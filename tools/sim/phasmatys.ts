// PORT PHASMATYS: the twelve ghosts nobody could talk to, and the toll on its gates.
//
// Eight ghost sailors on the docks and four ghost guards on the two barriers, every one of them
// offering Talk-To with nothing behind it. They are the first people a player meets in the town and
// they said nothing at all.
//
// WHAT IS WORTH TESTING, in order of what would break a player's day:
//   1. The toll. Two ecto-tokens, taken only when the player actually goes through, never taken on
//      a refusal, and not taken at all once the quest is done. A toll that charges and does not
//      move anybody is worse than no toll.
//   2. Which barrier a guard opens. The guard decides by its OWN latitude, so a guard at the south
//      gate must not fling a player across the north one twenty-three tiles away.
//   3. The ghostspeak rule, both ways: the sailor wails without the amulet and talks with it, and
//      the guards do not negotiate with somebody who cannot hear them.
//   4. The barrier itself still charging a player mid-quest, which is the behaviour the free pass
//      must not have swallowed.
import * as H from './harness.ts';
import { check, R, player, drive } from './a1lib.ts';
import NpcType from '#/cache/config/NpcType.js';
import Npc from '#/engine/entity/Npc.js';
import Player from '#/engine/entity/Player.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import World from '#/engine/World.js';

await H.boot();

const SOUTH_BARRIER = { x: 3652, z: 3485 };
const NORTH_BARRIER = { x: 3659, z: 3508 };

/**
 * WHICH SIDE OF A GATE A TILE IS ON, which is the only honest way to ask "did the player go
 * through?" - and the second thing this sim got wrong.
 *
 * A before/after distance cannot answer it. opNpc walks the player at a wandering npc, so an
 * ordinary conversation moves them a tile or two with no gate involved, and the first run read
 * those steps as crossings (and a real two-tile crossing as three). The side is immune to all of
 * it: ~ahoy_step_through crosses the wall, and the wall's own axis is the one that flips.
 *
 * The south barrier is turned (angle 2) so crossing it changes x; the north one (angle 3) changes
 * z. Taken from the map data, the same place quest_ahoy.constant's two coords come from.
 */
const southSide = (x: number) => x > SOUTH_BARRIER.x;
const northSide = (z: number) => z > NORTH_BARRIER.z;

// Both halves of what the player was shown, and a joined search - the same two traps zanaris.ts
// records: ~chatnpc WRAPS at 380 pixels into separate component texts, and half the lines here are
// mes()/mesbox() and never touch an interface at all.
type Mark = { iface: number; mes: number };
const mark = (): Mark => ({ iface: H.ifaces.length, mes: H.mesgs.length });
function lines(p: Player, from: Mark): string[] {
    return [
        ...H.ifaces
            .slice(from.iface)
            .filter(i => i.who === p.username && i.kind === 'text' && i.text)
            .map(i => i.text!),
        ...H.mesgs.slice(from.mes).filter(m => m.who === p.username).map(m => m.text)
    ];
}
const said = (out: string[], s: string) => out.join(' ').includes(s);

/**
 * WHERE THE PLAYER WAS STANDING WHEN THE CONVERSATION STARTED, which is not where they logged in.
 *
 * talkTo teleports with H.standBeside, so a before/after read taken around the call measures the
 * teleport as well as the gate. The first run of this sim reported "nobody moves: [3650,3487]" of a
 * guard who had moved nobody, and "stepped through the gate: 3" of a two-tile step. Every distance
 * below is measured from here.
 */
let stood: [number, number] = [0, 0];

function talkTo(p: Player, npc: Npc, picks: (number | string)[] = [], label = 'the menu this step expects'): string[] {
    const from = mark();
    if (!H.standBeside(p, npc)) {
        throw new Error(`nowhere to stand beside ${npc.x},${npc.z},${npc.level}`);
    }
    stood = [p.x, p.z];
    H.opNpc(p, npc, 1);
    for (let t = 0; t < 10 && !p.activeScript; t++) {
        H.tick(1);
    }
    try {
        drive(p, picks);
    } catch (e) {
        check(`  ${label}`, String(e).replace(/^Error: /, ''), picks.length ? 'the toll menu' : 'no menu at all');
    }
    H.tick(2);
    return lines(p, from);
}

function must(name: string, x: number, z: number, level = 0): Npc {
    const npc = H.npcNear(name, x, z, level);
    if (!npc) {
        throw new Error(`no ${name} is placed near ${x},${z},${level}`);
    }
    return npc;
}

function placed(name: string): number {
    let n = 0;
    for (const npc of World.npcs) {
        if (npc && npc.type === H.npcNear(name, 0, 0)?.type) {
            n++;
        }
    }
    return n;
}

