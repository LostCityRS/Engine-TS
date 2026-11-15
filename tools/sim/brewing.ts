// ALE BREWING, which the 377 cache shipped as two finished breweries nobody could use: the vats,
// barrels, valves, apple presses, both brewers and the whole Port Phasmatys cellar are placed on
// the map, and not one click was answered. The trapdoor in the pub floor had op1=Open and no
// script behind it, so the cellar - vat, barrel, press, Metarialus and all - had never been
// reachable at all.
//
//   npx tsx tools/sim/brewing.ts
import * as H from './harness.js';
import Player from '#/engine/entity/Player.js';
import World from '#/engine/World.js';
import LocType from '#/cache/config/LocType.js';
import NpcType from '#/cache/config/NpcType.js';
import ParamType from '#/cache/config/ParamType.js';
import ObjType from '#/cache/config/ObjType.js';
import Component from '#/cache/config/Component.js';
import ScriptState from '#/engine/script/ScriptState.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import { Interaction } from '#/engine/entity/Interaction.js';
import { findPathToLoc } from '#/engine/GameMap.js';

await H.boot();

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

function settle(p: Player, picks: number[] = [], max = 80) {
    let idle = 0;
    for (let g = 0; g < max; g++) {
        const s = p.activeScript;
        if (s && s.execution === ScriptState.PAUSEBUTTON) {
            idle = 0;
            const names = p.resumeButtons.map((id: number) => Component.get(id).comName ?? '');
            const open = p.modalChat === -1 ? '' : (Component.get(p.modalChat).comName ?? '');
            const multi = open.startsWith('multi') ? names.find((n: string) => n.startsWith(open + ':')) : null;
            if (multi) {
                const pick = picks.shift();
                if (pick === undefined) throw new Error('unexpected menu: ' + names.join(','));
                const byName = names.find((n: string) => n === `${open}:com_${pick}`);
                H.choose(p, byName ?? names[pick]);
                continue;
            }
            p.executeScript(s, true, true);
            continue;
        }
        H.tick(1);
        if (!p.activeScript && !p.target && !p.delayed && p.queue.head() === null) {
            if (++idle >= 3) break;
        } else idle = 0;
    }
    if (picks.length) throw new Error('menus not reached: ' + picks.join(','));
}

// ------------------------------------------------------------------ the two breweries
// Every coordinate here was read off the map, not off a wiki page. The tile each click is made from
// is a measured walkable one: the brewery rooms are tight and the vat is 2x2.
const KELDAGRIM = {
    level: 1,
    from: [2916, 10192] as [number, number],
    vat: [2917, 10194] as [number, number],
    barrel: [2917, 10193] as [number, number],
    valve: [2918, 10193] as [number, number],
    press: [2914, 10192] as [number, number],
    tap: [2915, 10192] as [number, number]
};
const PHASMATYS = {
    level: 0,
    from: [3678, 9960] as [number, number],
    vat: [3679, 9961] as [number, number],
    barrel: [3679, 9960] as [number, number],
    valve: [3680, 9960] as [number, number],
    press: [3676, 9958] as [number, number],
    tap: [3677, 9958] as [number, number]
};
const VAT_1 = 'brewing_vat_varbit_1';
const BARREL_1 = 'brewing_barrel_varbit_1';

const locAt = (x: number, z: number, level: number, name: string) => {
    const loc = World.getLoc(x, z, level, LocType.getId(name));
    if (!loc) throw new Error(`no ${name} at ${x},${z},${level}`);
    return loc;
};
const slotOf = (p: any, objName: string): number => {
    const inv = p.getInventory(93)!;
    const id = ObjType.getId(objName);
    for (let i = 0; i < inv.capacity; i++) if (inv.get(i)?.id === id) return i;
    throw new Error('not carrying ' + objName);
};
const heard = (fn: () => void): string => {
    const mark = H.mesgs.length;
    const faces = H.ifaces.length;
    fn();
    return H.ifaces
        .slice(faces)
        .filter(i => i.kind === 'text' && i.text)
        .map(i => i.text!)
        .concat(H.mesgs.slice(mark).map(m => m.text))
        .join(' ');
};
const stand = (p: any, at: [number, number], level: number) => {
    p.teleport(at[0], at[1], level);
    H.tick(1);
    p.clearPendingAction();
};
/** Use an item on a loc, walking to it from a tile a player can actually stand on. */
const useOn = (p: any, objName: string, at: [number, number], locName: string, level: number, from: [number, number]): string => {
    const loc = locAt(at[0], at[1], level, locName);
    return heard(() => {
        stand(p, from, level);
        p.lastUseItem = ObjType.getId(objName);
        p.lastUseSlot = slotOf(p, objName);
        p.queueWaypoints(findPathToLoc(level, p.x, p.z, loc.x, loc.z, p.width, loc.width, loc.length, loc.angle, loc.shape, LocType.get(loc.type).forceapproach));
        p.setInteraction(Interaction.ENGINE, loc, ServerTriggerType.APLOCU);
        p.opcalled = true;
        settle(p);
    });
};
const clickLoc = (p: any, at: [number, number], locName: string, level: number, from: [number, number], op = 1): string =>
    heard(() => {
        stand(p, from, level);
        H.opLoc(p, at[0], at[1], locName, op);
        settle(p);
    });

