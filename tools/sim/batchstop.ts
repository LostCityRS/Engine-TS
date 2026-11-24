/**
 * Every batched skilling loop that holds the player, and whether it lets go.
 *
 * DeathPlateau-Bugs#85 at the furnace and DeathPlateau-Bugs#39 at the chaos altar were the same
 * fault: a repeat paced with p_delay. p_delay sets player.delayed, and MoveClickHandler and its
 * fifteen siblings THROW AWAY a click made while that is set rather than deferring it, so a batch
 * whose hold and whose cadence meet leaves no tick for the player's own click to land in.
 *
 * Both were found by players. This sweeps the rest of the content for the same shape and measures
 * it, rather than reading the code and believing it - which is the mistake that let all of this
 * stand, because three separate comments claimed p_delay "yields" and none of them did:
 *
 *   glass.rs2       "p_delay is what carries the repeat ... It yields, so the player can walk
 *                    away or click something else and the loop ends on its own"
 *   chaos_altar.rs2 the same sentence, before DeathPlateau-Bugs#39
 *   smelting        the same belief with no comment at all, until DeathPlateau-Bugs#85
 *
 * WHAT EACH SECTION ASSERTS, and section 2 of each is the sharp one:
 *   1. the batch repeats from one click, and honours its count
 *   2. the player is NEVER delayed - sampled every tick, because one look after the run finds a
 *      free player and reports nothing wrong
 *   3. a walk click is accepted, and the count STOPS MOVING afterwards - not merely "some left",
 *      which passes with the bug in place because a ten-item batch ends after ten either way
 *
 * Glassblowing is driven through its real panel buttons. The lectern and the carving bench are
 * driven by calling their procs, the way chaosaltar.ts drives its op3 by hand: both need a built
 * house or a quest part-way through, and what is under test is the loop and not the way in.
 *
 * WHICH OF THESE REPRODUCED THE BUG, AND WHICH ONLY PINS THE FIX. Run against the content as it
 * stood, nine of these twenty checks failed - but only glassblowing's five are a faithful
 * reproduction, because only glassblowing is driven the way a player drives it:
 *
 *   glass    27 of 40 ticks held, 0 of 5 walk attempts accepted, 23 molten glass down to 8 while
 *            the player stood on the same tile. That is the report, measured.
 *   lectern  one tablet, then nothing. bench: no cats at all.
 *
 * Those last two are an ARTEFACT OF runProc, not a measurement of the game: runProc executes a
 * script in one shot and a p_delay inside it suspends with nothing to resume it, so the old
 * `while` loop made its first item and stopped there. It is suggestive - a loop that cannot even
 * be driven without a live player is a loop built on p_delay - but the honest claim is narrower:
 * for the lectern and the bench these checks pin the fixed behaviour and do not reproduce the
 * fault. Driving those two as a player would needs a built house, which is a bigger harness than
 * this. The fault in them is read from the code being the same shape, and from glassblowing.
 */
import * as H from './harness.js';
import { check, R, player } from './a1lib.js';
import type Player from '#/engine/entity/Player.js';

await H.boot();

// Anywhere walkable and quiet. None of the three needs a loc to click.
const SPOT: [number, number] = [3222, 3218];

function fresh(who: string): Player {
    const p = player(who, SPOT[0], SPOT[1], 0);
    H.setVar(p, 'tutorial', 1000);
    H.maxOut(p);
    H.clearInv(p);
    return p;
}

/** Ticks the player spent delayed over n ticks, sampled one at a time. */
function heldOver(p: Player, n: number) {
    let held = 0;
    for (let t = 0; t < n; t++) {
        H.tick(1);
        if (p.delayed) held++;
    }
    return held;
}

/** Five attempts to walk away, as a player makes when nothing happens. */
function tryToLeave(p: Player) {
    let accepted = 0;
    for (let i = 0; i < 5; i++) {
        if (H.walkTo(p, SPOT[0] + 8, SPOT[1] + 8)) accepted++;
        H.tick(1);
    }
    return accepted;
}

