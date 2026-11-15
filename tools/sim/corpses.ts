// DOES A DEAD NPC GO AWAY? Asked of the npcs a fuzz run reported as corpses, against a control group
// that works, in three different situations - because the finding counts alone cannot say whether
// those npcs are broken or the watcher's threshold is wrong.
//
//   npx tsx tools/sim/corpses.ts
//
// A 99-bot run reported four corpses - "still in the world N ticks after its hitpoints reached 0
// (npc_del never ran)" - for mm_monkey_guard, mm_oipuis and mm_duke, at 12 and 16 ticks against
// CORPSE_TICKS = 10.
//
// WHAT THIS SETTLES. An ordinary monster leaves the world THREE TICKS after its hitpoints reach 0,
// which is what [proc,npc_death] in skill_combat/scripts/npc/npc_death.rs2 should cost:
// npc_arrivedelay for up to two ticks, then npc_anim, npc_delay(1), npc_del. So CORPSE_TICKS = 10
// is three times the norm, the watcher is not crying wolf, and 12 and 16 ticks are real anomalies.
// It also exonerates two of the three suspects: mm_duke and mm_monkey_guard both go in three ticks.
//
// WHAT IT DOES NOT SETTLE: the cause. Three hypotheses, each the obvious one in turn, each dead:
//
//   the npc_findhero chain aborts and takes npc_del with it - which is what the corpse watcher's
//     own docstring blames for the one live instance it was written for. Ruled out by reading: all
//     six hooks after the arrivedelay return from THEMSELVES on a failed npc_findhero, not from
//     npc_death, so a bot that relocated mid-kill does not stop the removal.
//   npc_arrivedelay waits out a chase route - the one thing a 99-bot world does that a probe does
//     not, since the bots never stop moving. Ruled out by measurement: killed mid-chase costs at
//     most ONE extra tick (man 4, goblin and rat still 3).
//   several attackers at once, so %npc_aggressive_player is not whoever landed the kill - also
//     something one player cannot produce. Ruled out: a crowd of four changes nothing, and it is
//     what finally let mm_monkey_guard be killed at all.
//
// So the corpse needs something else the fuzz world has and this does not. The untried candidates,
// in the order they are worth trying: a SPELL kill, which is the bots' single commonest action
// (61,617 casts in that run, more than any other); an attacker who dies or logs out between the
// hit and the removal; and an instanced area.
//
// mm_oipuis is still untestable here - it cannot be brought to 0 hitpoints even by four max-stat
// players with dragon scimitars - so this probe says nothing at all about it, and the denominator
// is printed for that reason. A probe that skips its subject and exits 0 is the trap
// quest_garden_run fell into, aborting at step 6 and reporting 4 of 5 passing while 83 checks had
// never run.
//
// FOUR WRONG TURNS GOT HERE, all of them the probe's own and all worth leaving written down:
//
//   1. mm_duke died in three ticks on one run and was UNTESTED on the next with nothing changed.
//      That was an attack roll landing once, and it was briefly reported as a finding. A single
//      sample is not a measurement.
//   2. Re-setting hitpoints to 1 every tick, to make the kill certain, stopped EVERYTHING dying -
//      including the npc that had died before. Reverted.
//   3. The suspects were never unkillable: the controls have trivial defence and die to an unarmed
//      player at once, while all three carry 130 defence and the probe's player held nothing. It
//      wields a dragon scimitar now, and a crowd of four got the last one down.
//   4. A kill the probe never observed at 0 hitpoints was reported as "0 ticks, the same as alone".
//      That read as a measurement of instant removal; it means only that the death and the removal
//      both fell between two of the loop's looks. It says "no interval to report" now.
import * as H from './harness.js';
import NpcType from '#/cache/config/NpcType.js';
import { NpcStat } from '#/engine/entity/NpcStat.js';

await H.boot();

const SUSPECTS = ['mm_monkey_guard', 'mm_oipuis', 'mm_duke'];
// The control group: ordinary placed monsters nobody has ever reported a corpse for.
const CONTROLS = ['goblin', 'rat', 'man', 'guard'];

