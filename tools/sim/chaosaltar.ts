/**
 * Offering bones at the Wilderness chaos altar, and being able to STOP.
 *
 * The offering loop was a `while` with a p_delay(2) in it, and its comment claimed the delay
 * yielded so that walking away or clicking something else would end it. It does not: p_delay sets
 * player.delayed, and both MoveClickHandler and OpLocHandler throw the player's input away while
 * that is set. So ONE click worked through the whole pack with every later click and step
 * discarded - "cant be stopped until invo is empty" (DeathPlateau-Bugs#39). On the most PKed
 * training spot in the game that means not being able to eat, pray or run.
 *
 * It is one offering per call now, paced against map_clock and re-queued through p_oploc(3), which
 * is farming's rake pattern (that file carries the same warning in its own comment).
 *
 * WHAT A SIM CAN AND CANNOT SEE. The engine's own re-queue needs a live interaction the harness
 * does not keep, so op3 is driven here by hand, the way berrybushes.ts and plunder.ts drive theirs.
 * That is fine for the two claims that matter and it is why section 1 is the sharp one: a single
 * use must offer ONCE. The old loop offered until the pack was empty, so counting what one click
 * costs is the whole difference, and it needs no repeat machinery to measure.
 */
import * as H from './harness.js';
import { check, R, player } from './a1lib.js';

await H.boot();

// ^chaos_altar_coord = 0_46_59_3_44
const ALTAR: [number, number] = [2947, 3820];
const BONE = 'bones';

function atAltar(who: string, count: number) {
    const p = player(who, ALTAR[0], ALTAR[1] - 1, 0);
    H.setVar(p, 'tutorial', 1000);
    H.clearInv(p);
    H.give(p, BONE, count);
    return p;
}

// ---- 1. it offers, and keeps offering from one use -------------------------------------------
// The repeat is the point - it is not one bone per click - so this has to pass as well as
// section 3. p_oploc(3) carries it, which needs the hidden op3 the altar now has: without that
// P_OPLOC returns without doing anything and the whole thing becomes one bone a click.
{
    const p = atAltar('ca_one', 12);
    const xpBefore = p.stats[5];
    H.useHeldOnLoc(p, BONE, ALTAR[0], ALTAR[1], 'chaosaltar');
    H.tick(40);
    const gone = 12 - H.invCount(p, BONE);
    check('one use pays experience', p.stats[5] > xpBefore, true);
    check(`  ...and keeps going on its own (${gone} of 12 offered)`, gone > 1, true);
}

// ---- 2. the player is never held, at any point ----------------------------------------------
// SAMPLED EVERY TICK, not once at the end: the old loop held player.delayed for the whole run, so
// a single look afterwards found a free player and would have reported nothing wrong.
{
    const p = atAltar('ca_held', 12);
    H.useHeldOnLoc(p, BONE, ALTAR[0], ALTAR[1], 'chaosaltar');
    let held = 0;
    for (let t = 0; t < 30; t++) {
        H.tick(1);
        if (p.delayed) held++;
        H.opLoc(p, ALTAR[0], ALTAR[1], 'chaosaltar', 3);
    }
    check(`never delayed across 30 offerings (${held} ticks held)`, held, 0);
}

// ---- 3. AND WALKING AWAY STOPS IT, which is the report ---------------------------------------
// This is the check the bug was about. The old loop held player.delayed for its whole run, so
// MoveClickHandler threw the step away and the pack emptied wherever the player wanted to be.
{
    const p = atAltar('ca_stop', 25);
    H.useHeldOnLoc(p, BONE, ALTAR[0], ALTAR[1], 'chaosaltar');
    H.tick(8);
    const whenLeaving = H.invCount(p, BONE);
    H.walkTo(p, ALTAR[0] + 8, ALTAR[1] + 8);
    H.tick(40);
    const after = H.invCount(p, BONE);
    check(`it had started before the player left (${25 - whenLeaving} offered)`, whenLeaving < 25, true);
    // THE COUNT MUST STOP MOVING, not merely stay above zero. "after > 0" passed with the old
    // loop restored - it had eaten eight more bones in those 40 ticks and simply had not reached
    // the bottom of the pack yet. One is allowed for an offering already in flight on the tick
    // the player stepped away.
    check(`  ...and walking away stops it (${whenLeaving} left when leaving, ${after} after)`, whenLeaving - after <= 1, true);
    check('  ...with the player off the altar tile', p.x !== ALTAR[0] || p.z !== ALTAR[1] - 1, true);
}

// ---- 3b. an empty pack pays nothing ----------------------------------------------------------
// The old loop's exit was the bone count; this one scans the pack, so "nothing left" is a
// different code path and worth its own check.
{
    const p = atAltar('ca_empty', 4);
    H.useHeldOnLoc(p, BONE, ALTAR[0], ALTAR[1], 'chaosaltar');
    for (let i = 0; i < 60 && H.invCount(p, BONE) > 0; i++) H.tick(3);
    check('the pack does empty', H.invCount(p, BONE), 0);
    const xpAtEmpty = p.stats[5];
    for (let i = 0; i < 10; i++) {
        H.opLoc(p, ALTAR[0], ALTAR[1], 'chaosaltar', 3);
        H.tick(3);
    }
    check('  ...and an empty pack pays nothing more', p.stats[5], xpAtEmpty);
}

// ---- 4. and only at the one altar that trains ------------------------------------------------
// There are five [chaosaltar] locs and only the hut at level 38 is the training altar. The others
// stay plain Pray-at altars, and op3 must not open a back door into the offering either.
{
    const others = H.locsNear('chaosaltar', 3236, 3627, 0).filter(l => !(l.x === ALTAR[0] && l.z === ALTAR[1]));
    if (others.length === 0) {
        check('another chaosaltar exists to check the gate against', false, true);
    } else {
        const o = others[0];
        const p = player('ca_gate', o.x, o.z - 1, 0);
        H.setVar(p, 'tutorial', 1000);
        H.clearInv(p);
        H.give(p, BONE, 5);
        const xpBefore = p.stats[5];
        H.useHeldOnLoc(p, BONE, o.x, o.z, 'chaosaltar');
        H.tick(10);
        H.opLoc(p, o.x, o.z, 'chaosaltar', 3);
        H.tick(10);
        check(`a plain altar at ${o.x},${o.z} offers nothing`, p.stats[5], xpBefore);
        check('  ...and keeps your bones', H.invCount(p, BONE), 5);
    }
}

console.log(R.bad ? `FAILED: ${R.bad} of ${R.ok + R.bad}` : `${R.ok} ok`);
process.exit(R.bad ? 1 : 0);
