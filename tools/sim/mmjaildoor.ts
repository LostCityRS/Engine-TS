/**
 * The Ape Atoll cell door: bare hands get you out, a lockpick gets you out sooner.
 *
 * It used to refuse outright without a lockpick - "it is not going to open for fingers" - which is
 * wrong about the quest, and on this build it shut the door completely: no shop sells a lockpick,
 * so the only sources are pickpocketing a Rogue at Thieving 32 or looting an impling. A player
 * arrested below that was locked in a cell the quest had told them nothing about
 * (DeathPlateau-Bugs#38).
 *
 * WHY THE ODDS ARE MEASURED RATHER THAN READ. stat_random scales with the Thieving level, so "a
 * lockpick helps" is a claim about two distributions, not about one click. A single attempt tells
 * you nothing: at Thieving 1 the bare-handed chance is about a third, so one failed try is the
 * likely outcome even when the fix is working perfectly. These loops drive 400 attempts per case
 * on the seeded RNG and compare the rates.
 */
import * as H from './harness.js';
import { check, R, player } from './a1lib.js';
import World from '#/engine/World.js';
import NpcType from '#/cache/config/NpcType.js';

await H.boot();

// ^mm_jail_cell is 0_43_43_19_42 -> 2771,2794, and the door is at 2771,2795.
const CELL: [number, number] = [2771, 2794];
const DOOR: [number, number] = [2771, 2795];
const OUTSIDE: [number, number] = [2771, 2796];
const TRIES = 120;

/**
 * Try the door `TRIES` times at this Thieving level and count how often it opens.
 * The player is put back in the cell after every success, so each attempt is independent.
 */
function pickRate(who: string, thieving: number, withPick: boolean) {
    const p = player(who, CELL[0], CELL[1], 0);
    H.setVar(p, 'tutorial', 1000);
    p.levels[17] = thieving;
    p.baseLevels[17] = thieving;
    if (withPick) H.give(p, 'lockpick', 1);

    let opened = 0;
    let tried = 0;
    for (let i = 0; i < TRIES; i++) {
        p.teleport(CELL[0], CELL[1], 0);
        H.tick(2);
        H.clearLogs();
        H.opLoc(p, DOOR[0], DOOR[1], 'mm_jail_door', 1);
        // WAIT FOR THE ATTEMPT TO RESOLVE, AND NO LONGER. The success path has three p_delays and
        // a teleport where the failure path has one delay, so a flat budget either measures
        // successes as failures (six ticks had Thieving 99 at 50% when the roll makes it certain)
        // or spends the long budget on every failure as well, which is most of them. Breaking as
        // soon as either outcome shows took this file from four minutes to under two.
        let out = false;
        for (let t = 0; t < 14; t++) {
            H.tick(1);
            if (p.x === OUTSIDE[0] && p.z === OUTSIDE[1]) {
                out = true;
                break;
            }
            if (H.mesgs.some(m => m.who === p.username && m.text.includes('will not give'))) break;
        }
        if (H.mesgs.some(m => m.who === p.username && m.text.includes('You pick at the bamboo'))) tried++;
        if (out) opened++;
    }
    return { opened, tried };
}

// ---- 1. bare handed, which is the whole of the report ---------------------------------------
{
    const bare = pickRate('jailbare', 1, false).opened;
    check(`a level 1 thief opens it bare handed (${bare} of ${TRIES})`, bare > 0, true);
    // Not just "sometimes": often enough that a player is not stuck in a cell for an hour. The
    // configured base is 80/256, about a third, so a tenth is a floor far below the real rate
    // and well clear of the dice.
    check(`  ...and often enough to get out (${Math.round((bare / TRIES) * 100)}%, floor 10%)`, bare >= TRIES / 10, true);
}

// ---- 2. and a lockpick only improves it -----------------------------------------------------
{
    const bare = pickRate('jailb2', 1, false).opened;
    const pick = pickRate('jailp2', 1, true).opened;
    check(`a lockpick beats bare hands at level 1 (${pick} vs ${bare} of ${TRIES})`, pick > bare, true);
}

// ---- 3. and the Thieving level matters, which is what makes it a roll and not a coin ---------
{
    const lo = pickRate('jaillo', 1, false);
    const hi = pickRate('jailhi', 99, false);
    const low = lo.opened;
    const high = hi.opened;
    console.log(`      (clicks that reached the lock: ${lo.tried} at Thieving 1, ${hi.tried} at 99, of ${TRIES})`);
    check(`  ...and Thieving 99 opens every lock it reaches (${hi.opened}/${hi.tried})`, hi.opened, hi.tried);
    check(`Thieving 99 beats Thieving 1 bare handed (${high} vs ${low} of ${TRIES})`, high > low, true);
}

// ---- 4. the door is not a gate ---------------------------------------------------------------
// The failure must not be the old refusal. If the lockpick check ever comes back as a gate, every
// bare-handed attempt returns before the roll and section 1 fails - but this names it directly so
// a regression says which bug returned.
{
    const p = player('jailmsg', CELL[0], CELL[1], 0);
    H.setVar(p, 'tutorial', 1000);
    p.levels[17] = 1;
    p.baseLevels[17] = 1;
    H.clearLogs();
    H.opLoc(p, DOOR[0], DOOR[1], 'mm_jail_door', 1);
    H.tick(5);
    const said = H.mesgs
        .filter(m => m.who === p.username)
        .map(m => m.text)
        .join(' | ');
    // THE POSITIVE CLAIM ONLY. The first version of this also asserted that the old refusal -
    // "it is not going to open for fingers" - was absent, and that check could never fail: the
    // refusal was a ~mesbox, which draws an interface, and H.mesgs only sees mes(). It passed
    // with the fix reverted, next to four checks that correctly failed. What the lock DID say is
    // the honest test, and it fails the moment the gate comes back.
    check('a bare-handed player gets an attempt at the lock', said.includes('You pick at the bamboo and brass'), true);
}

