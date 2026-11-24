// A QUEST PLAYED THROUGH ON FOOT, rather than simulated.
//
// Every other sim in this directory teleports. a1lib's talk() tries ten tiles around the npc until
// one of them lets the op through, which is fine for testing a dialogue and useless for testing a
// QUEST: a player who is already standing next to Glough's cage never finds out that it is sealed on
// all four sides, and a player who blinks into Zanaris never finds out that the gate has no handler.
// Both of those were real bugs, both were reported by the owner, and no sim in this directory could
// have found either one.
//
// So this runner has no teleport in it. A step either walks, or it fails and says where it stopped.
//
//   go      travel on foot. A BFS over the engine's own canTravel finds the route and the player is
//           fed one waypoint per tick, which is what a client does. No route = the step fails.
//   talk    opnpc from wherever the player is standing, and let the ENGINE route the last stretch
//           with its real pathfinder - which will not open a door or climb a ladder. If the player
//           never gets there the step fails, and that is the finding rather than an inconvenience.
//   loc     the same for a loc click, with the route a client would send.
//   give    an item the player would have bought or banked. Declared, never assumed: the list of
//           gives IS the quest's item requirement, and the run prints it at the end.
//           `how` says where a player really gets it when that is a step of the quest (a cupboard to
//           search, say) rather than something bought or banked, and the quest helper shows it as a
//           step instead of an item to bring.
//   stage   assert the quest's own progress variable. A step that does not move it is a step that
//           did nothing, however much dialogue it produced.
//
// Assertions that fail are recorded and the run carries on, so one pass gives the whole picture.
// Anything that leaves the player unable to continue stops the run and names the step.
import * as H from './harness.js';
import Player from '#/engine/entity/Player.js';
import VarPlayerType from '#/cache/config/VarPlayerType.js';
import VarBitType from '#/cache/config/VarBitType.js';
import World from '#/engine/World.js';
import { canTravel, isLineOfSight } from '#/engine/GameMap.js';
import { CollisionFlag, CollisionType } from '#/engine/routefinder/index.js';
import { BlockWalk } from '#/engine/entity/BlockWalk.js';
import LocType from '#/cache/config/LocType.js';
import ObjType from '#/cache/config/ObjType.js';
import InvType from '#/cache/config/InvType.js';
import { findNpc, drive, useOn, useOnNpc, useOnObj } from './a1lib.js';
import NpcType from '#/cache/config/NpcType.js';
import HuntType from '#/cache/config/HuntType.js';
import JavaRandom from '#/util/JavaRandom.js';
import ScriptState from '#/engine/script/ScriptState.js';
import Npc from '#/engine/entity/Npc.js';

/** The nearest tile within `radius` holding this ground obj, or null. */
function groundObj(p: Player, objName: string, radius: number): [number, number] | null {
    const id = ObjType.getId(objName);
    for (let r = 0; r <= radius; r++) {
        for (let dx = -r; dx <= r; dx++) {
            for (let dz = -r; dz <= r; dz++) {
                if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
                const x = p.x + dx;
                const z = p.z + dz;
                if (World.getObj(x, z, p.level, id, p.hash64) ?? World.getObj(x, z, p.level, id, -1n)) return [x, z];
            }
        }
    }
    return null;
}

export type Step =
    | { go: [number, number] | [number, number, number]; why?: string; r?: number; exact?: boolean }
    | { talk: string; picks?: (number | string)[]; op?: number; want?: string; why?: string; tries?: number; until?: string; soft?: boolean }
    | {
          loc: string;
          at: [number, number];
          op?: number;
          picks?: (number | string)[];
          want?: string;
          why?: string;
          soft?: boolean;
          exact?: boolean;
          tries?: number;
          until?: string;
          first?: string | [string, number, number, number][];
          firstAt?: [number, number];
          firstOp?: number;
          brief?: number;
          hop?: boolean;
      }
    | { held: string; op?: number; picks?: (number | string)[]; want?: string; why?: string; tries?: number; until?: string }
    | { use: [string, string]; picks?: (number | string)[]; want?: string; why?: string }
    | {
          useLoc: string;
          at: [number, number];
          obj: string;
          picks?: (number | string)[];
          want?: string;
          why?: string;
          tries?: number;
          soft?: boolean;
          hop?: boolean;
          near?: number;
          first?: string | [string, number, number, number][];
          firstAt?: [number, number];
          firstOp?: number;
      }
    | { useObj: string; at: [number, number]; obj: string; picks?: (number | string)[]; want?: string; why?: string; soft?: boolean }
    | { useNpc: string; obj: string; picks?: (number | string)[]; want?: string; why?: string; tries?: number; until?: string }
    | { give: string; n?: number; how?: string }
    | { setvar: string; to: number; why?: string }
    | { stage: number; orLater?: boolean }
    | { level: number }
    // `nomark` keeps the assertion and withholds the progress mark the exporter would make from
    // it. For a quest whose legs are parallel rather than sequential - Recipe for Disaster's eight
    // sub-quests, any of which can be started first - a varbit moving off zero says a branch was
    // DRAWN, not that the player has reached the step it sits beside. See DeathPlateau-Bugs#60.
    | { varis: string; to: number; nomark?: boolean }
    | { wait: number; why?: string }
    | { take: string; why?: string; r?: number; soft?: boolean; tries?: number; brief?: number }
    | { setpos: [number, number, number]; why: string }
    | { has: string; n?: number }
    | { worn: string }
    // notworn: the opposite assertion, and it is not `hasnt` - taking something off puts it back in
    // the bag, so the item is still carried. Content that reads `inv_total(worn, ...)` cares about
    // the difference: the Guardians of Armadyl attack anyone WEARING Lucien's pendant and do not
    // mind it being in the bag at all.
    | { notworn: string }
    | { hasnt: string }
    | { fight: string | string[]; until?: string; untilvar?: string; to?: number; tries?: number; r?: number; op?: number; why?: string }
    | { nearnpc: string; r?: number; why?: string }
    | { sneak: [number, number]; past: string; r?: number; tol?: number; why?: string }
    | { hunt: [string, number, number][]; untilnpc: string; untilvar?: string; to?: number; tries?: number; why?: string }
    | { herd: string; at: [number, number]; gate: [number, number, number, number]; untilvar: string; bit: number; tries?: number; why?: string }
    | { press: string; n?: number; slot?: number; why?: string }
    | { say: (number | string)[]; want?: string; why?: string }
    | { rng: number | null; why?: string }
    | { close: true; why?: string }
    | { resume: true; picks?: (number | string)[]; want?: string; why?: string }
    | { count: number; why?: string }
    | { zone: true; why?: string }
    | { mapexit: [number, number]; why?: string }
    | { strip: string[]; why?: string }
    | { drop: string[]; why?: string }
    | { wakehunt: string; untilvar?: string; to?: number; r?: number; tries?: number; why?: string }
    | { cast: string; on: string; r?: number; tries?: number; want?: string; why?: string }
    | { castLoc: string; at: [number, number]; spell: string; picks?: (number | string)[]; want?: string; why?: string; tries?: number }
    | { note: string };

export type Manifest = {
    quest: string;
    source: string; // the guide this step list came from
    stageVar: string; // the quest's own progress varp or varbit
    done: number; // its value at completion
    start: [number, number, number];
    steps: Step[];
};

const W = 66; // how wide a step line is before the verdict column

// DID THE PLAYER GET THERE? This is the one question the runner cannot afford to get wrong, because
// getting it wrong means a step that did nothing is reported as a pass, which is worse than no audit
// at all. Three earlier answers were all wrong, each in its own way:
//
//   activeScript      a suspended script means a dialogue opened - but a door, a ladder or a chest
//                     runs to completion inside one tick and suspends nothing, so every one of
//                     those read as a player stuck outside the thing it had just operated.
//   target === null    the engine also clears the queued interaction when the ROUTE gives up, so a
//                     ladder the player never reached read as a successful climb, and the next step
//                     then failed on the wrong floor - blaming the chest for the ladder's mistake.
//   any script ran     the player's interfaces are redrawn periodically by scripts of their own
//                     ("Total XP", "Players online"), so this passed a crone the player never
//                     walked to. It was the worst of the three: a silent false pass.
//
// So the test is POSITIONAL, which is what the question actually means: after the click, is the
// player standing next to the thing. A dialogue still counts on its own, because a chat interface
// cannot open unless the content ran.
function arrive(p: Player, tx: number, tz: number, tw = 1, tl = 1, ticks = 50): boolean {
    const level0 = p.level;
    const near = () => {
        const dx = Math.max(tx - p.x, 0, p.x - (tx + tw - 1));
        const dz = Math.max(tz - p.z, 0, p.z - (tz + tl - 1));
        return Math.max(dx, dz) <= 1;
    };
    // A STAIRCASE MOVES YOU, so standing next to it afterwards is the wrong question: Draynor
    // Manor's crypt stairs leave the player at 3077,9771, six thousand tiles from the step they
    // clicked, and the positional test called that a player who never got there. Changing level, or
    // ending up further from the loc than any route to it could have taken you, can only be the op
    // having run.
    const jumped = () => p.level !== level0 || Math.max(Math.abs(p.x - tx), Math.abs(p.z - tz)) > 64;
    // ALREADY STANDING THERE IS NOT THE SAME AS THE OP HAVING RUN. Returning the moment the
    // player was adjacent made every repeat click on an npc they were already next to look
    // delivered when the engine had not processed it yet - forty hands of Rune-Draw that were
    // never dealt. Give the op a few ticks to run before proximity is allowed to count.
    for (let t = 0; t < ticks; t++) {
        if (p.activeScript) return true;
        if (t >= 4 && (near() || jumped()) && !p.hasWaypoints()) return true;
        H.tick(1);
    }
    return !!p.activeScript || near() || jumped();
}

/** For a click with no target to walk to - an inventory op. Just let the script run. */
function quiet(p: Player, ticks = 10): void {
    for (let t = 0; t < ticks; t++) {
        if (p.activeScript) return;
        H.tick(1);
    }
}

export type Result = { n: number; what: string; ok: boolean; detail: string };

/** A walkable route between two tiles, by the engine's own canTravel. [] means there is none. */
/**
 * THE TILES OTHER BODIES ARE STANDING ON, which a terrain flood cannot see.
 *
 * An npc writes BLOCK_NPC_AND_PLAYERS and NPC_OCC onto its own square as it moves, and a player's
 * own block flag is BLOCK_NPC_AND_PLAYERS - so a tile with a sheep on it is solid to the player
 * while reading perfectly walkable to canTravel with an extraFlag of 0. That is the whole of Sheep
 * Herder's flakiness: the route is planned over ground, and walked by an engine that disagrees.
 *
 * Collected as a set of tiles rather than asked of the collision map, because the animal being
 * pushed has to be left OUT - its own square is occupied by definition, and a planner that
 * respected that would refuse to move it anywhere.
 */
export function occupied(level: number, ignore?: unknown): Set<number> {
    const key = (a: number, b: number) => a * 20000 + b;
    const out = new Set<number>();
    for (const npc of World.npcs) {
        if (!npc || npc === ignore) continue;
        if (npc.level !== level) continue;
        if (npc.blockWalk === BlockWalk.NONE) continue; // walks through others, and they through it
        for (let dx = 0; dx < npc.width; dx++) {
            for (let dz = 0; dz < npc.length; dz++) out.add(key(npc.x + dx, npc.z + dz));
        }
    }
    return out;
}

/**
 * EVERY TILE THE PLAYER CAN ACTUALLY WALK TO from where they stand, out to `radius`.
 *
 * A prod needs the tile BEHIND the animal, and that tile can be on the other side of a fence. The
 * pen in Sheep Herder is the case: a sheep standing against its north wall has a back tile inside
 * the pen, which is reachable only through the gate - so the plan is legal, the push is legal, and
 * the player cannot get there. Asking "is it standable" answers yes, and the step then spends
 * forty rounds waiting for a sheep that is not going to move.
 */
export function reachable(level: number, x: number, z: number, radius = 48, blocked?: Set<number>, extraFlag = 0): Set<number> {
    const key = (a: number, b: number) => a * 20000 + b;
    const seen = new Set<number>([key(x, z)]);
    let q: [number, number][] = [[x, z]];
    while (q.length) {
        const next: [number, number][] = [];
        for (const [cx, cz] of q) {
            for (const [dx, dz] of D4) {
                const nx = cx + dx;
                const nz = cz + dz;
                const k = key(nx, nz);
                if (seen.has(k)) continue;
                if (Math.abs(nx - x) > radius || Math.abs(nz - z) > radius) continue;
                if (!canTravel(level, cx, cz, dx, dz, 1, extraFlag, CollisionType.NORMAL)) continue;
                if (blocked && blocked.has(k)) continue;
                seen.add(k);
                next.push([nx, nz]);
            }
        }
        q = next;
    }
    return seen;
}

export function route(level: number, x: number, z: number, tx: number, tz: number, radius = 96, tol = 0, blocked?: Set<number>): number[][] {
    const key = (a: number, b: number) => a * 20000 + b;
    const prev = new Map<number, number>();
    const seen = new Set<number>([key(x, z)]);
    let q: number[][] = [[x, z]];
    while (q.length) {
        const next: number[][] = [];
        for (const [cx, cz] of q) {
            if (Math.max(Math.abs(cx - tx), Math.abs(cz - tz)) <= tol) {
                const out: number[][] = [];
                let cur = key(cx, cz);
                while (cur !== key(x, z)) {
                    out.unshift([Math.floor(cur / 20000), cur % 20000]);
                    cur = prev.get(cur)!;
                }
                return out;
            }
            for (const [dx, dz] of [
                [1, 0],
                [-1, 0],
                [0, 1],
                [0, -1]
            ]) {
                const nx = cx + dx,
                    nz = cz + dz,
                    k = key(nx, nz);
                if (seen.has(k)) continue;
                if (Math.abs(nx - x) > radius || Math.abs(nz - z) > radius) continue;
                if (!canTravel(level, cx, cz, dx, dz, 1, 0, CollisionType.NORMAL)) continue;
                if (blocked && blocked.has(k)) continue;
                seen.add(k);
                prev.set(k, key(cx, cz));
                next.push([nx, nz]);
            }
        }
        q = next;
    }
    // AND IF AVOIDING THEM LEAVES NO ROUTE AT ALL, take the one through them. Standing where a body
    // stands is not possible, but a route that merely passes a tile something will have wandered
    // off by the time the player reaches it is worth walking - and a hard refusal here would turn
    // every crowded doorway in the directory into a failed step.
    if (blocked) return route(level, x, z, tx, tz, radius, tol);
    return [];
}

/**
 * A LOC YOU CAN WALK ON IS USED FROM ITS OWN TILE, not from beside it. The route an interaction
 * sends goes adjacent, which is right for a door or a chest and wrong for a farming patch: rake in
 * hand, standing one tile north of Unferth's patch, and nothing happens at all - in silence,
 * because the handler's p_arrivedelay never completes.
 */
function standOnIfWalkable(p: Player, name: string, x: number, z: number): void {
    try {
        if (LocType.get(LocType.getId(name)).blockwalk) return;
    } catch {
        return;
    }
    travel(p, x, z, p.level, 48, 0);
}

