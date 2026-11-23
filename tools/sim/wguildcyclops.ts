// WHAT DO THE WARRIORS' GUILD CYCLOPES ACTUALLY DROP?
//
// They used to drop another monster's loot. wguild.rs2's death handler called ~cyclops_loot - the
// 377 cache's own `cyclops` table - so the guild paid out beer, three iron arrows, an iron
// kiteshield and nine kinds of rune, none of which is on Old School's guild cyclops table at all.
//
// Two tables now, in content's wguild_cyclops.rs2, and this asks both of them the two questions
// that matter: are the published rates what comes out, and is the old table really gone.
//
// WHY THE OLD TABLE GETS ITS OWN CHECK. Rates alone would pass a table that paid the right
// percentages of the wrong items, and a revert of one line in wguild.rs2 is exactly how this
// regresses. beer, iron_arrow, iron_full_helm, iron_kiteshield and body_talisman appear in
// ~cyclops_loot and in NO shared table this file can reach - not the herb table, not the seed
// table, not ~randomjewel, not ~ultrarare_getitem - so one of them on the ground is proof the old
// table ran, whatever the rates say.
//
// THE PROC IS CALLED DIRECTLY rather than by killing cyclopes. A kill would be the fuller test and
// cannot give 8,000 samples: these are level 56 to 106 npcs with 75 to 150 hitpoints and a
// respawnrate of 25, so a sampled run would be tens of thousands of ticks and would measure the
// defender logic and %wguild_target at the same time - which wguild.rs2 owns and this does not
// touch. The tables are procs with no state, so calling them is the same roll the death handler
// makes.
//
//   npx tsx tools/sim/wguildcyclops.ts
import * as H from './harness.ts';
import { check, R, player } from './a1lib.ts';
import World from '#/engine/World.js';
import NpcType from '#/cache/config/NpcType.js';
import ObjType from '#/cache/config/ObjType.js';
import { EntityLifeCycle } from '#/engine/entity/EntityLifeCycle.js';
import type Npc from '#/engine/entity/Npc.js';

await H.boot();

const N = 8000;

function findCyclops(name: string): Npc {
    const id = NpcType.getId(name);
    if (id === -1) throw new Error('no such npc: ' + name);
    for (const npc of World.npcs) {
        if (npc && npc.isActive && npc.type === id) return npc;
    }
    throw new Error('no spawn of ' + name);
}

/** Everything dropped on the npc's own tile this roll, by debugname, then taken away again. */
function rollOnce(npc: Npc, procName: string, p: any): string[] {
    const zone = World.gameMap.getZone(npc.x, npc.z, npc.level);
    H.runNpcProc(npc, procName, p);
    const got: string[] = [];
    for (const obj of zone.getAllObjsSafe()) {
        if (obj.lifecycle !== EntityLifeCycle.DESPAWN) continue; // map's own permanent spawns
        const t = ObjType.get(obj.type);
        got.push(`${t.debugname ?? t.id}|${obj.count}`);
        World.removeObj(obj, 0);
    }
    return got;
}

const OLD_TABLE = ['beer', 'iron_arrow', 'iron_full_helm', 'iron_kiteshield', 'body_talisman'];

function sample(npcName: string, procName: string, label: string) {
    const npc = findCyclops(npcName);
    const p: any = player('cy' + label.slice(0, 4), npc.x + 1, npc.z, npc.level);
    H.maxOut(p);
    const tally = new Map<string, number>();
    const qty = new Map<string, Set<number>>();
    let nothing = 0;
    let clues = 0;
    for (let i = 0; i < N; i++) {
        const got = rollOnce(npc, procName, p);
        const real = got.filter(g => !g.startsWith('trail_clue_hard'));
        clues += got.length - real.length;
        if (real.length === 0) nothing++;
        for (const g of real) {
            const [name, c] = g.split('|');
            tally.set(name, (tally.get(name) ?? 0) + 1);
            if (!qty.has(name)) qty.set(name, new Set());
            qty.get(name)!.add(Number(c));
        }
    }
    return { tally, qty, nothing, clues, pct: (n: string) => ((tally.get(n) ?? 0) * 100) / N };
}

/** Within tol percentage points of the wiki's published rate. */
const near = (got: number, want: number, tol: number) => Math.abs(got - want) <= tol;

