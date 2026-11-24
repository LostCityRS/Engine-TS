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
import { isMapBlocked, canTravel } from '#/engine/GameMap.js';
import { CollisionFlag, CollisionType } from '#/engine/routefinder/index.js';
import LocType from '#/cache/config/LocType.js';
import World from '#/engine/World.js';
import type Player from '#/engine/entity/Player.js';

await H.boot();

const ENTRANCE: [number, number] = [2743, 3153];
const OUTSIDE: [number, number] = [2744, 3152];
const EXIT: [number, number] = [2714, 9564];
const INSIDE: [number, number] = [2713, 9564];

/**
 * The tiles a player can actually walk to from here, by the engine's own step test.
 *
 * Deliberately not a terrain flood: the thing that got past this file was an unallocated tile,
 * which no terrain test calls blocked. canTravel answers the question a player's foot asks.
 */
function walkableRegion(sx: number, sz: number, level = 0, cap = 50000): Set<string> {
    const seen = new Set<string>([`${sx},${sz}`]);
    const queue: [number, number][] = [[sx, sz]];
    while (queue.length && seen.size < cap) {
        const [x, z] = queue.shift()!;
        for (const [dx, dz] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1]
        ] as const) {
            if (!canTravel(level, x, z, dx, dz, 1, CollisionFlag.BLOCK_NPC_AND_PLAYERS, CollisionType.NORMAL)) continue;
            const key = `${x + dx},${z + dz}`;
            if (seen.has(key)) continue;
            seen.add(key);
            queue.push([x + dx, z + dz]);
        }
    }
    return seen;
}

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
    // THE LANDING TILES, and "not blocked" IS NOT THE QUESTION. This asked isMapBlocked and was
    // satisfied, and the door still dropped players somewhere they could not get out of: an
    // UNALLOCATED tile carries no blocking flag at all, so empty space off the end of the map
    // reads exactly like open floor. The old landing, 2715,9564, sat in a 39,191-tile region
    // spanning x 2432-2879 - the void between this dungeon's rooms - and passed this check every
    // night (DeathPlateau-Bugs#102).
    //
    // What a landing tile has to be is INSIDE A ROOM, and the room has to contain the way out. So
    // the region is flooded with the engine's own step test and held to both: small enough to be
    // a room rather than the void, and joined to the exit on foot.
    check(`the inside landing is walkable (${INSIDE})`, isMapBlocked(INSIDE[0], INSIDE[1], 0), false);
    check(`  ...and the outside one is (${OUTSIDE})`, isMapBlocked(OUTSIDE[0], OUTSIDE[1], 0), false);
    {
        const room = walkableRegion(INSIDE[0], INSIDE[1]);
        check(`the landing is in a room, not the void (${room.size} tiles)`, room.size > 8 && room.size < 5000, true);
        const beside = (
            [
                [0, 0],
                [1, 0],
                [-1, 0],
                [0, 1],
                [0, -1]
            ] as const
        ).some(([dx, dz]) => room.has(`${EXIT[0] + dx},${EXIT[1] + dz}`));
        check('  ...and the way out can be walked to from it', beside, true);
    }
}

