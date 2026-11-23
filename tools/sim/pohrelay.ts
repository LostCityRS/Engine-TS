// TAKING ONE THING OUT OF A HOUSE SHOULD NOT RE-PLACE THE HOUSE.
//
// Reported as "when removing a item in poh there is a loding delay" (DeathPlateau-Bugs#64).
// ~poh_furn_relay re-lays the ONE zone the piece was in, and then called ~poh_furn_restore, which
// lays every saved piece in the WHOLE house back down - each one a loc_add, and each loc_add a
// client update for a loc that is already exactly where it was. Nine rooms, nine updates; a
// furnished house, two hundred.
//
// THE MEASUREMENT IS loc_adds, not wall time. A sim's clock on a shared runner says nothing
// repeatable, and what the player waits for is the burst of loc updates the server sends, which is
// countable exactly: World.addLoc is the one chokepoint for all of them.
//
// AND EACH MEASUREMENT LANDS ON FRESH GROUND, which the first version of this file did not do. A
// loc_add for a loc that is already there never reaches World.addLoc, so every measurement after
// the first read as 0 and this file reported that a relay places nothing at all. Each restore now
// gets its own base coord, 64 tiles clear of the last.
//
// AND THE PIECES SIT ON DIFFERENT TILES, which the first version also did not do - every one was at
// local 2,2 of its own room. A mutation run that INVERTED the room filter then still measured 1,
// because the eight pieces from the other rooms all landed on the one tile and seven of them never
// reached World.addLoc. The count was collapsing, not passing.
//
// AND SECTION 5 DRIVES ~poh_furn_relay ITSELF. Everything above it calls the two restore procs
// directly, which is the right way to compare them - and leaves the one line this fix actually
// changes untested: a mutation run put ~poh_furn_restore back into the relay and all fourteen checks
// stayed green.
//
//   npx tsx tools/sim/pohrelay.ts
import * as H from './harness.ts';
import { check, R, player } from './a1lib.ts';
import World from '#/engine/World.js';
import { CoordGrid } from '#/engine/CoordGrid.js';

await H.boot();

let adds: { x: number; z: number }[] = [];
const target = World as unknown as { addLoc: (loc: unknown, duration: unknown) => unknown };
const origAddLoc = target.addLoc.bind(World);
target.addLoc = function (loc: unknown, duration: unknown) {
    const l = loc as { x: number; z: number };
    adds.push({ x: l.x, z: l.z });
    return origAddLoc(loc, duration);
};

const p: any = player('pohrelay', 2950, 3200, 0);
H.setVar(p, 'tutorial', 1000);
H.maxOut(p);
H.tick(2);

/** A base coord nobody has built on yet. The pieces land within 32 tiles of it. */
let plot = 0;
const freshBase = () => (plot += 64);

/** Run a restore onto clean ground and say how many locs the server placed. */
function count(proc: string, args: number[]): { x: number; z: number }[] {
    adds = [];
    H.runProc(p, proc, args, undefined, true);
    return adds;
}

// ---------------------------------------------------------------- the house
//
// Nine rooms in a 3x3 block with one piece in each. Small on purpose: the saving grows with how
// furnished the house is, so nine pieces is the least favourable case this can be shown in.
const ROOMS: [number, number][] = [];
for (let rx = 0; rx < 3; rx++) for (let rz = 0; rz < 3; rz++) ROOMS.push([rx, rz]);
const STOVE = 1; // poh_stove1_8, case 1 of ~poh_furn_show
// ~poh_furn_pack is the content's own packer, so the layout of a slot's value is never duplicated here.
const pack = (rx: number, rz: number, lx: number, lz: number, item: number) => H.runProc(p, '[proc,poh_furn_pack]', [rx, rz, lx, lz, 0, item])[0];

console.log('\n0. A HOUSE OF NINE ROOMS WITH A PIECE IN EACH');
for (let i = 0; i < ROOMS.length; i++) {
    const [rx, rz] = ROOMS[i];
    H.runProc(p, '[proc,poh_room_set]', [rx, rz, 1, 0], undefined, true);
    // A DIFFERENT TILE EACH, so a count can never collapse two pieces into one loc_add.
    H.runProc(p, '[proc,poh_furn_set]', [i, pack(rx, rz, i % 4, 1 + ((i / 4) | 0), STOVE)], undefined, true);
}
check('  nine rooms exist as far as the content is concerned', ROOMS.filter(([rx, rz]) => H.runProc(p, '[proc,poh_room_type]', [rx, rz])[0] !== 0).length, 9);
check('  and nine slots hold a stove', [...Array(9).keys()].filter(i => H.runProc(p, '[proc,poh_furn_item]', [H.runProc(p, '[proc,poh_furn_get]', [i])[0]])[0] === STOVE).length, 9);

