// THE TEN WOODEN CATS, and the pieces of The Great Brain Robbery a walked run cannot reach.
//
// quest_tgbr_run.ts walks the fourteen stages, and three things in the quest sit outside what a sim
// player can be walked to:
//
//   the cats are carved at a Workbench in a player-owned house, and a sim player has no house. The
//   carving itself is a proc, so it is called here with the materials in hand;
//   the gas outside the windmill is a softtimer, which the walked run nulls damage for;
//   Barrelchest's anchor swing is queued off a melee hit, so the queue is run directly and what it
//   did to the prayer book, the Attack level and the Defence level is read back.
//
//   NODE_MEMBERS=true npx tsx tools/sim/tgbrcats.ts
import * as H from './harness.js';
import World from '#/engine/World.js';
import NpcType from '#/cache/config/NpcType.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import ScriptPointer from '#/engine/script/ScriptPointer.js';
import InvType from '#/cache/config/InvType.js';

await H.boot();

let ok = 0;
let bad = 0;
function check(what: string, got: unknown, want?: unknown) {
    const pass = want === undefined ? got === true : JSON.stringify(got) === JSON.stringify(want);
    console.log(`  ${pass ? 'ok  ' : 'FAIL'}   ${what}: ${JSON.stringify(got)}${pass || want === undefined ? '' : '   (want ' + JSON.stringify(want) + ')'}`);
    if (pass) {
        ok++;
    } else {
        bad++;
    }
}

const p: any = H.makePlayer('cats', 3787, 2826);
H.tick(2);
p.applyDamage = function () {};
H.maxOut(p);
H.tick(1);

// ------------------------------------------------------------------ the cats
console.log('THE WOODEN CATS, at a workbench');
H.setVar(p, 'tgbr', 60); // ^tgbr_doctor - Fenkenstrain has agreed to come
H.setVarBit(p, 'tgbr_crate', 1); // ^tgbr_crate_space - Rufus has handed the parts over
check('the workbench offers to carve them', H.runProc(p, '[proc,tgbr_wants_cats]')[0] === 1);

H.clearInv(p);
// woodplank, NOT plank. This handed over the DEAD plank obj - the one
// ~sawmill_old_planks_login strips off a player on every login and that nothing in the game
// produces - so it was testing the quest against an item no player can be holding, and passing.
// The quest asked for the same dead obj, which is the bug this caught.
H.give(p, 'woodplank', 10);
H.give(p, 'fur', 10);
const xpBefore = p.stats[12]; // crafting
// The carving is a loop with a p_delay in it, so ScriptRunner.execute on its own stops at the first
// cat - the suspension belongs to the player, not to the call. This hands the script to the player
// the way a click does and then ticks the world until it finishes.
const script = ScriptProvider.getByName('[proc,tgbr_carve_cats]');
if (!script) throw new Error('no [proc,tgbr_carve_cats]');
const st = ScriptRunner.init(script, p, null, []);
st.pointerAdd(ScriptPointer.ProtectedActivePlayer);
p.executeScript(st, true, true);
for (let i = 0; i < 80 && H.invCount(p, 'wooden_cat') < 10; i++) H.tick(1);
check('ten cats', H.invCount(p, 'wooden_cat'), 10);
check('ten planks gone', H.invCount(p, 'woodplank'), 0);
check('ten pieces of fur gone', H.invCount(p, 'fur'), 0);
check('and 150 Crafting experience for each', p.stats[12] - xpBefore, 1500);

console.log('');
console.log('and it is only offered while the quest wants them');
H.setVar(p, 'tgbr', 130);
check('not once the quest is over', H.runProc(p, '[proc,tgbr_wants_cats]')[0] === 0);
H.setVar(p, 'tgbr', 0);
H.setVarBit(p, 'tgbr_crate', 0);
check('not before it starts', H.runProc(p, '[proc,tgbr_wants_cats]')[0] === 0);