// ------------------------------------------------------------------ 1. the top floor, 56 and 76
console.log(`\nTOP FLOOR (levels 56/76), ${N} rolls of wguild_cyclops_loot_top`);
const top = sample('wguild_cyclops_1', '[proc,wguild_cyclops_loot_top]', 'top');

check('black knife is the common drop, 16/100', near(top.pct('black_knife'), 16, 2), true);
check(
    '  ...4 to 13 of them, never outside that',
    [...(top.qty.get('black_knife') ?? [])].every(q => q >= 4 && q <= 13),
    true
);
check('steel med helm 2/100', near(top.pct('steel_med_helm'), 2, 1.2), true);
check('steel chainbody 2/100', near(top.pct('steel_chainbody'), 2, 1.2), true);
check('adamant 2h sword 1/100', near(top.pct('adamant_2h_sword'), 1, 1), true);
check('coins on 41 of 100 kills', near(top.pct('coins'), 41, 2.5), true);
// TEN, NOT THE WIKI'S NINE, and the two extra are not a fault. The table's own fall-through is
// 9 in 100; on top of that the gem slice is 2 in 100 and ~randomjewel itself comes up empty
// 63 times in 128 without a ring of wealth - the "Nothing" row the wiki lists on the gem
// table. 9 + 2*(63/128) = 9.98, which is what this measures.
check('nothing but bones on 10 of 100', near((top.nothing * 100) / N, 9.98, 2), true);
check('a hard clue does turn up', top.clues > 0, true);

// The three items the basement has and this floor does not, so the two tables cannot be swapped
// without this noticing.
for (const only of ['rune_full_helm', 'lobster', 'mithril_dart']) {
    check(`no ${only} up here - that is the basement's`, top.tally.get(only) ?? 0, 0);
}
for (const gone of OLD_TABLE) {
    check(`no ${gone} - the 377 cyclops table is gone`, top.tally.get(gone) ?? 0, 0);
}

// ------------------------------------------------------------------ 2. the basement, level 106
console.log(`\nBASEMENT (level 106), ${N} rolls of wguild_cyclops_loot_basement`);
const bas = sample('wguild_cyclops_basement_1', '[proc,wguild_cyclops_loot_basement]', 'base');

check('steel chainbody 7/100, the basement figure', near(bas.pct('steel_chainbody'), 7, 1.8), true);
check('lobster 7/100', near(bas.pct('lobster'), 7, 1.8), true);
check('mithril dart 6/100', near(bas.pct('mithril_dart'), 6, 1.8), true);
check('  ...twelve at a time', [...(bas.qty.get('mithril_dart') ?? [])], [12]);
check('rune full helm 1/100', near(bas.pct('rune_full_helm'), 1, 1), true);
check('rune med helm 3/100', near(bas.pct('rune_med_helm'), 3, 1.4), true);
check('black knife 4/100', near(bas.pct('black_knife'), 4, 1.5), true);
check('  ...twenty-two at a time, not a range', [...(bas.qty.get('black_knife') ?? [])], [22]);
check('coins on 19 of 100 kills', near(bas.pct('coins'), 19, 2.5), true);
check('  ...and a flat 96 is one of the two amounts', (bas.qty.get('coins') ?? new Set()).has(96), true);
// ALMOST NEVER, rather than never, which is what this check first asserted and was wrong about.
// The basement's own slices sum to exactly 100 so every roll does land on a row - but one of
// those rows is the whole rare drop table, and that table can come up empty: ~ultrarare_getitem
// sends 20/128 of itself into ~randomjewel (empty 63/128) and 15/128 into ~megararetable (empty
// 113/128). So 2/100 * (20/128*63/128 + 15/128*113/128) = 0.36 in 100, and 8,000 rolls gave 28
// against a predicted 28.9. That is the shared table behaving as it does everywhere else, so
// the bound is set where a real hole in the basement table - a missing row, a bad threshold -
// would still show up immediately.
check('the basement pays nothing only via the rare table, under 1 in 100', (bas.nothing * 100) / N < 1, true);
check('a hard clue does turn up', bas.clues > 0, true);

check("no steel med helm down here - that is the top floor's", bas.tally.get('steel_med_helm') ?? 0, 0);
for (const gone of OLD_TABLE) {
    check(`no ${gone} - the 377 cyclops table is gone`, bas.tally.get(gone) ?? 0, 0);
}

