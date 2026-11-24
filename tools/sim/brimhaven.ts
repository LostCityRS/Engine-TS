/**
 * The Brimhaven dungeon: getting in, getting out, and the vines in between.
 *
 * "cant enter brimhaven dungeon" - DeathPlateau-Bugs#91. The cache draws "Enter" on the overgrown
 * entrance, "Leave" on the hole at the far end and "Chop-down" on five sets of vines, and nothing
 * in the content answered any of them. Every one was sitting in tools/sim/opsweep-baseline.txt as
 * a dead option, so it was known in aggregate and never as "the dungeon cannot be entered".
 *
 * The dungeon itself was already finished - 27 kinds of npc placed, the map cut, the exit placed,
 * drop rows in npc_drops.dbrow. Only the door was missing.
 *
 * WHAT THIS HOLDS, and the last one is the point of the other two:
 *   1. the door goes in, and lands somewhere a player can stand
 *   2. the way out comes back, to the tile the reporter filed from
 *   3. the vines need an axe and ten Woodcutting, and nothing else
 *   4. and chopping NEVER HOLDS THE PLAYER - the DeathPlateau-Bugs#85 lesson, sampled every tick,
 *      because a chop paced with p_delay would be a run nobody could walk away from
 */
import * as H from './harness.js';
import { check, R, player } from './a1lib.js';
import { isMapBlocked } from '#/engine/GameMap.js';
import LocType from '#/cache/config/LocType.js';
import World from '#/engine/World.js';
import type Player from '#/engine/entity/Player.js';

await H.boot();

const ENTRANCE: [number, number] = [2743, 3153];
const OUTSIDE: [number, number] = [2744, 3152];
const EXIT: [number, number] = [2714, 9564];
const INSIDE: [number, number] = [2715, 9564];

function atOutside(who: string) {
    const p = player(who, OUTSIDE[0], OUTSIDE[1], 0);
    H.setVar(p, 'tutorial', 1000);
    H.clearInv(p);
    return p;
}

function heldOver(p: Player, n: number) {
    let held = 0;
    for (let t = 0; t < n; t++) {
        H.tick(1);
        if (p.delayed) held++;
    }
    return held;
}

// ---- 1. the two ends are where the content says they are ------------------------------------
{
    check('the entrance is placed', H.locAt(0, ENTRANCE[0], ENTRANCE[1], 'dungeon_tree_closed'), true);
    check('  ...and the exit is too', H.locAt(0, EXIT[0], EXIT[1], 'karam_dungeon_exit'), true);
    // THE LANDING TILES, checked rather than trusted. A door that drops a player inside a wall is
    // worse than a door that does nothing.
    check(`the inside landing is walkable (${INSIDE})`, isMapBlocked(INSIDE[0], INSIDE[1], 0), false);
    check(`  ...and the outside one is (${OUTSIDE})`, isMapBlocked(OUTSIDE[0], OUTSIDE[1], 0), false);
}

// ---- 2. in, and out again --------------------------------------------------------------------
{
    const p = atOutside('brim_in');
    H.opLoc(p, ENTRANCE[0], ENTRANCE[1], 'dungeon_tree_closed', 1);
    H.tick(6);
    check(`Enter puts the player in the dungeon (${p.x},${p.z})`, p.z > 9000, true);
    check('  ...beside the way out', Math.abs(p.x - EXIT[0]) <= 2 && Math.abs(p.z - EXIT[1]) <= 2, true);
}

// ---- 2b. and out, from a player who STARTED inside -------------------------------------------
// A SEPARATE PLAYER, PUT INSIDE DIRECTLY. Clicking Leave with the player from 2a tested nothing
// without the fix: Enter had not moved them, so they were still standing outside and "Leave
// brings them back out" was true before the click. Both halves have to stand on their own.
{
    const p = player('brim_out', INSIDE[0], INSIDE[1], 0);
    H.setVar(p, 'tutorial', 1000);
    H.clearInv(p);
    check('a player put inside is inside to begin with', p.z > 9000, true);
    H.opLoc(p, EXIT[0], EXIT[1], 'karam_dungeon_exit', 1);
    H.tick(6);
    check(`Leave brings them back out (${p.x},${p.z})`, p.z < 4000, true);
    check('  ...to the tile the entrance is approached from', p.x === OUTSIDE[0] && p.z === OUTSIDE[1], true);
}