// ---- 5. and sometimes a guard is standing outside -------------------------------------------
//
// The other half of wiki steps 13-14, reported separately (DeathPlateau-Bugs#41): the lock was
// here and the patrol was not. mm_monkey_guard has no static spawn anywhere in the build, so the
// prison held five archers that cannot reach the corridor and nothing else - picking the lock and
// walking away was free.
//
// It reuses the gate's ambush, so what is new is only the decision to call it: on a coin toss, not
// while the player is a monkey, and not twice inside %mm_guards_cooldown.
//
// SECTIONS 1-4 ARE UNAFFECTED, and that is not luck: they break out of the tick loop the moment
// the player reaches the far tile, which is the same tick the door opens - a guard has not walked
// or swung by then. Measured before writing this: 120 of 120 at Thieving 99, unchanged.

const GUARD = NpcType.getId('mm_monkey_guard');

/**
 * Every mm_monkey_guard in the world, gone. Each escape puts its guard in the same corridor and
 * they live ^mm_captor_lifetime ticks, so without this the corridor fills up and every later look
 * finds somebody else's guard.
 */
function clearGuards() {
    for (const npc of World.npcs) {
        if (npc && npc.isActive && npc.type === GUARD) World.removeNpc(npc, -1);
    }
}

/**
 * A guard within `r` tiles of the player - NOT H.npcNear, which returns the nearest
 * mm_monkey_guard in the WORLD with no distance bound. That is how the first version of this read
 * 100% guarded, 8 guards for greegree-wearing players and 12 of 12 cooldown failures: once one
 * guard existed anywhere, every later check found it and said yes.
 */
function guardWithin(p: any, r = 5): boolean {
    for (const npc of World.npcs) {
        if (!npc || !npc.isActive || npc.type !== GUARD || npc.level !== p.level) continue;
        if (Math.max(Math.abs(npc.x - p.x), Math.abs(npc.z - p.z)) <= r) return true;
    }
    return false;
}

/** Escape once at Thieving 99 and say whether a guard turned up beside the player. */
function escapeGuarded(who: string, asMonkey: boolean, resetCooldown: boolean): boolean {
    if (resetCooldown) clearGuards();
    const p: any = player(who, CELL[0], CELL[1], 0);
    H.setVar(p, 'tutorial', 1000);
    p.levels[17] = 99;
    p.baseLevels[17] = 99;
    if (asMonkey) H.equip(p, { rhand: 'mm_monkey_greegree_for_normal_gorilla' });
    if (resetCooldown) H.setVar(p, 'mm_guards_cooldown', 0);
    H.opLoc(p, DOOR[0], DOOR[1], 'mm_jail_door', 1);
    for (let t = 0; t < 14; t++) {
        H.tick(1);
        if (p.x === OUTSIDE[0] && p.z === OUTSIDE[1]) break;
    }
    H.tick(1);
    return guardWithin(p);
}

let guarded = 0;
const ESCAPES = 40;
for (let i = 0; i < ESCAPES; i++) {
    if (escapeGuarded('jg' + i, false, true)) guarded++;
}
const pct = Math.round((guarded * 100) / ESCAPES);
check(`a guard is outside on roughly half of ${ESCAPES} escapes (${pct}%)`, guarded > 5 && guarded < ESCAPES - 5, true);

// A MONKEY IS NOT ARRESTED. ~mm_captor_add sets opplayer2 by hand and never goes through mm.hunt,
// so the hunt's check_invparam cannot do this for us - without the explicit check a guard would be
// added and then vanish on its first swing, which is worse than no guard.
let monkeyGuards = 0;
for (let i = 0; i < 15; i++) {
    if (escapeGuarded('jgm' + i, true, true)) monkeyGuards++;
}
check('no guard ever appears for a player wearing a greegree', monkeyGuards, 0);

// THE COOLDOWN HOLDS. Picking the lock, being knocked back in and picking it again must not stack
// guards the way talking to four monkeys in one walk across Marim used to.
//
// ONE PLAYER, TWICE. %mm_guards_cooldown is a PLAYER varp, so two different players each start on
// a clock of nought - the first version of this check used a fresh player for the second escape
// and was really measuring two first escapes. It reported 6 of 12 and the content was right.
{
    let twice = 0;
    let pairs = 0;
    for (let i = 0; i < 20; i++) {
        clearGuards();
        const p: any = player('jgc' + i, CELL[0], CELL[1], 0);
        H.setVar(p, 'tutorial', 1000);
        p.levels[17] = 99;
        p.baseLevels[17] = 99;
        H.setVar(p, 'mm_guards_cooldown', 0);
        const out = (): boolean => {
            H.opLoc(p, DOOR[0], DOOR[1], 'mm_jail_door', 1);
            for (let t = 0; t < 14; t++) {
                H.tick(1);
                if (p.x === OUTSIDE[0] && p.z === OUTSIDE[1]) break;
            }
            H.tick(1);
            return guardWithin(p);
        };
        const first = out();
        // the guard goes, the CLOCK stays - which is the thing under test
        clearGuards();
        p.teleport(CELL[0], CELL[1], 0);
        H.tick(2);
        const second = out();
        if (first) pairs++;
        if (first && second) twice++;
    }
    check(`a second escape inside the cooldown never gets another guard (${pairs} first escapes were guarded)`, twice, 0);
}

console.log(R.bad ? `FAILED: ${R.bad} of ${R.ok + R.bad}` : `${R.ok} ok`);
process.exit(R.bad ? 1 : 0);
