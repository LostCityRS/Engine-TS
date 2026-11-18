// THE AXE IN THE LOG COMES OUT OF IT.
// Usage: npx tsx tools/sim/logaxe.ts   (exit code is the verdict)
//
// log_withaxe has carried op1=Take-axe since the 377 cache with nothing behind it, so every click
// answered "Nothing interesting happens." - the engine's words for an op with no trigger. Its
// pair, log_withoutaxe, has no ops and existed for nothing to change into. Tracker issue 26.
//
// WHY THE OP IS CHECKED BEFORE THE CLICK. The whole bug was an op nobody served, and a sim that
// only clicks cannot tell "the handler ran" from "the op quietly went away" - if someone deletes
// op1 from the loc the click stops being possible and a click-only test goes green on a loc a
// player can no longer use at all.
import * as H from './harness.js';
import { check, R, player, mesOf } from './a1lib.js';
import LocType from '#/cache/config/LocType.js';
import ObjType from '#/cache/config/ObjType.js';

await H.boot();

const AXE = ObjType.getId('bronze_axe');
const INV = 93;

console.log('== the loc still advertises the op, and its empty pair exists');
{
    const withAxe = LocType.getId('log_withaxe');
    const without = LocType.getId('log_withoutaxe');
    check('log_withaxe is in the cache', withAxe !== -1, true);
    check('  and still offers Take-axe on op1', LocType.get(withAxe).op?.[0], 'Take-axe');
    check('log_withoutaxe is in the cache', without !== -1, true);
    check('  and offers nothing, being the taken-from one', LocType.get(without).op ?? null, null);
}

console.log('\n== all three placements are where they were');
const spots = H.locsNear('log_withaxe', 3232, 3296, 0);
{
    check('the three logs stand on level 0', spots.map(s => `${s.x},${s.z}`).sort(), ['3186,3277', '3232,3296', '3315,2771']);
}

console.log('\n== taking it at the Lumbridge chicken farm');
{
    const p: any = player('logaxe', 3233, 3296, 0);
    H.clearLogs();
    H.opLoc(p, 3232, 3296, 'log_withaxe', 1);
    H.tick(2);
    check('the click is answered, not dropped', mesOf(p), ['You take the axe.']);
    check('  a bronze axe is in the bag', p.invTotal(INV, AXE), 1);
    check('  the log it came out of is gone', H.locAt(0, 3232, 3296, 'log_withaxe'), false);
    check('  and the axe-less one stands in its place', H.locAt(0, 3232, 3296, 'log_withoutaxe'), true);

    // THIRTY SECONDS, which is what the axe is documented to take coming back, and the reason
    // loc_change was given a duration rather than left permanent: a one-shot spawn would be gone
    // for everyone who came after the first player.
    H.tick(47);
    check('  not back yet at 49 ticks', H.locAt(0, 3232, 3296, 'log_withaxe'), false);
    H.tick(3);
    check('  back on the fiftieth', H.locAt(0, 3232, 3296, 'log_withaxe'), true);
}

console.log('\n== a full inventory is told why, and the axe stays in the log');
{
    const p: any = player('logaxefull', 3233, 3296, 0);
    for (let i = 0; i < 28; i++) p.invAdd(INV, ObjType.getId('coal'), 1, false);
    check('the bag is full', p.invFreeSpace(INV), 0);
    H.clearLogs();
    H.opLoc(p, 3232, 3296, 'log_withaxe', 1);
    H.tick(2);
    check('  it says so', mesOf(p), ["You don't have enough room in your inventory."]);
    check('  no axe arrived', p.invTotal(INV, AXE), 0);
    check('  and the log still has one for somebody else', H.locAt(0, 3232, 3296, 'log_withaxe'), true);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
