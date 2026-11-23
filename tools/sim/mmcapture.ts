// DOES TALKING TO A MONKEY AS A HUMAN GET YOU ARRESTED?
//
// "Monkey Guards will appear if players talk to a monkey on Ape Atoll while in human form", one of
// five named ninja monkeys with one or two of them, and "if they hit the player, the player will
// appear in the Ape Atoll prison". None of it existed: the six npcs had no spawn and no caller, and
// all eleven monkeys of Marim carried op1=Talk-to with nothing behind it.
//
// Six claims, and the first is the one that made the whole jail pointless:
//
//   1. THE CELL IS A CELL. ^mm_jail_cell pointed eight tiles east of it, into a hut that opens onto
//      Marim, so the arrest put you down already free. The cell is a sealed 21-tile room and the
//      arrest has to land inside it.
//   2. A human who speaks to a monkey is set upon - one named monkey, one or two guards.
//   3. A second monkey in the same minute is not a second ambush (%mm_guards_cooldown).
//   4. A hit from one of them arrests rather than kills.
//   5. A monkey - a player wearing a greegree - is served, not arrested.
//   6. A greegree put back on makes a captor that is already swinging vanish.
//
// Plus the configs underneath: seven level-149 monsters that had no combat stats at all, a guard
// that could not move, and two wrong bone drops.
//
//   npx tsx tools/sim/mmcapture.ts
import * as H from './harness.ts';
import { check, R, player, talk, mark, said } from './a1lib.ts';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import NpcType from '#/cache/config/NpcType.js';
import ObjType from '#/cache/config/ObjType.js';
import ParamType from '#/cache/config/ParamType.js';
import World from '#/engine/World.js';
import { canTravel } from '#/engine/GameMap.js';
import { CollisionType } from '#/engine/routefinder/index.js';

await H.boot();

const GREEGREE = 'mm_monkey_greegree_for_normal_monkey';
const CAPTORS = ['mm_duke', 'mm_oipuis', 'mm_ouhai', 'mm_uodai', 'mm_uyoro', 'mm_monkey_guard'];
const CAPTOR_IDS = new Set(CAPTORS.map(n => NpcType.getId(n)));

/** every live npc of the capture cast within $r of a tile */
function captorsNear(x: number, z: number, r = 12): number {
    let n = 0;
    for (const npc of World.npcs) {
        if (!npc || !CAPTOR_IDS.has(npc.type)) continue;
        if (Math.abs(npc.x - x) <= r && Math.abs(npc.z - z) <= r) n++;
    }
    return n;
}

/** Captors live for a hundred ticks, so one scenario's ambush is still standing in the next one's
 *  street. Every section starts from an empty Marim. */
/** ~chatnpc text reaches the harness as an interface line, not as a game message, so a dialogue
 *  assertion has to read H.ifaces - talk()'s own return is empty for these. */
function saidInChat(from: number, text: string): boolean {
    return H.ifaces.slice(from).some(f => (f.text ?? '').includes(text));
}

function clearCaptors() {
    const doomed: any[] = [];
    for (const npc of World.npcs as any) {
        if (npc && CAPTOR_IDS.has(npc.type)) doomed.push(npc);
    }
    for (const npc of doomed) World.removeNpc(npc, -1);
}

function pocket(level: number, x: number, z: number, cap = 400): number {
    const seen = new Set<string>([x + ',' + z]);
    const q: [number, number][] = [[x, z]];
    const DIRS: [number, number][] = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1]
    ];
    while (q.length && seen.size < cap) {
        const [cx, cz] = q.shift()!;
        for (const [dx, dz] of DIRS) {
            const k = cx + dx + ',' + (cz + dz);
            if (seen.has(k) || !canTravel(level, cx, cz, dx, dz, 1, 0, CollisionType.NORMAL)) continue;
            seen.add(k);
            q.push([cx + dx, cz + dz]);
        }
    }
    return seen.size;
}

