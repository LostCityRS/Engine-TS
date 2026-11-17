// A LEVEL EARNED ON THE SPINNING WHEEL IS ANNOUNCED WHEN IT IS EARNED, AND BY ITS OWN NUMBER.
//
//   npx tsx tools/sim/spinlevel.ts
//
// Tracker issue 23: "gaining lvls on spin wheel stack until end & repeat last lvl up over&over".
// Both halves of that are one cause. `[proc,craft_spinning_batch]` was a `while` loop paced by
// p_delay(3), and p_delay sets player.delayed for the whole batch:
//
//   * Player.addXp ENQUEUES the [advancestat,crafting] script (PlayerQueueType.ENGINE) rather than
//     running it inline, and a delayed player's queue does not drain - so every level-up waits for
//     the batch to finish and they all arrive together.
//   * [label,levelup] reads `stat_base($stat)` when it RUNS, not the level that was earned, so
//     every one of those deferred boxes names the FINAL level. Spinning 27 flax from level 10 with
//     1180 xp earned 11 and 12 and printed "Your crafting level is now 12." twice.
//
// The fix is the one this codebase already standardised on and spinning was the last holdout:
// repeat on a weakqueue, one item at a time, the way cooking (skill_cooking/scripts/cooking.rs2)
// and strung bows (skill_fletching/scripts/bows.rs2) do. bows.rs2 states the rule in capitals -
// "THE REPEAT IS A QUEUE, NOT p_delay, AND THAT IS THE WHOLE POINT" - and gives the other reason
// for it: while delayed, MoveClickHandler and OpLocHandler drop the player's input, so a p_delay
// batch cannot be stopped either.
//
// WHAT TO EXPECT OF A LEVEL-UP MID-BATCH. The box opens and p_pausebutton makes the player busy;
// closing it clears their weak queues, which ends the chain. That is the engine's own behaviour
// and what every other paced skill does - tools/sim/leveluppopup.ts documents it as the whole
// reason the popup can be switched off - so the batch stopping at a level is correct, not a
// regression. What was wrong was being told about it late and with the wrong number.
import * as H from './harness.js';
import { check, R, player } from './a1lib.js';
import Component from '#/cache/config/Component.js';
import ScriptState from '#/engine/script/ScriptState.js';

await H.boot();

const CRAFTING = 12; // PlayerStat.CRAFTING
/** xp is stored in tenths: productexp,150 for flax is 15.0 xp. */
const TENTHS = 10;
const LVL11 = 1358; // and 1584 is level 12, the one the batch used to announce for both

const wheel = (H.locsNear('spinningwheel', 2724, 3485, 1)[0] ?? H.locsNear('spinningwheel', 2724, 3485, 0)[0])!;

/** A spinner at the wheel, level 10 with 1180 xp and 27 flax: 405 xp, which crosses 11 and 12. */
const spinner = (name: string) => {
    const p: any = player(name, wheel.x, wheel.z + 1, wheel.level);
    p.teleport(wheel.x, wheel.z + 1, wheel.level);
    H.clearInv(p);
    H.give(p, 'flax', 27);
    p.stats[CRAFTING] = 1180 * TENTHS;
    p.levels[CRAFTING] = 10;
    p.baseLevels[CRAFTING] = 10;
    H.tick(2);
    return p;
};

console.log('\n== 27 flax, spun from level 10 with 1180 xp');
const p: any = spinner('spinlvl');
check('the wheel is where the report put it', [wheel.x, wheel.z, wheel.level], [2710, 3471, 1]);
check('it starts at level 10', p.baseLevels[CRAFTING], 10);
check('  with 27 flax', H.invCount(p, 'flax'), 27);

H.clearLogs();
H.useHeldOnLoc(p, 'flax', wheel.x, wheel.z, 'spinningwheel');
for (let t = 0; t < 6; t++) H.tick(1);
check('the make-x panel opens', p.modalChat === -1 ? '' : (Component.get(p.modalChat).comName ?? ''), 'skillmulti1');
check('  and Make All is a button on it', H.choose(p, 'skillmulti1:com_3'), true);