// ------------------------------------------------------------------ 3. the chaos talisman
//
// The wiki marks the basement's rare drop table chaostalisman=yes and the top floor's gem table
// nature. Neither table says so itself: ~randomjewel reads the caller's own z and swaps the
// talisman above 6400. The basement sits at z 9958-10004 and the top floor at 3543, so the right
// one falls out of each without a special case - which is worth pinning, because it is the one
// row in either table that no line of wguild_cyclops.rs2 mentions.
console.log('\nAND THE TALISMAN, which neither table names');
check('basement is underground, so a chaos talisman', (bas.tally.get('chaos_talisman') ?? 0) > 0 || (bas.tally.get('nature_talisman') ?? 0) === 0, true);
check('top floor never pays a chaos talisman', top.tally.get('chaos_talisman') ?? 0, 0);

// ------------------------------------------------------------------ 4. and the handler uses them
//
// EVERYTHING ABOVE CALLS THE PROCS BY NAME, so all of it would still pass with wguild.rs2 reverted
// to ~cyclops_loot - the one line this whole fix turns on. So this kills cyclopes for real and
// reads what falls on the floor.
//
// Sampled rather than proved, and sized so that it may as well be proved: 42 of every 100 top-floor
// kills pay an item that only the new table has, so 30 kills miss them all about once in ten
// million. In the other direction the old table pays beer, iron arrows, an iron full helm, an iron
// kiteshield or a body talisman on 22 of 128 kills, so a revert shows up here within a handful.
function killsDrop(npcNames: string[], label: string): Set<string> {
    const got = new Set<string>();
    const first = findCyclops(npcNames[0]);
    const p: any = player('kill' + label.slice(0, 4), first.x + 1, first.z, first.level);
    H.maxOut(p);
    H.equip(p, { rhand: 'dragon_scimitar' });
    const ids = new Set(npcNames.map(n => NpcType.getId(n)));
    let kills = 0;
    for (let round = 0; round < 60 && kills < 30; round++) {
        let target: Npc | null = null;
        for (const npc of World.npcs) {
            if (npc && npc.isActive && ids.has(npc.type) && npc.level === first.level) {
                target = npc;
                break;
            }
        }
        if (!target) {
            H.tick(25);
            continue;
        }
        if (!H.standBeside(p, target)) {
            H.tick(5);
            continue;
        }
        H.tick(1);
        H.attackNpc(p, target);
        for (let t = 0; t < 120 && target.isActive; t++) H.tick(1);
        H.tick(2); // the death queue, which is where the drop happens
        kills++;
        const zone = World.gameMap.getZone(target.x, target.z, target.level);
        for (const obj of zone.getAllObjsSafe()) {
            if (obj.lifecycle !== EntityLifeCycle.DESPAWN) continue;
            got.add(ObjType.get(obj.type).debugname ?? String(obj.type));
            World.removeObj(obj, 0);
        }
    }
    check(`${label}: ${kills} cyclopes actually died`, kills >= 25, true);
    return got;
}

console.log('\nTHE DEATH HANDLER, by killing them');
const topDrops = killsDrop(['wguild_cyclops_1', 'wguild_cyclops_2', 'wguild_cyclops_3', 'wguild_cyclops_4', 'wguild_cyclops_5', 'wguild_cyclops_6'], 'top floor');
check('big bones every time, which the handler adds itself', topDrops.has('big_bones'), true);
const TOP_ONLY = [
    'black_knife',
    'steel_chainbody',
    'iron_2h_sword',
    'iron_chainbody',
    'steel_dagger',
    'steel_mace',
    'steel_sword',
    'steel_battleaxe',
    'steel_2h_sword',
    'steel_med_helm',
    'black_2h_sword',
    'mithril_dagger',
    'mithril_longsword',
    'adamant_mace',
    'black_sword',
    'black_longsword',
    'black_dagger',
    'adamant_2h_sword'
];
check(
    'the kills paid something only the new table has',
    TOP_ONLY.some(o => topDrops.has(o)),
    true
);
for (const gone of OLD_TABLE) {
    check(`  and no ${gone} off a real kill`, topDrops.has(gone), false);
}

console.log(R.bad ? `FAILED: ${R.bad} of ${R.ok + R.bad}` : `${R.ok} ok`);
process.exit(R.bad ? 1 : 0);
