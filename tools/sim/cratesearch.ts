// THE CRATES AND BOXES THAT ANSWERED NOTHING.
// Usage: npx tsx tools/sim/cratesearch.ts   (exit code is the verdict)
//
// Storage furniture is answered by CATEGORY - [oploc1,_empty_crate], [oploc1,_empty_crates] and
// [oploc1,_empty_boxes] in general_use/scripts/crates.rs2 - and five placed locs carried the name
// and the Search option without the category, so the handler never saw the click and all 83 of
// them answered "Nothing interesting happens."
//
//   viking_crate     24  Rellekka      Crate    -> empty_crate
//   viking_crate_2   12  Rellekka      Crate    -> empty_crate   (drawn from crate3, a wired one)
//   ahoy_boxes_1     16  Morytania     Boxes    -> empty_boxes
//   loc_11744        15  Falador       Boxes    -> empty_boxes
//   loc_11745        16  Falador       Crates   -> empty_crates
//
// The same mistake as Ape Atoll's Jungle Trees, which had op1=Chop-down and no category=tree.
//
// FOUND BY grouping every loc by (name, ops) and keeping the families where some members are
// answered and some are not - 85 such families. crate2/crate3/crate_old and boxes/boxes2/boxes3
// are the wired siblings here, with hundreds of spawns between them. DeathPlateau-Bugs#27.
import * as H from './harness.js';
import { check, R, player, mesOf } from './a1lib.js';
import LocType from '#/cache/config/LocType.js';

await H.boot();

interface Spot {
    name: string;
    locname: string;
    at: [number, number, number];
    says: RegExp;
}

// The exact words each category answers with, from crates.rs2. Each also has a
// findsomethingnice roll that opens "You search the ...", so both are accepted.
const CRATE = /You search the crate but find nothing\.|You search the crate\.\.\./;
const CRATES = /You search the crates but find nothing of value\.|You search the crates\.\.\./;
const BOXES = /There is nothing interesting in these boxes\.|You search the boxes\.\.\./;

const CANDIDATES: Spot[] = [
    { name: 'Crate', locname: 'viking_crate', at: [2498, 3870, 0], says: CRATE },
    { name: 'Crate', locname: 'viking_crate_2', at: [2514, 3852, 0], says: CRATE },
    { name: 'Boxes', locname: 'ahoy_boxes_1', at: [3573, 3310, 0], says: BOXES },
    { name: 'Boxes', locname: 'loc_11744', at: [3009, 3336, 0], says: BOXES },
    { name: 'Crates', locname: 'loc_11745', at: [2962, 3350, 0], says: CRATES }
];

// "I can't reach that!" is the engine saying this sim parked the player somewhere that cannot
// touch the loc - a wall, a corner, the wrong side. It is NOT an answer from the script, and
// counting it as one is how the first version of this file reported two passes it had not earned.
const UNREACHED = /can't reach that/;
let logins = 0;

console.log('== each one is named and optioned like the siblings that already worked');
for (const c of CANDIDATES) {
    const id = LocType.getId(c.locname);
    check(`${c.locname} is in the cache`, id !== -1, true);
    if (id === -1) continue;
    check(`  it is called ${c.name}`, LocType.get(id).name, c.name);
    check('  and offers Search on op1', LocType.get(id).op?.[0], 'Search');
}

console.log('\n== and searching one answers instead of falling through');
for (const c of CANDIDATES) {
    const spots = H.locsNear(c.locname, c.at[0], c.at[1], c.at[2]);
    check(`${c.locname} is placed near ${c.at[0]},${c.at[1]}`, spots.length > 0, true);
    if (spots.length === 0) continue;

    // Several are tried: this furniture stands against walls and in corners, so which neighbouring
    // tile a player can reach it from differs per pile. A tile in an unallocated zone throws rather
    // than returning, so each attempt is guarded.
    let said = '';
    let unreached = 0;
    for (const s of spots.slice(0, 20)) {
        for (const [dx, dz] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1]
        ]) {
            let p: any;
            try {
                p = player(`cs${(logins++).toString(36)}`, s.x + dx, s.z + dz, s.level);
            } catch {
                continue;
            }
            H.clearLogs();
            H.opLoc(p, s.x, s.z, c.locname, 1);
            H.tick(4);
            const m = mesOf(p).join(' | ');
            if (!m) continue;
            if (UNREACHED.test(m)) {
                unreached++;
                continue;
            }
            said = m;
            break;
        }
        if (said) break;
    }
    if (!said && unreached) {
        console.log(`       (${unreached} tiles could not reach it)`);
    }
    // THE FAILURE THIS IS FOR is "No trigger for [oploc1,...]" followed by "Nothing interesting
    // happens.", which is the engine's default and what a player actually saw. Either the empty
    // message or the findsomethingnice roll is a pass.
    check('  searching it is answered', c.says.test(said), true);
    if (said) console.log(`       "${said.slice(0, 72)}"`);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