const p = H.makePlayer('mortician', 3222, 3218) as unknown as { x: number; z: number; level: number; teleport(x: number, z: number, level: number): void; applyDamage: (d: number) => void };
H.tick(2);
H.maxOut(p as never);
// A WEAPON, which is what separated the control group from the suspects. goblin, rat and man have
// trivial defence and an unarmed max-stat player kills them at once; mm_monkey_guard, mm_oipuis and
// mm_duke all carry 130 defence, and fifty unarmed swings over 400 ticks missed every time. Three
// runs of this probe reported them "could not be brought to 0 hitpoints" and the explanation was
// never anything about those npcs - it was the fist the probe was using.
H.equip(p as never, { rhand: 'dragon_scimitar' });
p.applyDamage = function () {};

let ok = 0;
let bad = 0;

/** Ticks between hitpoints reaching 0 and the npc leaving the world; -1 still standing, null unkillable. */
function timeToRemoval(name: string): number | null {
    if (NpcType.getId(name) === -1) {
        console.log(`  MISSING ${name} - no such npc, so this probe says nothing about it`);
        return null;
    }
    p.teleport(3222, 3218, 0);
    H.tick(1);
    const npc = H.addNpc(name, 3224, 3218);
    H.tick(1);
    // ONE HITPOINT, ONCE, and then hit it - so the death is the engine's own sequence rather than a
    // long fight with its own dice.
    //
    // RE-SETTING IT TO 1 EVERY TICK WAS TRIED AND IS WORSE. The idea was to make the kill certain
    // rather than leaving it to whether an attack roll lands, since mm_monkey_guard and mm_oipuis
    // survived 120 ticks here while mm_duke died in three and all three carry the same 130 across
    // the board. With the per-tick reset in, NOTHING died at all - not even the npc that had died
    // before - so whatever keeps those two alive is not the roll, and the reset was fighting
    // something else. Left as the simple version, with the subjects it cannot engage reported as
    // UNTESTED rather than quietly passing.
    npc.levels[NpcStat.HITPOINTS] = 1;
    let zeroAt = -1;
    for (let t = 0; t < 400; t++) {
        // RE-ISSUED, not set once. attackNpc establishes the interaction and the player swings
        // while it holds - but it does not hold forever, and a probe that attacks once then waits
        // out its budget reports "could not be brought to 0 hitpoints" for an npc that is perfectly
        // killable. mm_duke died in three ticks on one run of the single-attack version and was
        // UNTESTED on the next, with nothing changed: that was the roll landing once, not a
        // measurement, and it is exactly the flakiness choptrees had.
        if (zeroAt === -1 && npc.isActive && t % 8 === 0) {
            npc.levels[NpcStat.HITPOINTS] = 1;
            H.attackNpc(p as never, npc);
        }
        H.tick(1);
        if (zeroAt === -1 && npc.levels[NpcStat.HITPOINTS] === 0) {
            zeroAt = t;
        }
        if (!npc.isActive) {
            // -2, NOT 0. Reaching here with zeroAt unset means hitpoints were never OBSERVED at 0 -
            // the death and the removal both happened between two of this loop's looks - so there
            // is no interval to report. Returning 0 read as "removed instantly, same as alone",
            // which is a measurement the probe did not make.
            return zeroAt === -1 ? -2 : t - zeroAt;
        }
    }
    return zeroAt === -1 ? null : -1;
}

console.log('-- the control group: ordinary monsters');
const controlTimes: number[] = [];
let untested = 0;
for (const name of CONTROLS) {
    const n = timeToRemoval(name);
    if (n === null) {
        untested++;
        continue;
    }
    if (n === -1) {
        console.log(`  FAIL ${name} was STILL in the world 120 ticks after dying - the control group is not a control`);
        bad++;
    } else {
        console.log(`  ok   ${name} left the world ${n} ticks after its hitpoints reached 0`);
        controlTimes.push(n);
        ok++;
    }
}
const worstControl = controlTimes.length ? Math.max(...controlTimes) : 0;
console.log(`   the slowest ordinary death here is ${worstControl} ticks`);