// ---------------------------------------------------------------- 1. the cell
// The whole point of an arrest is that you are somewhere you have to get out of. 2771,2794 is the
// cell; 2779,2794 is what ^mm_jail_cell used to say, and it is in Marim.
console.log('THE CELL IS A SEALED ROOM AND 2779,2794 NEVER WAS');
check('  2771,2794 is a 21-tile room', pocket(0, 2771, 2794), 21);
check('  2779,2794 is in the open (400+)', pocket(0, 2779, 2794) >= 400, true);
check('  2771,2796, outside the door, is in the open', pocket(0, 2771, 2796) >= 400, true);

// ---------------------------------------------------------------- the configs
console.log('\nSEVEN LEVEL-149 MONSTERS THAT HAD NO STATS');
// NpcType.stats is indexed by NpcStat: ATTACK, DEFENCE, STRENGTH, HITPOINTS, RANGED, MAGIC.
// The engine default is 1 across the board, which is what all seven of these had.
for (const name of [...CAPTORS, 'mm_padulah']) {
    const st = (NpcType.get(NpcType.getId(name)) as any).stats as number[];
    check(`  ${name.padEnd(18)} att/def/str/hp/mage`, [st[0], st[1], st[2], st[3], st[5]], [130, 130, 130, 130, 130]);
}
{
    const guard: any = NpcType.get(NpcType.getId('mm_monkey_guard'));
    check('  the ninja Monkey Guard can walk', guard.moverestrict, 0);
}
console.log('\nAND THE BONES THEY DROP');
{
    const DEATH_DROP = ParamType.getId('death_drop');
    const dropOf = (npc: string) => (NpcType.get(NpcType.getId(npc)).params as Map<number, number | string>).get(DEATH_DROP);
    // Small for the guards, medium for the five named and for Padulah: "unlike the named ninja
    // monkeys, the monkey guards only drop small ninja monkey bones", and a medium ninja greegree
    // is carved from the medium ones.
    for (const [npc, want] of [
        ['mm_monkey_guard', 'mm_small_ninja_monkey_bones'],
        ['mm_padulah', 'mm_medium_ninja_monkey_bones'],
        ['mm_duke', 'mm_medium_ninja_monkey_bones'],
        ['mm_oipuis', 'mm_medium_ninja_monkey_bones']
    ] as [string, string][]) {
        check(`  ${npc.padEnd(18)} drops ${want}`, dropOf(npc), ObjType.getId(want));
    }
}

// ---------------------------------------------------------------- every silent Talk-to answers now
console.log('\nTWENTY-TWO SILENT TALK-TOS');
{
    const SILENT = [
        'mm_aberab',
        'mm_bonzara',
        'mm_bunkdo',
        'mm_bunkwicket',
        'mm_carado',
        'mm_denadu',
        'mm_dugopul',
        'mm_hafuba',
        'mm_karam',
        'mm_karam_talker',
        'mm_lofu',
        'mm_lumo',
        'mm_murowoi',
        'mm_padulah',
        'mm_sleeping_monkey_guard',
        'mm_trefaji',
        'mm_uwogo',
        'mm_waymottin',
        'mm_solihib',
        'mm_ifaba',
        'mm_hamab',
        'mm_tutab'
    ];
    let missing = 0;
    for (const n of SILENT) {
        if (!ScriptProvider.getByName(`[opnpc1,${n}]`)) {
            console.log(`  --   ${n} still says nothing`);
            missing++;
        }
    }
    check(`  all ${SILENT.length} have an [opnpc1]`, missing, 0);
    // the three in the cells need the approach as well - no tile outside the bars is adjacent
    for (const n of ['mm_lumo', 'mm_bunkdo', 'mm_carado']) {
        check(`  ${n} also answers an approach`, !!ScriptProvider.getByName(`[apnpc1,${n}]`), true);
    }
    check('  and every tile beside Lumo is inside his own cell', pocket(0, 2776, 2797) < 20, true);
}

