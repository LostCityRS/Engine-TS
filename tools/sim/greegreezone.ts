// A GREEGREE ONLY WORKS WHERE ZOOKNOCK'S MAGIC REACHES.
//
// Reported as "you can use a greegree outside of ape atoll" (DeathPlateau-Bugs#49), from 2600,3258.
// Nothing checked where the player was: the Hold option equipped the carving and transformed you
// anywhere on the map. OSRS wiki (Greegree): "their use is limited to the island of Ape Atoll, as
// Zooknock cannot use his magic over long distances" - with the Ardougne Zoo as the one exception,
// which this build cannot drop even if it wanted to, because ~mm_monkey_minder and
// ~mm_zoo_monkey_talk both gate on ~mm_is_monkey.
//
// SO THIS IS A FIX THAT TAKES SOMETHING AWAY, and the risk is not that it fails to take enough. It
// is that it takes away a step of the quest. Sections 1 and 2 are the whole of that worry: every
// npc, loc and landing coord the quest needs a monkey for has to be inside one of the three
// rectangles, derived from the map rather than from a list, before any of the behaviour below
// matters.
//
//   npx tsx tools/sim/greegreezone.ts
import * as H from './harness.ts';
import { check, R, player, held } from './a1lib.ts';
import World from '#/engine/World.js';
import { CoordGrid } from '#/engine/CoordGrid.js';
import NpcType from '#/cache/config/NpcType.js';
import HuntType from '#/cache/config/HuntType.js';
import ObjType from '#/cache/config/ObjType.js';
import InvType from '#/cache/config/InvType.js';
import CategoryType from '#/cache/config/CategoryType.js';

await H.boot();

const GREEGREE = 'mm_monkey_greegree_for_normal_monkey';
const HAS_GREEGREE = 10; // ^mm_has_greegree

// The three rectangles, read back here as plain numbers so the sim does not simply agree with the
// constant file by quoting it. x0,x1,z0,z1 and the levels inzone will accept.
const ATOLL = { x0: 2688, x1: 2815, z0: 2688, z1: 2815, lv: 3 };
const DUNGEON = { x0: 2688, x1: 2815, z0: 9088, z1: 9215, lv: 3 };
const ZOO = { x0: 2595, x1: 2612, z0: 3269, z1: 3288, lv: 0 };

const inRect = (r: typeof ATOLL, x: number, z: number, level = 0) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1 && level <= r.lv;
/** The three rectangles as this file understands them, from the comment above. */
const byRect = (x: number, z: number, level = 0) => inRect(ATOLL, x, z, level) || inRect(DUNGEON, x, z, level) || inRect(ZOO, x, z, level);

// AND THE CONTENT'S OWN ANSWER, which is what sections 1 and 2 go on. Asking the rectangles in
// TypeScript would make those sections a test of this file's arithmetic: dropping the zoo from
// ~mm_greegree_zone left every one of section 1's zoo checks green, because none of them had asked
// the game. A mutation run is the only reason that is known.
const probe: any = player('zoneprobe', 3200, 3200, 0);
H.setVar(probe, 'tutorial', 1000);
H.tick(2);
const allowed = (x: number, z: number, level = 0) => H.runProc(probe, '[proc,mm_greegree_zone]', [CoordGrid.packCoord(level, x, z)])[0] === 1;

// ---------------------------------------------------------------- 0. and the two agree everywhere
//
// So the rectangles written in the comment above are the rectangles the game uses. 1,600-odd tiles
// across the island, the dungeon and the whole Ardougne neighbourhood, which is what makes the
// numbers in this file documentation rather than decoration.
console.log('\n0. THE GAME AGREES WITH THE RECTANGLES THIS FILE DESCRIBES');
{
    const disagreed: string[] = [];
    let n = 0;
    for (const [x0, x1, z0, z1, step] of [
        [2680, 2825, 2680, 2825, 5],
        [2585, 2625, 3255, 3300, 2],
        [2680, 2825, 9080, 9225, 10],
        [3100, 3300, 3150, 3500, 25]
    ] as const) {
        for (let x = x0; x <= x1; x += step) {
            for (let z = z0; z <= z1; z += step) {
                n++;
                if (allowed(x, z, 0) !== byRect(x, z, 0)) disagreed.push(`${x},${z}`);
            }
        }
    }
    check(`  over ${n} tiles, the game and this file agree`, disagreed.slice(0, 6).join(' ') || '(everywhere)', '(everywhere)');
    // AND NOT BECAUSE EVERY ANSWER WAS NO. A ~mm_greegree_zone that returned false for everything
    // would agree with nothing and this check would still pass if the rectangles were empty.
    check('    with both answers in the sample', [...new Set([2762, 2596].map((x, i) => allowed(x, [2724, 3277][i], 0))), allowed(3213, 3424, 0)].join(','), 'true,false');
}