const p: any = H.makePlayer('brewer', 2916, 10192);
H.tick(1);
H.maxOut(p);
H.clearInv(p);
H.tick(2);
p.closeModal();

const vat = () => H.getVarBit(p, VAT_1);
const barrel = () => H.getVarBit(p, BARREL_1);
const nowMinute = () => Math.max(0, Math.floor((Date.now() - Date.UTC(2025, 0, 1)) / 60000));
// The cycle the content actually uses: Old School's 640 minutes, halved by the same rule farming's
// suggestion #22 applies to anything that runs past three hours.
const CYCLE = 320;
/** Put the running brew's clock N cycles into the past and let the content resolve it. */
const ageBrew = (cycles: number) => {
    H.setVar(p, 'brewing_time_1', Math.max(1, nowMinute() - cycles * CYCLE));
    H.runProc(p, '[proc,brew_update]', [1], undefined, true);
};
const cook = () => p.stats[7]; // 7 is Cooking

// ------------------------------------------------------------------ what the cache had
console.log('');
console.log('TWO BREWERIES, BUILT AND FURNISHED, WITH NOTHING BEHIND A SINGLE CLICK');
for (const [who, b, names] of [
    ['Keldagrim', KELDAGRIM, ['brewing_vat_1', 'brewing_barrel_1', 'vat_valve_1']],
    ['Port Phasmatys', PHASMATYS, ['brewing_vat_2', 'brewing_barrel_2', 'vat_valve_2']]
] as [string, typeof KELDAGRIM, string[]][]) {
    check(
        `${who}: vat, barrel and valve all placed`,
        [World.getLoc(b.vat[0], b.vat[1], b.level, LocType.getId(names[0])) !== null, World.getLoc(b.barrel[0], b.barrel[1], b.level, LocType.getId(names[1])) !== null, World.getLoc(b.valve[0], b.valve[1], b.level, LocType.getId(names[2])) !== null],
        [true, true, true]
    );
    check(
        '  and the apple press beside it',
        [World.getLoc(b.press[0], b.press[1], b.level, LocType.getId('farming_applebarrel_empty')) !== null, World.getLoc(b.tap[0], b.tap[1], b.level, LocType.getId('farming_applebarrel_tap')) !== null],
        [true, true]
    );
}
check(
    'the valve says Turn, and the barrel says Level or Drain depending on what is in it',
    [(LocType.get(LocType.getId('vat_valve_1')).op ?? [])[0], (LocType.get(LocType.getId('barrel_dwarven_stout')).op ?? [])[0], (LocType.get(LocType.getId('barrel_bad_ale')).op ?? [])[0]],
    ['Turn', 'Level', 'Drain']
);
// Both brewers wander, so the check is that each is in his own brewery, not on a particular tile.
check(
    'both brewers are in their own breweries',
    [
        ['blandebir', 2916, 10195, 1],
        ['metarialus', 3678, 9958, 0]
    ].map(([n, x, z, lv]) => {
        const id = NpcType.getId(n as string);
        for (const npc of World.npcs) {
            if (!npc || !npc.isActive || npc.type !== id) continue;
            return npc.level === lv && Math.abs(npc.x - (x as number)) <= 5 && Math.abs(npc.z - (z as number)) <= 5;
        }
        return 'missing';
    }),
    [true, true]
);
check(
    'and every one of those clicks has a trigger now',
    [
        ScriptProvider.getByTrigger(ServerTriggerType.OPLOCU, LocType.getId('brewing_vat_1'), -1) !== null,
        ScriptProvider.getByTrigger(ServerTriggerType.OPLOC1, LocType.getId('vat_valve_1'), -1) !== null,
        ScriptProvider.getByTrigger(ServerTriggerType.OPLOC1, LocType.getId('brewing_barrel_1'), -1) !== null,
        ScriptProvider.getByTrigger(ServerTriggerType.OPLOC1, LocType.getId('phasmatys_brewery_trapdoor'), -1) !== null
    ],
    [true, true, true, true]
);