// ------------------------------------------------------------------ killed while it is chasing
//
// WHY THIS SECOND SCENARIO. [proc,npc_death] in skill_combat/scripts/npc/npc_death.rs2 is
// npc_walk(npc_coord), npc_setmode(none), a handful of hooks, then npc_arrivedelay, then
// npc_anim(death), npc_delay(1), npc_del. Arrivedelay plus the one tick is where the control
// group's three ticks come from - so the thing that could stretch it is the ARRIVEDELAY, which
// waits for the npc's route to finish.
//
// The probe above kills an npc standing next to the player. A fuzz run never does: 99 bots walk
// constantly and an aggressive npc is part-way through a chase when it dies. That is the one
// difference between the context that reports corpses and the context that does not, so it is the
// one worth measuring. Every candidate inside the chain was ruled out first - all six hooks after
// the arrivedelay return from THEMSELVES when npc_findhero fails, not from npc_death, so a bot that
// relocated mid-kill does not take npc_del with it.
function timeToRemovalWhileChasing(name: string): number | null {
    if (NpcType.getId(name) === -1) return null;
    p.teleport(3222, 3218, 0);
    H.tick(1);
    const npc = H.addNpc(name, 3224, 3218);
    H.tick(1);
    H.attackNpc(p as never, npc);
    H.tick(3);
    // Walk out of its reach so it has a route to run, then come back and finish it mid-chase.
    p.teleport(3222 + 9, 3218 + 9, 0);
    H.tick(6);
    p.teleport(npc.x + 1, npc.z, 0);
    H.tick(1);
    npc.levels[NpcStat.HITPOINTS] = 1;
    let zeroAt = -1;
    for (let t = 0; t < 400; t++) {
        if (zeroAt === -1 && npc.isActive && t % 8 === 0) {
            npc.levels[NpcStat.HITPOINTS] = 1;
            H.attackNpc(p as never, npc);
        }
        H.tick(1);
        if (zeroAt === -1 && npc.levels[NpcStat.HITPOINTS] === 0) {
            zeroAt = t;
        }
        if (!npc.isActive) {
            // -2, NOT 0. Reaching here with zeroAt unset means hitpoints were never OBSERVED at 0 -
            // the death and the removal both happened between two of this loop's looks - so there
            // is no interval to report. Returning 0 read as "removed instantly, same as alone",
            // which is a measurement the probe did not make.
            return zeroAt === -1 ? -2 : t - zeroAt;
        }
    }
    return zeroAt === -1 ? null : -1;
}

console.log('');
console.log('-- the control group again, but killed mid-chase');
for (const name of CONTROLS) {
    const n = timeToRemovalWhileChasing(name);
    if (n === null) continue;
    if (n === -1) {
        console.log(`  FAIL ${name} was STILL in the world 400 ticks after dying mid-chase`);
        bad++;
    } else if (n === -2) {
        console.log(`  --   ${name} mid-chase: died and was removed between two looks, so no interval to report`);
    } else if (n > worstControl) {
        console.log(`  >>>> ${name} took ${n} ticks mid-chase, against ${worstControl} standing still`);
        ok++;
    } else {
        console.log(`  ok   ${name} mid-chase is ${n} ticks, the same as standing still`);
        ok++;
    }
}

