/**
 * Post a card for every listing already on the trading post.
 *
 *   npx tsx tools/market/announce.ts                    what would be posted, and nothing else
 *   npx tsx tools/market/announce.ts --confirm          post them
 *   npx tsx tools/market/announce.ts --confirm --id 7   just that one
 *   npx tsx tools/market/announce.ts --confirm --every 5000
 *
 * WHY THIS EXISTS. The feed only hears about a listing at the moment it is made - TradingPostOps
 * calls it from the `listed` hook - so anything already on the board when the feed was off, or
 * under its floor, has no card and never will. MARKET_FEED_MIN went from 50,000 to nought on
 * 19 November 2026, which left every listing made before that worth less than 50,000 announced to
 * nobody. This is the one-off that catches them up, and it is worth keeping for the next time the
 * feed is off for an evening.
 *
 * IT READS THE MARKET READ-ONLY AND NEVER OPENS IT THROUGH TradingPost. The live world holds that
 * file; constructing TradingPost would run its pragmas and its CREATE TABLE IF NOT EXISTS against
 * a database another process is writing, to read one table. So this opens a read-only connection
 * and runs the same single SELECT browse('') runs - state 0, newest first. If that query ever
 * changes there, change it here; it is four columns and a WHERE, and the alternative is worse.
 *
 * THE QUEUE IS BYPASSED, DELIBERATELY. MarketFeed.post caps its queue at 50 and drops the CHEAPEST
 * when it overflows, which is right for a busy evening and exactly wrong here: the cheap ones are
 * the ones this is for. So each card is rendered and sent in turn, with the feed's own gap between
 * them, and nothing is ever silently left out.
 *
 * DRY RUN BY DEFAULT, because the number of cards about to arrive in a channel is the one thing
 * worth seeing before it happens.
 */
import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';

// World first, for the reason tools/server/account.ts gives at its own top import.
import World from '#/engine/World.js';

import ObjType from '#/cache/config/ObjType.js';
import { commas, renderMarketCard } from '#/server/market/MarketCard.js';
import { postCard } from '#/server/market/MarketFeed.js';
import Environment from '#/util/Environment.js';
import { toDisplayName } from '#/util/JString.js';

const args = process.argv.slice(2);
const confirm = args.includes('--confirm');

function flag(name: string, fallback: number): number {
    const at = args.indexOf(name);
    if (at === -1 || at + 1 >= args.length) {
        return fallback;
    }
    const n = Number(args[at + 1]);
    return Number.isFinite(n) ? n : fallback;
}

function die(message: string): never {
    console.error(`announce: ${message}`);
    process.exit(1);
}

// ---------------------------------------------------------------- the cache, for names and values
// account.ts says why this is reload() and not World.start(), and why an empty data/pack is a
// normal state rather than a broken install.
const noCache = 'data/pack is empty or missing, so there are no item names or shop values to read.\nBuild it first (npm run build), or start the server once, then run this again.';
if (!fs.existsSync('data/pack')) {
    die(noCache);
}
try {
    World.reload();
} catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        die(noCache);
    }
    throw err;
}
if (ObjType.count === 0) {
    die(noCache);
}

// ---------------------------------------------------------------- the listings
const file = `data/tradingpost/${Environment.NODE_PROFILE}.sqlite`;
if (!fs.existsSync(file)) {
    die(`${file} does not exist, so nothing has ever been listed on this world.`);
}

type Row = { id: number; seller: string; obj: number; count: number; buyout: number };

let rows: Row[];
try {
    const db = new DatabaseSync(file, { readOnly: true });
    try {
        rows = db.prepare('SELECT id, seller, obj, count, buyout FROM listing WHERE state = 0 ORDER BY created DESC, id DESC').all() as unknown as Row[];
    } finally {
        db.close();
    }
} catch (err) {
    // A read-only connection to a WAL database still needs to write the -shm beside it, so this
    // is usually a permission on the DIRECTORY rather than on the file.
    die(`could not read ${file}: ${err instanceof Error ? err.message : err}\nRun this as the user the server runs as, from the engine directory.`);
}

const only = flag('--id', -1);
const wanted = only === -1 ? rows : rows.filter(r => r.id === only);
if (only !== -1 && wanted.length === 0) {
    die(`no open listing with id ${only}. There ${rows.length === 1 ? 'is 1 open listing' : `are ${rows.length} open listings`}.`);
}

// The same value TradingPostOps hands the feed: the buyout where there is one, and the lot's shop
// value where there is not, because an offers-only listing has no price of its own.
const cards = wanted.map(r => {
    const type = ObjType.get(r.obj);
    return {
        card: {
            id: r.id,
            obj: r.obj,
            name: type?.name ?? type?.debugname ?? 'null',
            count: r.count,
            seller: r.seller,
            buyout: r.buyout
        },
        value: r.buyout > 0 ? r.buyout : (type?.cost ?? 0) * r.count
    };
});

if (cards.length === 0) {
    console.log('Nothing is listed, so there is nothing to announce.');
    process.exit(0);
}

console.log(`${cards.length} open listing${cards.length === 1 ? '' : 's'}:\n`);
for (const { card, value } of cards) {
    const lot = card.count > 1 ? `${commas(card.count)} x ${card.name}` : card.name;
    const price = card.buyout > 0 ? `${commas(card.buyout)} gp` : `offers (worth ${commas(value)})`;
    console.log(`  #${String(card.id).padEnd(5)} ${lot.padEnd(34)} ${price.padEnd(26)} ${toDisplayName(card.seller)}`);
}

if (!confirm) {
    console.log(`\nNothing was sent. Add --confirm to post ${cards.length === 1 ? 'this card' : `these ${cards.length} cards`}.`);
    process.exit(0);
}

if (!Environment.MARKET_FEED_WEBHOOK) {
    die('MARKET_FEED_WEBHOOK is not set in .env, so there is nowhere to post. Nothing was sent.');
}

// The feed's own spacing, so this reads in the channel like an ordinary evening rather than a dump.
const every = Math.max(0, flag('--every', Environment.MARKET_FEED_EVERY));
console.log(`\nPosting ${cards.length}, one every ${Math.round(every / 1000)}s. ${Math.ceil((cards.length * every) / 1000)}s in all.`);

let sent = 0;
for (const [at, { card }] of cards.entries()) {
    if (at > 0 && every > 0) {
        await new Promise(r => setTimeout(r, every));
    }
    try {
        const res = await postCard(Environment.MARKET_FEED_WEBHOOK, renderMarketCard(card));
        if (res.ok) {
            sent++;
            console.log(`  sent #${card.id} (${res.status})`);
        } else {
            // The body says why - a deleted webhook, a rate limit - and never contains the URL.
            console.error(`  FAILED #${card.id}: Discord answered ${res.status}. ${(await res.text()).slice(0, 200)}`);
        }
    } catch (err) {
        console.error(`  FAILED #${card.id}: ${err instanceof Error ? err.message : err}`);
    }
}

console.log(`\n${sent} of ${cards.length} posted.`);
process.exit(sent === cards.length ? 0 : 1);