// ------------------------------------------------------------------ the cellar
console.log('');
console.log('THE TRAPDOOR IN THE PUB FLOOR, WHICH HAD NEVER OPENED');
// forceapproach=13 on the trapdoor leaves exactly one side open: from anywhere else in the pub the
// click is "I can't reach that!", which is why the ladder lands you on that tile and not beside it.
let said = clickLoc(p, [3681, 3498], 'phasmatys_brewery_trapdoor', 0, [3681, 3499]);
check('the trapdoor can only be opened from the south', [p.z, said.includes("can't reach")], [3499, true]);
clickLoc(p, [3681, 3498], 'phasmatys_brewery_trapdoor', 0, [3681, 3497]);
check('  and from there you are in the brewery cellar', [p.x, p.z, p.level], [3681, 9962, 0]);
clickLoc(p, [3682, 9962], 'phasmatys_brewery_ladder', 0, [3681, 9962]);
check('  while the ladder puts you back on the one tile the trapdoor answers from', [p.x, p.z, p.level], [3681, 3497, 0]);

// ------------------------------------------------------------------ the ingredients you make
console.log('');
console.log('MALTING BARLEY, AND CRUSHING APPLES');
H.give(p, 'barley', 1);
let xp = cook();
said = useOn(p, 'barley', [3230, 3196], 'range', 0, [3230, 3197]);
check('barley roasted on a range comes out as malt, and pays nothing', [H.invCount(p, 'barley_malt'), H.invCount(p, 'barley'), cook() - xp, said.includes('roast the barley')], [1, 0, 0, true]);

H.clearInv(p);
H.give(p, 'cooking_apple', 4);
said = useOn(p, 'cooking_apple', KELDAGRIM.press, 'farming_applebarrel_empty', KELDAGRIM.level, KELDAGRIM.from);
check('four apples with no bucket to catch it in gets you nowhere', [H.invCount(p, 'apple_mush'), said.includes('empty bucket')], [0, true]);
H.give(p, 'bucket_empty', 1);
useOn(p, 'cooking_apple', KELDAGRIM.press, 'farming_applebarrel_empty', KELDAGRIM.level, KELDAGRIM.from);
check('four apples and a bucket make one bucket of apple mush', [H.invCount(p, 'apple_mush'), H.invCount(p, 'cooking_apple'), H.invCount(p, 'bucket_empty')], [1, 0, 0]);
H.give(p, 'cooking_apple', 4);
H.give(p, 'bucket_empty', 1);
useOn(p, 'bucket_empty', KELDAGRIM.tap, 'farming_applebarrel_tap', KELDAGRIM.level, KELDAGRIM.from);
check('  and the tap does the same job as the barrel', H.invCount(p, 'apple_mush'), 2);

// ------------------------------------------------------------------ a batch of Dwarven Stout
console.log('');
console.log('A BATCH OF DWARVEN STOUT, FROM WATER TO EIGHT PINTS');
H.clearInv(p);
H.setVarBit(p, VAT_1, 0);
H.setVarBit(p, BARREL_1, 0);
p.setLevel(7, 18);
H.tick(1);

H.give(p, 'bucket_water', 1);
said = useOn(p, 'bucket_water', KELDAGRIM.vat, 'brewing_vat_1', KELDAGRIM.level, KELDAGRIM.from);
check('one bucket will not fill a vat that has no half-full state to be in', [vat(), said.includes('2 buckets')], [0, true]);
H.give(p, 'bucket_water', 1);
useOn(p, 'bucket_water', KELDAGRIM.vat, 'brewing_vat_1', KELDAGRIM.level, KELDAGRIM.from);
check('two will, and the buckets come back', [vat(), H.invCount(p, 'bucket_empty'), H.invCount(p, 'bucket_water')], [1, 2, 0]);

H.give(p, 'hammerstone_hops', 4);
said = useOn(p, 'hammerstone_hops', KELDAGRIM.vat, 'brewing_vat_1', KELDAGRIM.level, KELDAGRIM.from);
check('the hops are refused until the malt is in', [vat(), said.includes('barley malt')], [1, true]);

