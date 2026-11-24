// THE TWO DIAGNOSTICS THAT ANSWER "IS FISHING STOPPING, OR WAS IT ALWAYS THIS SLOW?"
//
// Corey: 27 tuna in 20-30 minutes, where every catch rate checked against the wiki and every cadence
// measured (tools/sim/fishingrates.ts) says about 14 - and other players reporting the same for other
// fish. The rates are right, so the remaining suspect is fishing STOPPING partway through a trip:
// the loop is p_opnpc re-queuing itself, and of the engine's 21 clearInteraction() calls exactly one
// says anything to the player. The rest are silent, and the player goes on standing there.
//
// Two things were added, and this holds them both to doing their job - an untested watchdog is worth
// nothing, because the way it fails is by staying quiet.
//
//   CONTENT  skill_fishing/scripts/fishing_watchdog.rs2 - every cast re-arms a ten-tick timer, so it
//            can only fire once casts have stopped, and then it records the state at that moment.
//   ENGINE   Player.validateTarget - names every silently dropped interaction and why, throttled to
//            one line per 30 seconds with the counts in between.
//
//   npx tsx tools/sim/fishingwatchdog.ts
import * as H from './harness.ts';
import * as A from './a1lib.ts';
import { check, R } from './a1lib.ts';
import InvType from '#/cache/config/InvType.js';
import NpcType from '#/cache/config/NpcType.js';
import ObjType from '#/cache/config/ObjType.js';
import World from '#/engine/World.js';
import Npc from '#/engine/entity/Npc.js';
import Player from '#/engine/entity/Player.js';
import { PlayerStat } from '#/engine/entity/PlayerStat.js';

await H.boot();

// The engine's warnings go through console.log, so the only way to assert on one is to listen for it.
const warnings: string[] = [];
const realLog = console.log;
console.log = (...args: unknown[]) => {
    const line = args.map(a => String(a)).join(' ');
    if (line.includes('interaction dropped silently')) warnings.push(line);
    realLog(...args);
};

const INV = InvType.getId('inv');
const TUNA = ObjType.getId('raw_tuna');

// A DIFFERENT SPOT FOR EACH SECTION. All four used to share one, and changing its type in the last
// section dropped the FIRST section's player - who was still logged in and still targeting it - so
// the engine's warning named the wrong player and the assertion passed by luck.
const spots: Npc[] = [];
for (const n of World.npcs) if ((NpcType.get(n.type).debugname ?? '').endsWith('_rarefish')) spots.push(n);
if (spots.length < 4) throw new Error('need four harpoon spots, found ' + spots.length);
let nextSpot = 0;

/** A level 39 fisher at a harpoon spot of their own, with the staff rank that sees the watchdog's line. */
function fisher(name: string): { p: Player; spot: Npc } {
    const spot = spots[nextSpot++];
    const p: Player = A.player(name, spot.x + 1, spot.z, spot.level);
    p.teleport(spot.x + 1, spot.z, spot.level);
    H.tick(1);
    p.setLevel(PlayerStat.FISHING, 39);
    p.staffModLevel = 3; // the watchdog's message is staff-only on purpose
    H.clearInv(p);
    H.give(p, 'harpoon', 1);
    return { p, spot };
}

/** Fish for `ticks`, optionally throwing the catch away so the pack never fills. */
function fish(p: Player, ticks: number, keepFish: boolean): number {
    let caught = 0;
    for (let t = 0; t < ticks; t++) {
        H.tick(1);
        const held = p.invTotal(INV, TUNA);
        if (held > 0 && !keepFish) {
            caught += held;
            p.invDel(INV, TUNA, held);
        } else if (held > 0) {
            caught = held;
        }
    }
    return caught;
}

const stopLines = (p: Player, from: number) => A.mesSince(p, from).filter(m => m.includes('[fishing] stopped'));