// ---------------------------------------------------------------- 2, 3 and 4. the ambush
// THE SPAWN LANDS ON TICK FOUR. The script screams, waits two ticks and then puts them down, so a
// probe that looks after six ticks sees an empty street and calls the whole thing dead. They then
// walk in and one of them swings, which is the arrest - so this one test covers the ambush, the
// hit and the cell together, and does it through a real Talk-to rather than by queueing anything.
console.log('A HUMAN WHO SPEAKS TO A MONKEY IS SET UPON, AND THE HIT IS THE ARREST');
{
    clearCaptors();
    const p: any = player('cap_human', 2802, 2764, 0);
    H.maxOut(p);
    H.setVar(p, 'tutorial', 1000);
    H.setVar(p, 'mm_guards_cooldown', 0);
    H.setVarBit(p, 'mm_jail_count', 3);
    H.tick(2);
    const street: [number, number] = [p.x, p.z];
    const from = mark();
    const i0 = H.ifaces.length;
    talk(p, 'mm_uwogo', [], 1, true);
    check('  Uwogo does not talk to a human', saidInChat(i0, 'Nobody is new'), false);

    let most = 0;
    for (let i = 0; i < 16; i++) {
        H.tick(1);
        most = Math.max(most, captorsNear(street[0], street[1]));
    }
    check(`  something comes for you (${most} of them)`, most >= 2, true);
    check('  one named monkey and one or two guards, no more', most <= 3, true);
    check('  the cooldown is set', H.getVar(p, 'mm_guards_cooldown') > 0, true);
    check('  one of them clubs you', said(p, from, 'flat of a scimitar'), true);
    check('  and you wake up in the cell', [p.x, p.z, p.level], [2771, 2794, 0]);
    check('  which Lumo adds to the count', H.getVarBit(p, 'mm_jail_count'), 4);
    H.despawn(p);
}

// A WALK ACROSS MARIM IS ONE AMBUSH. Five shopkeepers and six other monkeys in one village, so
// without %mm_guards_cooldown a player who clicks each of them in turn gathers a dozen level-149
// monkeys on one tile.
console.log('\nAND A SECOND MONKEY IN THE SAME MINUTE IS NOT A SECOND AMBUSH');
{
    clearCaptors();
    const p: any = player('cap_cooled', 2802, 2764, 0);
    H.maxOut(p);
    H.setVar(p, 'tutorial', 1000);
    H.setVar(p, 'mm_guards_cooldown', World.currentTick + 200);
    H.tick(2);
    const street: [number, number] = [p.x, p.z];
    const before = captorsNear(street[0], street[1]);
    talk(p, 'mm_uwogo', [], 1, true);
    let most = 0;
    for (let i = 0; i < 10; i++) {
        H.tick(1);
        most = Math.max(most, captorsNear(street[0], street[1]));
    }
    check('  nothing new comes', most, before);
    H.despawn(p);
}

// ---------------------------------------------------------------- 5. a monkey is served
console.log('\nA MONKEY IS SERVED');
{
    clearCaptors();
    const p: any = player('cap_monkey', 2802, 2764, 0);
    H.maxOut(p);
    H.setVar(p, 'tutorial', 1000);
    H.setVar(p, 'mm_guards_cooldown', 0);
    H.equip(p, { rhand: GREEGREE });
    H.give(p, 'mm_amulet_of_monkey_speak', 1);
    H.equip(p, { front: 'mm_amulet_of_monkey_speak' });
    H.tick(2);
    const before = captorsNear(p.x, p.z);
    const i0 = H.ifaces.length;
    talk(p, 'mm_uwogo', [], 1, true);
    H.tick(10);
    check('  Uwogo talks to a monkey', saidInChat(i0, 'Nobody is new'), true);
    check('  and nothing comes for it', captorsNear(p.x, p.z), before);
    H.despawn(p);
}

