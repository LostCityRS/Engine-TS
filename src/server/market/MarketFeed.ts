import Environment from '#/util/Environment.js';
import { printWarning } from '#/util/Logger.js';

import { type MarketCardListing, renderMarketCard, commas } from '#/server/market/MarketCard.js';

// THE PUBLIC MARKET FEED (custom, 2026-11-09). When somebody lists an item, a card for it goes to a
// Discord channel.
//
// This is the other half of server/discord/DiscordThread.ts, which has always been private: that
// one DMs a SELLER their own notices and lets them accept an offer from their phone. Nothing told
// anybody else that a thing was for sale, so the market only worked for people already standing at
// it.
//
// A WEBHOOK, NOT THE BOT. The bot is a gateway connection with a link table and a confirmation
// flow, and it is in a worker for good reasons; posting a picture to one channel needs none of
// that. A webhook URL is one HTTP POST, works whether or not the bot is configured, and if Discord
// is down the game does not notice. The URL IS A SECRET - anyone holding it can post to the channel
// as the server - so it lives in .env, is never printed, and never appears in a commit.
//
// NOTHING HERE RUNS ON THE TICK except the first line of post(). The card is drawn and the request
// is sent on the timer below, off the back of the queue, and every failure is swallowed: a market
// that stops working because Discord rate-limited us would be a bad trade.
//
// THE THROTTLE IS THE POINT OF THE QUEUE. A feed that posts every listing the instant it is made is
// a feed people mute, and on a busy evening it would be hundreds. One card every MARKET_FEED_EVERY
// milliseconds, and a listing worth less than MARKET_FEED_MIN never goes at all. When more arrive
// than the timer can send, the CHEAPEST waiting card is dropped rather than the newest - a backlog
// should lose the bronze daggers, not the whale.

/**
 * One card to one webhook. The only place the multipart is built, so the preview tool and the live
 * feed cannot disagree about what Discord is sent - which matters, because the tool is what gets
 * used to prove a new webhook works and a tool that posts a DIFFERENT shape proves nothing.
 *
 * The URL is never logged by anything that calls this.
 */
export async function postCard(url: string, png: Buffer): Promise<Response> {
    const form = new FormData();
    // The card says everything, so the message IS the card. An embed carries it rather than a bare
    // attachment only so the stripe down its left can be the server's red, which is the same
    // gesture the card itself makes.
    form.set(
        'payload_json',
        JSON.stringify({
            embeds: [
                {
                    color: 0xb83228, // --blood, as globals.css has it
                    image: { url: 'attachment://listing.png' }
                }
            ],
            // Nothing in a listing is a mention, but a seller could be called @everyone.
            allowed_mentions: { parse: [] }
        })
    );
    // Copied into a plain array first. A Buffer's backing store is typed as possibly shared and
    // BlobPart will not take that; a view onto it keeps the same type, so the copy is the fix
    // rather than a cast. It is five kilobytes once per card.
    const bytes = new Uint8Array(png.byteLength);
    bytes.set(png);
    form.set('files[0]', new Blob([bytes], { type: 'image/png' }), 'listing.png');
    return fetch(url, { method: 'POST', body: form });
}

type Pending = MarketCardListing & { value: number };

class MarketFeedImpl {
    private url = '';
    private minValue = 0;
    private every = 15000;
    private queue: Pending[] = [];
    private timer: NodeJS.Timeout | null = null;
    private broken = false;
    private dropped = 0;

    /** Off unless a webhook is configured. Reads the URL once and never logs it. */
    init(): void {
        this.url = Environment.MARKET_FEED_WEBHOOK;
        if (!this.url) {
            return;
        }
        this.minValue = Environment.MARKET_FEED_MIN;
        this.every = Math.max(1000, Environment.MARKET_FEED_EVERY);
        // Whether there is a URL, never the URL. "nothing under 0 gp" is not a sentence, and
        // this line is the only place the floor is ever stated out loud.
        const floor = this.minValue > 0 ? `nothing under ${commas(this.minValue)} gp` : 'every listing, whatever it is worth';
        console.log(`market feed: on, one card every ${Math.round(this.every / 1000)}s, ${floor}`);
    }

    get enabled(): boolean {
        return this.url !== '' && !this.broken;
    }

    /**
     * A listing was made. Returns immediately; the card is drawn later, off the tick.
     *
     * `value` is what the listing is worth for the purpose of the threshold - the buyout where
     * there is one, and the shop value of the lot where there is not. The caller works it out
     * because the caller is the one holding ObjType.
     */
    post(listing: Pending): void {
        if (!this.enabled || listing.value < this.minValue) {
            return;
        }
        this.queue.push(listing);
        // A cap, so a scripted flood cannot make the queue the leak. Cheapest first out.
        const CAP = 50;
        if (this.queue.length > CAP) {
            this.queue.sort((a, b) => b.value - a.value);
            this.dropped += this.queue.length - CAP;
            this.queue.length = CAP;
        }
        this.start();
    }

    private start(): void {
        if (this.timer || !this.queue.length) {
            return;
        }
        this.timer = setTimeout(() => {
            this.timer = null;
            this.drain();
        }, this.every);
        // The world should not be held open by a market card.
        this.timer.unref?.();
    }

    private drain(): void {
        const next = this.queue.shift();
        if (next) {
            void this.send(next);
        }
        if (this.dropped > 0 && !this.queue.length) {
            printWarning(`market feed: ${this.dropped} listing(s) went unposted while the queue was full.`);
            this.dropped = 0;
        }
        this.start();
    }

    private async send(listing: Pending): Promise<void> {
        try {
            const res = await postCard(this.url, renderMarketCard(listing));
            if (!res.ok) {
                // 429 is Discord asking us to slow down, and the honest answer is to post less
                // often rather than to retry into the same wall.
                printWarning(`market feed: Discord answered ${res.status} (URL withheld).`);
                if (res.status === 429) {
                    this.every = Math.min(this.every * 2, 300000);
                }
            }
        } catch (err) {
            // A feed is a nicety. It must never be able to take the world down, so one bad card
            // turns the whole thing off rather than throwing every fifteen seconds for ever.
            this.broken = true;
            this.queue.length = 0;
            printWarning(`market feed: turned off after an error - ${String((err as { message?: unknown })?.message ?? err)}`);
        }
    }
}

export const MarketFeed = new MarketFeedImpl();