// ------------------------------------------------------------------ the gas
console.log('');
console.log('THE GAS OUTSIDE THE WINDMILL');
H.setVar(p, 'tgbr', 10);
H.clearInv(p);
check('the mill is indoors', H.runProc(p, '[proc,harmony_outdoors]', [(3786 << 14) | 2826])[0] === 0);
check('and the statue is not', H.runProc(p, '[proc,harmony_outdoors]', [(3795 << 14) | 2844])[0] === 1);
check('with nothing on, the air is not breathable', H.runProc(p, '[proc,harmony_can_breathe]')[0] === 0);
H.give(p, 'hundred_pirate_diving_helmet');
H.give(p, 'hundred_pirate_diving_backpack');
H.opheld(p, 'hundred_pirate_diving_helmet', 2);
H.opheld(p, 'hundred_pirate_diving_backpack', 2);
H.tick(2);
check('Murphy’s pair makes it breathable', H.runProc(p, '[proc,harmony_can_breathe]')[0] === 1);
// clearInv only empties the pack; the pair is WORN, so the worn container is emptied too.
const worn = p.getInventory(InvType.WORN)!;
for (let i = 0; i < worn.capacity; i++) if (worn.get(i)) p.invDelSlot(InvType.WORN, i);
H.clearInv(p);
H.tick(1);
check('and taking them off does not', H.runProc(p, '[proc,harmony_can_breathe]')[0] === 0);
H.setVar(p, 'tgbr_prayer_until', World.currentTick + 500);
check('a recited prayer does', H.runProc(p, '[proc,harmony_can_breathe]')[0] === 1);
H.setVar(p, 'tgbr_prayer_until', 0);
check('and a stale one does not', H.runProc(p, '[proc,harmony_can_breathe]')[0] === 0);

// ------------------------------------------------------------------ the anchor
console.log('');
console.log('BARRELCHEST’S ANCHOR');
const bc = NpcType.getId('tgbr_barrelchest');
const t = NpcType.get(bc) as any;
check('level 190', t.vislevel, 190);
check('134 hitpoints', t.stats[3], 134);
check('170 Attack, 145 Strength, 140 Defence', [t.stats[0], t.stats[2], t.stats[1]], [170, 145, 140]);
check('3x3', t.size, 3);
check('and 35 is its max hit through this engine’s own formula', Math.floor(((t.stats[2] + 9) * (80 + 64) + 320) / 640), 35);

// the prayer drain: a point of Attack and Defence, half the damage off the prayer book, and every
// prayer switched off.
p.stats[13] = 0;
H.maxOut(p);
H.tick(1);
const atkBefore = p.levels[0];
const defBefore = p.levels[1];
const prayBefore = p.levels[5];
const hit = ScriptProvider.getByName('[queue,tgbr_anchor_hit]');
if (!hit) throw new Error('no [queue,tgbr_anchor_hit]');
const hst = ScriptRunner.init(hit, p, null, [10]);
hst.pointerAdd(ScriptPointer.ProtectedActivePlayer);
p.executeScript(hst, true, true);
H.tick(2);
check('the anchor takes a point of Attack', p.levels[0] < atkBefore);
check('and a point of Defence', p.levels[1] < defBefore);
check('and half the damage off your prayer', p.levels[5] < prayBefore);

// ------------------------------------------------------------------ the journal
// Fourteen stages, fourteen entries, and a quest list row that opens them. A journal that throws is
// a quest the player cannot read, so every stage is clicked.
console.log('');
console.log('THE QUEST JOURNAL, at every stage');
let journalBad = 0;
for (const stage of [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130]) {
    H.setVar(p, 'tgbr', stage);
    H.tick(1);
    H.clearLogs();
    try {
        H.ifButton(p, 'questlist:tgbr');
        H.tick(1);
        const text = (H.ifaces as any[])
            .filter(f => f.kind === 'text')
            .map(f => f.text)
            .join(' ');
        if (!text.includes('Brain Robbery') && !text.includes('@')) {
            console.log(`  FAIL   stage ${stage}: nothing was drawn`);
            journalBad++;
        }
    } catch (e) {
        console.log(`  FAIL   stage ${stage}: ${String(e).replace('Error: ', '')}`);
        journalBad++;
    }
}
check('every stage has an entry', journalBad, 0);

console.log('');
console.log(`${ok} ok, ${bad} FAIL`);
process.exit(bad ? 1 : 0);