H.give(p, 'barley_malt', 2);
useOn(p, 'barley_malt', KELDAGRIM.vat, 'brewing_vat_1', KELDAGRIM.level, KELDAGRIM.from);
check('malt makes it a mixture', vat(), 2);

said = useOn(p, 'hammerstone_hops', KELDAGRIM.vat, 'brewing_vat_1', KELDAGRIM.level, KELDAGRIM.from);
check('18 Cooking is one short of a Dwarven Stout', [vat(), said.includes('level of 19')], [2, true]);
p.setLevel(7, 19);
H.tick(1);
useOn(p, 'hammerstone_hops', KELDAGRIM.vat, 'brewing_vat_1', KELDAGRIM.level, KELDAGRIM.from);
check('19 is enough, and all four handfuls go in', [vat(), H.invCount(p, 'hammerstone_hops')], [4, 0]);

H.give(p, 'ale_yeast', 1);
useOn(p, 'ale_yeast', KELDAGRIM.vat, 'brewing_vat_1', KELDAGRIM.level, KELDAGRIM.from);
check('the yeast starts it fermenting, and the pot comes back', [vat(), H.invCount(p, 'pot_empty'), H.getVar(p, 'brewing_time_1') > 0], [5, 1, true]);

H.runProc(p, '[proc,brew_update]', [1], undefined, true);
check('a minute later it is still fermenting', vat(), 5);
ageBrew(1);
check('one cycle in, the vat moves to its second fermenting state', vat(), 6);

// ------------------------------------------------------------------ how a batch turns out
console.log('');
console.log('WHAT THE SECOND CYCLE DECIDES: 6 MATURE, 16 BAD AND 106 NORMAL OUT OF 128');
const tally = { normal: 0, mature: 0, bad: 0, other: 0 };
for (let i = 0; i < 2000; i++) {
    H.setVarBit(p, VAT_1, 5);
    ageBrew(2);
    const s = vat();
    if (s === 7) tally.normal++;
    else if (s === 8) tally.mature++;
    else if (s === 64) tally.bad++;
    else tally.other++;
}
console.log(`  (2000 batches: ${tally.normal} normal, ${tally.mature} mature, ${tally.bad} bad)`);
check('nothing lands anywhere else', tally.other, 0);
check('  mature is about 6 in 128 (94 expected)', [tally.mature > 40, tally.mature < 160], [true, true]);
check('  bad is about 16 in 128 (250 expected)', [tally.bad > 170, tally.bad < 330], [true, true]);
check('  and the rest is an ordinary batch', [tally.normal > 1500, tally.normal < 1780], [true, true]);

// ------------------------------------------------------------------ the valve and the barrel
console.log('');
console.log('THE VALVE, AND EIGHT PINTS IN THE BARREL');
H.setVarBit(p, VAT_1, 6);
H.setVarBit(p, BARREL_1, 0);
H.setVar(p, 'brewing_time_1', nowMinute());
said = clickLoc(p, KELDAGRIM.valve, 'vat_valve_1', KELDAGRIM.level, KELDAGRIM.from);
check('turning the valve early wastes the batch as unfermented liquid', [vat(), barrel(), said.includes('unfermented')], [0, 4, true]);
said = clickLoc(p, KELDAGRIM.barrel, 'brewing_barrel_1', KELDAGRIM.level, KELDAGRIM.from);
check('  and Drain is what the barrel offers for it', [barrel(), said.includes('drain')], [0, true]);

H.setVarBit(p, VAT_1, 7);
xp = cook();
clickLoc(p, KELDAGRIM.valve, 'vat_valve_1', KELDAGRIM.level, KELDAGRIM.from);
check('a finished brew runs into the barrel: eight pints, and 215 experience for the batch', [vat(), barrel(), (cook() - xp) / 10], [0, 15, 215]);
said = clickLoc(p, KELDAGRIM.barrel, 'brewing_barrel_1', KELDAGRIM.level, KELDAGRIM.from);
check('  and Level says what is left', said.includes('8 pints of Dwarven Stout'), true);