const hear = (p: Player) => H.equip(p, { front: 'amulet_of_ghostspeak' });

// ============================================================================ the ghost sailors

console.log('THE GHOST SAILORS');
{
    check('  ahoy_ghost_sailor has a Talk-to script', !!ScriptProvider.getByName('[opnpc1,ahoy_ghost_sailor]'), true);
    check('  and the map places eight', placed('ahoy_ghost_sailor'), 8);

    const p = player('phas_sailor', 3687, 3502);
    let out = talkTo(p, must('ahoy_ghost_sailor', 3687, 3502));
    check('  without the amulet he wails', said(out, 'Woooo wooo wooooo woooo'), true);
    check('  and says nothing about ships', said(out, 'We keep ships'), false);

    hear(p);
    out = talkTo(p, must('ahoy_ghost_sailor', 3687, 3502));
    check('  with it, the player asks why a dead town keeps ships', said(out, 'Why do you still bother having ships here'), true);
    check('  and is told: trade, and the Ectofuntus', said(out, "so that the Ectopower doesn't run out"), true);
    check('  the player works out what that means', said(out, "you're history, right?"), true);
    check('  and he agrees', said(out, 'Aye, matey.'), true);
    check('  no wail this time', said(out, 'Woooo'), false);
}

// ============================================================================= the ghost guards

console.log('\nTHE GHOST GUARDS, WITHOUT THE AMULET');
{
    check('  ahoy_ghost_guard has a Talk-to script', !!ScriptProvider.getByName('[opnpc1,ahoy_ghost_guard]'), true);
    check('  and the map places four', placed('ahoy_ghost_guard'), 4);

    const p = player('phas_deaf', 3652, 3484);
    H.give(p, 'ectotoken', 2);
    const out = talkTo(p, must('ahoy_ghost_guard', 3652, 3484), [], 'a deaf player gets no menu');
    check('  they wail, and the player understands the meaning', said(out, 'you may not pass the barriers of Port Phasmatys'), true);
    check('  no toll is named', said(out, 'toll charge of 2 Ectotokens'), false);
    check('  no tokens are taken', H.invCount(p, 'ectotoken'), 2);
    check('  and nobody gets through', southSide(p.x), southSide(stood[0]));
}

console.log('\nTHE GUARDS STAY ON THEIR POSTS');
{
    // configs/ahoy_guards.npc pins them, and the toll's geometry depends on it: ~ahoy_step_through
    // moves the player relative to themselves, so a guard that has drifted off its gate would step
    // somebody standing beside it through nothing at all. Measured over 200 ticks of wandering.
    const spawns = [
        [3652, 3484],
        [3652, 3487],
        [3658, 3508],
        [3661, 3508]
    ];
    const id = must('ahoy_ghost_guard', 3652, 3484).type;
    check('  their config says wanderrange 0', NpcType.get(id).wanderrange, 0);
    H.tick(200);
    let adrift = 0;
    for (const npc of World.npcs) {
        if (!npc || npc.type !== id) {
            continue;
        }
        if (!spawns.some(([x, z]) => npc.x === x && npc.z === z)) {
            adrift++;
            console.log(`    adrift: ${npc.x},${npc.z}`);
        }
    }
    check('  and after 200 ticks all four are still where they spawned', adrift, 0);
}

console.log('\nTHE TOLL, PAID');
{
    const p = player('phas_pay', 3652, 3484);
    hear(p);
    H.give(p, 'ectotoken', 5);
    const guard = must('ahoy_ghost_guard', 3652, 3484);
    const out = talkTo(p, guard, ["here's 2 Ectotokens"]);
    check('  the toll is two ecto-tokens', said(out, 'must pay a toll charge of 2 Ectotokens'), true);
    check('  two of them are taken', H.invCount(p, 'ectotoken'), 3);
    // The south barrier is turned so that crossing it changes x. What matters is that the player
    // ended up two tiles away on one axis and not twenty-three tiles away at the other gate.
    console.log(`    guard ${guard.x},${guard.z}  stood ${stood[0]},${stood[1]} -> ${p.x},${p.z}`);
    check('  and the player crosses the gate', southSide(p.x), !southSide(stood[0]));
    check('  the SOUTH gate, which is the one this guard stands at', Math.abs(p.z - SOUTH_BARRIER.z) <= 4, true);
    check('  nowhere near the north one', Math.abs(p.z - NORTH_BARRIER.z) > 10, true);
}

