/**
 * Draw the broadcast cards without a world - to look at them, or to prove a webhook works.
 *
 *   npx tsx tools/broadcast/cardpreview.ts out            writes out-1.png, out-2.png, ...
 *   npx tsx tools/broadcast/cardpreview.ts out --post     and sends them to the channel
 *   npx tsx tools/broadcast/cardpreview.ts out --line '@sh1@@gre@[Milestone]@sh0@@bla@ ...'
 *
 * THE LINES ARE THE REAL ONES, copied from content/scripts/general/scripts/broadcast.rs2 and
 * milestones.rs2 with a name filled in - including the two that must NEVER reach the channel, so
 * that this also shows the filter doing its job rather than only the cards it lets through.
 *
 * --post SENDS to BROADCAST_FEED_WEBHOOK, read from .env like everything else. The URL is never
 * typed on the command line and never printed: a webhook url is a password, and a password in your
 * shell history is a password you have given away. It bypasses the queue, because this is "does
 * this URL reach that channel", asked once.
 */
import fs from 'fs';

// World first, for the reason tools/server/account.ts gives at its own top import.
import World from '#/engine/World.js';

import ObjType from '#/cache/config/ObjType.js';
import { renderBroadcastCard, splitBroadcast } from '#/server/broadcast/BroadcastCard.js';
import { postCard } from '#/server/market/MarketFeed.js';
import Environment from '#/util/Environment.js';

const args = process.argv.slice(2);
const out = args[0];
const post = args.includes('--post');
if (!out || out.startsWith('--')) {
    console.error('cardpreview: give an output prefix first, e.g. out');
    process.exit(1);
}

// account.ts says why this is reload() and not World.start(), and why an empty data/pack is a
// normal state rather than a broken install.
if (!fs.existsSync('data/pack')) {
    console.error('cardpreview: data/pack is empty or missing, so there are no item names to read.\nBuild it first (npm run build), or start the server once.');
    process.exit(1);
}
World.reload();

const at = args.indexOf('--line');
const custom = at !== -1 && at + 1 < args.length ? args[at + 1] : null;

// kind is what the feed would pass: milestones from one op, news from the other.
type PreviewLine = { kind: string; raw: string; feed: 'milestone' | 'news'; item?: string; skill?: string };

// THE ITEMS ARE NAMED, NOT NUMBERED, and that is the whole of what went wrong the first time: the
// samples carried ids typed from memory - 13342 for a max cape, 6499 for a baby mole - and this
// build has 8312 and no baby mole at all. The cards came out bare, which looked like the icon
// work being broken when it was only the preview lying about what it was drawing. A name is
// checked against the cache below and a miss is reported rather than quietly drawn without.
function objId(name: string): number {
    const id = ObjType.getId(name);
    if (id === -1) {
        console.error(`  no such obj: ${name} - that card will be drawn without a picture`);
    }
    return id;
}

const ALL: PreviewLine[] = [
    { kind: 'milestone', raw: '@sh1@@gre@[Server first!]@sh0@@bla@ Koda is the first to reach level @dre@99 Fishing@bla@.', feed: 'milestone', skill: 'Fishing' },
    { kind: 'milestone', raw: '@sh1@@gre@[Milestone]@sh0@@bla@ Explorer has reached level @dre@99 Woodcutting@bla@.', feed: 'milestone', skill: 'Woodcutting' },
    { kind: 'milestone', raw: '@sh1@@gre@[Milestone]@sh0@@bla@ Nsx has completed every quest in the game.', feed: 'milestone', item: 'quest_point_cape' },
    { kind: 'milestone', raw: '@sh1@@gre@[Server first!]@sh0@@bla@ Koda is the first to master every skill. @dre@Max cape@bla@!', feed: 'milestone', item: 'max_cape' },
    { kind: 'world broadcast', raw: '@sh1@@or1@Rare drop!@sh0@@bla@ Corey received @dre@Dragon chainbody@bla@.', feed: 'news', item: 'dragon_chainbody' },
    { kind: 'world broadcast', raw: "@sh1@@or1@Pet!@sh0@@bla@ Thalia has a funny feeling like they're being followed: @dre@Giant mole@bla@.", feed: 'news', item: 'bosspet_giant_mole_item' },
    { kind: 'world broadcast', raw: '@sh1@@or1@Fire cape!@sh0@@bla@ Moaz has defeated TzTok-Jad and claimed a @dre@Fire cape@bla@.', feed: 'news', item: 'tzhaar_cape_fire' },
    // The two that must not go. Drawn anyway, so the picture shows what is being withheld.
    { kind: 'world broadcast', raw: '@sh1@@cya@[Yell]@sh0@@bla@ Somebody: selling whip 3m, pm me', feed: 'news' },
    { kind: 'world broadcast', raw: '@sh1@@red@[Announcement]@sh0@@bla@ Corey: the world restarts in ten minutes.', feed: 'news' }
];

const LINES: PreviewLine[] = custom ? [{ kind: 'milestone', raw: custom, feed: 'milestone' }] : ALL;

// The feed's own rules, stated here rather than imported, so this tool says what it believes and a
// disagreement with BroadcastFeed shows up as a surprise in the output rather than being hidden by
// sharing the code under test.
const NEVER = ['[yell]', '[announcement]', '[new player]'];
function wouldPost(line: { raw: string; feed: string }): boolean {
    if (line.feed === 'news' && !line.raw.includes('@or1@')) {
        return false;
    }
    const parts = splitBroadcast(line.raw);
    return parts !== null && !NEVER.includes(parts.label.toLowerCase());
}

let n = 0;
const sending: { file: string; png: Buffer }[] = [];
for (const line of LINES) {
    const parts = splitBroadcast(line.raw);
    n++;
    if (!parts) {
        console.log(`  ${n}. NOT A BROADCAST LINE - no card: ${line.raw.slice(0, 60)}`);
        continue;
    }
    const png = renderBroadcastCard({ ...parts, kind: line.kind, obj: line.item ? objId(line.item) : -1, skill: line.skill ?? '' });
    const file = `${out}-${n}.png`;
    fs.writeFileSync(file, png);
    const verdict = wouldPost(line) ? 'would post' : 'WITHHELD';
    console.log(`  ${n}. ${verdict.padEnd(10)} ${file}  [${parts.label}] ${parts.sentence.slice(0, 48)}`);
    if (wouldPost(line)) {
        sending.push({ file, png });
    }
}

if (!post) {
    console.log(`\n${n} card(s) written. Add --post to send the ones marked "would post".`);
    process.exit(0);
}

if (!Environment.BROADCAST_FEED_WEBHOOK) {
    console.error('cardpreview: --post needs BROADCAST_FEED_WEBHOOK in .env. Nothing was sent.');
    process.exit(1);
}

for (const { file, png } of sending) {
    const res = await postCard(Environment.BROADCAST_FEED_WEBHOOK, png);
    if (res.ok) {
        console.log(`posted ${file} (${res.status})`);
    } else {
        // The body often says why, and none of it contains the URL.
        console.error(`posted ${file}: Discord answered ${res.status}. ${(await res.text()).slice(0, 200)}`);
    }
}