// ---- 3. and the dungeon it opens is a populated one ------------------------------------------
// Not a claim about the door: a check that the thing behind it was worth opening, and that this
// sim is pointing at the real dungeon rather than an empty cave.
{
    let npcs = 0;
    for (let zx = 2600; zx <= 2720; zx += 8) {
        for (let zz = 9470; zz <= 9600; zz += 8) {
            for (const npc of (World as unknown as { gameMap: { getZone: (x: number, z: number, l: number) => { getAllNpcsUnsafe: () => Iterable<unknown> } } }).gameMap.getZone(zx, zz, 0).getAllNpcsUnsafe()) {
                if (npc) npcs++;
            }
        }
    }
    check(`the dungeon behind the door is populated (${npcs} npcs)`, npcs > 50, true);
}

// ---- 4. the vines want an axe, and a level ---------------------------------------------------
const VINE = H.locsNear('karam_dungeon_vineblocking1', 2690, 9564, 0)[0];

function atVine(who: string, wc: number, axe: boolean) {
    const p = player(who, VINE.x + 1, VINE.z, 0);
    H.setVar(p, 'tutorial', 1000);
    H.clearInv(p);
    p.setLevel(8, wc); // WOODCUTTING
    if (axe) H.give(p, 'bronze_axe', 1);
    return p;
}

{
    check('a vine is placed to chop', VINE !== undefined, true);
    const p = atVine('vine_noaxe', 50, false);
    H.opLoc(p, VINE.x, VINE.z, 'karam_dungeon_vineblocking1', 1);
    H.tick(10);
    check('with no axe the vine stays', H.locAt(0, VINE.x, VINE.z, 'karam_dungeon_vineblocking1'), true);
}
{
    const p = atVine('vine_lowlevel', 5, true);
    H.opLoc(p, VINE.x, VINE.z, 'karam_dungeon_vineblocking1', 1);
    H.tick(10);
    check('with an axe but 5 Woodcutting it stays', H.locAt(0, VINE.x, VINE.z, 'karam_dungeon_vineblocking1'), true);
}
{
    const p = atVine('vine_chop', 50, true);
    H.opLoc(p, VINE.x, VINE.z, 'karam_dungeon_vineblocking1', 1);
    // Driven by hand the way chaosaltar.ts drives its op3: the engine's own re-queue wants a live
    // interaction the harness does not keep.
    let gone = false;
    let swings = 0;
    for (let i = 0; i < 40; i++) {
        H.tick(1);
        // CHECKED BEFORE THE NEXT CLICK, not after. opLoc throws on a loc that is not there, and
        // a vine that has just been chopped is not there - the first draft of this loop clicked
        // first and died on its own success.
        if (!H.locAt(0, VINE.x, VINE.z, 'karam_dungeon_vineblocking1')) {
            gone = true;
            break;
        }
        H.opLoc(p, VINE.x, VINE.z, 'karam_dungeon_vineblocking1', 3);
        swings++;
    }
    check(`with an axe and the level, the vine comes down (${swings} swings)`, gone, true);
}

// ---- 5. AND CHOPPING NEVER HOLDS THE PLAYER --------------------------------------------------
// The sharp one. Sampled every tick, because a single look after the run finds a free player and
// reports nothing wrong - which is how DeathPlateau-Bugs#85 survived the round that built it.
{
    const vine2 = H.locsNear('karam_dungeon_vineblocking3', 2673, 9499, 0)[0];
    const p = player('vine_held', vine2.x + 1, vine2.z, 0);
    H.setVar(p, 'tutorial', 1000);
    H.clearInv(p);
    p.setLevel(8, 50);
    H.give(p, 'bronze_axe', 1);
    H.opLoc(p, vine2.x, vine2.z, 'karam_dungeon_vineblocking3', 1);
    const held = heldOver(p, 30);
    // AND THAT IT WAS ACTUALLY CHOPPING, or this passes on a trigger that does nothing at all -
    // which is exactly what it did before the content existed.
    const swung = H.soundsFor('vine_held').length > 0;
    check(`chopping actually started (${H.soundsFor('vine_held').length} swings heard)`, swung, true);
    check(`  ...and never delayed the player (${held} of 30 ticks held)`, held, 0);
}

// ---- 6. and the vines are answered on the category, so a sixth needs no edit ------------------
{
    const ids = [1, 2, 3, 4, 5].map(n => LocType.getId(`karam_dungeon_vineblocking${n}`));
    check(
        'all five vines exist in the cache',
        ids.every(i => i !== -1),
        true
    );
    const cats = new Set(ids.map(i => LocType.get(i).category));
    check('  ...and share one category, which is what the trigger is on', cats.size, 1);
}

