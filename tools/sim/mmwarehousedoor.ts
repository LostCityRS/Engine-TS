/**
 * THE DOORWAY INTO THE MONKEYS' WAREHOUSE, which answered nothing when clicked.
 *
 * Reported as "doorway on ape atoll doesnt open so you can get monkey ammy mould"
 * (DeathPlateau-Bugs#44), from 2764,2763 - one tile south of the doorway at 2764,2764.
 *
 * mm_bamboo_door_secure carried op1=Open and no [oploc1] trigger, so the click answered "Nothing
 * interesting happens." - and the player read that as the thing standing between them and the
 * M'amulet mould.
 *
 * IT WAS NOT, AND THAT IS CHECKED HERE RATHER THAN ASSUMED. Section 2 proves the warehouse was
 * never sealed: both quest crates can be reached from the reported tile with the doorway untouched.
 * The crates gate on %mm_main < ^mm_met_garkor and answer with flavour text until Garkor has been
 * met, which is the far likelier thing to have stopped them. So the fix is to a doorway that did
 * nothing when clicked, not to an unobtainable item, and section 2 exists so nobody later "fixes"
 * access that was never broken.
 *
 * mm_bamboo_door_secure_inactive is what it opens into: same model, same recolours, active=no, and
 * placed nowhere on the map - an open state built and never wired up.
 *
 *   npx tsx tools/sim/mmwarehousedoor.ts
 */
import * as H from './harness.ts';
import * as A from './a1lib.ts';
import { check, R, player } from './a1lib.ts';
import LocType from '#/cache/config/LocType.js';
import World from '#/engine/World.js';

await H.boot();

const DOOR: [number, number] = [2764, 2764];
const OUTSIDE: [number, number] = [2764, 2763]; // where the report came from

/** The loc type currently standing on a tile, or null. */
function locOn(x: number, z: number, level = 0): string | null {
    for (const loc of World.gameMap.getZone(x, z, level).getAllLocsUnsafe()) {
        if (loc && loc.x === x && loc.z === z) return LocType.get(loc.type)?.debugname ?? String(loc.type);
    }
    return null;
}

// ---- 1. THE WAREHOUSE WAS NEVER SEALED, which the report's own explanation gets wrong --------
// FIRST, AND ON A PRISTINE MAP. These two checks are about the world as the map ships it, so they
// have to run before anything in this file opens the door - the first version ran them after and
// read its own loc_change back, failing on state it had created itself.
//
// The report says the doorway was what kept the mould out of reach. It was not: both quest crates
// can be reached from the reported tile with the doorway shut, and the doorway's own tile is
// standable. The crates gate on %mm_main < ^mm_met_garkor and answer with flavour text until
// Garkor has been met, which is the far likelier thing to have stopped them. A later change that
// made this doorway load-bearing, or that "restored" access nobody lacked, fails here.
console.log('\n1. the quest crates were reachable from outside all along');
{
    check('  the doorway is shut, as the map ships it', locOn(DOOR[0], DOOR[1]), 'mm_bamboo_door_secure');
    check('  the denture crate is reachable from the reported tile', A.reachLoc(0, OUTSIDE[0], OUTSIDE[1], 'mm_denture_crate', 2767, 2769), true);
    check('  and so is the crate over the hole', A.reachLoc(0, OUTSIDE[0], OUTSIDE[1], 'mm_crate_over_hole', 2769, 2765), true);
    check('  the doorway tile itself is standable', A.walkable(0, DOOR[0], DOOR[1]), true);
}

// ---- 2. the open state is an unused variant, not map scenery --------------------------------
// Also before the click, for the same reason. If mm_bamboo_door_secure_inactive were real scenery
// somewhere, changing a doorway into it would be putting a map decoration where a door was. It is
// placed nowhere, which is what makes it the door's open state rather than a prop.
console.log('\n2. the open state is an unused variant, not map scenery');
{
    check('mm_bamboo_door_secure_inactive exists', LocType.getId('mm_bamboo_door_secure_inactive') >= 0, true);
    const t = LocType.get(LocType.getId('mm_bamboo_door_secure_inactive'));
    check('  it is inactive, so it cannot be clicked', (t as any).active, 0);
    check('  and it is placed nowhere on the atoll', A.locsNamed('mm_bamboo_door_secure_inactive', 2700, 2700, 2850, 2850, [0, 1, 2]).length, 0);
}

// ---- 3. and clicking Open now does something -------------------------------------------
// LAST, because it changes the loc. Everything above is about the map as it ships.
console.log('\n3. the doorway answers a click');
{
    const p: any = player('whdoor1', OUTSIDE[0], OUTSIDE[1], 0);
    H.setVar(p, 'tutorial', 1000);
    H.tick(2);
    H.clearLogs();
    A.op(p, DOOR[0], DOOR[1], 'mm_bamboo_door_secure', 1);
    H.tick(4);
    const said = H.mesgs
        .filter(m => m.who === p.username)
        .map(m => m.text)
        .join(' | ');
    // THE EXACT SYMPTOM. "No trigger for [oploc1,...]" is what the harness prints for an op nothing
    // answers, and "Nothing interesting happens." is what the player saw. Both named, so a
    // regression says which bug came back rather than only that a count moved.
    check('  no "No trigger" complaint', said.includes('No trigger'), false);
    check('  and it does not say "Nothing interesting happens."', said.includes('Nothing interesting happens'), false);
    check('  the doorway is now the open one', locOn(DOOR[0], DOOR[1]), 'mm_bamboo_door_secure_inactive');
}

console.log(R.bad ? `\nFAILED: ${R.bad} of ${R.ok + R.bad}` : `\n${R.ok} ok`);
process.exit(R.bad ? 1 : 0);