// ------------------------------------------------------------- killed with a crowd on it
//
// THE LAST CANDIDATE THAT FITS THE CONTEXT. 99 bots in one place means several of them attack the
// same npc, and npc_death reads %npc_aggressive_player - ONE player - for its death sound, while
// npc_findhero picks the hero out of whoever damaged it. A kill where the damage came from several
// players, and the one the npc was aggressive towards is not the one that landed the last hit, is
// something a single-player probe cannot produce at all.
function timeToRemovalWithCrowd(name: string, others: { teleport(x: number, z: number, level: number): void }[]): number | null {
    if (NpcType.getId(name) === -1) return null;
    p.teleport(3222, 3218, 0);
    H.tick(1);
    const npc = H.addNpc(name, 3224, 3218);
    H.tick(1);
    // Everybody piles on, so the npc has several attackers and picks one to be aggressive towards.
    for (const o of others) {
        o.teleport(npc.x, npc.z + 1, 0);
    }
    H.tick(1);
    for (const o of others) {
        H.attackNpc(o as never, npc);
    }
    H.attackNpc(p as never, npc);
    H.tick(4);
    let zeroAt = -1;
    for (let t = 0; t < 400; t++) {
        if (zeroAt === -1 && npc.isActive && t % 8 === 0) {
            npc.levels[NpcStat.HITPOINTS] = 1;
            H.attackNpc(p as never, npc);
            for (const o of others) {
                H.attackNpc(o as never, npc);
            }
        }
        H.tick(1);
        if (zeroAt === -1 && npc.levels[NpcStat.HITPOINTS] === 0) {
            zeroAt = t;
        }
        if (!npc.isActive) {
            // -2, NOT 0. Reaching here with zeroAt unset means hitpoints were never OBSERVED at 0 -
            // the death and the removal both happened between two of this loop's looks - so there
            // is no interval to report. Returning 0 read as "removed instantly, same as alone",
            // which is a measurement the probe did not make.
            return zeroAt === -1 ? -2 : t - zeroAt;
        }
    }
    return zeroAt === -1 ? null : -1;
}

console.log('');
console.log('-- the control group again, with three more players hitting it');
const crowd: { teleport(x: number, z: number, level: number): void }[] = [];
for (let i = 0; i < 3; i++) {
    const other = H.makePlayer('mob' + i, 3230 + i, 3218) as unknown as { teleport(x: number, z: number, level: number): void; applyDamage: (d: number) => void };
    H.tick(1);
    H.maxOut(other as never);
    H.equip(other as never, { rhand: 'dragon_scimitar' });
    other.applyDamage = function () {};
    crowd.push(other);
}
H.tick(2);
for (const name of CONTROLS) {
    const n = timeToRemovalWithCrowd(name, crowd);
    if (n === null) continue;
    if (n === -1) {
        console.log(`  FAIL ${name} was STILL in the world 400 ticks after dying in a crowd`);
        bad++;
    } else if (n === -2) {
        console.log(`  --   ${name} in a crowd: died and was removed between two looks, so no interval to report`);
    } else if (n > worstControl) {
        console.log(`  >>>> ${name} took ${n} ticks in a crowd, against ${worstControl} alone`);
        ok++;
    } else {
        console.log(`  ok   ${name} in a crowd is ${n} ticks, the same as alone`);
        ok++;
    }
}

console.log('');
console.log('-- the four the fuzz run reported');
for (const name of SUSPECTS) {
    const n = timeToRemoval(name);
    if (n === null) {
        console.log(`  UNTESTED ${name} - could not be brought to 0 hitpoints in 400 ticks`);
        untested++;
        continue;
    }
    if (n === -1) {
        console.log(`  FAIL ${name} was STILL in the world 400 ticks after dying - npc_del never ran`);
        bad++;
    } else if (n === -2) {
        console.log(`  --   ${name}: died and was removed between two looks, so no interval to report`);
    } else if (n > worstControl) {
        console.log(`  FAIL ${name} took ${n} ticks to leave, against ${worstControl} for an ordinary monster`);
        bad++;
    } else {
        console.log(`  ok   ${name} left the world ${n} ticks after its hitpoints reached 0, same as any monster`);
        ok++;
    }
}

// ------------------------------------------------------------------ killed with a spell
//
// THE DEATH PATH THE PROBE NEVER TRIED, and the reason this section exists. Every scenario above
// kills with a dragon scimitar, and the four findings came out of a fuzz run whose bots cast 61,617
// spells - their commonest action by a wide margin. If a magic kill removes a corpse on a different
// schedule from a melee kill, every measurement above was taken on the wrong weapon.
//
// Same shape as the others: one hitpoint, re-issued casts, and the interval between hitpoints
// reaching 0 and the npc leaving the world.

