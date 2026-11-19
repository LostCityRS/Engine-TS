import { renderBroadcastCard, splitBroadcast } from '#/server/broadcast/BroadcastCard.js';
import { postCard } from '#/server/market/MarketFeed.js';
import Environment from '#/util/Environment.js';

// The world's announcements, as cards, in a Discord channel. The market feed's twin and built the
// same way: a webhook, a card drawn in Node, and a timer so a busy evening is still readable.
//
// NOTHING HERE RUNS ON THE TICK except the first line of post(). The card is drawn and sent off the
// timer, and every failure is swallowed - a world that stalls because Discord rate-limited us would
// be a bad trade for a channel.
//
// WHAT GOES, AND WHAT MUST NOT. Everything that reaches every player in game goes through one of
// two methods on World, and they do not divide the way this feed needs:
//
//   broadcastMilestone   milestones only. Clean, so it all goes.
//   BROADCAST_MES (op)   rare drops, pets and capes - AND content's own yell and staff
//                        announcement procs, which share the op.
//
// So news is filtered, and a player's yell is the thing that must never leak into a public channel.
// It is guarded twice, independently: the message has to carry the news colour (@or1@, which
// content's broadcast.rs2 uses for news and nothing else - its own comment says the cyan of a yell
// is there "to tell it apart from the gold of the news"), and the label has to not be one of the
// two that are never news. Either test alone would do. A yell in this channel is the kind of
// mistake that cannot be taken back, so it gets both.
//
// THE RESTART COUNTDOWN AND ::broadcast ARE OUT BY CONSTRUCTION, because they call
// World.broadcastMes directly rather than going through the op. Nothing had to be written to
// exclude them, and if that ever changes the colour test still catches them.

/** The colour content gives news, and gives nothing else. */
const NEWS_COLOUR = '@or1@';

/** Labels that are never news, whatever colour they arrive in. */
const NEVER = ['[yell]', '[announcement]'];

type Pending = { label: string; sentence: string; kind: string };

class BroadcastFeedImpl {
    private url = '';
    private every = 5000;
    private queue: Pending[] = [];
    private timer: NodeJS.Timeout | null = null;
    private broken = false;
    private dropped = 0;

    /** Off unless a webhook is configured. Reads the URL once and never logs it. */
    init(): void {
        this.url = Environment.BROADCAST_FEED_WEBHOOK;
        if (!this.url) {
            return;
        }
        this.every = Math.max(1000, Environment.BROADCAST_FEED_EVERY);
        // Whether there is a URL, never the URL.
        console.log(`broadcast feed: on, one card every ${Math.round(this.every / 1000)}s`);
    }

    get enabled(): boolean {
        return this.url !== '' && !this.broken;
    }

    /** A milestone: a 99, a total level, a max cape, a server first. All of them go. */
    milestone(raw: string): void {
        this.queueIt(raw, 'milestone');
    }

    /**
     * A broadcast from the content op, which is news only - see the note at the top for the two
     * guards and why there are two of them.
     */
    news(raw: string): void {
        if (!raw.includes(NEWS_COLOUR)) {
            return;
        }
        this.queueIt(raw, 'world broadcast');
    }

    private queueIt(raw: string, kind: string): void {
        if (!this.enabled) {
            return;
        }
        const parts = splitBroadcast(raw);
        // Not a line either proc wrote. Dropped rather than drawn with an empty badge.
        if (!parts) {
            return;
        }
        if (NEVER.includes(parts.label.toLowerCase())) {
            return;
        }
        this.queue.push({ ...parts, kind });
        // A cap, so a flood cannot make the queue the leak. OLDEST out, unlike the market's
        // cheapest: there is no value to rank these by, and a backlog should lose the announcement
        // nobody is still talking about rather than the one that just happened.
        const CAP = 40;
        if (this.queue.length > CAP) {
            this.dropped += this.queue.length - CAP;
            this.queue = this.queue.slice(-CAP);
        }
        this.start();
    }

    private start(): void {
        if (this.timer || this.queue.length === 0) {
            return;
        }
        this.timer = setInterval(() => void this.tick(), this.every);
        // The timer must not be what keeps the process alive at shutdown.
        this.timer.unref?.();
    }

    private async tick(): Promise<void> {
        const next = this.queue.shift();
        if (!next) {
            if (this.timer) {
                clearInterval(this.timer);
                this.timer = null;
            }
            if (this.dropped > 0) {
                console.log(`broadcast feed: ${this.dropped} card(s) dropped to keep up`);
                this.dropped = 0;
            }
            return;
        }
        try {
            const res = await postCard(this.url, renderBroadcastCard(next));
            if (!res.ok) {
                // 404 is a webhook that has been deleted, and it will never come back on its own:
                // stop rather than posting into a hole every few seconds for the rest of the day.
                if (res.status === 404 || res.status === 401) {
                    this.broken = true;
                    this.queue.length = 0;
                    console.error(`broadcast feed: off - the webhook answered ${res.status}`);
                } else {
                    console.error(`broadcast feed: Discord answered ${res.status}`);
                }
            }
        } catch (err) {
            console.error(`broadcast feed: ${err instanceof Error ? err.message : err}`);
        }
    }
}

export const BroadcastFeed = new BroadcastFeedImpl();