/** Walk a route, one waypoint a tick, the way a client feeds them. Returns '' or why it failed. */
const D4: [number, number][] = [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0]
];

export function travel(p: Player, tx: number, tz: number, level = p.level, radius = 96, tol = 2, blocked?: Set<number>): string {
    if (p.level !== level) {
        return 'on level ' + p.level + ', not ' + level + ' - no step so far changed your floor';
    }
    if (Math.max(Math.abs(p.x - tx), Math.abs(p.z - tz)) <= tol) return '';
    const path = route(level, p.x, p.z, tx, tz, radius, tol, blocked);
    if (!path.length) {
        return 'NO WALKABLE ROUTE from ' + p.x + ',' + p.z + ' to ' + tx + ',' + tz;
    }
    let done = 0;
    for (const [sx, sz] of path) {
        for (let t = 0; t < 12 && (p.x !== sx || p.z !== sz); t++) {
            H.walkTo(p, sx, sz);
            H.tick(1);
        }
        if (p.x !== sx || p.z !== sz) break;
        done++;
    }
    const off = Math.max(Math.abs(p.x - tx), Math.abs(p.z - tz));
    if (off > tol) {
        return 'stopped at ' + p.x + ',' + p.z + ', ' + done + ' tiles into a ' + path.length + '-tile route';
    }
    return '';
}

// PRODDING AN ANIMAL ACROSS A FIELD. Sheep Herder's cattleprod moves a sheep one tile directly
// away from the player, and ~coord_direction only ever answers N/S/E/W, so the player has to stand
// SQUARE behind it: a diagonal reads as east or west and sends the sheep sideways.
//
// That makes "where can this sheep be pushed" a different graph from "where can this sheep walk".
// A tile with a wall behind it cannot be pushed away from that wall at all, because there is
// nowhere for the player to stand, so the route has to be planned over moves that are legal for
// BOTH of them. Planning it as a walk instead sends the sheep into a corner it cannot leave, which
// is exactly where the first version of this got stuck, eight prods in a row with nothing moving.
/**
 * AND THE FLAG THAT IS NOT IN WALK_BLOCKED.
 *
 * `canTravel` with an extraFlag of 0 tests WALK_BLOCKED, which is FLOOR | FLOOR_DECORATION | LOC.
 * It does NOT include BLOCK_NPC_AND_PLAYERS (0x100000), and that is the flag a blocking loc writes
 * for bodies: both a player and an npc carry it in their own blockWalkFlag, so both refuse a tile
 * that has it while canTravel says the tile is fine.
 *
 * Planning a prod without it produces pushes the ANIMAL refuses - "twenty-five prods in a row and
 * it has not moved, at 2609,3339" - and walks to stand tiles the PLAYER refuses. Both halves of a
 * prod are bodies moving, so both ask with the flag.
 */
const BODY = CollisionFlag.BLOCK_NPC_AND_PLAYERS;

function stepOk(level: number, x: number, z: number, dx: number, dz: number): boolean {
    return canTravel(level, x, z, dx, dz, 1, BODY, CollisionType.NORMAL);
}

/** Can anything stand here? True if some neighbour can walk onto the tile. */
function standable(level: number, x: number, z: number): boolean {
    for (const [dx, dz] of D4) if (stepOk(level, x - dx, z - dz, dx, dz)) return true;
    return false;
}

/**
 * The tiles to push an npc through to get it into the box, or null if it cannot be done.
 *
 * `blocked` is where the OTHER bodies are standing (see `occupied`). Both halves of a prod need it:
 * the animal will not walk onto an occupied tile, because an npc's own block flag carries NPC_OCC,
 * and the player cannot stand on one either. Without it the plan is drawn over ground that is only
 * notionally empty, the engine refuses the move, and the step spends its prods shoving a sheep into
 * its neighbour - which is what left Sheep Herder passing about half the time.
 */
export function prodPlan(level: number, sx: number, sz: number, box: [number, number, number, number], blocked?: Set<number>, reach?: Set<number>, reachFirstOnly = false): [number, number][] | null {
    const key = (a: number, b: number) => a * 20000 + b;
    const inBox = (x: number, z: number) => x >= box[0] && x <= box[2] && z >= box[1] && z <= box[3];
    const prev = new Map<number, number>();
    const seen = new Set<number>([key(sx, sz)]);
    let q: [number, number][] = [[sx, sz]];
    let rounds = 0;
    while (q.length && rounds < 400) {
        rounds++;
        const next: [number, number][] = [];
        for (const [x, z] of q) {
            if (inBox(x, z)) {
                const out: [number, number][] = [];
                let cur = key(x, z);
                while (cur !== key(sx, sz)) {
                    out.unshift([Math.floor(cur / 20000), cur % 20000]);
                    cur = prev.get(cur)!;
                }
                return out;
            }
            for (const [dx, dz] of D4) {
                const nx = x + dx;
                const nz = z + dz;
                if (Math.abs(nx - sx) > 80 || Math.abs(nz - sz) > 80) continue;
                if (seen.has(key(nx, nz))) continue;
                if (!stepOk(level, x, z, dx, dz)) continue;
                if (!standable(level, x - dx, z - dz)) continue;
                // the animal will not step onto a body, and nobody can stand behind it on one
                if (blocked && (blocked.has(key(nx, nz)) || blocked.has(key(x - dx, z - dz)))) continue;
                // AND EVERY PUSH HAS TO BE ONE THE PLAYER CAN MAKE, not just the next one.
                //
                // `reach` is the player's walkable COMPONENT, and walking about inside a component
                // does not change it - so a stand tile outside it is a push that is impossible
                // now and still impossible ten tiles later. Gating only the first step let the
                // plan turn into the fence on step two: push south, re-plan, west is refused,
                // push north, re-plan, west is refused - four hundred prods of a sheep walking up
                // and down the same fence.
                //
                // (The first attempt at this gated every step against a flood that had the OTHER
                // sheep subtracted from it, which cuts the component in half at any doorway one of
                // them is standing in, and threw away every route instead. Animals belong in
                // `blocked`; terrain belongs here.)
                if (reach && (!reachFirstOnly || (x === sx && z === sz)) && !reach.has(key(x - dx, z - dz))) continue;
                seen.add(key(nx, nz));
                prev.set(key(nx, nz), key(x, z));
                next.push([nx, nz]);
            }
        }
        q = next;
    }
    // THE TWO CONSTRAINTS ARE NOT EQUAL, and dropping the wrong one first is what kept Sheep
    // Herder failing about half the time even with both in place.
    //
    // `blocked` is soft: the animals wander, so a push refused because one of them is in the way
    // this round is often legal two rounds later, and a plan that goes through them is worth
    // having because the caller re-plans every round.
    //
    // `reach` is NOT soft. It says the player cannot get to the tile the push has to come from -
    // a fence between 2623 and 2624 in the field north of Ardougne, free ground either side of it
    // and no way across for eight tiles. Dropping it hands back a plan whose first move nobody can
    // make, and the step then spends forty rounds walking to a tile it will never reach. Which is
    // exactly what it did: "could not get behind it: NO WALKABLE ROUTE from 2623,3368 to
    // 2624,3366", on the sheep that was standing against that fence.
    //
    // So: drop the soft one, keep the hard one, and if there is still nothing, say so. No plan is
    // the honest answer, and the caller waits for the animal to wander out of the corner.
    // THE FALLBACK HAS THREE RUNGS AND NO FOURTH.
    //
    //   every step makeable, animals avoided   the best plan, and usually there is one
    //   every step makeable                    animals are soft: they wander, and the caller
    //                                          re-plans every round
    //   the NEXT push makeable                 the rest of the plan may need re-planning as the
    //                                          player walks, which the caller does anyway - this
    //                                          is the rung that gets a sheep out of a corner the
    //                                          strict plan can see no way out of
    //
    // And nothing below that. A plan whose next push comes from a tile the player cannot reach is
    // not a plan: the step walks towards it, never arrives, and spends forty rounds finding out.
    if (blocked) return prodPlan(level, sx, sz, box, undefined, reach, reachFirstOnly);
    if (reach && !reachFirstOnly) return prodPlan(level, sx, sz, box, blocked, reach, true);
    return null;
}

export function stageOf(p: Player, name: string): number {
    if (VarBitType.getId(name) !== -1) return H.getVarBit(p, name);
    if (VarPlayerType.getByName(name)) return H.getVar(p, name);
    throw new Error('no such varp or varbit: ' + name);
}

