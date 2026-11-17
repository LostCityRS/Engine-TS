// EVERY PICKPOCKET SUCCESS RATE, against the figures the OSRS wiki publishes.
//
//   npx tsx tools/sim/pickpocketrates.ts
//
// "players are saying the failing rate on thieving is high" - and two of these were, by more than
// twenty percentage points. This is the check that says so in numbers rather than in feel.
//
// THE FORMULA IS THE ENGINE'S, not a reimplementation: stat_random (PlayerOps.ts) interpolates the
// stored low/high by level and rolls against 256.
//
//     value = floor(low * (99 - level) / 98) + floor(high * (level - 1) / 98) + 1
//     success when value > floor(random() * 256)
//
// so the chance is value/256, and at level 99 it collapses to (high + 1)/256. THAT +1 IS WHY THE
// STORED NUMBERS LOOK ONE SHORT of the wiki's: the wiki quotes 241/256 for a knight of Ardougne
// and the table here stores 240. Reading the stored value as the wiki's figure is the mistake this
// comment exists to prevent.
//
// WHAT IS PINNED, AND WHAT IS NOT. Level 99 is the anchor, because it depends only on `high` and
// the wiki publishes it for every one of these. The `low` end is not asserted: it is published for
// almost none of them, and inventing a figure to assert would make this a test of my arithmetic
// rather than of the game.
import fs from 'fs';
import path from 'path';
import Environment from '#/util/Environment.js';
import * as H from './harness.js';
import { check, R } from './a1lib.js';

await H.boot();

/** The chance stat_random gives at a level, as a percentage. */
const rate = (low: number, high: number, level: number) => (Math.min(Math.floor((low * (99 - level)) / 98) + Math.floor((high * (level - 1)) / 98) + 1, 256) / 256) * 100;

// Level 99 base rate, no cape, no diary, as the OSRS wiki publishes it. The source is named per
// row because they do not all come from the same page.
const WIKI99: Record<string, { pct: number; source: string }> = {
    pickpocket_man: { pct: 94.14, source: 'Man: 70.6% at 1, 94.1% at 99' },
    pickpocket_woman: { pct: 94.14, source: 'as Man' },
    pickpocket_farmer: { pct: 94.14, source: 'Thieving cape table' },
    pickpocket_warrior: { pct: 94.14, source: 'Thieving cape table' },
    pickpocket_rogue: { pct: 94.14, source: 'Thieving cape table' },
    pickpocket_master_farmer: { pct: 94.14, source: 'Master Farmer: 91/256 at 1, 241/256 at 99' },
    pickpocket_guard: { pct: 94.14, source: 'Thieving cape table' },
    pickpocket_knight_of_ardougne: { pct: 94.14, source: 'Knight of Ardougne: 51/256 at 1, 241/256 at 99' },
    pickpocket_watchman: { pct: 62.89, source: 'Thieving cape table, Yanille Watchman' },
    pickpocket_gnome: { pct: 68.75, source: 'Thieving cape table, gnome' },
    pickpocket_hero: { pct: 62.89, source: 'Thieving cape table, hero' },
    pickpocket_elf: { pct: 39.45, source: 'Elf (Thieving) chart, 101/256' }
};

// Read the rows from the content source: a dbrow is data, and this is the file a change lands in.
const src = fs.readFileSync(path.join(Environment.BUILD_SRC_DIR, 'scripts/skill_thieving/configs/pickpocking/pickpocket.dbrow'), 'utf8');
const rows = new Map<string, { low: number; high: number; level: number }>();
for (const block of src.split(/\n(?=\[)/)) {
    const name = block.match(/^\[([a-z0-9_]+)\]/)?.[1];
    const sc = block.match(/data=success_chance,(\d+),(\d+)/);
    const lv = block.match(/data=level,(\d+)/);
    if (name && sc && lv) rows.set(name, { low: +sc[1], high: +sc[2], level: +lv[1] });
}

console.log(`\n================ ${rows.size} POCKETS, AT LEVEL 99\n`);
console.log(`  ${'pocket'.padEnd(30)} ${'req'.padStart(3)} ${'low'.padStart(4)} ${'high'.padStart(5)}  ${'@req'.padStart(6)} ${'@99'.padStart(7)}  wiki`);
for (const [name, r] of [...rows].sort((a, b) => a[1].level - b[1].level)) {
    const want = WIKI99[name];
    const got = rate(r.low, r.high, 99);
    const mark = want ? (Math.abs(got - want.pct) < 0.1 ? 'ok ' : 'OFF') : '-- ';
    console.log(
        `  ${mark} ${name.padEnd(28)} ${String(r.level).padStart(3)} ${String(r.low).padStart(4)} ${String(r.high).padStart(5)}  ${rate(r.low, r.high, r.level).toFixed(1).padStart(5)}% ${got.toFixed(2).padStart(6)}%  ${want ? want.pct.toFixed(2) + '%' : 'not published'}`
    );
}

console.log('');
for (const [name, want] of Object.entries(WIKI99)) {
    const r = rows.get(name);
    if (!r) {
        check(`${name} exists in the table`, false, true);
        continue;
    }
    check(`${name} is ${want.pct}% at 99 (${want.source})`, Math.round(rate(r.low, r.high, 99) * 100) / 100, want.pct);
}

// Every row the wiki table above does not cover, so adding a pocket cannot slip past unnoticed.
const unchecked = [...rows.keys()].filter(n => !WIKI99[n]);
console.log(`\n  not pinned (no published figure found): ${unchecked.join(', ') || 'none'}`);

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
