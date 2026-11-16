// EVERY GROUND ITEM SPAWN IS ONE A PLAYER CAN ACTUALLY PICK UP.
//
//   npx tsx tools/sim/objreach.ts
//
// A ground item is taken from its own tile or from a tile beside it: Player.inOperableDistance
// answers `reachedEntity(...) || reachedObj(...)` for an Obj, so standing on it works and so does
// standing next to it with nothing in between. What that leaves is an item whose tile is occupied
// AND whose every side is occupied or walled off - a spawn that renders, sits in the menu, and
// answers no click from anywhere a player can stand.
//
// That is tracker issue 19: the jug on the table in the Catherby cooking house north-east of the
// bank. The table (bigtable2, 2x1) covers both its tiles, a sink (sink2, 1x2) takes the tile west
// of the jug, and the two remaining sides have the house's own walls across them - so the jug has
// four sides and not one of them is a tile a player can stand on and reach from. The knife on the
// same table is fine, because the tile west of IT is open floor, which is where the player who
// filed the report was standing when the jug would not come.
//
// WHY A SWEEP AND NOT A CHECK FOR THAT ONE JUG. The shape of the bug is a spawn coordinate and the
// scenery around it, and nothing about it is special to Catherby: it is one map edit away in any
// kitchen in the game, and it is invisible until a player tries. So this asks the question of every
// static obj spawn in every map square the server loads, which is the only way to know whether the
// jug is alone.
//
// WHAT IT DOES NOT CHECK. Objs dropped by scripts (a quest's obj_add, a drop table) are not here:
// those land wherever the player or npc was standing, and that is the engine's business rather than
// the map's. Only the spawns the map file declares.
import * as H from './harness.js';
import World from '#/engine/World.js';
import ObjType from '#/cache/config/ObjType.js';
import { isMapBlocked } from '#/engine/GameMap.js';
import rsmod, { CollisionFlag } from '#/engine/routefinder/index.js';
import { isZoneAllocated } from '#/engine/GameMap.js';

await H.boot();

/** reachedEntity's own call: adjacency with the walls between the two tiles respected. */
const canReachFrom = (level: number, srcX: number, srcZ: number, x: number, z: number) => rsmod.reached(level, srcX, srcZ, x, z, 1, 1, 1, 0, -2, 0);

/** Every tile a player could take this obj from: its own, and the four beside it. */
function takeTiles(level: number, x: number, z: number): string[] {
    const out: string[] = [];
    if (!isMapBlocked(x, z, level)) out.push('its own tile');
    for (const [dx, dz, d] of [
        [-1, 0, 'west'],
        [1, 0, 'east'],
        [0, -1, 'south'],
        [0, 1, 'north']
    ] as [number, number, string][]) {
        const sx = x + dx;
        const sz = z + dz;
        if (isMapBlocked(sx, sz, level)) continue;
        if (!canReachFrom(level, sx, sz, x, z)) continue;
        out.push(d);
    }
    return out;
}

/**
 * WHAT IS STANDING ON THE TILE, which decides whether a spawn is this bug or another question.
 *
 * CollisionFlag.WALK_BLOCKED is two things at once: LOC, which is scenery the map put there, and
 * FLOOR / FLOOR_DECORATION, which is the ground itself being water, a cliff or a roof edge. An
 * item under a table is a map edit nobody can undo from in game; an item in the sea is a different
 * conversation, and lumping the two together would report thirty-odd "bugs" of two kinds and make
 * the real one harder to see.
 */
const blockedBy = (x: number, z: number, level: number): 'scenery' | 'ground' | null => {
    if (rsmod.isFlagged(x, z, level, CollisionFlag.LOC)) return 'scenery';
    if (rsmod.isFlagged(x, z, level, CollisionFlag.FLOOR_BLOCKED)) return 'ground';
    return null;
};

/**
 * THE FIVE THIS SWEEP FOUND BESIDE THE JUG, each one a decision somebody has to make about a map
 * rather than a thing to quietly move. They are listed by coordinate so that a SIXTH is red the
 * night it appears, which is the whole job of this check - an allowlist of "all of them" would be
 * no check at all.
 *
 * Three are a bar in Brimhaven: two beer glasses in the middle of a row of tables with chairs down
 * both sides, and a beer on the counter with the wall behind it. Two are iron armour on display
 * beside a statue and a standard in Varrock. Every one of them is where the map data puts it, and
 * whether the original meant them as scenery or as something a player could pick up is not a
 * question this file can answer - it is on tracker issue 19 for whoever can.
 */
