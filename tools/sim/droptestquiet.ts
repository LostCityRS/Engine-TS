// ::~droptest DOES NOT ANNOUNCE ITS DROPS TO THE WORLD.
//
//   npx tsx tools/sim/droptestquiet.ts
//
// The drop test spawns npcs and really kills them, so their drop tables run for real and call
// ~broadcast_drop like any other kill. "::~droptest king_black_dragon 100" was sending up to a
// hundred real "[Rare drop!]" lines to everybody on the world, each naming a drop nobody got.
//
// WHAT THIS ASSERTS
//   * ~broadcast_news sends nothing while %broadcast_suppressed is set, and the collection log
//     still records the item - the drop happened, it is only the announcement that did not;
//   * a run sets the gate, and - the case with teeth - HOLDS IT PAST THE LAST KILL. The npc's
//     death script runs on a later cycle than the run's own bookkeeping (npc_queue, not inline),
//     so a gate lifted when the run says "finished" would let the final drop of every run
//     through, including every single-kill run;
//   * it lifts afterwards, so an ordinary drop announces again;
//   * cancelling a run lifts it too, rather than leaving the account silent for ever;
//   * and ::yell is NOT suppressed - a staff member running a drop test can still talk.
import * as H from './harness.js';
import ObjType from '#/cache/config/ObjType.js';
import NpcType from '#/cache/config/NpcType.js';

await H.boot();
H.loginOrder();

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

const dev = H.makePlayer('dq_dev', 3222, 3218);
const watcher = H.makePlayer('dq_watch', 3224, 3218);
H.loginOrder(dev, watcher);
dev.staffModLevel = 4; // ~debug_require_dev
H.tick(2);

// "Rare drop!" with no brackets: ~broadcast_drop passes the label bare and ~broadcast_news wraps
// it in colour tags, not in [ ]. Only the milestone labels carry brackets, and matching on those
// here made the positive control read 0 - a line that was being sent perfectly well.
const heard = () => H.mesgs.filter(m => m.who === watcher.username && m.text.includes('Rare drop!')).length;
const gate = () => H.getVar(dev, 'broadcast_suppressed');
const WHIP = ObjType.getId('abyssal_whip');

console.log('\n================ THE GATE ITSELF');

H.clearLogs();
H.runProc(dev, '[proc,broadcast_drop]', [WHIP]);
H.tick(2);
check('a drop announces when the gate is open', heard(), 1);

H.setVar(dev, 'broadcast_suppressed', 1);
H.clearLogs();
H.runProc(dev, '[proc,broadcast_drop]', [WHIP]);
H.tick(2);
check('and nothing goes out when it is shut', heard(), 0);
// The drop still happened. Only the announcement did not - the log is the record of what this
// account has obtained, and a drop test's kills are real kills. ~broadcast_drop calls
// ~collection_log_add after ~broadcast_news, so a gate that returned too early would take the log
// entry with it.
check('...but the collection log still recorded the item', H.runProc(dev, '[proc,collection_log_has]', [WHIP])[0], 1);

// ::yell goes through broadcast_mes directly and must be untouched.
H.clearLogs();
H.runProc(dev, '[proc,yell]', ['hello']);
H.tick(2);
check('a yell is not suppressed', H.mesgs.filter(m => m.who === watcher.username && m.text.includes('[Yell]')).length, 1);
H.setVar(dev, 'broadcast_suppressed', 0);

console.log('\n================ A REAL RUN HOLDS THE GATE PAST ITS LAST KILL');

const CHICKEN = NpcType.getId('chicken');
const QUIET_TAIL = 10; // ^debug_droptest_quiet_tail

{
    // ONE KILL, which is the run length that catches the race. The tick decrements the counter
    // BEFORE the kill, so on a single-kill run the counter is already 0 while the only drop of
    // the whole test is still in flight.
    H.clearLogs();
    H.runProc(dev, '[debugproc,droptest]', [CHICKEN, 1]);
    H.tick(1);
    check('the run shuts the gate at once', gate(), 1);

    H.tick(6);
    const finished = H.mesgs.filter(m => m.who === dev.username && m.text.includes('Drop test finished')).length;
    check('the run finishes', finished >= 1, true);
    check('...and the gate is STILL shut while the last drop lands', gate(), 1);

    H.tick(QUIET_TAIL + 4);
    check('it lifts once the tail has run out', gate(), 0);

    H.clearLogs();
    H.runProc(dev, '[proc,broadcast_drop]', [WHIP]);
    H.tick(2);
    check('and an ordinary drop announces again', heard(), 1);
}

console.log('\n================ A CANCELLED RUN LIFTS IT TOO');

{
    H.runProc(dev, '[debugproc,droptest]', [CHICKEN, 50]);
    H.tick(2);
    check('a long run shuts the gate', gate(), 1);

    H.runProc(dev, '[debugproc,droptest]', [CHICKEN, 0]); // ::~droptest chicken 0 - stop
    H.tick(2);
    check('cancelling does not lift it immediately', gate(), 1);

    H.tick(QUIET_TAIL + 4);
    check('...but it does lift', gate(), 0);

    H.clearLogs();
    H.runProc(dev, '[proc,broadcast_drop]', [WHIP]);
    H.tick(2);
    check('and the account is not left silent', heard(), 1);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