function wornGreegree(p: any): boolean {
    const inv = p.getInventory(InvType.WORN);
    if (!inv) return false;
    for (let i = 0; i < inv.capacity; i++) {
        const o = inv.get(i);
        if (o && ObjType.get(o.id).debugname === GREEGREE) return true;
    }
    return false;
}
const isMonkey = (p: any) => p.npcId !== -1;

function fresh(name: string, x: number, z: number, level = 0, give = true): any {
    const p: any = player(name, x, z, level);
    H.setVar(p, 'tutorial', 1000);
    H.setVar(p, 'mm_main', HAS_GREEGREE);
    if (give) H.give(p, GREEGREE, 1);
    H.tick(2);
    H.clearLogs();
    return p;
}

// ---------------------------------------------------------------- 1. the quest still fits inside
//
// DERIVED FROM THE MAP. Every npc the quest needs you to be a monkey in front of, found by walking
// the world's own spawns rather than by listing coordinates - a greegree-gated npc placed outside
// these rectangles fails here by name, which is the only check that would catch a rectangle drawn
// a few tiles too small.
console.log('\n1. EVERYTHING THE QUEST NEEDS A MONKEY FOR IS INSIDE');

// mm.hunt's guard is the island's; these three are the off-island ones, in the zoo.
const GATED = ['mm_monkey_minder', 'mm_zoo_monkey', 'mm_zooknock', 'mm_garkor', 'mm_kruk', 'mm_elder_guard_1', 'mm_elder_guard_2', 'mm_religious_guard', 'mm_monkey_child', 'mm_karam'];
for (const name of GATED) {
    const id = NpcType.getId(name);
    if (id === -1) {
        check(`  ${name} exists`, false, true);
        continue;
    }
    const out: string[] = [];
    let n = 0;
    for (const npc of World.npcs) {
        if (!npc || !npc.isActive || npc.type !== id) continue;
        n++;
        if (!allowed(npc.x, npc.z, npc.level)) out.push(`${npc.x},${npc.z} L${npc.level}`);
    }
    if (n === 0) {
        console.log(`  --   ${name.padEnd(22)} has no static spawn, nothing to place`);
        continue;
    }
    check(`  all ${String(n).padStart(2)} ${name.padEnd(22)} are inside`, out.join(' ') || '(all)', '(all)');
}

// EVERY HOSTILE ON THE ISLAND TOO, because the greegree's other job is the hunts in mm.hunt: an
// npc that reads param=mm_transmog_npc and stands outside these rectangles is an npc the player
// cannot defend themselves from the intended way.
const guarded: string[] = [];
for (const npc of World.npcs) {
    if (!npc || !npc.isActive) continue;
    const t = NpcType.get(npc.type) as unknown as { huntmode: number; debugname?: string };
    if (t.huntmode === -1) continue;
    const hunt = HuntType.get(t.huntmode);
    if (hunt.debugname !== 'mm_aggressive_melee' && hunt.debugname !== 'mm_aggressive_ranged') continue;
    if (!allowed(npc.x, npc.z, npc.level)) guarded.push(`${t.debugname} ${npc.x},${npc.z} L${npc.level}`);
}
check('  every npc on a greegree-guarded hunt is inside', guarded.join('; ') || '(all)', '(all)');

// And the quest's own landing coords, which are the one thing with no npc to find.
for (const [what, x, z, level] of [
    ['Zooknock, in the dungeon', 2804, 9146, 0],
    ['the throne room arrival', 2802, 2761, 0],
    ['the zoo monkey cage, SW', 2600, 3274, 0],
    ['the zoo monkey cage, NE', 2607, 3283, 0],
    ['the zoo fairy ring', 2596, 3277, 0]
] as const) {
    check(`  ${what.padEnd(26)} (${x},${z}) is inside`, allowed(x, z, level), true);
}