const KNOWN = new Set(['2794,3165,0', '2795,3165,0', '2799,3156,0', '3254,3452,0', '3254,3453,0']);

type Stuck = { name: string; x: number; z: number; level: number; why: string; kind: 'scenery' | 'ground' | null };
const stuck: Stuck[] = [];
let checked = 0;
let unbuilt = 0;
const zones = (World.gameMap as unknown as { zonemap: { zones: Map<number, { getAllObjsUnsafe(): IterableIterator<{ type: number; x: number; z: number; level: number }> }> } }).zonemap.zones;
for (const zone of zones.values()) {
    for (const obj of zone.getAllObjsUnsafe()) {
        // AND A ZONE NOBODY HAS BUILT COLLISION FOR READS AS SOLID ROCK. rsmod hands back
        // CollisionFlag.NULL for an unallocated zone, which is "blocked" - so a spawn in a corner
        // of the map no player has walked into this boot would be reported as walled in on all
        // four sides when the truth is that nothing has been worked out yet. Only zones the world
        // has actually built are judged, and the rest are counted and said out loud.
        if (!isZoneAllocated(obj.level, obj.x, obj.z)) {
            unbuilt++;
            continue;
        }
        checked++;
        const tiles = takeTiles(obj.level, obj.x, obj.z);
        if (tiles.length) continue;
        const name = ObjType.get(obj.type).debugname ?? 'obj_' + obj.type;
        // WHY THE SIDES ARE SPELT OUT. "unreachable" is a verdict and not a lead: the fix is
        // different for a side a sink is standing on than for one a wall crosses, and whoever
        // picks this up should not have to work the four tiles out again by hand.
        const why = (
            [
                [-1, 0, 'west'],
                [1, 0, 'east'],
                [0, -1, 'south'],
                [0, 1, 'north']
            ] as [number, number, string][]
        )
            .map(([dx, dz, d]) => d + ': ' + (isMapBlocked(obj.x + dx, obj.z + dz, obj.level) ? 'occupied' : 'walled off'))
            .join(', ');
        stuck.push({ name, x: obj.x, z: obj.z, level: obj.level, why, kind: blockedBy(obj.x, obj.z, obj.level) });
    }
}

console.log(`\n  checked ${checked} static ground item spawns` + (unbuilt ? `, and skipped ${unbuilt} in zones this boot never built collision for` : ''));
// ONLY THE SCENERY ONES FAIL THIS CHECK. The ones standing in water or on a cliff edge are
// printed too, because a spawn nobody can walk to is worth knowing about either way - but they are
// a map's terrain rather than a thing left on a table, nothing here has established what the
// original data meant by them, and turning this red for thirty of those would retire the check on
// the day it was written.
const onScenery = stuck.filter(s => s.kind === 'scenery' && !KNOWN.has(`${s.x},${s.z},${s.level}`));
const known = stuck.filter(s => s.kind === 'scenery' && KNOWN.has(`${s.x},${s.z},${s.level}`));
const onGround = stuck.filter(s => s.kind !== 'scenery');
const say = (s: Stuck) => {
    console.log(`         ${s.name} at ${s.x},${s.z} L${s.level}  (${s.why})`);
    console.log(`           ::tele ${s.level},${s.x >> 6},${s.z >> 6},${s.x & 63},${s.z & 63}`);
};
if (onScenery.length) {
    console.log(`\n  FAIL ${onScenery.length} sit on scenery and cannot be taken from any tile a player can stand on:`);
    for (const s of onScenery.sort((a, b) => a.x - b.x || a.z - b.z)) say(s);
} else {
    console.log('\n  ok   every item standing on scenery can be taken from a tile beside it,');
    console.log(`       bar the ${known.length} on the list above this check's KNOWN line`);
}
// AND SAY WHEN THE LIST HAS GONE STALE. A coordinate that no longer needs excusing is a line
// somebody should delete, and a line nobody deletes is how a list like this rots into scenery.
for (const s of KNOWN) {
    if (!known.some(k => `${k.x},${k.z},${k.level}` === s)) {
        console.log(`  note ${s} is on this check's KNOWN list and can be reached now - delete that line`);
    }
}
if (onGround.length) {
    console.log(`\n  note ${onGround.length} more stand on ground a player cannot walk on - water, a cliff or a`);
    console.log("       roof edge. Worth a look one day; not this check's business.");
    for (const s of onGround.sort((a, b) => a.x - b.x || a.z - b.z)) say(s);
}
console.log(onScenery.length ? `\n${onScenery.length} ground item spawns on scenery that nobody can reach` : '\nALL PASS');
process.exit(onScenery.length ? 1 : 0);