H.clearInv(p);
H.give(p, 'beer_glass', 8);
for (let i = 0; i < 8; i++) useOn(p, 'beer_glass', KELDAGRIM.barrel, 'brewing_barrel_1', KELDAGRIM.level, KELDAGRIM.from);
check('eight beer glasses empty it, a pint each', [H.invCount(p, 'dwarven_stout'), H.invCount(p, 'beer_glass'), barrel()], [8, 0, 0]);
H.give(p, 'beer_glass', 1);
said = useOn(p, 'beer_glass', KELDAGRIM.barrel, 'brewing_barrel_1', KELDAGRIM.level, KELDAGRIM.from).toLowerCase();
check('  and a ninth gets nothing but the news', [H.invCount(p, 'dwarven_stout'), H.invCount(p, 'beer_glass'), said.includes('barrel is empty')], [8, 1, true]);

H.clearInv(p);
H.setVarBit(p, BARREL_1, 15);
H.give(p, 'calquat_fruit_keg_empty', 2);
useOn(p, 'calquat_fruit_keg_empty', KELDAGRIM.barrel, 'brewing_barrel_1', KELDAGRIM.level, KELDAGRIM.from);
check('a calquat keg takes four pints at once', [H.invCount(p, 'keg_dwarven_stout_4'), barrel()], [1, 11]);
useOn(p, 'calquat_fruit_keg_empty', KELDAGRIM.barrel, 'brewing_barrel_1', KELDAGRIM.level, KELDAGRIM.from);
check('  and the second keg empties the barrel', [H.invCount(p, 'keg_dwarven_stout_4'), barrel()], [2, 0]);

H.clearInv(p);
H.setVarBit(p, VAT_1, 8);
H.setVarBit(p, BARREL_1, 0);
clickLoc(p, KELDAGRIM.valve, 'vat_valve_1', KELDAGRIM.level, KELDAGRIM.from);
check('a mature batch fills the barrel from its own range of states, 128 higher', barrel(), 143);
H.give(p, 'beer_glass', 1);
H.give(p, 'calquat_fruit_keg_empty', 1);
useOn(p, 'beer_glass', KELDAGRIM.barrel, 'brewing_barrel_1', KELDAGRIM.level, KELDAGRIM.from);
useOn(p, 'calquat_fruit_keg_empty', KELDAGRIM.barrel, 'brewing_barrel_1', KELDAGRIM.level, KELDAGRIM.from);
check('  and pours mature pints and mature kegs', [H.invCount(p, 'mature_dwarven_stout'), H.invCount(p, 'keg_mature_dwarven_stout_4'), barrel()], [1, 1, 138]);

// ------------------------------------------------------------------ a batch that went bad
console.log('');
console.log('A BATCH THAT WENT BAD');
H.clearInv(p);
H.setVarBit(p, VAT_1, 64);
H.setVarBit(p, BARREL_1, 0);
H.give(p, 'barley_malt', 2);
said = useOn(p, 'barley_malt', KELDAGRIM.vat, 'brewing_vat_1', KELDAGRIM.level, KELDAGRIM.from);
check('nothing goes into a vat holding a ruined batch', [vat(), H.invCount(p, 'barley_malt'), said.includes('gone bad')], [64, 2, true]);
clickLoc(p, KELDAGRIM.valve, 'vat_valve_1', KELDAGRIM.level, KELDAGRIM.from);
check('the valve runs it into the barrel as bad ale', [vat(), barrel()], [0, 1]);
H.give(p, 'beer_glass', 1);
useOn(p, 'beer_glass', KELDAGRIM.barrel, 'brewing_barrel_1', KELDAGRIM.level, KELDAGRIM.from);
check('  which nobody is pouring into a glass', [H.invCount(p, 'beer_glass'), barrel()], [1, 1]);
clickLoc(p, KELDAGRIM.barrel, 'brewing_barrel_1', KELDAGRIM.level, KELDAGRIM.from);
check('  so it gets drained away instead', barrel(), 0);

// ------------------------------------------------------------------ the quest's own slot
// Forgettable Tale is not wired up, so nothing can put a Kelda brew in a vat yet. The cache keeps
// four vat states and a barrel state for it, and the valve has to know them - otherwise the day the
// quest lands, its brew runs away as unfermented liquid.
console.log('');
console.log('THE KELDA STOUT STATES THE CACHE KEEPS FOR FORGETTABLE TALE');
H.clearInv(p);
H.setVarBit(p, VAT_1, 71);
H.setVarBit(p, BARREL_1, 0);
xp = cook();
said = clickLoc(p, KELDAGRIM.valve, 'vat_valve_1', KELDAGRIM.level, KELDAGRIM.from);
check('a finished Kelda Stout goes into the barrel as Kelda Stout, and pays no Cooking experience', [vat(), barrel(), cook() - xp, said.includes('Kelda Stout')], [0, 3, 0, true]);
said = clickLoc(p, KELDAGRIM.barrel, 'brewing_barrel_1', KELDAGRIM.level, KELDAGRIM.from);
check('  and the barrel says what it is holding', said.includes('full of Kelda Stout'), true);
H.setVarBit(p, BARREL_1, 0);

