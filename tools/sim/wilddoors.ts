// THE DARK WARRIORS' FORTRESS DOORS OPEN NOW.
// Usage: npx tsx tools/sim/wilddoors.ts   (exit code is the verdict)
//
// wilderness.loc declared the pair and wired neither half: wild_door (op1=Open, 29 placed across
// both floors of the fortress at 3023-3033, 3626-3702) and wild_door_open (op1=Close, 0 placed,
// because an open door only ever arrives by loc_change). Doors are answered by category -
// [oploc1,_door_closed] ~open_door(500) in doors/scripts/doors.rs2 - and neither carried one, so
// every door in the fortress said "Nothing interesting happens."
//
// The precedent for a bespoke pair like this is goblin_outpost_poordoor /
// goblin_outpost_openpoordoor in quest_100/configs/100.loc: category=door_closed plus
// param=next_loc_stage pointing at the other half, both ways round.
//
// FOUND BY tools/sim/placeddead.ts, which filters opsweep's dead-loc lines down to the ones on
// locs that are actually PLACED on the map. DeathPlateau-Bugs#27.
import * as H from './harness.js';
import { check, R, player } from './a1lib.js';
import LocType from '#/cache/config/LocType.js';

await H.boot();

const CLOSED = 'wild_door';
const OPENED = 'wild_door_open';

console.log('== the pair is declared the way a door pair has to be');
for (const [name, op] of [
    [CLOSED, 'Open'],
    [OPENED, 'Close']
] as [string, string][]) {
    const id = LocType.getId(name);
    check(`${name} is in the cache`, id !== -1, true);
    if (id === -1) continue;
    check('  it is called Door', LocType.get(id).name, 'Door');
    check(`  and offers ${op}`, LocType.get(id).op?.[0], op);
}

console.log('\n== and a door in the fortress opens, then shuts again');
const spots = H.locsNear(CLOSED, 3023, 3627, 0);
check(`${CLOSED} is placed near 3023,3627`, spots.length > 0, true);

let drove = 0;
// Several are tried rather than one: a door stands in a wall, so which side a player can stand on
// differs per door, and a wall this sim cannot reach is not a door that is broken.
for (const s of spots.slice(0, 6)) {
    let p: any;
    let stood = false;
    for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1]
    ]) {
        try {
            p = player(`wdr${(drove * 4 + Math.abs(dx) + Math.abs(dz) * 2).toString(36)}`, s.x + dx, s.z + dz, s.level);
        } catch {
            continue;
        }
        H.clearLogs();
        H.opLoc(p, s.x, s.z, CLOSED, 1);
        H.tick(4);
        if (!H.locAt(s.level, s.x, s.z, CLOSED)) {
            stood = true;
            break;
        }
    }
    if (!stood) continue;
    drove++;
    // An open door moves off its own tile - ~open_door swings it round the corner it is hinged on -
    // so the closed one being GONE is what says the click was answered rather than falling through
    // to "Nothing interesting happens."
    check(`  the door at ${s.x},${s.z} level ${s.level} opens`, H.locAt(s.level, s.x, s.z, CLOSED), false);

    // AND THE OTHER HALF OF THE FIX. wild_door_open got category=door_opened in the same change,
    // and wiring only the closed half would leave a door that opens and then cannot be shut. The
    // swung door is on one of the eight tiles around the hinge, so it is hunted rather than
    // assumed.
    let shut = false;
    for (let dx = -1; dx <= 1 && !shut; dx++) {
        for (let dz = -1; dz <= 1 && !shut; dz++) {
            if (!H.locAt(s.level, s.x + dx, s.z + dz, OPENED)) continue;
            H.clearLogs();
            H.opLoc(p, s.x + dx, s.z + dz, OPENED, 1);
            H.tick(4);
            shut = !H.locAt(s.level, s.x + dx, s.z + dz, OPENED);
        }
    }
    check('    and Close shuts it again', shut, true);
    break;
}
check('at least one fortress door could be driven', drove > 0, true);

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