// ---------------------------------------------------------------- 1. a build, which is not the bug
//
// ~poh_furn_restore is correct and is NOT changed: after a build every zone has just been replaced,
// so every piece does have to go back down. It is measured here only as what the relay is compared
// against.
console.log('\n1. A BUILD LAYS THE WHOLE HOUSE BACK, WHICH IS RIGHT');
const whole = count('[proc,poh_furn_restore]', [freshBase()]).length;
check(`  one loc per piece (${whole})`, whole, 9);

// ---------------------------------------------------------------- 2. a relay, which was the bug
console.log('\n2. AND A RELAY LAYS BACK ONE ROOM');
for (const [rx, rz] of [
    [1, 1],
    [2, 0],
    [0, 2]
] as const) {
    const n = count('[proc,poh_furn_restore_room]', [freshBase(), rx, rz]).length;
    check(`  room ${rx},${rz} places its own one, not nine`, n, 1);
}
check('  so a relay is a ninth of a build here', 1 < whole, true);

// AND IT IS THE RIGHT ROOM'S PIECE. "Fewer locs" is also what a restore that places nothing looks
// like, and a relay that quietly dropped the room's own furniture would pass a count and lose a
// player's chairs. Two rooms, two different tiles, measured from the same offset.
const plots: number[] = [];
const plotOf = (r: { x: number; z: number }[]) => plots[r === a ? 0 : 1];
const baseA = freshBase();
plots.push(baseA);
const a = count('[proc,poh_furn_restore_room]', [baseA, 0, 0]);
const baseB = freshBase();
plots.push(baseB);
const b = count('[proc,poh_furn_restore_room]', [baseB, 2, 2]);
check('  and two rooms land on different tiles of their plots', a.length === 1 && b.length === 1 && (a[0].x !== b[0].x || a[0].z - plotOf(a) !== b[0].z - plotOf(b)), true);

// ---------------------------------------------------------------- 3. the filter is the room
console.log('\n3. AND THE FILTER IS THE ROOM, NOT A LIMIT OF ONE');
H.runProc(p, '[proc,poh_furn_set]', [8, 0], undefined, true); // the piece in room 2,2
check('  the emptied room places nothing', count('[proc,poh_furn_restore_room]', [freshBase(), 2, 2]).length, 0);
check('  its neighbour still places its own', count('[proc,poh_furn_restore_room]', [freshBase(), 1, 1]).length, 1);
check('  and a build now lays back eight', count('[proc,poh_furn_restore]', [freshBase()]).length, 8);

// ---------------------------------------------------------------- 4. and it scales with the room
//
// So the saving is not an artefact of one-piece rooms.
console.log('\n4. A ROOM WITH FOUR PIECES LAYS BACK FOUR');
for (let k = 0; k < 3; k++) H.runProc(p, '[proc,poh_furn_set]', [20 + k, pack(1, 1, 4 + k, 5, STOVE)], undefined, true);
check('  the room lays back four', count('[proc,poh_furn_restore_room]', [freshBase(), 1, 1]).length, 4);
const now = count('[proc,poh_furn_restore]', [freshBase()]).length;
check(`  while the whole house lays back eleven (${now})`, now, 11);
check('  so taking a chair out of that room is 4 updates and not 11', 4 < now, true);

// ---------------------------------------------------------------- 5. and the relay uses it
//
// THE ONE LINE THE FIX CHANGES. Everything above compares the two restore procs, which says they
// differ - and says nothing about which one ~poh_furn_relay calls. A mutation run put
// ~poh_furn_restore back in and every check above stayed green.
//
// %poh_instance is set to an ordinary coord rather than a real instance: ~poh_place_zone's
// instance_setzone then does nothing useful, which is fine - what is being counted is the restore
// that follows it, and a relay outside an instance is not a thing a player can do anyway.
console.log('\n5. AND ~poh_furn_relay IS THE ONE THAT USES IT');
{
    const housePieces = count('[proc,poh_furn_restore]', [freshBase()]).length;
    const plot = freshBase();
    H.setVar(p, 'poh_instance', CoordGrid.packCoord(0, 0, plot));
    const viaRelay = count('[proc,poh_furn_relay]', [1, 1]).length;
    check(`  a relay of room 1,1 places its four, not the house's ${housePieces}`, viaRelay, 4);
    check('    and the house really does hold more than that', housePieces > 4, true);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