// ---- 2. in, and out again --------------------------------------------------------------------
{
    const p = atOutside('brim_in');
    H.opLoc(p, ENTRANCE[0], ENTRANCE[1], 'dungeon_tree_closed', 1);
    H.tick(6);
    check(`Enter puts the player in the dungeon (${p.x},${p.z})`, p.z > 9000, true);
    // IN THE SAME ROOM AS THE WAY OUT, not merely within two tiles of it. Two tiles of slack let
    // the player stand on the far SIDE of the exit, outside the room, and called it beside.
    check('  ...beside the way out', Math.abs(p.x - EXIT[0]) <= 2 && Math.abs(p.z - EXIT[1]) <= 2, true);
    check('  ...and in the same room as it', walkableRegion(p.x, p.z).has(`${EXIT[0] - 1},${EXIT[1]}`), true);
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

function atVine(who: string, wc: number, axe: boolean, at?: [number, number]) {
    const p = player(who, at ? at[0] : VINE.x + 1, at ? at[1] : VINE.z, 0);
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
    // CAPTURED BEFORE THE CHOP, because "it was blocked" is half of what makes "and now it is
    // not" mean anything.
    const blockedWhileStanding = isMapBlocked(VINE.x, VINE.z, 0);
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

    // THE QUESTION THE CHECK ABOVE DOES NOT ASK, AND THE WHOLE POINT OF CUTTING A VINE.
    //
    // "The vine comes down" was green for a tile no player could walk through. A player chopped
    // all the way through and still could not pass, and filed it (DeathPlateau-Bugs#103): the LAND
    // under all five of these tiles carried BLOCK_MAP_SQUARE on top of the loc's own blockwalk.
    // World.removeLoc clears the loc's collision and cannot touch the land's, so the vine vanished
    // and the wall stayed exactly where it was.
    //
    // A vine that disappears without opening anything is scenery with a verb on it. These three
    // checks are the difference, and the middle one is what the map edit in
    // DeathPlateau-Content#101 exists for - put the `f1` back on these five tiles and it fails.
    check('  ...the tile was blocked while the vine stood', blockedWhileStanding, true);
    check('  ...and chopping OPENS it', isMapBlocked(VINE.x, VINE.z, 0), false);
    // Not just a flag that reads open: the player is walked onto the far side, because a tile can
    // be unblocked and still be unreachable if something else fences it.

    // AND THE POINT OF CUTTING A VINE IS WALKING THROUGH IT, which this file did not ask.
    // "the vine comes down" was the whole of the old check, and it stayed green while chopping
    // opened nothing at all: the five vine tiles each carried the landscape's own block flag
    // (f1, BLOCK_MAP_SQUARE) on top of the loc's, so loc_del cleared the loc's collision and the
    // land's remained. A player chopped, walked into the gap and stopped dead
    // (DeathPlateau-Bugs#103). The flags are off those five tiles now.
    check('  ...and the gap it leaves can be walked through', canTravel(0, VINE.x + 1, VINE.z, -1, 0, 1, CollisionFlag.BLOCK_NPC_AND_PLAYERS, CollisionType.NORMAL), true);
    H.walkTo(p, VINE.x - 1, VINE.z);
    H.tick(12);
    check(`  ...and the player walks through to the far side (${p.x},${p.z})`, p.x <= VINE.x - 1 && p.z === VINE.z, true);
}

// ---- 4b. ALL FIVE VINES ARE DOORS: shut until cut, and joining two rooms once they are -------
//
// Each of the five sits in a one-tile gap in a wall with the unallocated void to either side and
// a REAL ROOM on each of the other two sides - measured, and the reason this is a map fix rather
// than a script one:
//
//     vine1 2690,9564   the entrance room (191) <-> the stepping-stones channel (635)
//     vine2 2683,9569   the channel (635)       <-> a room of 491
//     vine3 2673,9499   a room of 1434          <-> a room of 37
//     vine4 2675,9479   a room of 1434          <-> a room of 113
//     vine5 2694,9482   a room of 113           <-> the 3,266-tile room #103 was reported from
//
// So they are the dungeon's five doors, and every one of them was a wall. Both halves are checked
// per vine, because "it opens" alone would pass on a vine that was never shut, and "it is shut"
// alone is what shipped.
{
    // VINE 1 IS STILL DOWN FROM SECTION 4, which chopped it as its example, so this waits out
    // ^brimhaven_vine_regrow (100 ticks) before asking whether the gaps are shut. The first draft
    // did not, and vine1 reported "not placed" and "not shut" while the other four passed - which
    // is the regrow being tested by accident, so it is asserted on purpose below.
    H.tick(110);
    const VINES: { n: number; at: [number, number]; side: [number, number] }[] = [
        { n: 1, at: [2690, 9564], side: [1, 0] },
        { n: 2, at: [2683, 9569], side: [0, 1] },
        { n: 3, at: [2673, 9499], side: [1, 0] },
        { n: 4, at: [2675, 9479], side: [1, 0] },
        { n: 5, at: [2694, 9482], side: [1, 0] }
    ];
    for (const v of VINES) {
        const [vx, vz] = v.at;
        const [dx, dz] = v.side;
        const name = `karam_dungeon_vineblocking${v.n}`;
        check(`vine${v.n} is placed at ${vx},${vz}${v.n === 1 ? ' (grown back)' : ''}`, H.locAt(0, vx, vz, name), true);
        const before = walkableRegion(vx + dx, vz + dz);
        check('  ...and shut: the gap is not walkable while it stands', before.has(`${vx},${vz}`), false);
        const p = atVine(`gate_${v.n}`, 50, true, [vx + dx, vz + dz]);
        let gone = false;
        for (let i = 0; i < 60 && !gone; i++) {
            if (!H.locAt(0, vx, vz, name)) {
                gone = true;
                break;
            }
            H.opLoc(p, vx, vz, name, i === 0 ? 1 : 3);
            H.tick(1);
        }
        check('  ...it comes down', gone, true);
        const after = walkableRegion(vx + dx, vz + dz);
        check(`  ...and the room on the far side is now reachable (${before.size} -> ${after.size} tiles)`, after.size > before.size + 20, true);
    }
    // PUT THEM BACK, because the sections after this one chop vines of their own and a vine that
    // is already down throws out of H.opLoc rather than failing a check. Asserted rather than
    // assumed, which also pins the regrow for all five.
    H.tick(110);
    for (const v of VINES) {
        check(`vine${v.n} grows back`, H.locAt(0, v.at[0], v.at[1], `karam_dungeon_vineblocking${v.n}`), true);
    }
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

// ---- 8. AND THE DUNGEON BEHIND THE VINES IS ONE DUNGEON --------------------------------------
//
// The check above proves one vine opens its own tile. This proves the five of them together open
// the dungeon, which is a different claim and the one the player was really making.
//
// WHY THIS IS MEASURED AND NOT ASSUMED. The first diagnosis of DeathPlateau-Bugs#103 concluded the
// dungeon was "fragments, not a dungeon" - four disconnected regions that removing all five vines
// "joins none of". That was wrong, and wrong in a way worth recording: it was measured with the
// vine LOCS removed while the land flag was still set, so the five doorways were still walls, and
// it counted only walking, so the stepping stones - which are a scripted two-tile hop and not a
// step - read as dead ends. Both halves have to be modelled or the dungeon looks broken when it
// is not.
//
// THE STONES ARE EDGES, NOT TILES. Each stone's own tile is blocked and crossing it moves the
// player two tiles along z, so the flood below jumps them the way the script does rather than
// trying to walk onto them.
{
    const VINE_TILES: [string, number, number][] = [
        ['karam_dungeon_vineblocking1', 2690, 9564],
        ['karam_dungeon_vineblocking2', 2683, 9569],
        ['karam_dungeon_vineblocking3', 2673, 9499],
        ['karam_dungeon_vineblocking4', 2675, 9479],
        ['karam_dungeon_vineblocking5', 2694, 9482],
    ];
    const STONES: [number, number][] = [[2649, 9561], [2647, 9558]];
    const LANDING: [number, number] = [2713, 9564];
    const REPORTED_FROM: [number, number] = [2709, 9468];

    // every vine down, which is the state a player with an axe can put the dungeon in
    for (const [name, x, z] of VINE_TILES) {
        const loc = World.getLoc(x, z, 0, LocType.getId(name));
        if (loc) World.removeLoc(loc, 2000);
    }
    for (const [name, x, z] of VINE_TILES) {
        check(`${name}'s tile is open once it is down`, isMapBlocked(x, z, 0), false);
    }

    const key = (x: number, z: number) => x * 100000 + z;
    const seen = new Set<number>([key(LANDING[0], LANDING[1])]);
    const queue: [number, number][] = [[LANDING[0], LANDING[1]]];
    while (queue.length) {
        const [x, z] = queue.pop()!;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]) {
            const nx = x + dx, nz = z + dz;
            // bounded to the dungeon's own squares so a hole in the map cannot turn this into a
            // walk across Karamja
            if (nx < 2560 || nx > 2820 || nz < 9380 || nz > 9640) continue;
            // canTravel AND NOT walkable(). walkable() asks whether a TILE carries WALK_BLOCKED,
            // which says nothing about the wall between two open tiles - so a flood built on it
            // walks straight through the dungeon's walls and reported 44,220 tiles here, a number
            // that would have been "more than 5000" whether or not the vines opened anything.
            // canTravel is the directional test the player's own movement uses, with the same
            // extraFlag Player.blockWalkFlag() hands it.
            if (seen.has(key(nx, nz))) continue;
            if (!canTravel(0, x, z, dx, dz, 1, CollisionFlag.BLOCK_NPC_AND_PLAYERS, CollisionType.NORMAL)) continue;
            seen.add(key(nx, nz));
            queue.push([nx, nz]);
        }
        for (const [sx, sz] of STONES) {
            if (x !== sx) continue;
            for (const side of [1, -1]) {
                if (z !== sz + side) continue;
                const dest: [number, number] = [x, sz - side];
                if (seen.has(key(dest[0], dest[1])) || isMapBlocked(dest[0], dest[1], 0)) continue;
                seen.add(key(dest[0], dest[1]));
                queue.push(dest);
            }
        }
    }

    // 191 is the entrance room on its own - what a player got before this, and what they get again
    // if the `f1` goes back on those five tiles.
    check(`the dungeon reachable from the entrance is more than the entrance room (${seen.size} tiles)`, seen.size > 5000, true);
    check('  ...and it is not the 191-tile room alone', seen.size === 191, false);
    check('  ...and it reaches the tile the #103 reporter stood on', seen.has(key(REPORTED_FROM[0], REPORTED_FROM[1])), true);
}

console.log(R.bad ? `FAILED: ${R.bad} of ${R.ok + R.bad}` : `${R.ok} ok`);
process.exit(R.bad ? 1 : 0);