// ------------------------------------------------------------------ cider
console.log('');
console.log('CIDER, WHICH TAKES NEITHER WATER NOR MALT');
H.clearInv(p);
H.setVarBit(p, VAT_1, 0);
H.setVarBit(p, BARREL_1, 0);
p.setLevel(7, 14);
H.tick(1);
H.give(p, 'apple_mush', 4);
useOn(p, 'apple_mush', KELDAGRIM.vat, 'brewing_vat_1', KELDAGRIM.level, KELDAGRIM.from);
check('four buckets of apple mush go straight into an empty vat, and the buckets come back', [vat(), H.invCount(p, 'bucket_empty')], [58, 4]);
H.give(p, 'ale_yeast', 1);
useOn(p, 'ale_yeast', KELDAGRIM.vat, 'brewing_vat_1', KELDAGRIM.level, KELDAGRIM.from);
check('and the yeast ferments it', vat(), 59);
let badCider = 0;
let badAle = 0;
for (let i = 0; i < 400; i++) {
    H.setVarBit(p, VAT_1, 59);
    ageBrew(2);
    if (vat() === 65) badCider++;
    if (vat() === 64) badAle++;
}
check('a ruined cider goes bad as cider and never as ale', [badCider > 10, badAle], [true, 0]);
H.setVarBit(p, VAT_1, 61);
xp = cook();
clickLoc(p, KELDAGRIM.valve, 'vat_valve_1', KELDAGRIM.level, KELDAGRIM.from);
check('and a finished one is eight pints of cider for 182 experience', [barrel(), (cook() - xp) / 10], [87, 182]);
H.clearInv(p);
H.give(p, 'beer_glass', 1);
useOn(p, 'beer_glass', KELDAGRIM.barrel, 'brewing_barrel_1', KELDAGRIM.level, KELDAGRIM.from);
check('  poured a pint at a time', H.invCount(p, 'cider'), 1);

// ------------------------------------------------------------------ the other brewery
// Everything above ran on Keldagrim's varbit pair. The cellar has its own, and a feature with two
// of everything is exactly where a copied line goes unnoticed - so this brews a batch down there
// and checks that the Keldagrim vat never moved.
console.log('');
console.log('AND THE SAME AGAIN IN THE CELLAR, ON ITS OWN PAIR OF VARBITS');
H.clearInv(p);
H.setVarBit(p, VAT_1, 0);
H.setVarBit(p, BARREL_1, 0);
H.setVarBit(p, 'brewing_vat_varbit_2', 0);
H.setVarBit(p, 'brewing_barrel_varbit_2', 0);
p.setLevel(7, 24);
H.tick(1);
const vat2 = () => H.getVarBit(p, 'brewing_vat_varbit_2');
H.give(p, 'bucket_water', 2);
H.give(p, 'barley_malt', 2);
H.give(p, 'asgarnian_hops', 4);
H.give(p, 'ale_yeast', 1);
useOn(p, 'bucket_water', PHASMATYS.vat, 'brewing_vat_2', PHASMATYS.level, PHASMATYS.from);
useOn(p, 'barley_malt', PHASMATYS.vat, 'brewing_vat_2', PHASMATYS.level, PHASMATYS.from);
useOn(p, 'asgarnian_hops', PHASMATYS.vat, 'brewing_vat_2', PHASMATYS.level, PHASMATYS.from);
useOn(p, 'ale_yeast', PHASMATYS.vat, 'brewing_vat_2', PHASMATYS.level, PHASMATYS.from);
check('an Asgarnian Ale goes on in the cellar: hops state 10, then fermenting at 11', [vat2(), H.getVar(p, 'brewing_time_2') > 0], [11, true]);
check('  and the Keldagrim vat is untouched by any of it', [vat(), barrel()], [0, 0]);
H.setVarBit(p, 'brewing_vat_varbit_2', 13);
xp = cook();
clickLoc(p, PHASMATYS.valve, 'vat_valve_2', PHASMATYS.level, PHASMATYS.from);
check('its own valve fills its own barrel, for 248 experience', [vat2(), H.getVarBit(p, 'brewing_barrel_varbit_2'), (cook() - xp) / 10], [0, 23, 248]);
H.give(p, 'beer_glass', 1);
useOn(p, 'beer_glass', PHASMATYS.barrel, 'brewing_barrel_2', PHASMATYS.level, PHASMATYS.from);
check('  and pours Asgarnian Ale, not Dwarven Stout', [H.invCount(p, 'asgarnian_ale'), H.getVarBit(p, 'brewing_barrel_varbit_2')], [1, 22]);