// Watch for the first level-up box: when it arrives, what it says, and what is left to spin.
let box = { tick: -1, level: -1, flaxLeft: -1, text: '' };
for (let t = 1; t <= 300 && box.tick === -1; t++) {
    H.tick(1);
    const s = p.activeScript;
    if (!s || s.execution !== ScriptState.PAUSEBUTTON) continue;
    const said = H.ifaces.filter(f => f.who === p.username && f.kind === 'text' && f.text && /level is now/.test(f.text)).map(f => f.text ?? '');
    if (!said.length) continue;
    box = { tick: t, level: p.baseLevels[CRAFTING], flaxLeft: H.invCount(p, 'flax'), text: said[said.length - 1] };
}

console.log('');
check('a level-up box arrives at all', box.tick !== -1, true);
// THE TWO HALVES OF THE REPORT.
check('  it arrives DURING the batch, with flax still to spin', box.flaxLeft > 0, true);
check('  and it names the level just earned, not the one the batch ends on', box.text, 'Your crafting level is now 11.');
check('  which is the level the player actually has as it opens', box.level, 11);
// The xp either side of that level, to show the box is not merely early: 1358 is level 11.
check('  and the xp backs that up', p.stats[CRAFTING] >= LVL11 * TENTHS && p.stats[CRAFTING] < 1584 * TENTHS, true);
console.log(`       (box at tick ${box.tick}, ${box.flaxLeft} flax left, ${p.stats[CRAFTING] / TENTHS} xp)`);

// ---- and the chain itself still spins a batch, which is what was replaced -----------------
console.log('\n== the batch still runs to the end when nothing interrupts it');
{
    const q: any = player('spinall', wheel.x, wheel.z + 1, wheel.level);
    q.teleport(wheel.x, wheel.z + 1, wheel.level);
    H.clearInv(q);
    H.give(q, 'flax', 27);
    H.tick(2);
    // a1lib's player() maxes every stat, so there is no level to earn and nothing to interrupt
    check('a maxed crafter has nothing to level', q.baseLevels[CRAFTING], 99);
    H.useHeldOnLoc(q, 'flax', wheel.x, wheel.z, 'spinningwheel');
    for (let t = 0; t < 6; t++) H.tick(1);
    H.choose(q, 'skillmulti1:com_3');
    for (let t = 0; t < 200; t++) H.tick(1);
    check('all 27 flax are spun', [H.invCount(q, 'flax'), H.invCount(q, 'bow_string')], [0, 27]);
}

console.log('\n== one flax takes the single-item path');
{
    const q: any = player('spinone', wheel.x, wheel.z + 1, wheel.level);
    q.teleport(wheel.x, wheel.z + 1, wheel.level);
    H.clearInv(q);
    H.give(q, 'flax', 1);
    H.tick(2);
    H.useHeldOnLoc(q, 'flax', wheel.x, wheel.z, 'spinningwheel');
    for (let t = 0; t < 6; t++) H.tick(1);
    H.choose(q, 'skillmulti1:com_6'); // Make 1
    for (let t = 0; t < 30; t++) H.tick(1);
    check('one flax, one bow string', [H.invCount(q, 'flax'), H.invCount(q, 'bow_string')], [0, 1]);
}

console.log('\n== wool still becomes a ball of wool, so the product map survived');
{
    const q: any = player('spinwool', wheel.x, wheel.z + 1, wheel.level);
    q.teleport(wheel.x, wheel.z + 1, wheel.level);
    H.clearInv(q);
    H.give(q, 'wool', 5);
    H.tick(2);
    H.useHeldOnLoc(q, 'wool', wheel.x, wheel.z, 'spinningwheel');
    for (let t = 0; t < 6; t++) H.tick(1);
    H.choose(q, 'skillmulti1:com_3');
    for (let t = 0; t < 60; t++) H.tick(1);
    check('five wool, five balls of wool', [H.invCount(q, 'wool'), H.invCount(q, 'ball_of_wool')], [0, 5]);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
