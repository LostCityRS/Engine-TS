/**
 * How long a mined rock stays spent.
 *
 * mining_table's rock_respawnrate is in TICKS and a tick is 0.6 seconds. Every value in that
 * column was the wiki's figure divided by 0.3 instead, so every rock in the game took twice as
 * long to come back as it should - coal 30s as 100 ticks rather than 50, mithril 120s as 400,
 * runite 720s as 2400 - with the three fastest rounded up on top (iron 5.4s as 20 ticks, not 9).
 * A player timed iron and reported it as "almost double" (DeathPlateau-Bugs#33). It was double.
 *
 * TWO KINDS OF CHECK, because either alone would have missed it. Section 1 reads the table, which
 * is the only way to cover all ten ores: runite's correct respawn is 1,200 ticks and nobody is
 * going to mine one in a sim for every change. Section 2 mines three rocks and counts, which is
 * the only way to know the column is what drives the respawn at all - a number can be right in a
 * table nothing reads.
 */
import * as H from './harness.js';
import { check, R, player } from './a1lib.js';
import DbTableType from '#/cache/config/DbTableType.js';
import DbRowType from '#/cache/config/DbRowType.js';
import World from '#/engine/World.js';

await H.boot();

// mine.dbtable's column order: rock, ore_name, rock_output, rock_level, rock_exp,
// rock_successchance, rock_respawnrate, pet_base.
const COL_ORE_NAME = 1;
const COL_RESPAWN = 6;

// The wiki's respawn for each ore, in ticks: seconds / 0.6, written out so the arithmetic that
// caused the bug is visible rather than implied.
const WIKI_TICKS: Record<string, [number, string]> = {
    clay: [2, '1.2s'],
    copper: [4, '2.4s'],
    tin: [4, '2.4s'],
    iron: [9, '5.4s'],
    coal: [50, '30s'],
    silver: [100, '60s'],
    gold: [100, '60s'],
    mithril: [200, '2 min'],
    adamantite: [400, '4 min'],
    runite: [1200, '12 min']
};

// ---- 1. the table, for every ore the wiki publishes a figure for -----------------------------
const rows = DbRowType.getInTable(DbTableType.getId('mining_table'));
const seen = new Set<string>();
for (const row of rows) {
    const ore = String((row.getValue(COL_ORE_NAME, 0) ?? [''])[0]);
    const want = WIKI_TICKS[ore];
    if (!want) continue; // blurite, the gem rocks and rune essence - no wiki figure to hold them to
    seen.add(ore);
    const got = Number((row.getValue(COL_RESPAWN, 0) ?? [-1])[0]);
    check(`${ore} respawns in ${want[0]} ticks (${want[1]} on the wiki)`, got, want[0]);
}
check('and all ten ores were found in the table', seen.size, Object.keys(WIKI_TICKS).length);

// ---- 2. and the column really drives it ------------------------------------------------------
function mineAndWait(who: string, rock: string, ore: string, near: [number, number]) {
    const spot = H.locsNear(rock, near[0], near[1], 0)[0];
    if (!spot) throw new Error('no ' + rock + ' near ' + near);
    const p = player(who, spot.x + 1, spot.z, 0);
    H.maxOut(p);
    H.give(p, 'rune_pickaxe', 1);
    H.equip(p, { rhand: 'rune_pickaxe' });

    H.opLoc(p, spot.x, spot.z, rock, 1);
    let mined = false;
    for (let t = 0; t < 60 && !mined; t++) {
        H.tick(1);
        mined = H.invCount(p, ore) > 0;
    }
    if (!mined) throw new Error(rock + ' would not mine');

    let gap = 0;
    while (!H.locAt(0, spot.x, spot.z, rock) && gap < 4000) {
        H.tick(1);
        gap++;
    }
    return { gap, at: `${spot.x},${spot.z}` };
}

// Iron first, and at the rock the report came from: the reporter stood at 2692,3329 and ironrock1
// is one tile away at 2692,3328. Then one mid and one slow rock, so the check is not pinned to a
// single magnitude.
//
// CLAY IS DELIBERATELY NOT HERE. Its correct respawn is 2 ticks, which scales to 1, and a window
// of "within three ticks of 1" is satisfied by every possible result including 0 - a check that
// cannot fail. The fast rocks are covered by section 1 instead, where the number is exact.
const DRIVEN: [string, string, string, [number, number]][] = [
    ['iron', 'ironrock1', 'iron_ore', [2692, 3329]],
    ['coal', 'coalrock1', 'coal', [3140, 3150]],
    ['mithril', 'mithrilrock1', 'mithril_ore', [3020, 3340]]
];
for (const [ore, rock, obj, near] of DRIVEN) {
    const want = WIKI_TICKS[ore][0];
    // World.removeNpc's sibling: the stored rate goes through scale_by_playercount, which only
    // ever shortens it and by under a tick here. The count starts the tick after the ore lands,
    // so this is a window rather than an exact figure - but a window far too narrow for the old
    // doubled rate to sit in, which is the regression that matters.
    const scaled = World.scaleByPlayerCount(want);
    const r = mineAndWait('mn_' + ore, rock, obj, near);
    check(`${rock} at ${r.at} is back in ${scaled - 3}..${scaled} ticks (got ${r.gap})`, r.gap >= scaled - 3 && r.gap <= scaled, true);
    // Name the bug, so a regression says which one came back rather than only that a number moved.
    check(`and not on the old doubled rate (got ${r.gap}, was about ${want * 2})`, r.gap < want * 2 - 2, true);
}

console.log(R.bad ? `FAILED: ${R.bad} of ${R.ok + R.bad}` : `${R.ok} ok`);
process.exit(R.bad ? 1 : 0);