/** Ticks between hitpoints reaching 0 and removal, killed with fire bolt rather than a blade. */
function timeToRemovalBySpell(name: string): number | null {
    if (NpcType.getId(name) === -1) {
        console.log(`  MISSING ${name} - no such npc, so this probe says nothing about it`);
        return null;
    }
    p.teleport(3222, 3218, 0);
    H.tick(1);
    const npc = H.addNpc(name, 3224, 3218);
    H.tick(1);
    npc.levels[NpcStat.HITPOINTS] = 1;
    let zeroAt = -1;
    for (let t = 0; t < 400; t++) {
        if (zeroAt === -1 && npc.isActive && t % 8 === 0) {
            npc.levels[NpcStat.HITPOINTS] = 1;
            H.castOnNpc(p as never, npc, 'magic:fire_bolt');
        }
        H.tick(1);
        if (zeroAt === -1 && npc.levels[NpcStat.HITPOINTS] === 0) {
            zeroAt = t;
        }
        if (!npc.isActive) {
            return zeroAt === -1 ? -2 : t - zeroAt;
        }
    }
    return zeroAt === -1 ? null : -1;
}

console.log('');
console.log('-- the same npcs again, killed with fire bolt instead of a blade');
// Runes rather than a staff, so nothing depends on what is in the weapon hand - the scimitar can
// stay equipped and the only thing that changes between this section and the first is the kill.
H.give(p as never, 'airrune', 5000);
H.give(p as never, 'chaosrune', 5000);
H.give(p as never, 'firerune', 5000);
H.tick(1);
const SPELL_TARGETS = [...CONTROLS, ...SUSPECTS];
for (const name of SPELL_TARGETS) {
    // MISSING was already reported by the melee pass; counting it again here would report one
    // absent npc as two problems.
    if (NpcType.getId(name) === -1) continue;
    const n = timeToRemovalBySpell(name);
    if (n === null) {
        console.log(`  UNTESTED ${name} - fire bolt could not bring it to 0 hitpoints in 400 ticks`);
        untested++;
    } else if (n === -1) {
        console.log(`  FAIL ${name} was STILL in the world 400 ticks after dying to a spell`);
        bad++;
    } else if (n === -2) {
        console.log(`  --   ${name}: died and was removed between two looks, so no interval to report`);
    } else if (n > worstControl) {
        // MEASURED AND REPORTED, NOT FAILED, and the distinction is the point.
        //
        // A spell kill really does take longer: 5 ticks against melee's 3, byte-identical over two
        // runs, for goblin, man and mm_monkey_guard. But a fire bolt has a projectile to fly and a
        // hit to land, so 2 extra ticks may be exactly right, and a sim that calls the correct
        // answer a failure is red every night for nothing - which is the mistake the first version
        // of the fuzz gate made, gating on 254 findings that were all normal.
        //
        // So this prints the difference and leaves the verdict open. What makes it worth printing
        // at all: the fuzz run whose four corpse findings started this probe had its bots cast
        // 61,617 spells, their commonest action by a wide margin, so this is the death path those
        // findings most likely came through. It is not on its own an explanation - CORPSE_TICKS is
        // 10 and 5 is well under it, so nothing here would trip the watcher - but it is the first
        // measured difference between two death paths, and it says where to look next.
        //
        // Unexplained, and the next thread to pull: rat and mm_oipuis come back at 3 either way,
        // so whatever adds the 2 ticks does not add them for every npc.
        console.log(`  >>>> ${name} took ${n} ticks to leave after a spell kill, against ${worstControl} for a melee kill`);
    } else {
        console.log(`  ok   ${name} left ${n} ticks after a spell kill, the same as a melee one`);
        ok++;
    }
}

console.log('');
// THE DENOMINATOR IS PRINTED, because a probe that skips its subject and exits 0 is the trap
// quest_garden_run fell into: it aborted at step 6 and reported 4 of 5 passing while 83 checks had
// never run.
console.log(`${ok} ok, ${bad} FAIL, ${untested} untested of ${CONTROLS.length + SUSPECTS.length} npcs across ${4} scenarios`);
process.exit(bad ? 1 : 0);
