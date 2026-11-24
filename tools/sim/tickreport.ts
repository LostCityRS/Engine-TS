// ::ticks, AND WHETHER IT TELLS THE TRUTH.
//
// The question staff get asked is "is the server lagging, or is this skill just slow?", and until
// now nothing in game could answer it: the only signal was a journal line, written only when a tick
// went over budget, throttled to one every 30 seconds, and visible to nobody holding a client. A
// week went into checking every fishing catch rate against the wiki and measuring every cadence
// before anyone could say whether the tick itself was late - and a world running at 1000ms a tick
// would have made all of that beside the point.
//
// A report that lies is worse than no report, so this holds it to its numbers: the ring buffer's
// arithmetic against cycle times it was fed by hand, that it wraps rather than grows, and that the
// command answers a moderator and refuses everybody else.
//
//   npx tsx tools/sim/tickreport.ts
import * as H from './harness.ts';
import * as A from './a1lib.ts';
import { check, R } from './a1lib.ts';
import ClientCheatHandler from '#/network/game/client/handler/ClientCheatHandler.js';
import ClientCheat from '#/network/game/client/model/ClientCheat.js';
import World from '#/engine/World.js';
import Player from '#/engine/entity/Player.js';

await H.boot();

const cheats = new ClientCheatHandler();
const run = (p: Player, text: string): boolean => cheats.handle(new ClientCheat(text), p) !== false;

console.log('=== the world records what its ticks cost');
{
    H.tick(20);
    const cycles = World.recentCycles();
    console.log(`  ${cycles.length} ticks recorded, last few: ${cycles.slice(-5).join(', ')}ms`);
    check('ticking the world fills the history', cycles.length >= 20, true);
    check(
        '  ...and every entry is a real duration, not a negative or a NaN',
        cycles.every(c => Number.isInteger(c) && c >= 0),
        true
    );
}

console.log('\n=== the ring wraps instead of growing');
{
    // 500 is five minutes at 600ms. Feeding it more than that must overwrite the oldest rather than
    // let the array grow for the life of the world - a leak in a report about performance would be a
    // poor joke.
    const before = World.recentCycles().length;
    H.tick(520 - before > 0 ? 520 - before : 1);
    const after = World.recentCycles();
    check('the history stops at 500', after.length, 500);
    check('  ...and the ring is 500 wide, so five minutes is what it holds', (World as unknown as { cycleHistory: Uint32Array }).cycleHistory.length, 500);
}

console.log('\n=== the arithmetic, against numbers fed in by hand');
{
    // The real cycle times in a sim are whatever this machine happened to take, so the statistics
    // are checked against a history written directly: 499 ticks of 10ms and one of 5000ms. A mean
    // that quietly included the outlier as the median, or a 95th that was really the maximum, would
    // read as a healthy world on a struggling one.
    const w = World as unknown as { cycleHistory: Uint32Array; cycleHistoryWrites: number; tickRate: number };
    const savedRate = w.tickRate;
    w.tickRate = 600;
    w.cycleHistory.fill(10);
    w.cycleHistory[0] = 5000;
    w.cycleHistoryWrites = 500;
    const report = World.cycleReport();
    for (const line of report) console.log('  ' + line);
    check('the median ignores the one outlier', report[0].includes('median 10ms'), true);
    check('  ...the worst does not', report[0].includes('worst 5000ms'), true);
    check('  ...the mean sits between them', report[0].includes('mean 20.0ms'), true); // (499*10 + 5000)/500 = 19.98
    check('  ...and the budget line counts exactly the one tick that broke it', report[1].includes('1 tick over it (0.2%)'), true);
    check('  ...and does not claim the world is keeping up', report[1].includes('keeping up'), false);

    // and the other way: a world entirely inside its budget should say so, because that is the
    // answer that sends somebody to look at the skill instead of the server
    w.cycleHistory.fill(12);
    const healthy = World.cycleReport();
    console.log('  ' + healthy[1]);
    check('a world inside its budget says nothing is over it', healthy[1].includes('0 ticks over it (0.0%)'), true);
    check('  ...and says so in words, not just a percentage', healthy[1].includes('not the tick rate'), true);
    w.tickRate = savedRate;
}

console.log('\n=== who may ask');
{
    const mod: Player = A.player('tr_mod', 3222, 3218);
    mod.staffModLevel = 2;
    let from = A.mark();
    check('a moderator gets an answer', run(mod, 'ticks'), true);
    const lines = A.mesSince(mod, from);
    for (const l of lines) console.log('  ' + l);
    check('  ...of four lines', lines.length, 4);
    check(
        '  ...naming the budget',
        lines.some(l => l.includes('Budget')),
        true
    );

    // ::lag is the same command, because it is the word somebody reaches for
    from = A.mark();
    run(mod, 'lag');
    check('::lag answers the same way', A.mesSince(mod, from).length, 4);

    const ordinary: Player = A.player('tr_player', 3224, 3218);
    ordinary.staffModLevel = 0;
    from = A.mark();
    run(ordinary, 'ticks');
    check('an ordinary player gets nothing', A.mesSince(ordinary, from).filter(l => l.includes('Budget')).length, 0);
}

console.log('\n=== and it is listed where staff would look for it');
{
    const mod: Player = A.player('tr_list', 3226, 3218);
    mod.staffModLevel = 2;
    const from = A.mark();
    run(mod, 'commands');
    const listed = A.mesSince(mod, from).filter(l => l.includes('ticks'));
    console.log('  ' + (listed[0] ?? '(not listed)'));
    check('::commands mentions it, so it can be found without reading the source', listed.length >= 1, true);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
