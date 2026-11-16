// THE EXACT TEXT OF EVERY NEW MILESTONE BROADCAST, written out for the client to photograph.
//
//   npx tsx tools/sim/milestonelines.ts [outfile]
//
// WHY THIS EXISTS RATHER THAN THE LINES BEING TYPED INTO THE SHOT HARNESS. What a broadcast looks
// like is a client question - the colours are tags it turns into pixels and the badges are sprites
// it substitutes - but what a broadcast SAYS is a server question, and the two have to be the same
// string or the photograph is of something nobody will ever see. So the server produces them here,
// through the real procs, and the client is handed the result.
//
// It also cannot be done end-to-end any more, which is the other reason. Every way to reach these
// lines from inside the game is a staff command, and a staff command now marks the account and
// mutes it - deliberately. A sim is the only thing left that can make a non-staff account earn
// 200m experience.
import fs from 'fs';
import * as H from './harness.js';
import Player, { getExpByLevel } from '#/engine/entity/Player.js';
import { PlayerStatMap } from '#/engine/entity/PlayerStat.js';
import { MilestoneStore } from '#/engine/MilestoneStore.js';
import EnumType from '#/cache/config/EnumType.js';

const OUT = process.argv[2] ?? 'milestonelines.txt';

await H.boot();
H.loginOrder();
MilestoneStore.reset();

const LABELS = ['[Milestone]', '[Server first!]', '[New player]'];
const watcher = H.makePlayer('onlooker', 3222, 3218);
H.loginOrder(watcher);
H.tick(1);

/** Every milestone line the onlooker has seen since the last clear, in order. */
const seen = () => H.mesgs.filter(m => m.who === watcher.username && LABELS.some(l => m.text.includes(l))).map(m => m.text);

let spawned = 0;
const player = (name: string): Player => {
    const p = H.makePlayer(name, 3223 + (spawned++ % 4), 3218);
    H.loginOrder(p);
    H.setVar(p, 'option_levelup', 1); // the popup is a modal and blocks the engine queue
    H.tick(1);
    return p;
};
const levelTo = (p: Player, stat: string, level: number) => {
    const id = PlayerStatMap.get(stat.toUpperCase())!;
    const want = getExpByLevel(level);
    if (want > p.stats[id]) p.addXp(id, want - p.stats[id], false);
    H.tick(6);
};
const xpTo = (p: Player, stat: string, xp: number) => {
    const id = PlayerStatMap.get(stat.toUpperCase())!;
    if (xp > p.stats[id]) p.addXp(id, xp - p.stats[id], false);
    H.tick(6);
};

const groups: { title: string; lines: string[] }[] = [];
const capture = (title: string, body: () => void) => {
    H.clearLogs();
    body();
    H.tick(4);
    const lines = seen();
    groups.push({ title, lines });
    console.log(`${title}: ${lines.length} line(s)`);
    for (const l of lines) console.log(`   ${l}`);
};

const first = player('oakleaf');
const second = player('brightmoor');

// The 99s first and OUTSIDE the captures: they are a shipped line, not one of the new ones, and
// taking a skill to 50m takes it through 99 on the way.
levelTo(first, 'fishing', 99);
levelTo(second, 'fishing', 99);
levelTo(first, 'woodcutting', 99);

capture('Experience: a server first, and the same tier for the next player', () => {
    xpTo(first, 'fishing', 500_000_000);
    xpTo(second, 'fishing', 500_000_000);
});

capture('Experience: the rungs after it, and the cap', () => {
    xpTo(first, 'fishing', 1_000_000_000);
    xpTo(first, 'fishing', 1_500_000_000);
    xpTo(first, 'woodcutting', 2_000_000_000);
});

capture('The collection log: a page, and the whole thing', () => {
    const items = EnumType.getByName('collection_log_items')!;
    for (const item of items.values.values()) {
        H.runProc(first, '[proc,collection_log_add]', [item as number, 1]);
    }
});

// The whole-log run produces a line per page; keep the shortest page name, the longest (which is
// what proves nothing wraps), and the log itself.
const clog = groups[groups.length - 1];
const whole = clog.lines.filter(l => l.includes('entire collection log'));
const pages = clog.lines.filter(l => !l.includes('entire collection log'));
const longest = pages.reduce((a, b) => (b.length > a.length ? b : a), pages[0]);
clog.lines = [pages.find(l => l.includes('Giant Mole')) ?? pages[0], longest, ...whole].filter(Boolean);

// Plain text rather than JSON because the only consumer is a Java shot harness with no json
// parser in it: "## " starts a group, every other non-empty line is one broadcast.
fs.writeFileSync(OUT, groups.map(g => `## ${g.title}\n${g.lines.join('\n')}`).join('\n\n') + '\n');
console.log(`\nwrote ${OUT}`);
process.exit(0);