// ------------------------------------------------------------------ the brewers
console.log('');
console.log('THE TWO MEN WHO EXPLAIN IT, AND SELL THE ONE THING YOU CANNOT MAKE');
const npcNamed = (name: string) => {
    const id = NpcType.getId(name);
    for (const npc of World.npcs) if (npc && npc.isActive && npc.type === id) return npc;
    throw new Error(name + ' is not spawned');
};
const talk = (name: string, picks: number[]): string => {
    const npc = npcNamed(name);
    return heard(() => {
        stand(p, [npc.x, npc.z - 1], npc.level);
        H.opNpc(p, npc, 1);
        settle(p, picks);
    });
};
said = talk('blandebir', [1, 1]);
check('Blandebir walks you through the whole recipe, cider included', [said.includes('Two buckets of water'), said.includes('yeast'), said.includes('apple mush')], [true, true, true]);
// THE PRICE AS WELL AS THE CURRENCY, and the gap between those two is where a real bug lived.
// These checks used to establish that Blandebir takes coins and Metarialus takes ectotokens and
// said nothing whatever about HOW MANY, so when the shop formula moved from per cent to per mille
// - ~calc_shop_value now ends in scale($int5, 1000, $base_cost) - both keepers kept their old
// numbers and nothing noticed. Blandebir sold 25gp yeast for 2gp, which Noterazzo's allstock
// counter bought back at 15gp, and Metarialus charged two tokens where his own comment says five.
//
// brewers.rs2 states the intent in as many words: "ale yeast costs 25, so 100 is Blandebir's 25
// coins and 20 is Metarialus's 5 tokens". That sentence is what these two checks are about.
//
// THE MULTIPLIER AND NOT THE QUOTED PRICE, which took two wrong attempts to settle on.
//
// Asserting the quoted price exactly fails straight away: on top of the multiplier,
// ~calc_shop_value subtracts ~price_mod scaled by %shop_haggle, which moves with how far the row's
// stock sits from its norm, so a full shelf quotes 27 where the multiplier alone says 25. Both are
// correct. A proportional band round the quoted price is no better, because that haggle term is
// ADDITIVE IN MULTIPLIER SPACE - the same +80 per mille for both keepers - which is +8% on
// Blandebir's 1000 and +40% on Metarialus's 200. And an absolute band wide enough for that cannot
// separate Metarialus's correct 7 from the ~4 he quoted while broken.
//
// The multiplier is where the bug lived, so the multiplier is what gets asserted. It carries no
// haggle, no stock position and no rounding, and it is exactly the number brewers.rs2 is talking
// about when it says "100 is Blandebir's 25 coins and 20 is Metarialus's 5 tokens" - those two
// figures on the per-cent scale that ~calc_shop_value no longer uses.
const sellMultiplier = (npcName: string): number | undefined => {
    const t = NpcType.get(NpcType.getId(npcName));
    return t?.params?.get(ParamType.getId('shop_sell_multiplier')) as number | undefined;
};

said = talk('blandebir', [2]);
check('  and his counter sells ale yeast for coins, at par', [H.getVar(p, 'shop') !== -1, ObjType.get(H.getVar(p, 'shop_currency')).debugname, sellMultiplier('blandebir')], [true, 'coins', 1000]);
p.closeModal();
H.tick(1);
said = talk('metarialus', [2]);
check('while the dead brewer in the cellar takes ectotokens, at a fifth of cost', [H.getVar(p, 'shop') !== -1, ObjType.get(H.getVar(p, 'shop_currency')).debugname, sellMultiplier('metarialus')], [true, 'ectotoken', 200]);

console.log('');
console.log(`${R.ok} ok, ${R.bad} failed`);
process.exit(R.bad ? 1 : 0);