// ================================================================= 1. glassblowing
// The flagship: its comment claimed the delay yielded, and Make X with a big number is the
// documented way to work a whole inventory - so the lockout was the whole pack long.
{
    const p = fresh('gl_ten');
    H.give(p, 'glassblowingpipe', 1);
    H.give(p, 'molten_glass', 20);
    H.useHeldOn(p, 'glassblowingpipe', 'molten_glass');
    H.tick(2);
    H.ifButton(p, 'glass_crafting:com_11'); // Make 10 vials
    H.tick(60);
    check(`glass: Make 10 blows ten (${H.invCount(p, 'vial_empty')})`, H.invCount(p, 'vial_empty'), 10);
    check('  ...and leaves the rest of the pack alone', H.invCount(p, 'molten_glass'), 10);
}
{
    const p = fresh('gl_held');
    H.give(p, 'glassblowingpipe', 1);
    H.give(p, 'molten_glass', 20);
    H.useHeldOn(p, 'glassblowingpipe', 'molten_glass');
    H.tick(2);
    H.ifButton(p, 'glass_crafting:com_11');
    const held = heldOver(p, 40);
    check(`glass: never delayed across a ten-piece run (${held} of 40 ticks held)`, held, 0);
}
{
    const p = fresh('gl_stop');
    H.give(p, 'glassblowingpipe', 1);
    H.give(p, 'molten_glass', 26);
    H.useHeldOn(p, 'glassblowingpipe', 'molten_glass');
    H.tick(2);
    H.ifButton(p, 'glass_crafting:com_10'); // Make X
    H.typeCount(p, 26);
    H.tick(8);
    const leaving = H.invCount(p, 'molten_glass');
    const accepted = tryToLeave(p);
    H.tick(40);
    const after = H.invCount(p, 'molten_glass');
    check(`glass: a Make X of 26 had started (${26 - leaving} blown)`, leaving < 26, true);
    check(`  ...the step is accepted (${accepted} of 5 attempts)`, accepted > 0, true);
    check(`  ...and walking away stops it (${leaving} left, ${after} after)`, leaving - after <= 2, true);
    check('  ...with the player off the spot', p.x !== SPOT[0] || p.z !== SPOT[1], true);
}

// ================================================================= 2. the lectern
// Tablet 1 is 1 water rune, 1 cosmic rune and 1 soft clay. ~poh_tab_make carries every check and
// every refusal message, so the queue needs none of its own and this only has to prove the repeat
// still repeats and no longer holds.
{
    const p = fresh('tab_ten');
    H.give(p, 'softclay', 20);
    H.give(p, 'waterrune', 20);
    H.give(p, 'cosmicrune', 20);
    H.runProc(p, '[proc,poh_tab_make_n]', [1, 10]);
    H.tick(60);
    const made = 20 - H.invCount(p, 'softclay');
    check(`lectern: Make 10 makes ten (${made})`, made, 10);
}
{
    const p = fresh('tab_held');
    H.give(p, 'softclay', 20);
    H.give(p, 'waterrune', 20);
    H.give(p, 'cosmicrune', 20);
    H.runProc(p, '[proc,poh_tab_make_n]', [1, 10]);
    const held = heldOver(p, 40);
    check(`lectern: never delayed across a ten-tablet run (${held} of 40 ticks held)`, held, 0);
}
{
    const p = fresh('tab_stop');
    // TWENTY, NOT TWENTY-EIGHT. Soft clay does not stack, so 28 of it plus the two rune stacks is
    // thirty slots of twenty-eight and ~poh_tab_make refuses for want of clay it was never given.
    H.give(p, 'softclay', 20);
    H.give(p, 'waterrune', 20);
    H.give(p, 'cosmicrune', 20);
    H.runProc(p, '[proc,poh_tab_make_n]', [1, 20]);
    H.tick(8);
    const leaving = H.invCount(p, 'softclay');
    const accepted = tryToLeave(p);
    H.tick(40);
    const after = H.invCount(p, 'softclay');
    check(`lectern: a run of 20 had started (${20 - leaving} made)`, leaving < 20, true);
    check(`  ...the step is accepted (${accepted} of 5 attempts)`, accepted > 0, true);
    check(`  ...and walking away stops it (${leaving} left, ${after} after)`, leaving - after <= 2, true);
}