console.log('\nTHE TOLL, WITH AN EMPTY POCKET');
{
    const p = player('phas_broke', 3652, 3484);
    hear(p);
    const out = talkTo(p, must('ahoy_ghost_guard', 3652, 3484), ["here's 2 Ectotokens"]);
    check('  the player offers and has nothing', said(out, 'The barrier will not let you through'), true);
    check('  nothing is taken', H.invCount(p, 'ectotoken'), 0);
    check('  and nobody gets through', southSide(p.x), southSide(stood[0]));
}

console.log('\nTHE OTHER TWO ANSWERS');
{
    const p = player('phas_ask', 3652, 3484);
    hear(p);
    H.give(p, 'ectotoken', 2);
    let out = talkTo(p, must('ahoy_ghost_guard', 3652, 3484), ['not paying you Ectotokens']);
    check('  refusing gets Town Policy', said(out, "Sorry - it's Town Policy."), true);
    check('  and costs nothing', H.invCount(p, 'ectotoken'), 2);
    check('  and lets nobody through', southSide(p.x), southSide(stood[0]));

    out = talkTo(p, must('ahoy_ghost_guard', 3652, 3484), ['Where can I get Ectotokens']);
    check('  asking where points at the Temple', said(out, 'You need to go to the Temple and earn some'), true);
    check('  and the disciples', said(out, 'Talk to the disciples'), true);
    check('  still costing nothing', H.invCount(p, 'ectotoken'), 2);
}

console.log('\nTHE NORTH GATE IS THE NORTH GUARD\'S');
{
    const p = player('phas_north', 3658, 3508);
    hear(p);
    H.give(p, 'ectotoken', 2);
    const guard = must('ahoy_ghost_guard', 3658, 3508);
    talkTo(p, guard, ["here's 2 Ectotokens"]);
    console.log(`    guard ${guard.x},${guard.z}  stood ${stood[0]},${stood[1]} -> ${p.x},${p.z}`);
    check('  the player crosses the NORTH barrier, on its own axis', northSide(p.z), !northSide(stood[1]));
    check('  not flung twenty-three tiles to the south gate', Math.abs(p.z - SOUTH_BARRIER.z) > 10, true);
    check('  and the toll is taken once', H.invCount(p, 'ectotoken'), 0);
}

// ================================================================= after the quest, it is free

console.log('\nAFTER GHOSTS AHOY THE TOWN IS OPEN');
{
    const p = player('phas_done', 3652, 3484);
    hear(p);
    H.setVarBit(p, 'ahoy_questvar', 15); // ^ahoy_complete
    H.give(p, 'ectotoken', 2);
    const out = talkTo(p, must('ahoy_ghost_guard', 3652, 3484), [], 'a freed town asks nothing, so no menu');
    check('  the guard says so', said(out, 'a service that surpasses all value, so you may pass without charge'), true);
    check('  no tokens are taken', H.invCount(p, 'ectotoken'), 2);
    check('  and the player goes through anyway', southSide(p.x), !southSide(stood[0]));
}

console.log('\nAND SO IS THE BARRIER ITSELF');
{
    /** Right-click Pass on a barrier from a tile beside it. */
    const pass = (p: Player, x: number, z: number): string[] => {
        const from = mark();
        H.opLoc(p, x, z, 'ahoy_town_barrier', 1);
        for (let t = 0; t < 20 && !p.activeScript; t++) {
            H.tick(1);
        }
        drive(p, []);
        H.tick(2);
        return lines(p, from);
    };

    // mid-quest, with tokens: still charged. This is the half the free pass must not have eaten.
    const q = player('phas_bar_mid', 3650, 3485);
    H.give(q, 'ectotoken', 4);
    const qside = southSide(q.x);
    let out = pass(q, SOUTH_BARRIER.x, SOUTH_BARRIER.z);
    check('  and it crosses', southSide(q.x), !qside);
    check('  mid-quest the barrier still takes its two', said(out, 'ecto-tokens and the barrier lets you by'), true);
    check('  two of four left', H.invCount(q, 'ectotoken'), 2);

    // finished: free.
    const r = player('phas_bar_done', 3650, 3485);
    H.setVarBit(r, 'ahoy_questvar', 15);
    H.give(r, 'ectotoken', 4);
    const rside = southSide(r.x);
    out = pass(r, SOUTH_BARRIER.x, SOUTH_BARRIER.z);
    check('  finished, it asks for nothing', said(out, 'You have done this town a service it has not forgotten'), true);
    check('  all four tokens kept', H.invCount(r, 'ectotoken'), 4);
    check('  and it still lets the player through', southSide(r.x), !rside);
}

console.log(`\n${R.ok} ok, ${R.bad} failed`);
process.exit(R.bad ? 1 : 0);
