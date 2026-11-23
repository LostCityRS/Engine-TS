// IS ANYTHING DRAWN ON THIS TILE - the question collision cannot answer.
//
// A tile is drawn only if its mapsquare row gives it an overlay (o) or an underlay (u). Everything
// else is a hole: the client builds no Ground and no QuickGround for it, so a player standing there
// is standing in the air. The engine's collision map knows nothing about this - a hole at plane 3
// over a street is "open" as far as canTravel is concerned, which is why fifteen rooftop agility
// landings sat in one and passed every sim in this directory.
//
// THREE ANSWERS, not two, and the middle one is the trap:
//
//   drawn    the mapsquare draws a floor there
//   onLoc    nothing is drawn, but a loc occupies the tile - which is a floor, because half the
//            agility obstacles are things you climb ON TO: a market stall, a basket, a banner, a
//            steep roof, a pile of fish. The tile carries no overlay, is flagged LOC and blocked,
//            and the player put there by the obstacle is standing on its model. Pollnivneach is
//            nine obstacles of exactly this and a sweep without it condemns the whole course.
//   thinAir  neither. This is the fault.
//
// And BLOCKED IS NOT BROKEN either: Draynor's whole rooftop deck reads "o175 f1" - drawn, and
// flagged - because a grafted roof is not meant to be walked on; the course carries you across it.
import { readFileSync } from 'fs';

import LocType from '#/cache/config/LocType.js';
import { isFlagged } from '#/engine/GameMap.js';
import { CollisionFlag } from '#/engine/routefinder/index.js';

/** mapsquare -> the "<plane>,<localX>,<localZ>" of every tile it draws a floor for. */
const squares = new Map<string, Set<string>>();

export function drawn(x: number, z: number, level: number): boolean {
    const mx = x >> 6;
    const mz = z >> 6;
    const key = `${mx}_${mz}`;
    let set = squares.get(key);
    if (!set) {
        set = new Set<string>();
        try {
            const text = readFileSync(`../content/maps/m${mx}_${mz}.jm2`, 'utf8');
            let section = '';
            for (const line of text.split(/\r?\n/)) {
                const t = line.trim();
                if (t.startsWith('====')) {
                    section = t.replace(/=/g, '').trim();
                    continue;
                }
                if (section !== 'MAP' || !t.includes(':')) continue;
                const [head, rest] = t.split(':');
                const [pl, lx, lz] = head.trim().split(/\s+/).map(Number);
                if (/\bo\d+/.test(rest) || /\bu\d+/.test(rest)) set.add(`${pl},${lx},${lz}`);
            }
        } catch {
            // no such mapsquare - nothing is drawn there
        }
        squares.set(key, set);
    }
    return set.has(`${level},${x & 63},${z & 63}`);
}

// mapsquare -> the "<plane>,<localX>,<localZ>" of every tile a loc's footprint covers.
const placed = new Map<string, Set<string>>();

/**
 * A LOC OCCUPIES THE TILE, so there is a model to be standing on.
 *
 * Read out of the mapsquare's LOC rows rather than off the collision map, because the collision map
 * only knows about locs that BLOCK. Pollnivneach's course is climbed across market canopies and
 * every one of them is blockwalk=no - no LOC flag, no collision at all, and a very solid-looking
 * model to be standing on. Asking the collision map called the whole market thin air.
 *
 * The footprint is taken from the loc's own type and rotated by the placement angle, because a row
 * gives the origin tile only and a three-tile canopy covers two more.
 */
export function onLoc(x: number, z: number, level: number): boolean {
    const mx = x >> 6;
    const mz = z >> 6;
    const key = `${mx}_${mz}`;
    let set = placed.get(key);
    if (!set) {
        set = new Set<string>();
        try {
            const text = readFileSync(`../content/maps/m${mx}_${mz}.jm2`, 'utf8');
            let section = '';
            for (const line of text.split(/\r?\n/)) {
                const t = line.trim();
                if (t.startsWith('====')) {
                    section = t.replace(/=/g, '').trim();
                    continue;
                }
                if (section !== 'LOC' || !t.includes(':')) continue;
                const [head, rest] = t.split(':');
                const [pl, lx, lz] = head.trim().split(/\s+/).map(Number);
                const parts = rest.trim().split(/\s+/).map(Number);
                const id = parts[0];
                const angle = parts.length > 2 ? parts[2] : 0;
                let w = 1;
                let l = 1;
                try {
                    const type = LocType.get(id);
                    w = type.width ?? 1;
                    l = type.length ?? 1;
                } catch {
                    // an id the cache does not know: treat it as one tile
                }
                const [fw, fl] = angle % 2 === 1 ? [l, w] : [w, l];
                for (let dx = 0; dx < fw; dx++) {
                    for (let dz = 0; dz < fl; dz++) set.add(`${pl},${lx + dx},${lz + dz}`);
                }
            }
        } catch {
            // no such mapsquare
        }
        placed.set(key, set);
    }
    // a footprint can run over the square's edge, so check the neighbour's set too when close to it
    if (set.has(`${level},${x & 63},${z & 63}`)) return true;
    return isFlagged(x, z, level, CollisionFlag.LOC);
}

/**
 * Nothing is drawn and no loc is there: a player put here is PROBABLY in the air.
 *
 * NOT ALWAYS, AND THE EXCEPTION IS REAL. This asks what is drawn ON the tile. A loc on the tile
 * NEXT DOOR whose model overhangs it carries the player just as well, and nothing here can see
 * that - the loc's footprint says which tiles it occupies, not how far its geometry reaches.
 * Pollnivneach's market stall and second tree land on two such tiles: thinAir is true, Old School's
 * own cache has the same empty terrain at both, and the course cam's photographs show the player
 * standing squarely on the roof of the building next door.
 *
 * So treat a hit as "go and look", not as a fault. The renderer settles it - see
 * javaclient/tools/clienttests/CourseCam.java, which answers the same question from the client's
 * own Square list and takes a picture. Nineteen rooftop landings WERE genuinely in the air and
 * this is how they were found; two more are not, and were nearly "fixed" into diverging from OSRS.
 */
export function thinAir(x: number, z: number, level: number): boolean {
    return !drawn(x, z, level) && !onLoc(x, z, level);
}

// NO process.exit HERE, AND NOTHING MAY BE ADDED AT THE TOP LEVEL. This file is a library: three
// predicates and the mapsquare cache behind them. It cannot be run on its own and never could -
// importing #/engine/GameMap.js from an entry point this low in the graph hits a circular import
// (`Cannot access 'NonPathingEntity' before initialization`) and dies in six seconds.
//
// A bare `process.exit(0)` sat here from 9d29cbde until it was found, added to stop a standalone
// run hanging. A module body runs on import, so instead it ended the process the instant any sim
// imported drawn/onLoc/thinAir - roofall, rooftops, courseland, coursefall, agilityland, plunder,
// the pyramid set and the werewolf set, fifteen files - each printing nothing and exiting 0.
// Nothing caught it: tools/sim/sweep.sh only runs a sim that can report a verdict
// (`grep -qE 'process\.exit\([^0-9)]'`), which exit(0) does not match, so a suite that reported no
// failures because it never ran looked exactly like a suite that passed.
