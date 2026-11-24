/**
 * Smelting a batch of bars at a furnace, and being able to STOP.
 *
 * "when smelting iron bars, you wont stop until out of ores in inventory" - DeathPlateau-Bugs#85.
 * Word for word the shape of DeathPlateau-Bugs#39 at the chaos altar ("cant be stopped until invo
 * is empty"), and the same mechanism: ~smelt_bar holds the player with p_delay(3) for every bar,
 * and MoveClickHandler THROWS AWAY a move click while player.delayed is set rather than deferring
 * it. The furnace's Smelt window re-queues itself every 4 ticks, so the hold and the cadence leave
 * the player no free tick to click in: one press of Smelt X works to the bottom of the pack with
 * every step the player tries to take discarded.
 *
 * The chaos altar had no repeat machinery of its own and needed p_oploc(3) and a hidden op3 to get
 * one. The furnace already has the repeat - a weak queue - so the fix here is only to stop holding
 * the player: the pacing moves to the queue's own 4-tick delay, which is the shape cook_generic
 * already uses (cooking.rs2 has no p_delay anywhere in its loop).
 *
 * Section 2 is the sharp one. It samples player.delayed EVERY TICK, because a single look after the
 * run finds a free player and reports nothing wrong.
 */
import * as H from './harness.js';
import { check, R, player } from './a1lib.js';
import type Player from '#/engine/entity/Player.js';

await H.boot();

// The Al Kharid furnace: [furnace1], the variant that carries op2=Smelt.
const FURNACE: [number, number] = [3272, 3185];
const ORE = 'iron_ore';

function atFurnace(who: string, ores: number) {
    const p = player(who, FURNACE[0] + 2, FURNACE[1], 0);
    H.setVar(p, 'tutorial', 1000);
    H.maxOut(p);
    H.clearInv(p);
    // NO COAL. [label,smelt_ore] reads iron ore plus two coal as a request for a steel bar, and
    // section 5 uses that path - a pack with coal in it would be smelting something else.
    H.give(p, ORE, ores);
    return p;
}

function smeltTen(p: Player) {
    H.opLoc(p, FURNACE[0], FURNACE[1], 'furnace1', 2);
    H.tick(3);
    H.ifButton(p, 'smelt_window:smelt_10_iron');
}

// ---- 1. one press of Smelt 10 smelts ten ------------------------------------------------------
// The repeat has to keep working: the fix must not turn the window into one bar a click.
{
    const p = atFurnace('sm_ten', 20);
    smeltTen(p);
    H.tick(60);
    check(`Smelt 10 spends ten ores (${20 - H.invCount(p, ORE)} spent)`, 20 - H.invCount(p, ORE), 10);
    check('  ...and stops there, with the rest of the pack untouched', H.invCount(p, ORE), 10);
}

// ---- 2. AND THE PLAYER IS NEVER HELD ----------------------------------------------------------
// The whole report. Sampled every tick, not once at the end.
{
    const p = atFurnace('sm_held', 20);
    smeltTen(p);
    let held = 0;
    for (let t = 0; t < 50; t++) {
        H.tick(1);
        if (p.delayed) held++;
    }
    check(`never delayed across a ten-bar run (${held} of 50 ticks held)`, held, 0);
}

// ---- 3. so walking away stops it, which is what the player could not do -----------------------
{
    const p = atFurnace('sm_stop', 27);
    smeltTen(p);
    H.tick(9);
    const whenLeaving = H.invCount(p, ORE);
    // A PLAYER CLICKS MORE THAN ONCE when nothing happens. Counting how many of five attempts the
    // server accepted is the measurement the report is about: with the hold in place every one of
    // them is thrown away by MoveClickHandler before it reaches clearPendingAction.
    let accepted = 0;
    for (let i = 0; i < 5; i++) {
        if (H.walkTo(p, FURNACE[0] + 8, FURNACE[1] + 8)) accepted++;
        H.tick(1);
    }
    H.tick(40);
    const after = H.invCount(p, ORE);
    check(`it had started before the player tried to leave (${27 - whenLeaving} spent)`, whenLeaving < 27, true);
    check(`  ...the step is accepted (${accepted} of 5 attempts)`, accepted > 0, true);
    // THE COUNT MUST STOP MOVING, not merely stay above zero: a ten-bar run stops on its own after
    // ten whether the player got away or not. Two are allowed - one bar in flight on the tick the
    // click landed, and one for the queue entry already counted down.
    check(`  ...and walking away stops it (${whenLeaving} left when leaving, ${after} after)`, whenLeaving - after <= 2, true);
    check('  ...with the player off the furnace tile', p.x !== FURNACE[0] + 2 || p.z !== FURNACE[1], true);
}

// ---- 4. an empty pack stops it, and says so ---------------------------------------------------
{
    const p = atFurnace('sm_empty', 3);
    smeltTen(p);
    H.tick(60);
    check('a short pack empties', H.invCount(p, ORE), 0);
    const xpAtEmpty = p.stats[13];
    H.tick(30);
    check('  ...and pays nothing more once it is empty', p.stats[13], xpAtEmpty);
}

// ---- 5. and using one ore on the furnace still costs the player its delay ----------------------
// The other half of the fix: ~smelt_bar is the one copy of the act, shared with [label,smelt_ore],
// and a single use is one click for one bar. Its pacing has to survive, or using ore on a furnace
// becomes as fast as a player can click.
{
    const p = atFurnace('sm_single', 5);
    H.useHeldOnLoc(p, ORE, FURNACE[0], FURNACE[1], 'furnace1');
    let held = 0;
    for (let t = 0; t < 10; t++) {
        H.tick(1);
        if (p.delayed) held++;
    }
    check(`one ore on the furnace spends one ore (${5 - H.invCount(p, ORE)})`, 5 - H.invCount(p, ORE), 1);
    check(`  ...and still holds the player while it smelts (${held} ticks)`, held > 0, true);
}

console.log(R.bad ? `FAILED: ${R.bad} of ${R.ok + R.bad}` : `${R.ok} ok`);
process.exit(R.bad ? 1 : 0);