// ---------------------------------------------------------------- 2. and the rest of the map is out
console.log('\n2. AND NOWHERE ELSE IS');
for (const [what, x, z] of [
    ['the tile this was reported from', 2600, 3258],
    ['Ardougne market', 2655, 3283],
    ['the zoo camels', 2618, 3265],
    ['Varrock square', 3213, 3424],
    ['Lumbridge castle', 3222, 3218],
    ['Falador centre', 2965, 3380],
    ['Karamja, Musa Point', 2910, 3160],
    ['the Grand Exchange', 3165, 3487]
] as const) {
    check(`  ${what.padEnd(31)} (${x},${z}) is outside`, allowed(x, z, 0), false);
}
// The aviary is the edge case and is stated rather than left out: the keeper at 2610,3286 is
// inside this rectangle and his parrots at 2613,3287 are one tile outside it, because the east
// edge runs between them. Nothing in the zoo needs a greegree, so neither answer is wrong - but a
// rectangle whose edge cuts through an exhibit is worth knowing about.
check('  the aviary keeper (2610,3286) is inside', allowed(2610, 3286, 0), true);
check('  and his parrots   (2613,3287) are not', allowed(2613, 3287, 0), false);

// THE ZOO CAMELS ARE OUTSIDE ON PURPOSE and are listed above rather than left unsaid.
// Old School lets a greegree work anywhere in the zoo; this build's rectangle is the monkey pen and
// its approach, because the 377 cache has no fence loc in the zoo to read a real boundary off.
// See the constant file. If that is widened, those two lines are the ones that change.

// ---------------------------------------------------------------- 3. holding it up
console.log('\n3. THE HOLD OPTION ASKS WHERE YOU ARE');
for (const [what, x, z, want] of [
    ['on the Ape Atoll beach', 2762, 2724, true],
    ['in the dungeon, by Zooknock', 2803, 9146, true],
    ['in the zoo monkey pen', 2602, 3277, true],
    ['where this was reported', 2600, 3258, false],
    ['in Varrock square', 3213, 3424, false]
] as const) {
    const p = fresh('hold' + (x % 1000) + (z % 100), x, z, 0);
    // THROUGH drive(), NOT A BARE opheld. ~mm_greegree_hold ends in a ~mesbox, which parks the
    // player's script on a click - and a parked script means no protected access, which means the
    // watch's queue below never runs. The first version of this file left the dialogue open and
    // then reported that leaving the island did not take the greegree off: the queue was sitting
    // on the player, ten deep, waiting for a click nobody made.
    held(p, GREEGREE, 2);
    H.tick(2);
    check(`  ${what.padEnd(28)} -> a monkey`, isMonkey(p), want);
    check(`    ${' '.repeat(26)} and it is worn`, wornGreegree(p), want);
    // BOTH CHANNELS. The refusal is a mes() line plus a ~mesbox, and a mesbox's text arrives as an
    // interface update, not as a chat message - reading only H.mesgs passed over the half of the
    // refusal that actually explains itself.
    const said = [...H.mesgs.map(m => m.text), ...H.ifaces.map(i => i.text ?? '')].join(' | ');
    if (!want) {
        // THE WIELD CHECK'S OWN WORDS, and not just "Zooknock" - which the watch also says. Deleting
        // the wield check entirely left this whole section green: the hold succeeded, and the watch
        // took the greegree back off two ticks later, so every check above still read "not a monkey,
        // not worn". A mutation run is the only reason that is known. These two lines are what tell
        // "it was refused" from "it was allowed and then undone".
        check("    refused in its own words, not the watch's", /carved wood/.test(said), true);
        check('    and never got as far as holding it up', /hold up the greegree/.test(said), false);
    } else {
        check('    and it says you held it up', /hold up the greegree/.test(said), true);
    }
    H.despawn(p);
}