// ---------------------------------------------------------------- 6. the greegree ends a fight
console.log('\nAND A GREEGREE PUT BACK ON ENDS ONE THAT HAS STARTED');
{
    clearCaptors();
    const p: any = player('cap_switch', 2755, 2798, 0);
    H.maxOut(p);
    H.setVar(p, 'tutorial', 1000);
    H.tick(2);
    const npc = H.addNpc('mm_duke', 2756, 2798);
    H.setNpcVar(npc, 'npc_aggressive_player', (p as any).uid);
    H.setNpcMode(npc, 'OPPLAYER2', p);
    H.tick(3);
    check('  Duke is in the world and after you', !!World.getNpc(npc.nid), true);

    H.equip(p, { rhand: GREEGREE });
    H.tick(10);
    check('  and is gone the moment you are a monkey again', !!World.getNpc(npc.nid), false);
    H.despawn(p);
}

// ---------------------------------------------------------------- Karam
// "He instantly kills any monkeys trying to apprehend the player, as long as he can see both the
// player and those monkeys." He has stood in Marim since the quest was built with nothing to do,
// and this is both what he is for and how a player farms the bones: stand where Karam can see you,
// then take the greegree off.
console.log('\nAND KARAM KILLS WHAT HE CAN SEE');
{
    clearCaptors();
    const karam = H.npcNear('mm_karam', 2765, 2775, 0) ?? H.npcNear('mm_karam', 2754, 2790, 0);
    check('  Karam is standing in Marim', !!karam, true);
    if (karam) {
        // The captor goes on the player's FAR side, not on Karam's other side: an npc blocks a tile,
        // so Karam standing between them means the captor never reaches the player, [ai_opplayer2]
        // never runs and the check fails for a reason that has nothing to do with Karam.
        const p: any = player('cap_karam', karam.x + 1, karam.z, 0);
        H.maxOut(p);
        H.setVar(p, 'tutorial', 1000);
        H.tick(2);
        const npc = H.addNpc('mm_duke', karam.x + 2, karam.z);
        H.setNpcVar(npc, 'npc_aggressive_player', p.uid);
        H.setNpcMode(npc, 'OPPLAYER2', p);
        // THE DISTANCE IS PINNED, NOT THE TILE, and that is the whole of what this check used to
        // get wrong. mm_karam has no moverestrict and wanders, and the scene was built once from
        // the tile he happened to be on - so by the time the loop below ran he had walked off, and
        // this reported "a captor beside him does not last: hp 130 at 2770,2780, Karam at
        // 2767,2776" about a captor that was four tiles from him on both axes. The claim being
        // made is a DISTANCE - mm_capture.rs2 asks `.npc_find(npc_coord, mm_karam,
        // ^mm_karam_reach, 1)` from the CAPTOR's own tile - so the scene is re-formed around
        // wherever Karam is each tick. Exactly the lesson tools/sim/mmaggro.ts records at length,
        // which is why this was worth fixing rather than deleting. DeathPlateau-Bugs#83.
        let dead = false;
        let last = '';
        let reformed = 0;
        for (let i = 0; i < 40 && !dead; i++) {
            const k: any = World.getNpc(karam.nid);
            const n0: any = World.getNpc(npc.nid);
            if (k && n0 && Math.max(Math.abs(n0.x - k.x), Math.abs(n0.z - k.z)) > 1) {
                p.teleport(k.x + 1, k.z, k.level);
                n0.teleport(k.x + 2, k.z, k.level);
                H.setNpcMode(n0, 'OPPLAYER2', p);
                reformed++;
                // A TICK TO LAND IT, as mmaggro needs for the same reason: a teleport moves the
                // coordinates and nothing else until the entity is processed.
                H.tick(1);
            }
            H.tick(1);
            const n: any = World.getNpc(npc.nid);
            dead = !n || n.levels[3] === 0;
            if (n && k) last = `hp ${n.levels[3]} at ${n.x},${n.z}, Karam at ${k.x},${k.z}, ${Math.max(Math.abs(n.x - k.x), Math.abs(n.z - k.z))} apart`;
        }
        check(`  and a captor beside him does not last (${last})`, dead, true);
        // AND THE RE-FORMING IS REPORTED, because "it died" over a scene that was never actually
        // beside Karam would be the same pass for the wrong reason.
        console.log(`       (Karam wandered, so the scene was re-formed around him ${reformed} times)`);
        H.despawn(p);
    }
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