// ================================================================= 3. the carving bench
// The Giant Dwarf's wooden cats: a plank and a piece of fur each, capped at ten by the quest.
{
    const p = fresh('cat_ten');
    H.give(p, 'woodplank', 10);
    H.give(p, 'fur', 10);
    H.runProc(p, '[proc,tgbr_carve_cats]', []);
    H.tick(80);
    check(`bench: it stops at the ten the quest wants (${H.invCount(p, 'wooden_cat')})`, H.invCount(p, 'wooden_cat'), 10);
}
{
    const p = fresh('cat_held');
    H.give(p, 'woodplank', 10);
    H.give(p, 'fur', 10);
    H.runProc(p, '[proc,tgbr_carve_cats]', []);
    const held = heldOver(p, 50);
    check(`bench: never delayed while carving (${held} of 50 ticks held)`, held, 0);
}
{
    const p = fresh('cat_stop');
    H.give(p, 'woodplank', 10);
    H.give(p, 'fur', 10);
    H.runProc(p, '[proc,tgbr_carve_cats]', []);
    H.tick(10);
    const leaving = H.invCount(p, 'woodplank');
    const accepted = tryToLeave(p);
    H.tick(50);
    const after = H.invCount(p, 'woodplank');
    check(`bench: carving had started (${10 - leaving} carved)`, leaving < 10, true);
    check(`  ...the step is accepted (${accepted} of 5 attempts)`, accepted > 0, true);
    check(`  ...and walking away stops it (${leaving} left, ${after} after)`, leaving - after <= 2, true);
}

// ================================================================= 4. and the two that were right
// water_sources.rs2 reasons the whole thing through in its own comment - it keeps a p_delay(0) per
// fill and sets the queue's cadence to 2 SO THAT every other tick is undelayed and the player's
// click lands on it. That is a different design from the three above, not a broken one, and this
// holds it to its own claim: a click has to be accepted inside two ticks, every time.
{
    // BESIDE THE WELL, not at SPOT. locsNear searches the whole map, so the nearest well to
    // Lumbridge is still a walk away and the fill never starts from where the others stand.
    const well = H.locsNear('well', SPOT[0], SPOT[1], 0)[0];
    if (!well) {
        check('a well exists to fill from', false, true);
    } else {
        const p = player('well_stop', well.x + 1, well.z, 0);
        H.setVar(p, 'tutorial', 1000);
        H.maxOut(p);
        H.clearInv(p);
        H.give(p, 'bucket_empty', 20);
        H.useHeldOnLoc(p, 'bucket_empty', well.x, well.z, 'well');
        H.tick(6);
        const leaving = H.invCount(p, 'bucket_empty');
        let accepted = 0;
        for (let i = 0; i < 2 && accepted === 0; i++) {
            if (H.walkTo(p, well.x + 6, well.z + 6)) accepted++;
            H.tick(1);
        }
        H.tick(30);
        const after = H.invCount(p, 'bucket_empty');
        check(`well: filling had started (${20 - leaving} filled)`, leaving < 20, true);
        check('  ...and a click lands within two ticks, as its comment claims', accepted > 0, true);
        check(`  ...and stops the run (${leaving} left, ${after} after)`, leaving - after <= 2, true);
    }
}

console.log(R.bad ? `FAILED: ${R.bad} of ${R.ok + R.bad}` : `${R.ok} ok`);
process.exit(R.bad ? 1 : 0);
