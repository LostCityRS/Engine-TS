// EVERY PANEL OF THE WATERFALL LEDGE DOOR OPENS, NOT JUST THE MIDDLE ONE.
// Usage: npx tsx tools/sim/waterfalldoor.ts   (exit code is the verdict)
//
// The doorway on the ledge is THREE locs side by side - waterfall_ledge_door_left at 2510,3464,
// waterfall_ledge_door at 2511 and waterfall_ledge_door_right at 2512 - and all three carry
// op1="Open". Only the centre one had a trigger, so clicking either side panel answered the
// engine's words for an op nothing serves:
//
//   ["No trigger for [oploc1,waterfall_ledge_door_left]", "Nothing interesting happens."]
//
// This is the door Waterfall Quest has to go through, and the two panels that did nothing look
// exactly like the one that works.
//
// BOTH OUTCOMES ARE CHECKED ON ALL THREE, because a panel that merely stops being silent is not
// fixed: without Glarial's amulet the corridor floods and washes you back to the river, and with
// it you walk through and the quest moves on. A side panel that opened but did neither would pass
// a "does it say something" test and still be broken.
//
// Found with tools/sim/placeddead.ts. Nobody reported it.
import * as H from './harness.js';
import { check, R, player, mesOf } from './a1lib.js';
import LocType from '#/cache/config/LocType.js';

await H.boot();

const PANELS: [string, number][] = [
    ['waterfall_ledge_door_left', 2510],
    ['waterfall_ledge_door', 2511],
    ['waterfall_ledge_door_right', 2512]
];
const AMULET = 'glarials_amulet_waterfall_quest';
const ENTERED_TOMB = 4;
const ENTERED_WATERFALL = 5;

console.log('== the doorway is three panels wide and they all offer Open');
for (const [nm, x] of PANELS) {
    const id = LocType.getId(nm);
    check(`${nm} is in the cache`, id !== -1, true);
    if (id === -1) continue;
    check('  it offers Open on op1', LocType.get(id).op?.[0], 'Open');
    check(`  and stands at ${x},3464`, H.locAt(0, x, 3464, nm), true);
}

console.log('\n== with no amulet, every panel floods you back to the river');
for (const [nm, x] of PANELS) {
    const p: any = player('wfa' + x, x, 3465, 0);
    H.clearLogs();
    H.opLoc(p, x, 3464, nm, 1);
    H.tick(8);
    const said = mesOf(p);
    check(`${nm} opens`, said[0], 'The door begins to open.');
    check('  and the corridor floods', said.includes('Suddenly the corridor floods...'), true);
    check('  washing you to the riverside', [p.x, p.z], [2527, 3413]);
}

console.log('\n== with the amulet, every panel takes you through and moves the quest on');
for (const [nm, x] of PANELS) {
    const p: any = player('wfb' + x, x, 3465, 0);
    H.give(p, AMULET, 1);
    H.setVar(p, 'waterfall_quest', ENTERED_TOMB);
    H.clearLogs();
    H.opLoc(p, x, 3464, nm, 1);
    H.tick(8);
    check(`${nm} lets you through`, mesOf(p).includes('You walk through the door.'), true);
    check('  and you are inside', [p.x, p.z], [2575, 9861]);
    check('  with the quest moved on', H.getVar(p, 'waterfall_quest'), ENTERED_WATERFALL);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