console.log('=== while fishing is running, the watchdog says nothing');
{
    const { p, spot } = fisher('wd_quiet');
    H.opNpc(p, spot, 3);
    const from = A.mark();
    const caught = fish(p, 240, false);
    console.log(`  240 ticks, ${caught} tuna, ${stopLines(p, from).length} watchdog lines`);
    // THE TEST THAT MATTERS MOST. A watchdog that cries wolf every ten ticks would be worse than
    // none: it would bury the real stop in noise, and nobody would read the journal twice.
    check('240 ticks of fishing, not one watchdog line', stopLines(p, from).length, 0);
    check('  ...and it really was fishing all along', caught > 0, true);
}

console.log('\n=== when the interaction is dropped from under them, it fires');
{
    const { p, spot } = fisher('wd_dropped');
    H.opNpc(p, spot, 3);
    fish(p, 60, false);
    const from = A.mark();
    // Exactly what a silent clearInteraction leaves behind: no target, no message, a player still
    // stood at the spot with a harpoon and 27 free slots.
    p.clearInteraction();
    fish(p, 20, false);
    const lines = stopLines(p, from);
    console.log('  ' + (lines[0] ?? '(nothing)'));
    check('the watchdog notices within 20 ticks', lines.length, 1);
    check('  ...and says the pack still had room, which is what makes it a bug and not a full pack', lines[0]?.includes('27 free slots'), true);
}

console.log('\n=== a pack that fills up fires it too, and says so - that one is not a bug');
{
    const { p, spot } = fisher('wd_full');
    // 26 junk beside the harpoon, so there is exactly ONE slot left: fishing starts, arms the timer
    // on its first cast, and the catch that lands fills the pack and stops it. Starting from an
    // ALREADY full pack proves nothing - the handler refuses before any cast, so nothing is ever
    // armed and the watchdog has nothing to fire. That is what this check asserted at first.
    for (let i = 0; i < 26; i++) H.give(p, 'bones', 1);
    H.opNpc(p, spot, 3);
    const from = A.mark();
    for (let t = 0; t < 400 && stopLines(p, from).length === 0; t++) H.tick(1);
    const lines = stopLines(p, from);
    console.log(`  caught ${H.invCount(p, 'raw_tuna')} tuna into the last slot, then: ${lines[0] ?? '(nothing)'}`);
    check('a filled pack is reported with no free slots, so the journal can tell them apart', lines[0]?.includes('0 free slots') ?? false, true);
}

console.log('\n=== and the engine names a silently dropped target');
{
    const { p, spot } = fisher('wd_changetype');
    H.opNpc(p, spot, 3);
    fish(p, 30, false);
    warnings.length = 0;
    // The warning is throttled to one line per 30 seconds of WALL clock, which a sim blows through in
    // milliseconds - so the counters are reset here and the next drop is guaranteed to be the line
    // that prints, and to be the only thing counted in it.
    const stats = Player as unknown as { lastTargetDropReport: number; targetDropCounts: Map<string, number> };
    stats.lastTargetDropReport = 0;
    stats.targetDropCounts.clear();
    // WHAT THE WHIRLPOOL RANDOM EVENT DOES: npc_changetype on the fishing spot, to the npc named by
    // its own param=whirlpool. validateTarget then sees targetSubject.type != target.type and clears
    // the interaction with no message - the exact silent stop this whole investigation was chasing.
    const whirlpool = NpcType.getId('macro_whirlpool_rarefish');
    check('the spot has a whirlpool to turn into', whirlpool !== -1, true);
    spot.changeType(whirlpool, 60);
    fish(p, 10, false);
    console.log('  ' + (warnings[0] ?? '(no warning)'));
    check('the engine logged the drop', warnings.length >= 1, true);
    check('  ...and named the reason as a type change', warnings[0]?.includes('changed type') ?? false, true);
    check('  ...and named the player', warnings[0]?.includes('wd_changetype') ?? false, true);
    // and the interaction really is gone, which is the behaviour the log is describing
    check('  ...and fishing really did stop', p.target, null);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