export function play(m: Manifest, p: Player): Result[] {
    const out: Result[] = [];
    const gives: string[] = [];
    let n = 0;
    let stopped = '';
    console.log('');
    console.log(m.quest);
    console.log('  step list from ' + m.source);
    console.log('  progress read off ' + m.stageVar + ', complete at ' + m.done);

    // THE OPS A STEP NEEDS BEFORE IT, in order, and with as few ticks between them as possible.
    // Shilo Village's carved doors are the case this exists for: the palm trees over them have to
    // be SEARCHED to reveal them, they hide themselves again fifty ticks later, and getting inside
    // takes two more clicks after that - so the whole chain has to fit in one window, and going
    // through arrive() for each link spent the window on its own.
    const runFirsts = (spec: string | [string, number, number, number][], at: [number, number], atOp: number) => {
        const chain: [string, number, number, number][] = typeof spec === 'string' ? [[spec, at[0], at[1], atOp]] : spec;
        (p as unknown as { closeModal: (c?: boolean) => void }).closeModal(false);
        for (let w = 0; w < 12 && (p as unknown as { delayed: boolean }).delayed; w++) H.tick(1);
        for (const [name, fx, fz, fop] of chain) {
            try {
                if (H.opLoc(p, fx, fz, name, fop)) {
                    for (let t = 0; t < 4; t++) H.tick(1);
                }
            } catch {
                // already in the state the step wants
            }
        }
    };
    for (const s of m.steps) {
        if (stopped) break;

        if ('note' in s) {
            console.log('');
            console.log('      -- ' + s.note);
            continue;
        }
        if ('give' in s) {
            H.give(p, s.give, s.n ?? 1);
            gives.push(s.n && s.n > 1 ? s.give + ' x' + s.n : s.give);
            continue;
        }
        if ('setvar' in s) {
            try {
                H.setVarBit(p, s.setvar, s.to);
            } catch {
                H.setVar(p, s.setvar, s.to);
            }
            H.tick(1);
            console.log('      -- ' + s.setvar + ' = ' + s.to + (s.why ? '   (' + s.why + ')' : ''));
            continue;
        }

        n++;
        const label = (t: string) => (t.length > W ? t.slice(0, W - 1) + '~' : t.padEnd(W));
        const soft_step = 'soft' in s && s.soft === true;
        const hard = (what: string, ok: boolean, detail = '') => {
            out.push({ n, what, ok: ok || soft_step, detail });
            console.log('  ' + String(n).padStart(2) + '. ' + label(what) + (ok ? ' ok' : soft_step ? ' --' : ' FAIL') + (detail ? '  ' + detail : ''));
            if (!ok && !soft_step) stopped = what;
        };
        const soft = (what: string, ok: boolean, detail = '') => {
            out.push({ n, what, ok, detail });
            console.log('  ' + String(n).padStart(2) + '. ' + label(what) + (ok ? ' ok' : ' NO') + (detail ? '  ' + detail : ''));
        };

        if ('go' in s) {
            const x = s.go[0];
            const z = s.go[1];
            const lvl = s.go.length > 2 ? (s.go[2] as number) : p.level;
            const err = travel(p, x, z, lvl, s.r ?? 96, s.exact ? 0 : 2);
            // TWO TILES OF SLACK, REPORTED. travel() accepts landing within 2 of the target, which
            // is right - a tile is often occupied by the time the route gets there - but it said
            // nothing about having done so, and two tiles is enough to be on the other side of a
            // wall. Elemental Workshop I walks into a house whose door is shut: "walk to 2715,3481
            // ok" with the player standing outside, and the bookcase step then failed as though the
            // bookcase were the problem. Where the player actually stopped is now part of the line.
            const off = Math.max(Math.abs(p.x - x), Math.abs(p.z - z));
            hard('walk to ' + x + ',' + z + (s.why ? ' - ' + s.why : ''), !err, err || (off ? 'stopped ' + off + ' short, at ' + p.x + ',' + p.z : ''));
            continue;
        }
        if ('take' in s) {
            // A REAL CLICK, not a lift. a1lib's take() deletes the obj and hands the player the
            // item, which is harmless for an egg on a coop floor and useless for the ghost's
            // skull: [opobj3,ghostskull] IS that step of The Restless Ghost, setting the stage and
            // spawning the skeleton, and the lift left the quest sitting at stage 3 while the
            // inventory check passed. So walk to it and send op 3, which is the ground Take.
            n++;
            const label2 = (x: string) => (x.length > W ? x.slice(0, W - 1) + '~' : x.padEnd(W));
            const what2 = 'pick up ' + s.take + (s.why ? ' - ' + s.why : '');
            const before = H.invCount(p, s.take);
            const at = groundObj(p, s.take, s.r ?? 6);
            let got = false;
            let why = 'nothing on the floor nearby';
            if (at) {
                // A LEFTOVER DELAY OR AN OPEN CHAT WINDOW EATS THE CLICK, and the engine drops it
                // without a word - the same thing that ate forty hands of Rune-Draw. So clear both
                // and allow a couple of goes, which is what a player does anyway.
                // `tries` AND `brief`, FOR A CLICK THAT WAKES SOMETHING. Reaching for Viyeldi's
                // hat animates the clothes beside it and starts his speech, which ends in npc_del
                // - so arrive()'s fifty ticks and drive()'s clicks spend the whole 100-tick life of
                // the npc the click just woke, and the dagger has nothing left to be used on. With
                // `brief` the click gets that many ticks and no dialogue, and `tries: 1` stops the
                // retry sending a second Take that only gets "your hand passes through the hat".
                const triesTake = ('tries' in s ? s.tries : undefined) ?? 3;
                const briefTake = 'brief' in s ? s.brief : undefined;
                for (let a = 0; a < triesTake && !got; a++) {
                    for (let w = 0; w < 10 && (p as unknown as { delayed: boolean }).delayed; w++) H.tick(1);
                    (p as unknown as { closeModal: (c?: boolean) => void }).closeModal(false);
                    H.tick(1);
                    // STAND ON IT FIRST. A ground obj is picked up from its own tile, and the
                    // interaction route only goes adjacent, so the walk is done here and exactly -
                    // the fish food on the manor's first floor was two tiles away and stayed there.
                    let err = travel(p, at[0], at[1], p.level, 48, 0);
                    if (err) {
                        // UNLESS THE TILE IS UNDER THE FURNITURE. Monk's Friend leaves the child's
                        // blanket on the thieves' table, which is a blocking loc, so there is no
                        // route onto its tile at all - and the engine does not need one: reachedObj
                        // accepts a click from a tile beside the obj. So fall back to a neighbour
                        // and let the engine's own rule decide, rather than this runner's.
                        let beside = false;
                        for (const [dx, dz] of D4) {
                            if (!travel(p, at[0] + dx, at[1] + dz, p.level, 48, 0)) {
                                beside = true;
                                break;
                            }
                        }
                        if (!beside) {
                            why = err;
                            continue;
                        }
                        err = '';
                    }
                    if (!H.opObj(p, at[0], at[1], s.take, 3, false)) {
                        why = 'the player was delayed and the click was thrown away';
                        H.tick(5);
                        continue;
                    }
                    if (briefTake) {
                        for (let t = 0; t < briefTake; t++) H.tick(1);
                    } else {
                        arrive(p, at[0], at[1]);
                        drive(p, []);
                    }
                    got = H.invCount(p, s.take) > before;
                    if (!got)
                        why =
                            'clicked Take at ' +
                            at[0] +
                            ',' +
                            at[1] +
                            ' and it never arrived; the player is at ' +
                            p.x +
                            ',' +
                            p.z +
                            ', the obj is ' +
                            (groundObj(p, s.take, 1) ? 'still there' : 'gone') +
                            ', target=' +
                            !!p.target +
                            ', free=' +
                            (p.getInventory(InvType.INV)?.freeSlotCount ?? '?');
                }
            }
            // A CLICK THAT IS MEANT TO FAIL. Witch's House spawns the shapeshifter the first time
            // anybody reaches for the ball, and the ball stays where it is - so that click has to
            // be sent and must not stop the run.
            const softTake = 'soft' in s && s.soft === true;
            out.push({ n, what: what2, ok: got || softTake, detail: got ? '' : why });
            console.log('  ' + String(n).padStart(2) + '. ' + label2(what2) + (got ? ' ok' : softTake ? ' --' : ' FAIL') + (!got && softTake ? '  ' + why : ''));
            if (!got && !softTake) stopped = what2;
            continue;
        }
        if ('setpos' in s) {
            // THE ONE DELIBERATE CHEAT, and it has to say so. This runner exists because the other
            // sims teleport, so a jump in a manifest is only ever allowed for a stretch of WORLD
            // travel that is not the quest - and it prints a line of its own so nobody can mistake
            // a jumped leg for a walked one. Every use needs a reason in .
            // CLEAR THE ROUTE FIRST. A jump with waypoints still queued is undone by the engine on
            // the next tick - it carries on walking the old path from the new tile - which is how a
            // jump to 3017,5201 ended up at 3030,5203.
            p.clearPendingAction();
            p.queueWaypoints([]);
            p.teleport(s.setpos[0], s.setpos[1], s.setpos[2]);
            H.tick(2);
            console.log('      -- JUMPED to ' + s.setpos[0] + ',' + s.setpos[1] + ' L' + s.setpos[2] + ': ' + s.why);
            continue;
        }
        if ('wait' in s) {
            H.tick(s.wait);
            console.log('      -- waited ' + s.wait + ' ticks' + (s.why ? '   (' + s.why + ')' : ''));
            continue;
        }
        // CLOSE A MAIN INTERFACE SO THE QUEUE CAN RUN. An open modal makes busy() true, and
        // canAccess() gates processQueue on it - so a queue the player's own click started will sit
        // there for ever until the interface is shut. The Observatory telescope does exactly that:
        // if_openmain(telescope) and then queue(constellation_dialogue, 0, ...), which is why the
        // constellation dialogue only arrives after the player closes the view. Nothing else in the
        // runner shuts a main interface, so the manifest has to say when the player clicks the X.
        // A SPELL AT A NAMED NPC, which no other step can send. Chronozon has to be hit once by
        // each of the four Blast spells before he can be killed at all, and "hit" means a hit, not
        // a cast - a splash does not count. So this waits for the hit to land and reports whether
        // the spell actually connected rather than whether the click went out.
        if ('cast' in s) {
            const whatCast = 'cast ' + s.cast + ' at ' + s.on + (s.why ? ' - ' + s.why : '');
            const rCast = ('r' in s ? s.r : undefined) ?? 16;
            const triesCast = ('tries' in s ? s.tries : undefined) ?? 6;
            const ids = NpcType.getId(s.on);
            let hit = false;
            let whyNot = 'no ' + s.on + ' within ' + rCast;
            const mesMarkCast = H.mesgs.length;
            for (let a = 0; a < triesCast && !hit; a++) {
                let target: Npc | null = null;
                for (const npc of World.npcs) {
                    if (!npc || !npc.isActive || npc.level !== p.level || npc.type !== ids) continue;
                    if (Math.max(Math.abs(npc.x - p.x), Math.abs(npc.z - p.z)) <= rCast) {
                        target = npc;
                        break;
                    }
                }
                if (!target) {
                    H.tick(4);
                    continue;
                }
                whyNot = 'the spell never landed';
                try {
                    H.castOnNpc(p, target, s.cast);
                } catch (e) {
                    whyNot = String(e).replace('Error: ', '');
                    break;
                }
                for (let t = 0; t < 20; t++) {
                    H.tick(1);
                    const said = H.mesgs
                        .slice(mesMarkCast)
                        .map(x => x.text)
                        .join(' ');
                    if (s.want ? said.includes(s.want) : (target.levels[3] ?? 0) < (target.baseLevels[3] ?? 0)) {
                        hit = true;
                        break;
                    }
                }
                // A SPELL CAN ANSWER IN DIALOGUE RATHER THAN IN THE CHATBOX. Confuse cast on
                // Ungadulu inside his octagram frees him for long enough to say where the Book of
                // Binding is, and every word of it is a ~chatnpc waiting on a click - none of it
                // reaches H.mesgs, so a `want` taken from what he says could never match and the
                // step reported "the spell never landed" over a spell that had landed. Drive what
                // is waiting and judge the step on those lines too.
                if (!hit && s.want) {
                    let spoke: string[] = [];
                    try {
                        spoke = drive(p, []);
                    } catch {
                        // a menu this step has no answer for is the next step's business
                    }
                    if (
                        H.mesgs
                            .slice(mesMarkCast)
                            .map(x => x.text)
                            .concat(spoke)
                            .join(' ')
                            .includes(s.want)
                    )
                        hit = true;
                }
            }
            soft(whatCast, hit, hit ? '' : whyNot);
            continue;
        }
        // CAST A SPELL ON A LOC, which is the only thing some locs answer to. Legends' Quest's
        // magic trial gate is fused into the rock and cannot be opened from the south at all: the
        // way through is to charge an orb against it, which the gate intercepts in
        // ~magic_spell_charge_orb before it ever checks whether the loc is the right obelisk.
        if ('castLoc' in s) {
            const whatCL = 'cast ' + s.spell + ' at ' + s.castLoc + ' ' + s.at[0] + ',' + s.at[1] + (s.why ? ' - ' + s.why : '');
            const markCL = H.mesgs.length;
            let sentCL = false;
            let blewCL = '';
            let linesCL: string[] = [];
            // AND A CAST AT A WALL IS NOT ALWAYS DELIVERED. The route to a wall loc can leave the
            // player on a tile the interaction is never satisfied from, and the click is dropped
            // without a word - so `tries` sends it again, which is what a player does.
            const triesCL = ('tries' in s ? s.tries : undefined) ?? 1;
            for (let a = 0; a < triesCL; a++) {
                if (a > 0) H.tick(4);
                // AND CLEAR WHAT IS IN THE WAY FIRST. A spell on a loc is an interaction, and the
                // engine processes none of them while canAccess() is false - so an objbox still
                // open from the step before (the bravery potion's "you bravely swig down the
                // entire contents") swallows the cast with no message at all, which looks exactly
                // like a spell that fizzled. Same clearing the take step does.
                for (let w = 0; w < 10 && (p as unknown as { delayed: boolean }).delayed; w++) H.tick(1);
                (p as unknown as { closeModal: (c?: boolean) => void }).closeModal(false);
                H.tick(1);
                try {
                    sentCL = H.castOnLoc(p, s.at[0], s.at[1], s.castLoc, s.spell);
                } catch (e) {
                    blewCL = String(e).replace('Error: ', '');
                    break;
                }
                if (!sentCL) continue;
                // LONG ENOUGH FOR WHAT THE SPELL SETS OFF. Charging an orb against the magic trial
                // gate forcewalks you to the tile in front of it and then blows you clean through
                // into the next cave, which is an exactmove of some thirty ticks - and reading the
                // player's position before it finishes finds them half way, mid-flight, on a tile
                // with no walkable route to anywhere.
                for (let t = 0; t < 40; t++) H.tick(1);
                try {
                    linesCL = linesCL.concat(drive(p, ('picks' in s ? s.picks : undefined) ?? []));
                } catch {
                    // a menu this step has no answer for is the next step's business
                }
                if (
                    !s.want ||
                    linesCL
                        .concat(H.mesgs.slice(markCL).map(x => x.text))
                        .join(' ')
                        .includes(s.want)
                )
                    break;
            }
            const saidCL = linesCL.concat(H.mesgs.slice(markCL).map(x => x.text)).join(' ');
            if (blewCL) hard(whatCL, false, blewCL);
            else if (!sentCL) hard(whatCL, false, 'the player was delayed and the click was thrown away');
            else if (s.want && !saidCL.includes(s.want))
                soft(
                    whatCL,
                    false,
                    'nothing said "' +
                        s.want +
                        '"' +
                        '; at ' +
                        p.x +
                        ',' +
                        p.z +
                        ', protect=' +
                        (p as unknown as { protect: boolean }).protect +
                        ', delayed=' +
                        (p as unknown as { delayed: boolean }).delayed +
                        ', busy=' +
                        (p as unknown as { busy: () => boolean }).busy() +
                        ', free=' +
                        (p.getInventory(InvType.INV)?.freeSlotCount ?? '?') +
                        '; got: ' +
                        saidCL.replace(/Total XP:[^|]*/g, '').slice(0, 200)
                );
            else hard(whatCL, true);
            continue;
        }
        // USE A HELD ITEM ON A GROUND OBJ. Nothing else reaches OPOBJU: the loc version walks to a
        // tile beside the thing, and a ground obj is reached from its own tile. Zogre Flesh Eaters
        // puts a cup of tea on Sithik's drawers and the potion has to go into the cup.
        if ('useObj' in s) {
            const whatUO = 'use ' + s.obj + ' on the ' + s.useObj + ' at ' + s.at[0] + ',' + s.at[1] + (s.why ? ' - ' + s.why : '');
            const markUO = H.mesgs.length;
            let linesUO: string[] = [];
            let blewUO = '';
            try {
                linesUO = useOnObj(p, s.at[0], s.at[1], s.useObj, s.obj, ('picks' in s ? s.picks : undefined) ?? []);
            } catch (e) {
                blewUO = String(e).replace('Error: ', '');
            }
            const saidUO = linesUO.concat(H.mesgs.slice(markUO).map(x => x.text)).join(' ');
            const okUO = !blewUO && (!s.want || saidUO.includes(s.want));
            const report = 'soft' in s && s.soft ? soft : hard;
            report(whatUO, okUO, blewUO || (okUO ? '' : 'nothing said "' + s.want + '"; got: ' + saidUO.slice(0, 160)));
            continue;
        }
        if ('wakehunt' in s) {
            // A HUNT NOBODY IS WATCHING NEVER RUNS. Npc.processNpc only calls huntAll() when the
            // hunt's nobodynear is not PAUSEHUNT - the default - or when rsbuf.getNpcObservers()
            // says a client is looking at the npc, and a harness player is not a NetworkPlayer, so
            // it observes nothing and no npc in a sim ever hunts anything. Big Chompy Bird Hunting
            // is the first quest in the pass that turns on one: the chompy bird is called by the
            // bait and then has to HUNT the bloated toad to eat it, and eating it is what moves the
            // quest on. Same shape as the `zone` step: the engine's own call is made by hand, with
            // the huntClock ticked so the hunt's own rate still applies, and consumeHuntTarget is
            // left to the engine - processNpc calls it outside the gate.
            const wantHunt = 'wake the hunt on ' + s.wakehunt + (s.why ? ' - ' + s.why : '');
            const idHunt = NpcType.getId(s.wakehunt);
            const rWake = ('r' in s ? s.r : undefined) ?? 20;
            // EVERY ONE OF THEM, NOT THE FIRST ONE FOUND. What gates the real hunt is an observer,
            // and a watching client observes a whole zone rather than one npc, so every matching
            // npc in range is driven. Taking the first match out of World.npcs - which is in spawn
            // order, not distance order - also made the step's behaviour depend on how many static
            // npcs happened to be created before this one.
            const hunters: Npc[] = [];
            for (const npc of World.npcs) {
                if (!npc || !npc.isActive || npc.type !== idHunt || npc.level !== p.level) continue;
                if (Math.max(Math.abs(npc.x - p.x), Math.abs(npc.z - p.z)) > rWake) continue;
                hunters.push(npc);
            }
            const doneWake = () => ('untilvar' in s && s.untilvar ? stageOf(p, s.untilvar) === s.to : hunters.some(h => !h.isValid()));
            if (!hunters.length) {
                soft(wantHunt, false, 'nothing of that type is within ' + rWake + ' tiles of ' + p.x + ',' + p.z);
                continue;
            }
            // THE THROTTLE HAS ALREADY RUN DOWN BY NOW. huntAll() returns without looking at
            // anything while huntClock < rate - 1, and huntClock is incremented inside the same
            // observer gate that stops the hunt running at all - so on a live server the clock has
            // been ticking since the npc spawned, under the eye of the player who is standing
            // there, and the throttle is long expired before the npc is worth hunting with. In a
            // sim nothing ticks it, so it is still 0 when this step starts and the first rate - 1
            // ticks of the step are dead. For the chompy bird, with rate=10, those are precisely
            // the ticks it spends beside the bait it was called to: it lands within two tiles
            // (map_findsquare(coord, 1, 2) in spawn_chompy_bird), stands there while the throttle
            // runs down, and has wandered back out of its huntrange=2 by the time huntAll is
            // allowed to look. The quest then stalls at the bait and the failure reads as a hunt
            // that "never found anything", with nothing wrong in the content or the engine.
            // Starting the clock where the engine would have left it is what makes this step a
            // model of the live hunt rather than a race against the npc's own wander.
            for (const hunter of hunters) {
                const h: any = hunter;
                if (h.huntMode === -1) continue;
                const hunt = HuntType.get(h.huntMode);
                if (hunt && h.huntClock < hunt.rate) {
                    h.huntClock = hunt.rate;
                }
            }
            const ticksWake = ('tries' in s ? s.tries : undefined) ?? 60;
            for (let t = 0; t < ticksWake && !doneWake(); t++) {
                for (const hunter of hunters) {
                    const h: any = hunter;
                    if (h.huntMode !== -1 && h.isValid()) {
                        const hunt = HuntType.get(h.huntMode);
                        if (hunt) {
                            h.huntAll(hunt);
                            h.huntClock++;
                        }
                    }
                }
                H.tick(1);
            }
            soft(wantHunt, doneWake(), doneWake() ? '' : 'the hunt never found anything in ' + ticksWake + ' ticks');
            continue;
        }
        if ('strip' in s) {
            // TAKE EVERYTHING ELSE OFF. Some content counts what is worn rather than looking for a
            // particular thing: Underground Pass's temple doors want
            // inv_freespace(worn) = inv_size(worn) - 2, which is "the two Zamorak robes and nothing
            // else", so a player in full rune with a bow is refused however right the robes are.
            // There is no unequip trigger to drive, so this moves each unwanted worn item back into
            // the pack the way the client's own Remove does, and says what it took off.
            const keep = new Set(s.strip.map(n => ObjType.getId(n)));
            const worn = p.getInventory(InvType.WORN);
            const took: string[] = [];
            if (worn) {
                for (let slot = 0; slot < worn.capacity; slot++) {
                    const obj = worn.get(slot);
                    if (!obj || keep.has(obj.id)) continue;
                    took.push(ObjType.get(obj.id).debugname ?? String(obj.id));
                    worn.delete(slot);
                    p.invAdd(InvType.INV, obj.id, obj.count);
                }
            }
            (p as unknown as { buildAppearance: (inv: number) => void }).buildAppearance?.(InvType.WORN);
            H.tick(2);
            const whatStrip = 'take off everything but ' + s.strip.join(', ') + (s.why ? ' - ' + s.why : '');
            soft(whatStrip, true, took.length ? 'removed ' + took.join(', ') : 'nothing to remove');
            continue;
        }
        // DROP WHAT THE WALK HAS FINISHED WITH. Twenty-eight slots is a real constraint on a long
        // quest, and a quest script that hands you something with `// no space check` above it
        // loses the item outright when the pack is full: Legends' Quest's three dead heroes each
        // inv_add a chunk of the heart crystal that way, so the second and third kills were
        // rewarding nothing at all. A player would bank or drop the spent trial kit; this does the
        // same, and prints what is left so the next step list can be written against it.
        if ('drop' in s) {
            const whatDrop = 'drop what is spent' + (s.why ? ' - ' + s.why : '');
            const gone: string[] = [];
            for (const name of s.drop) {
                const id = ObjType.getId(name);
                if (id === -1) continue;
                const n = H.invCount(p, name);
                if (n <= 0) continue;
                p.invDel(InvType.INV, id, n);
                gone.push(name + (n > 1 ? ' x' + n : ''));
            }
            H.tick(1);
            const inv = p.getInventory(InvType.INV);
            const left: string[] = [];
            if (inv) {
                for (let i = 0; i < inv.capacity; i++) {
                    const o = inv.get(i);
                    if (o) left.push((ObjType.get(o.id).debugname ?? String(o.id)) + (o.count > 1 ? ' x' + o.count : ''));
                }
            }
            soft(whatDrop, true, (gone.length ? 'dropped ' + gone.join(', ') + '; ' : '') + left.length + ' slots used: ' + left.join(', '));
            continue;
        }
        if ('mapexit' in s) {
            // LEAVING A MAP SQUARE IS A TRIGGER TOO, and the same NetworkPlayer-only hole as the
            // `zone` step covers: [mapzone,...] and [mapzoneexit,...] are fired from
            // processMovement, so a harness player can walk out of a map square and nothing runs.
            // Shilo Village is the first quest in the pass that needs one - leaving Ah Za Rhoon is
            // what sets ^zombiequeen_left_ah_za_rhoon, and the tomb of Bervirius will not let you
            // in without it. The coordinate is the square being LEFT, not the one arrived in.
            const [mx, mz] = s.mapexit;
            const whatExit = 'leave the map square at ' + mx + ',' + mz + (s.why ? ' - ' + s.why : '');
            (p as any).triggerMapzoneExit(mx, mz);
            for (let t = 0; t < 10 && !p.activeScript; t++) H.tick(1);
            for (let t = 0; t < 20 && p.activeScript; t++) H.tick(1);
            soft(whatExit, true, '');
            continue;
        }
        if ('zone' in s) {
            // A [zone,...] TRIGGER, which a sim never gets on its own: Player.triggerZone is only
            // called from NetworkPlayer.processMovement, so a harness player can walk into a zone
            // all day and nothing fires. Death Plateau's scouting step is one of these - walking
            // far enough up the secret path is what tells Denulth the trolls have not found it.
            // This fires the trigger for the tile the player is standing on, which is exactly what
            // the client's own arrival does, so the CONTENT is still what is being tested.
            const whatZone = 'zone trigger at ' + p.x + ',' + p.z + (s.why ? ' - ' + s.why : '');
            (p as any).triggerZone(p.level, (p.x >> 3) << 3, (p.z >> 3) << 3);
            for (let t = 0; t < 10 && !p.activeScript; t++) H.tick(1);
            for (let t = 0; t < 20 && p.activeScript; t++) H.tick(1);
            soft(whatZone, true, '');
            continue;
        }
        if ('count' in s) {
            // A p_countdialog: the "enter an amount" box, which is not a button and not a menu, so
            // neither choose() nor ifButton() can answer it. Death Plateau's dice is the first
            // thing in the pass to ask for one - Harold wants a stake typed in before he will roll.
            const whatCount = 'enter ' + s.count + (s.why ? ' - ' + s.why : '');
            let answered = false;
            for (let t = 0; t < 10 && !answered; t++) {
                const sc: any = (p as any).activeScript;
                if (sc && sc.execution === ScriptState.COUNTDIALOG) {
                    sc.lastInt = s.count;
                    (p as any).executeScript(sc, true, true);
                    answered = true;
                    break;
                }
                H.tick(1);
            }
            // and then click through whatever the script says next: Harold answers a stake with
            // "Right...er...here goes..." and waits on continue before he will roll, so a count
            // step that only types the number leaves the hand half-played.
            if (answered) drive(p, []);
            soft(whatCount, answered, answered ? '' : 'nothing was waiting for a number');
            continue;
        }
        if ('close' in s) {
            (p as unknown as { closeModal: (c?: boolean) => void }).closeModal(false);
            for (let w = 0; w < 6; w++) H.tick(1);
            console.log('      -- closed the interface' + (s.why ? '   (' + s.why + ')' : ''));
            continue;
        }
        // CLICK CONTINUE ON SOMETHING NOBODY CLICKED. `close` dismisses a modal, which ABORTS the
        // script behind it; `wait` only ticks, and a script paused on a continue is not waiting for
        // ticks. A queue that mesboxes before it does the work therefore never does the work - The
        // Fremennik Trials' [queue,viking_koschei_felled] says "He falls, and the dark folds over
        // him" and THEN summons the next form of Koschei, so a fight step followed by a wait found
        // an empty arena every time. This drives whatever is paused, the way a player would.
        if ('resume' in s) {
            const mesBefore = H.mesgs.length;
            const lines = drive(p, (s.picks ?? []).slice());
            const saidResume = (Array.isArray(lines) ? lines : []).concat(H.mesgs.slice(mesBefore).map(x => x.text)).join(' | ');
            const whatResume = 'click through what is waiting' + (s.why ? ' - ' + s.why : '');
            const saidIt = !s.want || saidResume.toLowerCase().includes(s.want.toLowerCase());
            soft(whatResume, saidIt, saidIt ? '' : 'nothing said "' + s.want + '"; got: ' + saidResume.slice(0, 160));
            continue;
        }
        // A RANDOMISED STEP CANNOT BE ASSERTED. Curpile Fyod asks three of six questions at
        // random, so a manifest that names the three answers is right one time in six - and a check
        // that fails five times in six is not a check, it is noise. This pins the engine's own RNG
        // to a fixed return for as long as the randomised step lasts, and `rng: null` puts the real
        // one back, because pinning it through a FIGHT would make every hit roll zero.
        if ('rng' in s) {
            const rng: any = JavaRandom;
            if (s.rng === null) {
                if (rng.__realNextDouble) rng.nextDouble = rng.__realNextDouble;
                console.log('      -- rng back to normal' + (s.why ? '   (' + s.why + ')' : ''));
            } else {
                if (!rng.__realNextDouble) rng.__realNextDouble = rng.nextDouble.bind(rng);
                const v = s.rng;
                rng.nextDouble = () => v;
                console.log('      -- rng pinned to ' + v + (s.why ? '   (' + s.why + ')' : ''));
            }
            continue;
        }
        if ('varis' in s) {
            const got = stageOf(p, s.varis);
            soft(s.varis + ' is ' + s.to, got === s.to, 'it is ' + got);
            continue;
        }
        if ('level' in s) {
            soft('standing on level ' + s.level, p.level === s.level, 'on level ' + p.level + ' at ' + p.x + ',' + p.z);
            continue;
        }
        if ('stage' in s) {
            const got = stageOf(p, m.stageVar);
            // `orLater` IS FOR A STAGE THE RUN CANNOT STAND STILL ON. A stage marker is a leg
            // boundary to ExportHelper as well as an assertion, so it has to stay in the manifest
            // even where the run blows straight past it: The Great Brain Robbery sets tgbr to 110
            // when Mi-Gor is confronted and 120 when Barrelchest goes down, and drive() keeps
            // clicking through that confrontation for up to 600 ticks while a damage-immune player
            // with maxed stats kills the thing it summoned - so by the time this step looked, 110
            // had been and gone: "tgbr is now 110 -- it is 120" (tracker issue 21).
            //
            // Only where the overshoot IS the content working. A plain stage still means exactly
            // this number, which is what catches a quest that skipped a step.
            const orLater = 'orLater' in s && s.orLater === true;
            const ok = orLater ? got >= s.stage : got === s.stage;
            soft(m.stageVar + ' is now ' + s.stage + (orLater ? ' or past it' : ''), ok, ok ? '' : 'it is ' + got);
            continue;
        }
        if ('has' in s) {
            const got = H.invCount(p, s.has);
            soft('carrying ' + (s.n ?? 1) + ' x ' + s.has, got >= (s.n ?? 1), 'has ' + got);
            continue;
        }
        if ('worn' in s) {
            // WEARING IT IS NOT THE SAME AS CLICKING WEAR, and the difference is invisible from
            // outside: [opheld2,_] matches every obj in the game, so a `held` step on something
            // with no wearpos reports ok, ~equip bails on the DEBUG line, and the player walks on
            // in their own face. The Feud's own disguise is exactly that - the cache has one
            // unwearable combined obj and one with three wearpos entries - and the playthrough
            // only found out eleven steps later, at a cactus.
            const inv = p.getInventory(InvType.WORN);
            let on = 0;
            if (inv) {
                for (let i = 0; i < inv.capacity; i++) {
                    const o = inv.get(i);
                    if (o && ObjType.get(o.id).debugname === s.worn) on++;
                }
            }
            soft('wearing ' + s.worn, on > 0, on > 0 ? 'on' : 'it is not on');
            continue;
        }
        if ('notworn' in s) {
            const inv = p.getInventory(InvType.WORN);
            let on = 0;
            if (inv) {
                for (let i = 0; i < inv.capacity; i++) {
                    const o = inv.get(i);
                    if (o && ObjType.get(o.id).debugname === s.notworn) on++;
                }
            }
            soft('not wearing ' + s.notworn, on === 0, on === 0 ? 'off' : 'it is still on');
            continue;
        }
        if ('herd' in s) {
            // ONE SHEEP, ONE INSTANCE. There are three spawns of every plaguesheep type, so
            // "nearest sheep of this type" changes under you the moment one of the others wanders
            // closer - the first run of this herded four different sheep a few tiles each and
            // reported that none of them would move. Lock on to the npc and follow it by identity.
            const what0 = 'herd ' + s.herd + (s.why ? ' - ' + s.why : '');
            const sheep = H.npcNear(s.herd, s.at[0], s.at[1], p.level);
            if (!sheep) {
                hard(what0, false, 'no ' + s.herd + ' anywhere near ' + s.at[0] + ',' + s.at[1]);
                continue;
            }
            const done = () => (stageOf(p, s.untilvar) & (1 << s.bit)) !== 0;
            const maxProds = s.tries ?? 400;
            let prods = 0;
            let stillness = 0;
            let stranded = 0;
            // `behind` counts the times the tile the prod has to come from could not be reached,
            // and unlike `stranded` nothing resets it - the plan branch clears `stranded` on every
            // pass, so sharing it let the loop alternate between a good plan and an unreachable
            // tile for ever without spending a prod. That hung a run for half an hour.
            let behind = 0;
            let rounds = 0;
            let why = '';
            // THE FLOOD IS CACHED ON WHERE THE PLAYER IS STANDING. It is about terrain - which
            // tiles the player can walk to at all - and a thousand rounds of re-flooding three
            // thousand tiles is minutes of nothing. Other bodies are left out of it deliberately:
            // they move, and they belong in `blocked` where they can be dropped.
            let reachFrom = '';
            let reachSet = new Set<number>();
            const reachNow = (): Set<number> => {
                const key = p.x + ',' + p.z;
                if (key !== reachFrom) {
                    reachFrom = key;
                    reachSet = reachable(p.level, p.x, p.z, 72, undefined, CollisionFlag.BLOCK_NPC_AND_PLAYERS);
                }
                return reachSet;
            };
            while (prods < maxProds && rounds < maxProds * 4 && !done()) {
                rounds++;
                if (!sheep.isValid()) {
                    why = 'the sheep vanished at ' + sheep.x + ',' + sheep.z + ' without the quest noticing';
                    break;
                }
                const inGate = sheep.x >= s.gate[0] && sheep.x <= s.gate[2] && sheep.z >= s.gate[1] && sheep.z <= s.gate[3];
                let dx = 0;
                let dz = 0;
                if (inGate) {
                    // in the gateway: one more prod from any side and it jumps in
                    for (const [ax, az] of D4) {
                        if (standable(p.level, sheep.x - ax, sheep.z - az)) {
                            dx = ax;
                            dz = az;
                            break;
                        }
                    }
                } else {
                    const plan = prodPlan(p.level, sheep.x, sheep.z, s.gate, occupied(p.level, sheep), reachNow());
                    if (!plan || !plan.length) {
                        // THE JUMP TAKES A FEW TICKS. The prod that lands a sheep in the gateway
                        // teleports it inside, waits two ticks and only then deletes it and sets
                        // the quest bit, so for that window the npc is standing in a walled pen
                        // with no route anywhere and nothing to say it has been herded. Give it a
                        // moment before calling that a dead end.
                        // AND WAITING IS NOW A REAL STRATEGY, not just a window for the gate's
                        // two-tick jump. With the reach constraint kept (see prodPlan) "no plan"
                        // means the animal is somewhere it cannot be pushed from at all - against
                        // a fence, or boxed in by another one - and it wanders out of that on its
                        // own. Six waits of five ticks was not enough to find out.
                        // Ninety of them, which is four hundred and fifty ticks. The field north
                        // of Ardougne has a pocket east of its fence that is cut off from both
                        // sides, and a sheep that wanders into it cannot be pushed anywhere at all
                        // until it wanders out again - "no way to prod it from 2624,3371 to the
                        // pen", which is true, and which thirty waits was not long enough to
                        // outlast. A wait costs a sim nothing; a false dead end costs the run.
                        stranded++;
                        if (stranded > 90) {
                            why = 'no way to prod it from ' + sheep.x + ',' + sheep.z + ' to the pen, after 450 ticks of waiting for it to move';
                            break;
                        }
                        H.tick(5);
                        continue;
                    }
                    stranded = 0;
                    dx = plan[0][0] - sheep.x;
                    dz = plan[0][1] - sheep.z;
                }
                // AND THE TILE BEHIND IT IS NOT ALWAYS REACHABLE WHILE IT IS STANDING THERE. A
                // sheep against a fence can leave its own back tile with no route to it, and the
                // sheep wanders - so this is a moment to wait out rather than a dead end, the same
                // way `stranded` above is. Giving up on the first one lost Sheep Herder about one
                // run in twenty on "NO WALKABLE ROUTE from 2623,3367 to 2624,3365".
                let err = travel(p, sheep.x - dx, sheep.z - dz, p.level, 32, 0, occupied(p.level, sheep));
                for (let b = 0; b < 6 && err; b++) {
                    H.tick(5);
                    if (!sheep.isValid()) break;
                    err = travel(p, sheep.x - dx, sheep.z - dz, p.level, 32, 0, occupied(p.level, sheep));
                }
                // AND IF IT STAYS UNREACHABLE, RE-PLAN RATHER THAN PROD FROM ANYWHERE. Pushing
                // from whichever side happens to be reachable sounds helpful and is not: a sheep
                // moves away from the player, so an arbitrary side moves it the wrong way, and
                // trying that spent four hundred prods shoving sheep two round its pen. Waiting
                // and re-planning works, because the sheep wanders out of the corner on its own.
                if (err) {
                    behind++;
                    // STAND WHEREVER PUSHES IT THE RIGHT WAY, not only directly behind it. The
                    // exact opposite tile is often unreachable because the sheep itself is in the
                    // way of it, and a sheep runs away from the player - so any neighbour on the
                    // same side as the planned push moves it where it should go. Scoring the four
                    // by how well they agree with the plan and taking the best reachable one is
                    // what finally made Sheep Herder repeat: prodding from ANY side (including the
                    // wrong ones) spent four hundred prods going nowhere, and waiting alone left
                    // it failing about half the time.
                    const sides = D4.map(([ax, az]) => ({ ax, az, score: ax * dx + az * dz })).filter(c => c.score > 0);
                    sides.sort((a, b) => b.score - a.score);
                    let moved = false;
                    const occ = occupied(p.level, sheep);
                    for (const c of sides) {
                        if (!standable(p.level, sheep.x + c.ax, sheep.z + c.az)) continue;
                        if (occ.has((sheep.x + c.ax) * 20000 + sheep.z + c.az)) continue; // a body in the way of the push
                        if (occ.has((sheep.x - c.ax) * 20000 + sheep.z - c.az)) continue; // or standing where we would
                        if (travel(p, sheep.x - c.ax, sheep.z - c.az, p.level, 32, 0, occ)) continue;
                        moved = true;
                        break;
                    }
                    // A TRUE LAST RESORT - any reachable side at all, wrong direction included -
                    // was tried and measured WORSE: a prod from the wrong side undoes progress
                    // faster than the re-plan recovers it. Four variants were measured on Sheep
                    // Herder's second sheep over nine runs: giving up at once failed every time,
                    // waiting alone and the agreeing-sides scoring here both land around half,
                    // and any-side was worse than both. So this is an improvement and not a cure.
                    //
                    // WHAT FINALLY CURED IT was none of the above: prodPlan and the walk now count
                    // the other sheep (see `occupied`). A sim npc barely wanders, so a sheep whose
                    // approach is blocked by another one stays blocked however long the step waits
                    // - the block being npc flags the terrain flood cannot see, which is why the
                    // tile reads walkable while the router refuses it. Planning around them is
                    // what made this repeat; everything above is kept as the safety net it is.
                    if (moved) {
                        err = '';
                    } else {
                        if (behind > 40) {
                            why = 'could not get behind it: ' + err;
                            break;
                        }
                        H.tick(5);
                        continue;
                    }
                }
                // AND CHECK WHERE IT IS STANDING NOW, not where it was when the plan was made.
                //
                // The animal wanders while the player walks to the tile behind it, and the script
                // works out which way to shove it from ~coord_direction(player, animal) at the
                // moment of the prod - so a sheep that has shuffled one tile is pushed in a
                // direction nobody planned, usually into the wall the plan was routing around. It
                // does not move, the prod is spent, and twenty-five of those in a row is how both
                // remaining failures looked: "it has not moved, at 2609,3339".
                //
                // Re-planning costs nothing and the loop has a round budget four times the prod
                // budget, so a shuffle is now a re-plan rather than a wasted shove.
                if (sheep.x - p.x !== dx || sheep.z - p.z !== dz) {
                    H.tick(1);
                    continue;
                }
                const before = sheep.x * 20000 + sheep.z;
                H.opNpc(p, sheep, 1);
                H.tick(6);
                prods++;
                stillness = sheep.x * 20000 + sheep.z === before ? stillness + 1 : 0;
                // A PROD THAT MOVES NOTHING IS USUALLY A RACE, not a dead end. The plan is made
                // against where the other animals are standing and the prod lands a tick or two
                // later; by then one of them can have stepped into the tile this one was going to
                // take, and `npc_walk` quietly refuses. Waiting and re-planning fixes it, and
                // giving up at eight lost about one run in eight on "eight prods in a row and it
                // has not moved".
                if (stillness > 8 && stillness <= 24) {
                    H.tick(5);
                    continue;
                }
                if (stillness > 24) {
                    why = 'twenty-five prods in a row and it has not moved, at ' + sheep.x + ',' + sheep.z;
                    break;
                }
            }
            if (done()) {
                hard(what0, true, prods + ' prods');
            } else {
                hard(what0, false, why || 'still loose after ' + prods + ' prods');
            }
            continue;
        }
        if ('hunt' in s) {
            // CLICK THESE UNTIL SOMETHING COMES OUT. A Soul's Bane's Fear room is six holes with
            // one reaper hiding in a different one every time, and a loc step cannot tell the
            // difference between "nothing in there" and a click the engine threw away - so the only
            // honest test is to keep looking until the thing is out.
            const want = NpcType.getId(s.untilnpc);
            const near = () => [...World.npcs].some(n => n && n.isActive && n.type === want && n.level === p.level && Math.max(Math.abs(n.x - p.x), Math.abs(n.z - p.z)) <= 40);
            const triesHunt = ('tries' in s ? s.tries : undefined) ?? 3;
            // With untilvar the step is the whole room, not one look: keep opening holes AND
            // killing whatever comes out until the counter says it is done. Splitting the two in
            // the manifest did not work - the reaper is aggressive, so the player kills it during
            // the looking, and the next step then finds nothing and calls it a failure.
            const huntVar = 'untilvar' in s ? s.untilvar : undefined;
            const huntTo = 'to' in s ? s.to : undefined;
            const done = () => (huntVar ? stageOf(p, huntVar) === huntTo : near());
            const kill = () => {
                let npc = null;
                try {
                    npc = findNpc(s.untilnpc, p, true);
                } catch {
                    npc = null;
                }
                if (!npc) return;
                H.maxOut(p);
                for (let k = 0; k < 300 && npc.isValid(); k++) {
                    if (!p.target && !(p as unknown as { delayed: boolean }).delayed) {
                        (p as unknown as { closeModal: (c?: boolean) => void }).closeModal(false);
                        H.attackNpc(p, npc);
                    }
                    H.tick(1);
                }
                H.tick(6);
            };
            let found = done();
            for (let a = 0; a < triesHunt && !found; a++) {
                for (const [name, x, z] of s.hunt) {
                    if (found) break;
                    const err = travel(p, x, z, p.level, 48, 2);
                    if (err) continue;
                    for (let w = 0; w < 10 && (p as unknown as { delayed: boolean }).delayed; w++) H.tick(1);
                    try {
                        if (!H.opLoc(p, x, z, name, 1)) continue;
                    } catch {
                        continue;
                    }
                    arrive(p, x, z);
                    drive(p, []);
                    H.tick(2);
                    if (huntVar) kill();
                    found = done();
                }
            }
            soft(
                'look in ' + s.hunt.length + ' places for ' + s.untilnpc + (huntVar ? ' until ' + huntVar + ' is ' + huntTo : '') + (s.why ? ' - ' + s.why : ''),
                found,
                found ? 'done' : huntVar ? huntVar + ' got to ' + stageOf(p, huntVar) : 'nothing came out of any of them'
            );
            continue;
        }
        if ('say' in s) {
            // ANSWER A DIALOGUE NOBODY CLICKED. Delrith's incantation is four options put to the
            // player by a queue that the KILL started, not by talking to anyone, so there is no
            // click to hang the picks on.
            const mark = H.mesgs.length;
            let said: string[] = [];
            let blew = '';
            try {
                said = drive(p, s.say.slice());
            } catch (e) {
                blew = String(e).replace('Error: ', '');
            }
            const joinedSay = said.concat(H.mesgs.slice(mark).map(x => x.text)).join(' ');
            if (blew) soft('answer ' + JSON.stringify(s.say) + (s.why ? ' - ' + s.why : ''), false, blew);
            else if (s.want && !joinedSay.includes(s.want)) soft('answer ' + JSON.stringify(s.say) + (s.why ? ' - ' + s.why : ''), false, 'nothing said "' + s.want + '"');
            else soft('answer ' + JSON.stringify(s.say) + (s.why ? ' - ' + s.why : ''), true);
            continue;
        }
        if ('press' in s) {
            // A BUTTON ON AN INTERFACE, which drive() cannot reach: it only knows the multi1..5
            // option lists, and a make-x panel (skillmulti1..5) is a different interface with its
            // own buttons. Spinning wool opens one of those, so there is no way to spin without it.
            //
            // Two kinds of button end up here. A dialogue's resume button is answered by choose(),
            // which the engine is waiting for; a plain [if_button,...] on an open interface is not
            // waited for at all and has to be sent. Tribal Totem's combination lock is the second
            // kind, and `n` is for it: the four dials only step one letter at a time, so the
            // combination is sixty-six presses and nobody wants sixty-six lines of report.
            const times = ('n' in s ? s.n : undefined) ?? 1;
            const whatPress = 'press ' + s.press + (times > 1 ? ' x' + times : '') + (s.why ? ' - ' + s.why : '');
            let pressed = 0;
            let errPress = '';
            for (let i = 0; i < times; i++) {
                try {
                    // THREE KINDS OF BUTTON, not two. A dialogue's resume button is answered by
                    // choose(); a plain [if_button,...] on an open interface has to be sent; and a
                    // panel SLOT that looks like a button is an inv and its trigger is INV_BUTTON1,
                    // which ifButton cannot reach - the silvthrill rod on the Silver Casting window
                    // is one of those.
                    // choose() ONLY WHEN SOMETHING IS WAITING FOR AN ANSWER. It used to be tried
                    // first on every press, and it reports success for a component that is merely
                    // IN the player's resume list - so an emote button pressed while a finished
                    // conversation was still on screen counted as "pressed" and the emote never
                    // ran. Throne of Miscellania is three emotes, and all three were silently
                    // doing nothing.
                    const paused = (p as unknown as { activeScript: { execution: number } | null }).activeScript?.execution === ScriptState.PAUSEBUTTON;
                    if (!paused || !H.choose(p, s.press)) {
                        try {
                            H.ifButton(p, s.press);
                        } catch {
                            // A PANEL SLOT, not a component. The crafting jewellery window's
                            // rows are one inv each and the trigger is INV_BUTTON1 on the row with
                            // last_slot set - so "the ruby ring" is rings_inv slot 3, and without
                            // the slot every row makes a sapphire one.
                            H.invButton(p, s.press, 1, ('slot' in s ? s.slot : undefined) ?? 0);
                        }
                    }
                    pressed++;
                } catch (e) {
                    errPress = String(e).replace('Error: ', '');
                    break;
                }
                for (let t = 0; t < 20 && p.activeScript; t++) H.tick(1);
            }
            soft(whatPress, pressed === times, errPress || (pressed === times ? '' : pressed + ' of ' + times + ' went through'));
            continue;
        }
        if ('sneak' in s) {
            // WALKING PAST SOMETHING THAT MUST NOT SEE YOU. The witch patrols the middle of her
            // garden and teleports anybody who comes within three tiles with a clear line - which
            // is what the wiki means by "move around the edge, using the hedges as cover". A plain
            // `go` walks the route at full speed and gets caught halfway round, so this one steps a
            // tile at a time and waits whenever the next tile would be inside her range.
            const whatSneak = 'sneak past ' + s.past + ' to ' + s.sneak[0] + ',' + s.sneak[1] + (s.why ? ' - ' + s.why : '');
            const keepOut = ('r' in s ? s.r : undefined) ?? 4;
            if (!route(p.level, p.x, p.z, s.sneak[0], s.sneak[1], 96, ('tol' in s ? s.tol : undefined) ?? 0).length) {
                hard(whatSneak, false, 'NO WALKABLE ROUTE from ' + p.x + ',' + p.z + ' to ' + s.sneak[0] + ',' + s.sneak[1]);
                continue;
            }
            let waited = 0;
            let blocked = '';
            // AND BEING CAUGHT IS A THING THAT HAPPENS. Nora T. Hagg hunts three tiles with line
            // of sight and teleports whoever she sees out of the garden entirely - so a sneak that
            // walks its path once and reports where it stopped was reporting the catch, not a
            // blockage, and Witch's House lost its last two stages to it every run. Being thrown
            // out is recoverable the way it is for a player: go back to the start of the leg and
            // walk it again, further out of her way. Three goes, re-routing from wherever the
            // throw-out left the player.
            // HER OWN TEST, INVERTED, because waiting is not safety.
            //
            // [ai_timer,nora_t_hagg] is huntall(npc_coord, 3, 0), then lineofsight (the same
            // GameMap.isLineOfSight this calls - the LINEOFSIGHT opcode is that function), and then
            // a hedge check: a player NORTH of her is caught unless the tile SOUTH of them is a
            // hedge or hedgecorner, and a player SOUTH of her unless the tile NORTH of them is a
            // hedge. On her exact row neither branch matches and she never catches at all. That is
            // what the wiki means by "move around the edge, using the hedges as cover".
            //
            // The old version held for sixty ticks whenever she was inside the manifest's margin
            // and then stepped anyway. Both halves of that were wrong. Stepping into her reach
            // gets you caught - and so does STANDING in it, which is what actually happened here
            // every run: the player waited on 2922,3466 with her three tiles away on 2925,3463 and
            // a clear line, she said "Stop! Thief!" on the eleventh tick, and the catch deleted the
            // shed key and the ball, put %ballquest back to ^ball_started and threw the player to
            // 2929,3456 outside the hedge, where no route back in exists. Three retries could not
            // win, because the key was gone (tracker issue 21).
            //
            // So: never stand still inside her reach - step out of it - and re-plan the route after
            // every move, because a retreat makes the old one stale.
            const CATCH = 3;
            const hedgeAt = (x: number, z: number) => H.locAt(p.level, x, z, 'hedge') || H.locAt(p.level, x, z, 'hedgecorner');
            const sneakTo = (tx: number, tz: number): boolean => {
                // THE ROUTE AVOIDS HER REACH; IT DOES NOT WALK INTO IT AND HOPE.
                //
                // By the time she can catch the tile the player is standing on, the catch has
                // already begun: her script runs p_stopaction and then p_delay on the player, so
                // the player cannot move, and stepping aside is not an option that exists. The
                // trace is unambiguous - "retreat to 2919,3460 score=104 delayed=true" three times
                // over, the player pinned on 2920,3460 while she finished the spell. Avoiding her
                // reach is therefore the only play, and it has to be re-planned every step because
                // she patrols.
                //
                // route() already takes a set of tiles to keep out of. The margin is her radius
                // plus two, because she covers a tile a tick and the player covers one or two.
                const K = (a: number, b: number) => a * 20000 + b;
                let budget = 900;
                while (budget-- > 0) {
                    if (p.x === tx && p.z === tz) {
                        blocked = '';
                        return true;
                    }
                    const npc = H.npcNear(s.past, p.x, p.z, p.level);
                    const avoid = new Set<number>();
                    if (npc) {
                        // WHERE SHE COULD CATCH FROM NEXT TICK, not only from where she stands.
                        // She covers a tile a tick and so does the player, and this loop looks once
                        // a tick - so a tile judged safe against her CURRENT tile can be a catch by
                        // the time the step lands. That is exactly what happened: the player walked
                        // to 2924,3466 with her four off, she stepped to 2926,3463, and the tile was
                        // hers. Dilating her position by one tile is the margin that fits the
                        // clock, and cover is re-tested for each of those positions because a hedge
                        // only protects the side she is actually on.
                        // `r` IS WHAT THAT DILATION IS. The manifest's margin is her radius plus
                        // the ticks of slack to allow for, so r: 4 against her 3 means "assume she
                        // may be one tile closer than she looks". Clamped, because a margin wide
                        // enough to cover her whole garden leaves nowhere to stand.
                        const slack = Math.max(1, Math.min(3, keepOut - CATCH));
                        for (let wx = -slack; wx <= slack; wx++) {
                            for (let wz = -slack; wz <= slack; wz++) {
                                const hx = npc.x + wx;
                                const hz = npc.z + wz;
                                for (let dx = -CATCH; dx <= CATCH; dx++) {
                                    for (let dz = -CATCH; dz <= CATCH; dz++) {
                                        const x = hx + dx;
                                        const z = hz + dz;
                                        if (avoid.has(K(x, z))) continue;
                                        if (!isLineOfSight(p.level, hx, hz, x, z)) continue;
                                        const ddz = z - hz;
                                        if (ddz === 0) continue;
                                        if (ddz > 0 && hedgeAt(x, z - 1)) continue;
                                        if (ddz < 0 && hedgeAt(x, z + 1)) continue;
                                        avoid.add(K(x, z));
                                    }
                                }
                            }
                        }
                    }
                    // A route THROUGH the avoid set is route()'s own fallback when keeping out of
                    // it leaves nowhere to go - fine for a crowded doorway, fatal here. So if what
                    // comes back still crosses her reach, stand still and let her walk on.
                    const legs = route(p.level, p.x, p.z, tx, tz, 96, 0, avoid);
                    if (!legs.length) {
                        blocked = 'no route from ' + p.x + ',' + p.z + ' to ' + tx + ',' + tz;
                        return false;
                    }
                    // STANDING IN THE MARGIN IS NOT WAITING, IT IS LOSING SLOWLY. Her radius is
                    // three and the margin is five, so a player inside the margin has a tick or two
                    // in hand - and spending them standing still is how the last version was
                    // caught: it walked out to nine tiles clear, then held while she strolled back
                    // into range. Inside the margin, move out of it; the tile does not have to be
                    // on the route.
                    if (avoid.has(K(p.x, p.z)) && npc) {
                        let best: [number, number] | null = null;
                        let bestScore = -1;
                        for (const [dx, dz] of [
                            [1, 0],
                            [-1, 0],
                            [0, 1],
                            [0, -1]
                        ]) {
                            const nx = p.x + dx;
                            const nz = p.z + dz;
                            if (!canTravel(p.level, p.x, p.z, dx, dz, 1, 0, CollisionType.NORMAL)) continue;
                            const score = (avoid.has(K(nx, nz)) ? 0 : 100) + Math.max(Math.abs(npc.x - nx), Math.abs(npc.z - nz));
                            if (score > bestScore) {
                                bestScore = score;
                                best = [nx, nz];
                            }
                        }
                        if (best) {
                            if (process.env.QUESTRUN_DEBUG) console.log(`        in the margin at ${p.x},${p.z}, witch ${npc.x},${npc.z} - out to ${best[0]},${best[1]}`);
                            H.walkTo(p, best[0], best[1]);
                            H.tick(1);
                            waited++;
                            continue;
                        }
                    }
                    // the route itself crosses her reach: hold, out of the margin, until she moves
                    if (legs.slice(0, 4).some(([lx, lz]) => avoid.has(K(lx, lz)))) {
                        H.tick(1);
                        waited++;
                        continue;
                    }
                    const [sx, sz] = legs[0];
                    if (process.env.QUESTRUN_DEBUG && npc) console.log(`        at ${p.x},${p.z} -> ${sx},${sz} witch ${npc.x},${npc.z} d=${Math.max(Math.abs(npc.x - p.x), Math.abs(npc.z - p.z))} avoiding ${avoid.size} tiles, ${legs.length} to go`);
                    const wasX = p.x;
                    const wasZ = p.z;
                    for (let t = 0; t < 12 && (p.x !== sx || p.z !== sz); t++) {
                        H.walkTo(p, sx, sz);
                        H.tick(1);
                        // A TELEPORT, NOT A STEP. A running player covers at most two tiles a tick,
                        // so anything further is somebody else moving them - being caught, here.
                        if (Math.max(Math.abs(p.x - wasX), Math.abs(p.z - wasZ)) > 2) {
                            blocked = 'moved from ' + wasX + ',' + wasZ + ' to ' + p.x + ',' + p.z + ' in one tick - thrown out of the leg, not walked';
                            return false;
                        }
                    }
                    if (p.x !== sx || p.z !== sz) {
                        blocked = 'stopped at ' + p.x + ',' + p.z + ' on the way to ' + sx + ',' + sz;
                        return false;
                    }
                }
                blocked = 'gave up ' + Math.max(Math.abs(p.x - tx), Math.abs(p.z - tz)) + ' tiles short at ' + p.x + ',' + p.z;
                return false;
            };
            for (let a = 0; a < 3; a++) {
                if (sneakTo(s.sneak[0], s.sneak[1])) break;
                H.tick(10);
                waited += 10;
            }
            const offSneak = Math.max(Math.abs(p.x - s.sneak[0]), Math.abs(p.z - s.sneak[1]));
            hard(whatSneak, offSneak <= (('tol' in s ? s.tol : undefined) ?? 0), blocked || (offSneak > 0 ? 'ended up at ' + p.x + ',' + p.z : waited + ' ticks held back'));
            continue;
        }
        if ('nearnpc' in s) {
            // DID THE CUTSCENE ACTUALLY PRODUCE THE NPC? Ernest the Chicken's whole ending is a
            // chicken turning into a man in front of you, and it did not happen for years: the
            // changetype looked for the multinpc's child where the map spawns the parent, so the
            // quest completed, the rewards arrived, and the chicken simply stopped being drawn.
            // Nothing a stage or an inventory check can see.
            const want = NpcType.getId(s.nearnpc);
            const r = s.r ?? 8;
            let found = '';
            // A changetype or a spawn lands on a tick of its own, so give it a few rather than
            // asking in the same breath as the varp beside it.
            for (let t = 0; t < 12 && !found; t++) {
                for (const npc of World.npcs) {
                    if (!npc || !npc.isActive || npc.type !== want) continue;
                    if (npc.level !== p.level) continue;
                    if (Math.max(Math.abs(npc.x - p.x), Math.abs(npc.z - p.z)) > r) continue;
                    found = npc.x + ',' + npc.z;
                    break;
                }
                if (!found) H.tick(1);
            }
            soft(
                s.nearnpc + ' is here' + (s.why ? ' - ' + s.why : ''),
                found !== '',
                found
                    ? 'at ' + found
                    : 'nothing of that type within ' +
                          r +
                          ' tiles of ' +
                          p.x +
                          ',' +
                          p.z +
                          ' L' +
                          p.level +
                          '; what is there: ' +
                          [...World.npcs]
                              .filter(n => n && n.isActive && n.level === p.level && Math.max(Math.abs(n.x - p.x), Math.abs(n.z - p.z)) <= r)
                              .map(n => NpcType.get(n!.type).debugname + '@' + n!.x + ',' + n!.z)
                              .join(' ')
                              .slice(0, 160)
            );
            continue;
        }
        if ('hasnt' in s) {
            const got = H.invCount(p, s.hasnt);
            soft(s.hasnt + ' is gone', got === 0, 'still has ' + got);
            continue;
        }
        if ('fight' in s) {
            // KILL IT UNTIL IT DROPS THE THING, when the thing is what the step is for. Melzar the
            // Mad and the zombies in his basement are the maze's keys, and both were reported dead
            // with no key on the floor: isValid() flickers false for a respawn as well as a death,
            // so a kill that never happened read as one. With `until` the step is judged on the
            // drop, which is what the wiki means by "kill zombies until one drops it".
            const want = 'until' in s ? s.until : undefined;
            // `untilvar` is the other way a fight ends: not a drop but a counter. A Soul's Bane's
            // Anger room is "keep hitting them with the right weapon until the rage bar fills",
            // and the bar is a varbit.
            const wantVar = 'untilvar' in s ? s.untilvar : undefined;
            const wantTo = 'to' in s ? s.to : undefined;
            const label2 = (x: string) => (x.length > W ? x.slice(0, W - 1) + '~' : x.padEnd(W));
            // A LIST OF TYPES, for a thing that comes back as something else. A Soul's Bane's
            // hopeless creatures have three forms and killing one spawns the next, so "kill the
            // big ones, then the middle ones, then the small ones" is not a sequence - it is
            // whichever of the three happens to be standing in front of you.
            const types = Array.isArray(s.fight) ? s.fight : [s.fight];
            const what2 = 'kill ' + types.join('/') + (want ? ' until it drops ' + want : '') + (wantVar ? ' until ' + wantVar + ' is ' + wantTo : '') + (s.why ? ' - ' + s.why : '');
            const got = () => (wantVar ? stageOf(p, wantVar) === wantTo : want ? !!groundObj(p, want, 14) || H.invCount(p, want) > 0 : false);
            let t = 0;
            let died = false;
            let rounds = 0;
            let missing = '';
            const maxRounds = ('tries' in s ? s.tries : undefined) ?? (want || wantVar ? 8 : 1);
            // A STATIC NPC IS NOT ACTIVE UNTIL SOMETHING IS NEAR IT, so a fight that starts in the
            // same breath as a jump finds whatever happens to be awake instead - the unicorn leg of
            // Rag and Bone Man picked one 140 tiles away, in a field the player had walked past two
            // legs earlier. Two ticks to let the zone wake up, and only look as far as `r`.
            H.tick(2);
            // AND IT MAY ALREADY BE DONE - BUT ONLY A `untilvar` CAN SAY SO. A summoned boss has a
            // lifetime - Legends' Quest's second Nezikchened is npc_add-ed for 500 ticks - so a
            // walk that has to allow for the summon not landing wants to send the summon again and
            // fight again, and the second attempt must not fail for finding nothing when the first
            // one already finished the job. A stage is the right thing to read that off.
            //
            // AN `until` OBJ IS NOT, and reading it here broke Lunar Diplomacy. That walk kills
            // four Suqah for four hides, one fight-and-take pair each, and a hide from the first
            // kill is still in the pack when the second pair starts - so "already done" passed a
            // fight that killed nothing and the take under it found nothing on the floor. The
            // whole quest stopped at ^lunar_staff_done over it.
            if (wantVar && got()) {
                out.push({ n: ++n, what: what2, ok: true, detail: 'already done' });
                console.log('  ' + String(n).padStart(2) + '. ' + label2(what2) + ' ok  already done');
                continue;
            }
            const rFight = ('r' in s ? s.r : undefined) ?? 32;
            const picksFight: (string | number)[] | undefined = 'picks' in s ? (s.picks as (string | number)[]) : undefined;
            // SOME SPAWNS ARE PENNED IN. Four of the goblins south of Falador stand inside a
            // fenced pocket nothing can walk into, so "the nearest goblin" can be one no player
            // will ever hit. One that lands no hit goes on this list and the step moves to the
            // next one along rather than failing the whole leg.
            const unreachable = new Set<number>();
            const nearestOf = (names: string[]) => {
                let best: Npc | null = null;
                let bestD = Infinity;
                const ids = names.map(nm => NpcType.getId(nm));
                for (const npc of World.npcs) {
                    if (!npc || !npc.isActive || npc.level !== p.level || !ids.includes(npc.type)) continue;
                    if (unreachable.has(npc.nid)) continue;
                    const d = Math.max(Math.abs(npc.x - p.x), Math.abs(npc.z - p.z));
                    if (d <= rFight && d < bestD) {
                        bestD = d;
                        best = npc;
                    }
                }
                return best;
            };
            while (rounds < maxRounds) {
                rounds++;
                // AND WAIT FOR THE RESPAWN. Two unicorns in that field and a one-in-four bone
                // means the third round usually arrives before either of them is back, and
                // grabbing "the nearest one anywhere" instead sent the player off to the Lumbridge
                // swamp to punch at something 140 tiles away for 150 ticks.
                let npc: Npc | null = nearestOf(types);
                for (let w = 0; w < 10 && !npc; w++) {
                    H.tick(20);
                    npc = nearestOf(types);
                }
                if (!npc) {
                    for (const name of types) {
                        try {
                            npc = findNpc(name, p, true);
                        } catch {
                            npc = null;
                        }
                        if (npc) break;
                    }
                }
                if (!npc) {
                    // AND SAY WHAT IS THERE INSTEAD, the way the nearnpc step does. "none of X is
                    // spawned anywhere near" is the same sentence whether the thing was never
                    // spawned, has already been killed, or is standing two tiles away on another
                    // level - and Dream Mentor's arena spent four runs on the third of those.
                    const seen: string[] = [];
                    for (const other of World.npcs) {
                        if (!other || !other.isActive) continue;
                        if (Math.max(Math.abs(other.x - p.x), Math.abs(other.z - p.z)) > 30) continue;
                        seen.push((NpcType.get(other.type).debugname ?? 'npc_' + other.type) + '@' + other.x + ',' + other.z + 'L' + other.level);
                        if (seen.length >= 8) break;
                    }
                    missing = 'none of ' + types.join('/') + ' is spawned anywhere near ' + p.x + ',' + p.z + ' L' + p.level + (seen.length ? '; what is there: ' + seen.join(' ') : '; nothing at all is within 30 tiles');
                    break;
                }
                H.maxOut(p);
                // A FIGHT CAN END WITHOUT A CORPSE. Delrith is beaten down to nothing and then
                // CHANGES TYPE - npc_changetype(delrith_weakened) - so he stays a valid npc and the
                // loop would have run its 900 ticks on a demon that had already been beaten.
                const type0 = npc.type;
                // UNLESS THE NEW TYPE IS ALSO ONE THIS STEP NAMED. The rule above is for Delrith,
                // who changes into something the step did not ask for; the Gelatinnoth Mother
                // changes into another of HER OWN six forms every thirty ticks
                // (npc_changetype_keepall, hundred_culinaromancer.rs2), and all six are named in
                // quest_hundred_run's one fight step because they are one npc. Reading that as a
                // death ended every round after at most thirty ticks and reported a kill: "killed
                // 60 in 884 ticks and hundred_minionskilled_tally is 4" is sixty rounds of her
                // turning over, not sixty corpses. Let her turn, and the round runs its 900 ticks.
                const sameFight = new Set(types.map(nm => NpcType.getId(nm)));
                // CAN THE PLAYER EVEN GET TO IT? A fight that lands no hit in 150 ticks is not a
                // long fight, it is a wall: the first Rag and Bone Man run picked a goblin in a
                // sealed part of the Goblin Cave and spent 27,000 ticks - thirty rounds of 900 -
                // clicking at something it could never reach, and reported only that no bone had
                // dropped. Bail out and name the tile instead.
                const hp0 = npc.levels[3];
                let d = false;
                // WAS THE PLAYER EVER TOE-TO-TOE? The unreachable test below is for a fight that
                // never starts - Rag and Bone Man's penned goblins - but Underground Pass's three
                // paladins wander, have op2=Attack and no huntmode, and take the better part of a
                // hundred ticks to take their first hit. A fight that has had the player beside it
                // is not a wall, however long it takes.
                let everAdjacent = false;
                for (let k = 0; k < 900 && !d; k++, t++) {
                    if (!npc.isValid() || (npc.type !== type0 && !sameFight.has(npc.type))) {
                        d = true;
                        break;
                    }
                    const adjacent = Math.max(Math.abs(npc.x - p.x), Math.abs(npc.z - p.z)) <= 1;
                    if (adjacent) everAdjacent = true;
                    if (k > 150 && npc.levels[3] >= hp0 && !adjacent && !everAdjacent) {
                        unreachable.add(npc.nid);
                        missing = 'no hit landed on ' + types.join('/') + ' at ' + npc.x + ',' + npc.z + ' in 150 ticks from ' + p.x + ',' + p.z + ' - it cannot be reached';
                        break;
                    }
                    // SOME FIGHTS ARE MEANT TO BE INTERRUPTED. Sir Mordred is beaten down, not
                    // killed: at low hitpoints his mother stops the fight, heals him to full and
                    // starts talking - and the re-click below closed her dialogue and went back to
                    // hitting him, so he healed over and over and the quest never moved. With
                    // `picks` the step answers the conversation instead of swinging through it.
                    if (picksFight && p.activeScript) {
                        try {
                            drive(p, [...picksFight]);
                        } catch {
                            // whatever she said, it was not the menu we had picks for
                        }
                        break;
                    }
                    // AND RE-CLICK WHEN IT IS WALKING AWAY. A passive npc never comes to you, and
                    // one click's worth of waypoints goes stale the moment it wanders - Underground
                    // Pass's three paladins have op2=Attack and no huntmode, and the player chased
                    // Sir Jerro east across the room two tiles behind him for 150 ticks without
                    // ever closing. Re-issuing the click re-queues the route from where he is now.
                    const chasing = k > 0 && k % 15 === 0 && npc.levels[3] >= hp0 && Math.max(Math.abs(npc.x - p.x), Math.abs(npc.z - p.z)) > 1;
                    // and WALK, rather than trusting the click to route: re-issuing the op queues
                    // waypoints that setInteraction then replaces, so a player who is not already
                    // beside a passive npc never takes a step. travel() is the same BFS the `go`
                    // step uses, and it stops one tile short on purpose.
                    if (chasing) travel(p, npc.x, npc.z, p.level, 32, 1);
                    // RE-CLICK WHEN THE PLAYER IS IDLE. One attack click at the start is not a
                    // fight: a door or gate op leaves the player delayed and the engine throws the
                    // click away without a word, which is how Elvarg survived 900 ticks of nothing
                    // happening with a rune scimitar in hand.
                    if ((chasing || !p.target) && !(p as unknown as { delayed: boolean }).delayed) {
                        if (!picksFight) {
                            (p as unknown as { closeModal: (c?: boolean) => void }).closeModal(false);
                        }
                        // SOME THINGS ARE SHOT, NOT ATTACKED. attackNpc sends APNPC2, which is what every
                        // ordinary Attack op is - but the Chompy Bird's Attack is op5 ([apnpc5,chompy_bird]),
                        // and an op2 on it does nothing at all. `op` sends that op instead, through the same
                        // routed click a client would make.
                        if ('op' in s && s.op) {
                            H.opNpc(p, npc, s.op);
                        } else {
                            H.attackNpc(p, npc);
                        }
                    }
                    H.tick(1);
                }
                H.tick(15);
                died = died || d;
                if (missing) {
                    // one penned npc is not the end of the leg; try the next one along, and only
                    // report this if there is nothing else to try
                    if (rounds < maxRounds && nearestOf(types)) {
                        missing = '';
                        continue;
                    }
                    break;
                }
                if (!(want || wantVar) || got()) break;
                // AND THE NEXT ONE MAY BE BEHIND A MESBOX. Shilo Village's Nazastarool has three
                // forms, and each one's death opens a mesbox whose script summons the next: left
                // open, nothing comes, and the next round waited 200 ticks for a form that was
                // never sent (tracker issue 18). Only between rounds, so a fight that has finished
                // still leaves its last dialogue for the step after it - Fight Arena's `say` steps
                // are written for exactly that.
                if (p.activeScript && p.activeScript.execution === ScriptState.PAUSEBUTTON) {
                    try {
                        drive(p, picksFight ? [...picksFight] : []);
                    } catch {
                        // a menu this step has no picks for; the next round's re-click closes it
                    }
                }
            }
            const ok = want || wantVar ? got() : died;
            const detail = ok
                ? t + ' ticks' + (rounds > 1 ? ', ' + rounds + ' of them' : '')
                : missing ||
                  (wantVar ? 'killed ' + rounds + ' in ' + t + ' ticks and ' + wantVar + ' is ' + stageOf(p, wantVar) : want ? 'killed ' + rounds + ' in ' + t + ' ticks and no ' + want + ' on the floor' : t + ' ticks and it is still alive');
            // AND `soft` COUNTS HERE TOO. A fight that is only insurance - "kill whatever is left
            // after shoving the thing again" - has nothing to do when the first attempt finished
            // the job, and finding nothing to hit is the expected outcome rather than a failure.
            const softFight = 'soft' in s && s.soft === true;
            out.push({ n: ++n, what: what2, ok: ok || softFight, detail });
            console.log('  ' + String(n).padStart(2) + '. ' + label2(what2) + (ok ? '  ok  ' + detail : softFight ? '  --  ' + detail : ' FAIL  ' + detail));
            if (!ok && !softFight) stopped = what2;
            continue;
        }

        // --- the clicks, each one sent from wherever the player is standing
        const mesMark = H.mesgs.length;
        // EVERY LINE SINCE THE CLICK, not only the ones drive() happened to see. drive() starts
        // counting when it is called, and arrive() returns the moment a script pauses - which for a
        // one-shot mesbox is the same tick its text was set, so the line is already behind drive's
        // mark by the time it looks. The Restless Ghost's "There's a skeleton without a skull in
        // here." came back as "nothing said" on a step that had worked perfectly.
        const ifaceMark = H.ifaces.length;
        const saidSince = (): string[] =>
            H.ifaces
                .slice(ifaceMark)
                .filter(i => i.who === p.username && i.kind === 'text' && i.text && i.text.length > 1)
                .map(i => i.text as string);
        let lines: string[] = [];
        let unreached = '';
        const run = (picks: (number | string)[]) => {
            try {
                return drive(p, picks);
            } catch (e) {
                const msg = String(e);
                if (msg.includes('unexpected menu')) {
                    unreached = 'an unexpected menu: ' + msg.split('unexpected menu: ')[1];
                    return [];
                }
                if (msg.includes('menus not reached')) {
                    unreached = msg.split('menus not reached: ')[1] ?? '?';
                    return [];
                }
                throw e;
            }
        };
        let what = '';
        if ('talk' in s) {
            what = 'talk to ' + s.talk + (s.why ? ' - ' + s.why : '');
            let npc: ReturnType<typeof findNpc> | null = null;
            try {
                npc = findNpc(s.talk, p, true);
            } catch {
                npc = null;
            }
            if (!npc) {
                hard(what, false, 'no ' + s.talk + ' anywhere near ' + p.x + ',' + p.z);
                continue;
            }
            // ONE ATTEMPT IS NOT ALWAYS A FAIR TEST, and the three ways a talk can come to
            // nothing look alike from outside: the npc wandered out of reach (Kruk patrols a yard
            // no tile of which can be stood next to), the dialogue took a branch that never offered
            // the option, or it ran and refused to do the thing (the monkey child while his aunt is
            // listening). tries retries the whole click and re-finds the npc each time, because
            // it has moved.
            const tries = s.tries ?? 1;
            let reached = false;
            let far = 0;
            for (let a = 0; a < tries; a++) {
                if (a > 0) {
                    H.tick(20);
                    try {
                        npc = findNpc(s.talk, p, true);
                    } catch {
                        continue;
                    }
                }
                unreached = '';
                // A dialogue that ended early leaves a suspended script on the player, and the
                // engine throws the next click away while it is there. Retrying without
                // clearing it burned forty attempts on Robin without dealing a single hand.
                if (p.activeScript) {
                    p.activeScript = null;
                    // and the DELAY it was sitting in. Dropping the script without this leaves
                    // the player delayed for ever, every later click is thrown away before it
                    // reaches the content, and the trace shows forty attempts and no dialogue.
                    (p as unknown as { delayed: boolean; delayedUntil: number }).delayed = false;
                    (p as unknown as { delayed: boolean; delayedUntil: number }).delayedUntil = -1;
                    H.tick(2);
                }
                // AND THE INTERFACE. A chat window left open makes the player busy(), and the
                // engine drops a queued op on a busy player without a word - which is what ate
                // forty hands of Rune-Draw: the click was accepted and then quietly binned.
                (p as unknown as { closeModal: (c?: boolean) => void }).closeModal(false);
                H.tick(1);
                far = Math.max(Math.abs(npc.x - p.x), Math.abs(npc.z - p.z));
                // One arrow with the condition inside it, rather than a ternary choosing between
                // two arrows where the no-op one needed a `void _w;` body to keep eslint quiet:
                // prettier and eslint's indent rule could not agree on how to lay that out.
                const dbg = (w: string) => {
                    if (process.env.QUESTRUN_DEBUG) console.log('        attempt ' + a + ': ' + w);
                };
                if (!H.opNpc(p, npc, s.op ?? 1)) {
                    dbg('click thrown away; delayed=' + (p as unknown as { delayed: boolean }).delayed);
                    H.tick(5);
                    continue;
                }
                if (!arrive(p, npc.x, npc.z, npc.width, npc.length)) {
                    dbg('never arrived; player ' + p.x + ',' + p.z + ' L' + p.level + ' npc ' + npc.x + ',' + npc.z + ' L' + npc.level);
                    continue;
                }
                reached = true;
                // A COPY OF THE PICKS, EVERY ATTEMPT. drive() shifts the options off the array it
                // is handed, so passing s.picks itself emptied it on the first try and every
                // retry then met the same menu with nothing to answer it - "an unexpected menu:
                // multi2: Draw. | Not now.", forty times, which is exactly what ate Rune-Draw.
                lines = run([...(('picks' in s ? s.picks : undefined) ?? [])]);
                dbg('said ' + JSON.stringify(lines.slice(0, 2)) + ' unreached=' + JSON.stringify(unreached));
                // With until, the item arriving is the signal and a leftover pick is not a
                // fault: Robin deals one hand per click, so most clicks consume one menu and
                // the run simply clicks again.
                const stalled = s.until ? H.invCount(p, s.until) === 0 : unreached !== '';
                if (!stalled) {
                    if (a > 0) what = what + ' [took ' + (a + 1) + ' attempts]';
                    break;
                }
            }
            // until not satisfied after every attempt is a failure, not a pass. Reporting ok
            // here once hid a Rune-Draw loop that never produced the bow.
            if (reached && 'until' in s && s.until && H.invCount(p, s.until) === 0) {
                hard(what, false, 'after ' + tries + ' attempts there is still no ' + s.until + '; the last one said: ' + lines.slice(0, 4).join(' | ').slice(0, 120));
                continue;
            }
            if (!reached) {
                // THE LEVEL, because without it this message cannot tell the two reasons apart.
                // "3 tiles off at 3503,9837; player stuck at 3505,9832" reads as a pathing
                // problem inside one room; the same words describe an npc three tiles away on
                // another plane, which no amount of walking will ever reach. far is a 2D
                // distance, so it is the smaller number of the two and the more innocent-looking.
                const planes = npc.level === p.level ? '' : ' - ON PLANE ' + npc.level + ' while the player is on ' + p.level + ', which no route can cross';
                hard(what, false, far + ' tiles off at ' + npc.x + ',' + npc.z + ' L' + npc.level + '; player stuck at ' + p.x + ',' + p.z + ' L' + p.level + planes);
                continue;
            }
        } else if ('loc' in s) {
            what = s.loc + ' at ' + s.at[0] + ',' + s.at[1] + (s.why ? ' - ' + s.why : '');
            // where the step was sent FROM, so a retry can stand there again rather than wherever
            // the last route left the player - Sir Vyvin's cupboard is refused from one tile and
            // allowed from the next one over.
            const fromX = p.x;
            const fromZ = p.z;
            let sent = false;
            let locw = 1;
            let locl = 1;
            // `first` BEFORE THE FIRST ATTEMPT, not only on a retry: Shilo Village's carved doors
            // do not exist at all until a palm tree two tiles away has been searched, so looking
            // them up first threw "no hillsideclosedl there" and the retry loop was never reached.
            if ('first' in s && s.first) {
                runFirsts(s.first, ('firstAt' in s ? s.firstAt : undefined) ?? s.at, ('firstOp' in s ? s.firstOp : undefined) ?? 1);
            }
            try {
                const lt = LocType.get(LocType.getId(s.loc));
                locw = lt.width;
                locl = lt.length;
                standOnIfWalkable(p, s.loc, s.at[0], s.at[1]);
                sent = H.opLoc(p, s.at[0], s.at[1], s.loc, s.op ?? 1);
            } catch (e) {
                // The real reason, not a guess at it. This used to say "no <loc> there" whatever
                // went wrong, which is only one of the things that can: since harness.opLoc started
                // refusing an op the cache does not declare - the check OpLocHandler makes and this
                // directory's click did not - the useful message is that one, and it was being
                // thrown away and replaced with a wrong one.
                const why = String((e as { message?: unknown })?.message ?? e);
                hard(what, false, why.includes('has no op') ? why : 'no ' + s.loc + ' there on level ' + p.level + ' (player at ' + p.x + ',' + p.z + ')');
                continue;
            }
            if (!sent) {
                hard(what, false, 'the player was delayed and the click was thrown away');
                continue;
            }
            // `hop` IS FOR AN OP THAT MOVES YOU A FEW TILES. arrive() passes as soon as the
            // player has been next to the loc at any point, which covers everything you walk up
            // to - but Mountain Daughter's lake crossings are approach ops on locs standing in
            // the water, clicked from two or three tiles off and answered with a teleport to the
            // far side. The player is never next to the clump of rocks and never can be, so the
            // positional test asks a question with no right answer. With `hop` the step is judged
            // on what the op said and on the exact walk that follows it, which is the stronger
            // test anyway: the tile it lands you on cannot be reached on foot from this side.
            if (!arrive(p, s.at[0], s.at[1], locw, locl) && !('hop' in s && s.hop)) {
                hard(what, false, 'player stuck at ' + p.x + ',' + p.z);
                continue;
            }
            // `brief` IS FOR A CLICK THAT SPAWNS SOMETHING AGGRESSIVE. drive() stops after three
            // idle ticks, and a player with a combat target is never idle - so a click that puts an
            // aggressive npc on top of a damage-immune sim player runs drive's whole 600-tick guard
            // out, because neither side can finish the fight. Elemental Workshop I's elemental rock
            // spawns its earth elemental with a 500-tick lifetime: by the time the step returned,
            // the thing it had woken had already expired, three times running, and the step before
            // reported ok each time. With `brief` the op gets that many ticks and no dialogue.
            if ('brief' in s && s.brief) {
                for (let t = 0; t < s.brief; t++) H.tick(1);
                lines = [];
            } else {
                lines = run(('picks' in s ? s.picks : undefined) ?? []);
            }
            // SOME OPS ARE REFUSED FOR A REASON THAT PASSES. Sir Vyvin shouts at anybody who opens
            // his cupboard while he is standing next to them, and he wanders, so the search is a
            // coin toss rather than a bug - the wiki says to wait for him to walk out. `tries` is
            // for exactly that: send it again, a few ticks later, until the thing it is for happens.
            // `until` is an obj and `want` is a line of text; either will stop the retries, and the
            // obj is the better test - drive() misses a one-shot mesbox often enough that a step
            // which had worked kept trying.
            const untilLoc = 'until' in s ? s.until : undefined;
            const wantLoc = 'want' in s ? s.want : undefined;
            const triesLoc = ('tries' in s ? s.tries : undefined) ?? 1;
            const doneLoc = () =>
                untilLoc
                    ? H.invCount(p, untilLoc) > 0
                    : !wantLoc ||
                      lines
                          .concat(
                              saidSince(),
                              H.mesgs.slice(mesMark).map(x => x.text)
                          )
                          .join(' ')
                          .includes(wantLoc);
            for (let a = 1; a < triesLoc && (untilLoc || wantLoc) && !doneLoc(); a++) {
                // LEAVE AND COME BACK, which is what the wiki tells you to do about Sir Vyvin and
                // what the player has to do about any npc standing in the way: an npc parks itself
                // while somebody is next to it, so waiting on the spot waits for ever. Walking off
                // and returning lets it wander again.
                (p as unknown as { closeModal: (c?: boolean) => void }).closeModal(false);
                for (let w = 0; w < 10 && (p as unknown as { delayed: boolean }).delayed; w++) H.tick(1);
                for (const [dx, dz] of [
                    [0, 8],
                    [0, -8],
                    [8, 0],
                    [-8, 0]
                ]) {
                    if (!travel(p, fromX + dx, fromZ + dz, p.level, 24, 0)) break;
                }
                H.tick(25);
                travel(p, fromX, fromZ, p.level, 24, 0);
                // `first` is the op this one needs before it: a cupboard shuts itself after a
                // while, so a retry that only clicks the open one throws from then on and every
                // later try is a no-op.
                const firstLoc = 'first' in s ? s.first : undefined;
                if (firstLoc) {
                    runFirsts(firstLoc, ('firstAt' in s ? s.firstAt : undefined) ?? s.at, ('firstOp' in s ? s.firstOp : undefined) ?? 1);
                }
                let sent2 = false;
                try {
                    sent2 = H.opLoc(p, s.at[0], s.at[1], s.loc, s.op ?? 1);
                } catch {
                    sent2 = false;
                }
                if (process.env.QUESTRUN_DEBUG) console.log('        retry ' + a + ': sent=' + sent2 + ' at ' + p.x + ',' + p.z);
                if (!sent2) continue;
                if (!arrive(p, s.at[0], s.at[1], locw, locl)) continue;
                lines = lines.concat(run(('picks' in s ? s.picks : undefined) ?? []));
            }
        } else if ('held' in s) {
            what = s.held + ' op' + (s.op ?? 1) + (s.why ? ' - ' + s.why : '');
            // SOME ITEM OPS ROLL FOR IT. Rubbing Sea Slug's dry sticks together is a firemaking
            // roll, so it fails some of the time at any level, and `until` names the obj that says
            // it worked - the same shape as the loc step's retries, and for the same reason.
            const triesHeld = ('tries' in s ? s.tries : undefined) ?? 1;
            const untilHeld = 'until' in s ? s.until : undefined;
            let heldok = false;
            let heldErr = '';
            for (let a = 0; a < triesHeld; a++) {
                if (a > 0) H.tick(4);
                try {
                    heldok = H.opheld(p, s.held, s.op ?? 1);
                } catch (e) {
                    heldErr = String(e).replace('Error: ', '');
                    break;
                }
                if (!heldok) break;
                quiet(p);
                lines = lines.concat(run(('picks' in s ? s.picks : undefined) ?? []));
                if (!untilHeld || H.invCount(p, untilHeld) > 0) break;
            }
            if (heldErr) {
                hard(what, false, heldErr);
                continue;
            }
            if (!heldok) {
                hard(what, false, 'not carrying it, or that op does not exist');
                continue;
            }
            if (untilHeld && H.invCount(p, untilHeld) === 0) {
                hard(what, false, 'after ' + triesHeld + ' tries there is still no ' + untilHeld);
                continue;
            }
        } else if ('use' in s) {
            what = 'use ' + s.use[0] + ' on ' + s.use[1] + (s.why ? ' - ' + s.why : '');
            let useok = false;
            try {
                useok = H.useHeldOn(p, s.use[0], s.use[1]);
            } catch (e) {
                hard(what, false, String(e).replace('Error: ', ''));
                continue;
            }
            if (!useok) {
                hard(what, false, 'one of the two is not in the inventory');
                continue;
            }
            quiet(p);
            lines = run(('picks' in s ? s.picks : undefined) ?? []);
        } else if ('useLoc' in s) {
            what = 'use ' + s.obj + ' on ' + s.useLoc + (s.why ? ' - ' + s.why : '');
            let lw = 1;
            let ll = 1;
            // `first` here for the same reason as on the loc step: Shilo Village's carved doors do
            // not exist until the palm trees over them have been searched, and they hide themselves
            // again fifty ticks later - so the bone key has to be used in the same window the
            // search opens. As few ticks as possible between the two.
            if ('first' in s && s.first) {
                runFirsts(s.first, ('firstAt' in s ? s.firstAt : undefined) ?? s.at, ('firstOp' in s ? s.firstOp : undefined) ?? 1);
            }
            // `near` IS FOR A LOC THAT IS PUT WHERE SOMETHING ELSE HAPPENS TO BE STANDING.
            // Legends' Quest's spring is loc_added onto the boulder NPC's own tile the moment it
            // is shoved clear, and the boulder drifts a tile or two from its spawn over the course
            // of a run - so the pool is not reliably where the manifest says. `near` searches that
            // many tiles around the coord for the named loc and uses whichever tile it is actually
            // on. Everything else still wants the exact coord, because being wrong about which
            // door you clicked is a real failure.
            let atX = s.at[0];
            let atZ = s.at[1];
            const nearUL = ('near' in s ? s.near : undefined) ?? 0;
            if (nearUL > 0) {
                const wantId = LocType.getId(s.useLoc);
                let best = Infinity;
                for (let dx = -nearUL; dx <= nearUL; dx++)
                    for (let dz = -nearUL; dz <= nearUL; dz++) {
                        if (!World.getLoc(s.at[0] + dx, s.at[1] + dz, p.level, wantId)) continue;
                        const d = Math.abs(dx) + Math.abs(dz);
                        if (d < best) {
                            best = d;
                            atX = s.at[0] + dx;
                            atZ = s.at[1] + dz;
                        }
                    }
            }
            // `tries` IS FOR A CLICK THAT CAN BE SWALLOWED WITHOUT SAYING SO. `held` and `useNpc`
            // have had it for a while; useLoc had not, and the Lumbridge range is the case that
            // wanted it. Roasting Recipe for Disaster's stuffed snake there does nothing at all
            // on the first click in a long run - no message, no Cooking xp, the raw snake still in
            // the pack - while the same obj on the same range cooks every time in isolation, and
            // the cake and the fishcake cook on that range earlier in the same run. audit1.ts
            // roasts the same snake and worked around the same thing with a loop of its own,
            // noting only that "a leftover delay or an open box eats the click, silently"; waiting
            // the delay out and closing the modal here was not enough on its own. Clicking again
            // is what a player does when nothing happens, so the step can now do it too.
            //
            // It only ever retries a step that asked for it AND gave a `want`, because the `want`
            // is the only evidence that the click landed - retrying on arrival alone would just
            // click a working thing several times. Every existing useLoc step is untouched.
            const triesUL = Math.max(1, ('tries' in s ? s.tries : undefined) ?? 1);
            let saidUse = '';
            let landedUL = false;
            let stuckUL = false;
            for (let a = 0; a < triesUL && !landedUL; a++) {
                if (a > 0) {
                    // the same clearing audit1 does before each go: a leftover delay or an open
                    // box is the thing most likely to have eaten the last one
                    for (let w = 0; w < 12 && (p as unknown as { delayed: boolean }).delayed; w++) H.tick(1);
                    (p as unknown as { closeModal: (c?: boolean) => void }).closeModal(false);
                    p.clearPendingAction();
                    H.tick(1);
                }
                try {
                    const lt = LocType.get(LocType.getId(s.useLoc));
                    lw = lt.width;
                    ll = lt.length;
                    // THE PICKS GO IN HERE, not into a second drive afterwards. useOn drives as the
                    // player walks, so a panel that opens on arrival - a make-x panel, for one - was
                    // met with an empty pick list and the step blew up on its own menu.
                    standOnIfWalkable(p, s.useLoc, atX, atZ);
                    lines = useOn(p, atX, atZ, s.useLoc, s.obj, ('picks' in s ? s.picks : undefined) ?? []);
                } catch (e) {
                    hard(what, false, String(e).replace('Error: ', ''));
                    stuckUL = true;
                    break;
                }
                // `hop` as on the loc step: useOn drives as it goes, so an op that teleports the
                // player has already done it by the time this runs and adjacency can never come back.
                if (!arrive(p, atX, atZ, lw, ll) && !('hop' in s && s.hop)) {
                    hard(what, false, 'player stuck at ' + p.x + ',' + p.z);
                    stuckUL = true;
                    break;
                }
                lines = lines.concat(run([]));
                // `want` WAS NEVER CHECKED HERE. Every useLoc step in every manifest reported ok on
                // arrival alone, which is the silent false pass this runner's own comments are about:
                // Rat Catchers' King rat passed its want three runs in a row while the handler was not
                // running at all. The loc step has always done this; useLoc never did.
                if (!('want' in s) || !s.want) {
                    landedUL = true;
                    break;
                }
                saidUse = lines
                    .concat(
                        saidSince(),
                        H.mesgs.slice(mesMark).map(x => x.text)
                    )
                    .join(' | ');
                if (saidUse.includes(s.want)) landedUL = true;
            }
            if (stuckUL) {
                continue;
            }
            if (!landedUL) {
                soft(what, false, 'nothing said "' + s.want + '" in ' + triesUL + (triesUL === 1 ? ' try' : ' tries') + (saidUse ? '; got: ' + saidUse.slice(0, 160) : ''));
                continue;
            }
        } else if ('useNpc' in s) {
            what = 'use ' + s.obj + ' on ' + s.useNpc + (s.why ? ' - ' + s.why : '');
            let npc = null;
            try {
                npc = findNpc(s.useNpc, p, true);
            } catch {
                npc = null;
            }
            if (!npc) {
                hard(what, false, 'no ' + s.useNpc + ' anywhere near ' + p.x + ',' + p.z);
                continue;
            }
            // USE-ON-NPC IS ITS OWN PACKET, not op 5. Sending op 5 reached the npc, reported a
            // delivered click and never fired [opnpcu,...] at all - three beers handed to Drunken
            // Ali with nothing to show for it. a1lib.useOnNpc sets lastUseItem and the APNPCU
            // interaction, which is what the real client does.
            // SOME USE-ONS MISS. Shearing a sheep fails one time in four by design, so the step is
            // judged on the obj it is for rather than on one click of it.
            const untilUse = 'until' in s ? s.until : undefined;
            const triesUse = ('tries' in s ? s.tries : undefined) ?? 1;
            let threw = '';
            for (let a = 0; a < triesUse; a++) {
                if (a > 0) H.tick(4);
                try {
                    lines = lines.concat(useOnNpc(p, s.useNpc, s.obj, s.picks ?? []));
                } catch (e) {
                    threw = String(e).replace('Error: ', '');
                    break;
                }
                if (!untilUse || H.invCount(p, untilUse) > 0) break;
            }
            if (threw) {
                hard(what, false, threw);
                continue;
            }
            const joinedUse = lines
                .concat(
                    saidSince(),
                    H.mesgs.slice(mesMark).map(x => x.text)
                )
                .join(' ');
            if (untilUse && H.invCount(p, untilUse) === 0) {
                soft(what, false, 'after ' + triesUse + ' tries there is still no ' + untilUse);
            } else if (s.want && !joinedUse.includes(s.want)) {
                soft(what, false, 'nothing said "' + s.want + '"');
            } else {
                hard(what, true);
            }
            continue;
        }

        const joined = lines
            .concat(
                saidSince(),
                H.mesgs.slice(mesMark).map(x => x.text)
            )
            .join(' ');
        // A STEP THAT ASKED FOR NOTHING CANNOT HAVE FAILED TO GET IT. Some clicks open a
        // conversation through a QUEUE - swinging the bullroarer in Legends' Quest runs
        // [queue,bullroarer_use] a tick later, which walks Gujuo over and opens his menu - so the
        // menu turns up inside the SWING's drive window and the answers belong to the step after
        // it. Charging the swing with "the dialogue never offered the option(s)" is a harness
        // artifact: it declared no picks, so it claimed nothing. A step that did declare picks and
        // then met a menu it had no answer for is still a real failure.
        const claimedPicks = 'picks' in s && ((s.picks as unknown[] | undefined)?.length ?? 0) > 0;
        if (unreached && claimedPicks && !('until' in s && s.until)) {
            soft(what, false, 'the dialogue never offered the option(s) ' + unreached + '; it said: ' + joined.slice(0, 110));
            continue;
        }
        if (s.want && !joined.includes(s.want)) {
            soft(what, false, 'nothing said "' + s.want + '"; got: ' + lines.slice(0, 2).join(' | ').slice(0, 80));
        } else {
            hard(what, true);
        }
    }

    const stage = stageOf(p, m.stageVar);
    console.log('');
    if (stopped) console.log('  STOPPED at step ' + n + ': ' + stopped);
    // `>=`, not `===`: a run can finish PAST the quest's completion. Fight Arena goes on to kill
    // the general, Temple of Ikov takes the ending worth 90 where the quest is over at 80, and the
    // Observatory run claims the wine afterwards. All three are complete.
    console.log('  ' + m.stageVar + ' finished at ' + stage + (stage >= m.done ? ' - COMPLETE' : ' of ' + m.done));
    if (gives.length) console.log('  items the run had to be handed: ' + gives.join(', '));
    const bad = out.filter(r => !r.ok).length;
    console.log('  ' + (out.length - bad) + ' of ' + out.length + ' checks passed');
    return out;
}