// ---------------------------------------------------------------- 4. and it comes off when you leave
console.log('\n4. AND IT COMES OFF WHEN YOU LEAVE');
{
    const p = fresh('leaver', 2762, 2724, 0);
    held(p, GREEGREE, 2);
    H.tick(2);
    check('  a monkey on the beach to begin with', isMonkey(p), true);
    // AND THE WATCH IS RUNNING, which the two controls below cannot tell you. "Still a monkey after
    // crossing the island" is also what a timer that was never started looks like, and that is
    // exactly the state this file was in while section 4 failed.
    check(
        '    and the watch timer is running',
        [...(p as any).timers.values()].some((t: any) => t.script?.name === '[softtimer,mm_greegree_watch]'),
        true
    );

    // THE CONTROL FIRST, on the island, because "it turned me back" and "the timer fires every
    // tick regardless" look identical from one check. Across the island and into the dungeon.
    p.teleport(2722, 2792, 0);
    H.tick(6);
    check('  still a monkey after crossing the island', isMonkey(p), true);
    p.teleport(2803, 9146, 0);
    H.tick(6);
    check('  still a monkey down in the dungeon', isMonkey(p), true);

    H.clearLogs();
    p.teleport(3213, 3424, 0);
    H.tick(6);
    check('  human again in Varrock square', isMonkey(p), false);
    check('    and the greegree is off', wornGreegree(p), false);
    check('    and back in the pack', H.invCount(p, GREEGREE), 1);
    check('    and it said so', /Zooknock/.test(H.mesgs.map(m => m.text).join(' | ')), true);
    H.despawn(p);
}

// A FULL PACK DESTROYS NOTHING. Old School drops the greegree on the floor and the wiki warns
// players about losing one that way; this waits for a slot instead. Which means a full pack leaves
// you a monkey off the island - a loophole, and a deliberate one, so it is asserted rather than
// left to be discovered.
{
    const p = fresh('fullpack', 2762, 2724, 0);
    held(p, GREEGREE, 2);
    H.tick(2);
    check('  a monkey, with the greegree worn', isMonkey(p) && wornGreegree(p), true);
    H.fillInv(p);
    H.clearLogs();
    p.teleport(3213, 3424, 0);
    H.tick(8);
    check('  a full pack keeps it on rather than dropping it', wornGreegree(p), true);
    // AND SAYS IT ONCE AT MOST, never once a tick: ~unequip's own "You don't have enough free
    // space to do that." is what a missing freespace guard looks like, eight times over.
    const spam = H.mesgs.filter(m => /free space/.test(m.text)).length;
    check('    and does not say "free space" every tick', spam, 0);
    // and the moment a slot opens
    H.clearInv(p);
    H.give(p, 'coins', 1);
    H.tick(4);
    check('    and comes off the tick a slot opens', isMonkey(p), false);
    H.despawn(p);
}

// ---------------------------------------------------------------- 5. logging in somewhere it does not work
console.log('\n5. LOGGING IN WHERE IT DOES NOT WORK');
{
    // Every account that played before this check existed can be standing anywhere, wearing one.
    const p = fresh('relog', 3213, 3424, 0);
    H.equip(p, { rhand: GREEGREE });
    H.tick(1);
    check('  it is worn to start with', wornGreegree(p), true);
    H.runProc(p, '[proc,mm_greegree_login]');
    H.tick(2);
    check('  logging in at Varrock does not transform', isMonkey(p), false);
    check('    and takes it off', wornGreegree(p), false);
    H.despawn(p);

    const q = fresh('relog2', 2762, 2724, 0);
    H.equip(q, { rhand: GREEGREE });
    H.tick(1);
    H.runProc(q, '[proc,mm_greegree_login]');
    H.tick(2);
    check('  logging in on the island does transform', isMonkey(q), true);
    check('    and leaves it on', wornGreegree(q), true);
    H.despawn(q);
}

// ---------------------------------------------------------------- 6. all eight, not just the one
console.log('\n6. ALL EIGHT GREEGREES, NOT THE ONE THIS SIM USES');
const cat = CategoryType.getId('mm_greegree');
const all: string[] = [];
for (let id = 0; id < ObjType.count; id++) {
    const t = ObjType.get(id);
    if (t && t.category === cat && t.debugname) all.push(t.debugname);
}
check('  the cache has eight of them', all.length, 8);
for (const nm of all.sort()) {
    const p = fresh('eight' + all.indexOf(nm), 3213, 3424, 0, false);
    H.give(p, nm, 1);
    held(p, nm, 2);
    H.tick(2);
    check(`  ${nm.replace('mm_monkey_greegree_for_', '').padEnd(22)} refused in Varrock`, isMonkey(p), false);
    H.despawn(p);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