// ---- 7. the stepping stones: twelve Agility one way, free the other ---------------------------
// Each stone is a one-tile plug in a north-south channel - its own tile blocked, open above and
// below, wall either side - so crossing is a two-tile hop over it. North is the way out (the exit
// is at z=9564, above both), so north is the free direction.
const STONES: [string, number, number][] = [
    ['karam_dungeon_stone1', 2649, 9561],
    ['karam_dungeon_stone2', 2647, 9558]
];

function atStone(who: string, sx: number, sz: number, side: 'N' | 'S', agility: number) {
    const p = player(who, sx, side === 'N' ? sz + 1 : sz - 1, 0);
    H.setVar(p, 'tutorial', 1000);
    H.clearInv(p);
    p.setLevel(16, agility); // AGILITY
    return p;
}

for (const [name, sx, sz] of STONES) {
    // the geometry this is all built on, asserted rather than assumed
    check(`${name} is a plug: its own tile is blocked`, isMapBlocked(sx, sz, 0), true);
    check('  ...with open ground north and south', !isMapBlocked(sx, sz + 1, 0) && !isMapBlocked(sx, sz - 1, 0), true);
    check('  ...and wall east and west', isMapBlocked(sx + 1, sz, 0) && isMapBlocked(sx - 1, sz, 0), true);

    // southbound under the level: refused, and still standing where they were
    {
        // ELEVEN AND TWELVE, the published boundary, and not 5 and 60. On its own "11 cannot
        // cross" is true of a trigger that does not exist as well - it was green before this
        // content was written - so it earns its place only as half of a pair whose other half
        // (twelve crosses) cannot pass without the script. The harness has no capture for mes(),
        // so asserting the refusal's wording is not available here.
        const p = atStone(`st_${sz}_low`, sx, sz, 'N', 11);
        H.opLoc(p, sx, sz, name, 1);
        H.tick(8);
        check(`${name}: 11 Agility cannot cross southward (${p.x},${p.z})`, p.z === sz + 1, true);
    }
    // southbound with the level: across
    {
        // RETRIED, because southbound has a fail roll and a failure leaves you on the starting
        // side - so a single click proves nothing when it comes up short. This check was green for
        // one roll and went red the day an unrelated map change shifted the seeded dice under it
        // (eighteen npc spawns moved in DeathPlateau-Bugs#98), which is red over nothing in the
        // same way a one-roll pass is green over nothing. What the gate actually promises is that
        // 12 gets across and 11 never does, so 12 is given the attempts to show it.
        const p = atStone(`st_${sz}_ok`, sx, sz, 'N', 12);
        let tries = 0;
        while (p.z !== sz - 1 && tries < 15) {
            tries++;
            H.opLoc(p, sx, sz, name, 1);
            H.tick(10);
        }
        check(`  ...and 12 does, in ${tries} attempt(s) (${p.x},${p.z})`, p.z === sz - 1, true);
    }
    // northbound at level 1: free, and it must LAND - the roll is southbound only, or the player
    // who got down here with no Agility could never get back out
    {
        const p = atStone(`st_${sz}_out`, sx, sz, 'S', 1);
        H.opLoc(p, sx, sz, name, 1);
        H.tick(10);
        check(`  ...and 1 Agility crosses northward for free (${p.x},${p.z})`, p.z === sz + 1, true);
    }
    // CLICKING FROM OFF TO THE SIDE WALKS INTO LINE AND THEN CROSSES, which is what a click is:
    // opLoc paths the player to the loc first, exactly as a real client does. The first draft of
    // this asserted they were REFUSED, and failed - correctly. The in-line guard in the script is
    // a safety net for an op that arrives without that pathing (p_oploc from script), not
    // something a clicking player should ever meet.
    {
        const p = player(`st_${sz}_diag`, sx + 1, sz + 1, 0);
        H.setVar(p, 'tutorial', 1000);
        H.clearInv(p);
        p.setLevel(16, 99);
        H.opLoc(p, sx, sz, name, 1);
        H.tick(14);
        // THE FAR SIDE, not merely in line. Starting north-east of the stone, the pathing alone
        // puts them at sx,sz+1 - so "in line" was true without any crossing having happened, and
        // this check passed against a dead trigger too. Crossed means sz-1.
        check(`  ...and a click from off to the side walks into line and crosses (${p.x},${p.z})`, p.x === sx && p.z === sz - 1, true);
    }
}

console.log(R.bad ? `FAILED: ${R.bad} of ${R.ok + R.bad}` : `${R.ok} ok`);
process.exit(R.bad ? 1 : 0);
