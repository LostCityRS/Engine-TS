// WANTED!: the hunt as Old School runs it - eighteen real places, and an ITEM for a clue.
// Usage: NODE_MEMBERS=true npx tsx tools/sim/wantedosrs.ts   (exit code is the verdict)
//
// DeathPlateau-Bugs#98 - "wanted! quest is written incorrectly. can't find solus based off the
// clues" - and #97, the reporter who stood two tiles from Solus while the orb named a different
// town. The earlier fix made the twelve names true. This checks the quest Old School actually has.
//
// THE CACHE WAS BUILT FOR IT. Nineteen [wanted_solusN] shells, nineteen mission bits, a decoy
// keyed on bit 3, a level-32 Black Knight config and six Temple Knight rank bits - and Old
// School's clue table has eighteen distinct places. Twelve shells at convenience tiles was the
// shortfall, not the ceiling.
//
// WHAT THIS FILE REFUSES TO TAKE ON TRUST:
//   - that a place is where the table says        -> the shell has to be standing near the tile
//   - that the tile is the place the clue claims  -> a landmark npc or the world map's own label
//                                                    has to be beside it
//   - that the orb gives a CLUE and not an answer -> the sentence must name the object and must
//                                                    not contain any of the eighteen place names
//   - that the seven stops are Old School's       -> 1, 3, 5, 7 fixed; 2, 4, 6 out of the pool
//   - that the fixed clues are the right three    -> blue cape, bone spear, twenty noted essence
import * as H from './harness.js';
import * as A from './a1lib.js';
import { check, R, player } from './a1lib.js';
import fs from 'fs';
import World from '#/engine/World.js';
import { isFlagged, CollisionFlag } from '#/engine/routefinder/index.js';
import NpcType from '#/cache/config/NpcType.js';
import Environment from '#/util/Environment.js';

await H.boot();
H.loginOrder();

const labels: [string, number, number][] = [];
for (const line of fs.readFileSync(`${Environment.BUILD_SRC_DIR}/maps/labels.txt`, 'ascii').split(/\r?\n/)) {
    const m = /^=([^,]+),(\d+),(\d+),(\d+)/.exec(line.trim());
    if (m) labels.push([m[1].replace(/\//g, ' '), Number(m[2]), Number(m[3])]);
}
const labelNear = (x: number, z: number, name: string) => {
    const hit = labels.find(l => l[0] === name);
    return hit ? Math.max(Math.abs(hit[1] - x), Math.abs(hit[2] - z)) : -1;
};
const npcNearName = (x: number, z: number, wantName: string) => {
    let best = -1;
    for (const npc of World.npcs) {
        if (!npc || !npc.isActive) continue;
        if (NpcType.get(npc.type)?.name !== wantName) continue;
        const d = Math.max(Math.abs(npc.x - x), Math.abs(npc.z - z));
        if (best === -1 || d < best) best = d;
    }
    return best;
};

const locNear = (x: number, z: number, locName: string) => {
    let best = -1;
    for (const l of H.locsNear(locName, x, z, 0)) {
        const d = Math.max(Math.abs(l.x - x), Math.abs(l.z - z));
        if (best === -1 || d < best) best = d;
    }
    return best;
};

type Proof = { label: string; within: number } | { npc: string; within: number } | { loc: string; within: number };
// shell -> tile, the place it is meant to BE, the word the clue sentence must carry, and a thing
// standing there that proves the place is what the clue says it is.
const PLACES: { n: number; at: [number, number]; place: string; clue: string; proof: Proof }[] = [
    { n: 1, at: [3487, 3485], place: 'Canifis', clue: '', proof: { npc: 'Roavar', within: 20 } },
    { n: 2, at: [3190, 3359], place: "Champions' Guild", clue: 'cape', proof: { npc: 'Guild master', within: 10 } },
    { n: 3, at: [3169, 9574], place: 'Lumbridge Swamp Caves', clue: 'bone', proof: { npc: 'Cave bug larva', within: 20 } },
    { n: 4, at: [2892, 4811], place: 'Rune essence mine', clue: 'Essence', proof: { loc: 'blankrunestone', within: 10 } },
    { n: 5, at: [3433, 3544], place: 'Slayer Tower', clue: 'earmuffs', proof: { npc: 'Banshee', within: 10 } },
    { n: 6, at: [2660, 3658], place: 'Rellekka', clue: 'Fremennik', proof: { npc: 'Askeladden', within: 10 } },
    { n: 7, at: [2940, 3155], place: 'Musa Point', clue: 'banana', proof: { npc: 'Luthas', within: 15 } },
    { n: 8, at: [3109, 3159], place: "Wizards' Tower", clue: "wizard's hat", proof: { npc: 'Wizard', within: 10 } },
    { n: 9, at: [2654, 3311], place: 'Ardougne Market', clue: 'Bear', proof: { npc: 'Silver merchant', within: 10 } },
    { n: 10, at: [2443, 3091], place: 'Castle Wars', clue: 'ticket', proof: { npc: 'Lanthus', within: 10 } },
    { n: 11, at: [2465, 3497], place: 'Grand Tree', clue: 'gnome tailoring', proof: { npc: 'King Narnode Shareen', within: 10 } },
    { n: 12, at: [2793, 3157], place: 'Brimhaven', clue: 'eye patch', proof: { label: 'Brimhaven', within: 40 } },
    { n: 13, at: [3282, 3215], place: 'Al Kharid', clue: 'beard', proof: { npc: 'Gem trader', within: 10 } },
    { n: 14, at: [2955, 3503], place: 'Goblin Village', clue: 'Goblin-sized', proof: { label: 'Goblin Village', within: 25 } },
    { n: 15, at: [2555, 3080], place: 'Dragon Inn', clue: "Greenman's", proof: { npc: 'Bartender', within: 10 } },
    { n: 16, at: [2666, 3506], place: "McGrubor's Wood", clue: 'worm', proof: { npc: 'Guard dog', within: 15 } },
    { n: 17, at: [3082, 3247], place: 'Draynor Village', clue: 'horse', proof: { label: 'Draynor Village', within: 40 } },
    { n: 18, at: [2464, 3228], place: 'Shrine of Scorpius', clue: 'unholy symbol', proof: { npc: 'Spirit of Scorpius', within: 10 } }
];
// The words the orb is NOT allowed to use. Naming the place is the bug; the clue is the object.
const PLACE_WORDS = [
    'Canifis',
    'Champions',
    'Lumbridge',
    'Rune essence',
    'Slayer Tower',
    'Rellekka',
    'Musa Point',
    'Wizards',
    'Ardougne',
    'Castle Wars',
    'Grand Tree',
    'Brimhaven',
    'Al Kharid',
    'Goblin Village',
    'Yanille',
    'McGrubor',
    'Draynor',
    'Scorpius',
    'Rimmington',
    'Falador',
    'Seers',
    'Catherby',
    'Port Sarim'
];

// Reads the sentence the player actually sees, through the orb. H.runProc hands back the INT stack
// and these procs return strings, so calling them directly gives "" - and "" passes every
// `does not contain "Draynor"` check in this file.
const orbCache = new Map<number, string>();
const orbSays = (n: number): string => {
    const had = orbCache.get(n);
    if (had !== undefined) return had;
    const q: any = player('orb' + n, 2994, 3375, 0);
    H.maxOut(q);
    H.clearInv(q);
    H.setVarBit(q, 'wanted_main', 20); // ^wanted_briefed
    H.setVarBit(q, 'wanted_mission' + n, 1);
    H.give(q, 'wanted_crystal_ball');
    H.tick(2);
    H.clearLogs();
    H.opheld(q, 'wanted_crystal_ball', 1);
    for (let t = 0; t < 30 && !q.activeScript; t++) H.tick(1);
    A.drive(q);
    H.tick(3);
    const said = H.ifaces
        .filter(i => i.who === q.username && i.kind === 'text' && i.text)
        .map(i => i.text!)
        .join(' ');
    orbCache.set(n, said);
    return said;
};

console.log('== every coord in the constant file decodes to the tile its own comment claims');
{
    // THIS CHECK EARNED ITS PLACE. Two coords in this file were packed by hand and both were
    // wrong - 0_46_53_38_16 is not 2966,3380 and 0_42_55_43_37 is not Camelot - and both decoded
    // to somewhere walkable, so nothing else here would have caught them. A level_mx_mz_lx_lz
    // literal is unreadable by eye, which is exactly why the comments beside them have to be held
    // to the numbers.
    const src = fs.readFileSync(`${Environment.BUILD_SRC_DIR}/scripts/quests/quest_wanted/configs/quest_wanted.constant`, 'ascii');
    const re = /^\^(\w+)\s*=\s*(\d+)_(\d+)_(\d+)_(\d+)_(\d+)\s*\/\/\s*(\d+),(\d+)/gm;
    let m: RegExpExecArray | null;
    let seen = 0;
    while ((m = re.exec(src))) {
        const [, name, l, mx, mz, lx, lz, cx, cz] = m;
        const x = (Number(mx) << 6) + Number(lx);
        const z = (Number(mz) << 6) + Number(lz);
        seen++;
        check(`^${name} is ${x},${z} as its comment says`, `${x},${z}`, `${cx},${cz}`);
        const blocked = isFlagged(x, z, Number(l), CollisionFlag.WALK_BLOCKED) || isFlagged(x, z, Number(l), CollisionFlag.FLOOR) || isFlagged(x, z, Number(l), CollisionFlag.FLOOR_DECORATION);
        check('  ...and that tile is not blocked', blocked, false);
    }
    // Eighteen places plus the two set-piece destinations. If the table shrinks, say so here.
    check('all twenty coords were read', seen, 20);
}

console.log('== all eighteen Old School places are placed, and the shell is standing on them');
for (const pl of PLACES) {
    const id = NpcType.getId('wanted_solus' + pl.n);
    const npc = World.npcs.find((n: any) => n && n.isActive && n.type === id);
    check(`wanted_solus${pl.n} (${pl.place}) is in the world`, npc !== undefined, true);
    if (npc) {
        // A radius, not a tile: the shells wander, and this run logs a player in per place.
        const drift = Math.max(Math.abs(npc.x - pl.at[0]), Math.abs(npc.z - pl.at[1]));
        check(`  ...within a few tiles of ${pl.at[0]},${pl.at[1]} (drifted ${drift})`, drift <= 8 && npc.level === 0, true);
    }
}

console.log('\n== and each tile really is the place its clue points at');
for (const pl of PLACES) {
    if ('label' in pl.proof) {
        const d = labelNear(pl.at[0], pl.at[1], pl.proof.label);
        check(`${pl.place}: the "${pl.proof.label}" map label is ${d} tiles away`, d >= 0 && d <= pl.proof.within, true);
    } else if ('loc' in pl.proof) {
        // The essence mine is the one place of the eighteen with no npc in it at all - it is a
        // cave full of rocks - so the rock is what proves it.
        const d = locNear(pl.at[0], pl.at[1], pl.proof.loc);
        check(`${pl.place}: a ${pl.proof.loc} is ${d} tiles away`, d >= 0 && d <= pl.proof.within, true);
    } else {
        const d = npcNearName(pl.at[0], pl.at[1], pl.proof.npc);
        check(`${pl.place}: a ${pl.proof.npc} stands ${d} tiles away`, d >= 0 && d <= pl.proof.within, true);
    }
}

console.log('\n== the orb hands over an OBJECT, and never the answer');
for (const pl of PLACES) {
    if (pl.n === 1) continue; // Canifis is where he is first seen; there is no clue to it
    const said = orbSays(pl.n);
    // Assert it spoke before asserting what it lacks - the empty-string trap this file is built to avoid.
    check(`${pl.place}: the orb says something`, said.length > 20, true);
    check(`  ...and it names the ${pl.clue}`, said.toLowerCase().includes(pl.clue.toLowerCase()), true);
    const leaked = PLACE_WORDS.filter(w => said.includes(w));
    check(`  ...and it does not name a place (${leaked.join(', ') || 'none'})`, leaked.length, 0);
}

console.log('\n== the three clues Old School fixes are on the three fixed stops');
check("stop 3 is the Champions' Guild, and its clue is a blue cape", orbSays(2).toLowerCase().includes('blue wool'), true);
check('stop 5 is the cave-goblin mine, and its clue is a bone spear', orbSays(3).toLowerCase().includes('made of bone'), true);
check('stop 7 is the essence mine, and its clue is twenty noted essence', orbSays(4).toLowerCase().includes('twenty lots'), true);

console.log('\n== scanning tells you he is HERE only when you are standing in the place');
{
    const q: any = player('scanner', 3487, 3485, 0); // Canifis, stop 1's tile
    H.maxOut(q);
    H.clearInv(q);
    H.setVarBit(q, 'wanted_main', 20);
    H.setVarBit(q, 'wanted_mission6', 1); // he is in Rellekka, a long way from Canifis
    H.give(q, 'wanted_crystal_ball');
    H.tick(2);
    const scan = () => {
        H.clearLogs();
        H.opheld(q, 'wanted_crystal_ball', 1);
        for (let t = 0; t < 30 && !q.activeScript; t++) H.tick(1);
        A.drive(q);
        H.tick(3);
        return H.ifaces
            .filter(i => i.who === q.username && i.kind === 'text' && i.text)
            .map(i => i.text!)
            .join(' ');
    };
    const far = scan();
    check('standing in the wrong place, the orb only repeats the clue', far.toLowerCase().includes('fremennik'), true);
    check('  ...and does not claim he is nearby', far.includes('He is here'), false);
    q.teleport(2660, 3658, 0); // Rellekka, where he actually is
    H.tick(2);
    const near = scan();
    check('standing in the right place, the orb says he is here', near.includes('He is here'), true);
}

console.log("\n== the seven stops are Old School's: 1, 3, 5, 7 fixed and 2, 4, 6 from the pool");
{
    const p: any = player('hunter', 3487, 3485, 0);
    H.maxOut(p);
    H.clearInv(p);
    H.give(p, 'wanted_crystal_ball');
    H.setVarBit(p, 'wanted_main', 10); // ^wanted_recruited, so Contact runs the briefing
    H.tick(2);
    // Contact: Savant briefs, and puts him in Canifis.
    H.opheld(p, 'wanted_crystal_ball', 2);
    for (let t = 0; t < 30 && !p.activeScript; t++) H.tick(1);
    A.drive(p);
    H.tick(4);
    const litNow = () => {
        for (let i = 1; i <= 18; i++) if (H.getVarBit(p, 'wanted_mission' + i) === 1) return i;
        return 0;
    };
    check('the briefing starts him in Canifis', litNow(), 1);
    check('  ...and the stage is hunting', H.getVarBit(p, 'wanted_main'), 30);

    const visited: number[] = [];
    const FIXED: Record<number, number> = { 1: 1, 3: 2, 5: 3, 7: 4 };
    for (let stop = 1; stop <= 7; stop++) {
        const lit = litNow();
        if (lit === 0) {
            check(`stop ${stop}: he is somewhere`, false, true);
            break;
        }
        visited.push(lit);
        if (FIXED[stop] !== undefined) {
            check(`stop ${stop} is the fixed place ${FIXED[stop]} (${PLACES[FIXED[stop] - 1].place})`, lit, FIXED[stop]);
        } else {
            check(`stop ${stop} is drawn from the pool (shell ${lit})`, lit >= 5 && lit <= 18, true);
        }
        const id = NpcType.getId('wanted_solus' + lit);
        const npc = World.npcs.find((n: any) => n && n.isActive && n.type === id)!;
        const hpBefore = p.levels[3];
        p.teleport(npc.x + 1, npc.z, npc.level);
        H.tick(2);
        check('  ...Talk-to is on his menu', H.npcOpWord(p, npc, 1), 'Talk-to');
        H.clearLogs();
        H.opNpc(p, npc, 1);
        for (let t = 0; t < 40 && !p.activeScript; t++) H.tick(1);
        A.drive(p);
        H.tick(12);
        check('  ...the sighting counts', H.getVarBit(p, 'wanted_mission' + lit + 'complete'), 1);
        // The set pieces, at the stops Old School puts them.
        if (stop === 2) {
            const d = Math.max(Math.abs(p.x - 2755), Math.abs(p.z - 3477));
            check(`  ...and stop 2 threw him to Camelot (${p.x},${p.z})`, d <= 10, true);
        }
        if (stop === 4) {
            check(`  ...and stop 4's Flames of Zamorak took most of his health (${hpBefore} -> ${p.levels[3]})`, p.levels[3] < hpBefore / 2, true);
            check('  ...and left him standing', p.levels[3] >= 1, true); // see the one-hitpoint run below for the real proof
            const d = Math.max(Math.abs(p.x - 2966), Math.abs(p.z - 3380));
            check(`  ...and Savant pulled him out to Falador (${p.x},${p.z})`, d <= 10, true);
        }
        if (stop === 5) {
            check(`  ...and stop 5's "hostage" cost him health (${hpBefore} -> ${p.levels[3]})`, p.levels[3] < hpBefore, true);
        }
        if (stop < 7) p.levels[3] = p.baseLevels[3]; // heal up, so stop 4's share is measured off full
    }
    check('seven stops, no place twice', new Set(visited).size, 7);
    check('he is cornered at the end', H.getVarBit(p, 'wanted_main'), 40);
    check('  ...and his hat is the proof', H.invCount(p, 'wanted_solus_trophy'), 1);
}

console.log('\n== and the quest journal does not give the answer away either');
{
    // Half of #98 was the journal: it said "The orb has him in <town>" straight out, so even with
    // the orb fixed a player could read the place off their own quest list.
    const q: any = player('journal', 2994, 3375, 0);
    H.maxOut(q);
    H.clearInv(q);
    H.setVarBit(q, 'wanted_main', 30); // hunting
    H.setVarBit(q, 'wanted_mission7', 1); // Musa Point - the banana
    H.tick(2);
    H.clearLogs();
    H.ifButton(q, 'questlist:wanted');
    for (let t = 0; t < 30 && !q.activeScript; t++) H.tick(1);
    A.drive(q);
    H.tick(3);
    const said = H.ifaces
        .filter(i => i.who === q.username && i.kind === 'text' && i.text)
        .map(i => i.text!)
        .join(' ');
    check('the journal says something', said.length > 40, true);
    check('  ...and it records the object he dropped', said.includes('Banana'), true);
    const leaked = PLACE_WORDS.filter(w => said.includes(w));
    check(`  ...and not where he is (${leaked.join(', ') || 'none'})`, leaked.length, 0);
}

console.log('\n== the Flames of Zamorak cannot kill, which is the whole point of them');
{
    // MEASURED AT 1 HITPOINT, because measuring it at full health proves nothing. stat_sub clamps
    // at 0, not at 1 (PlayerOps.ts STAT_SUB: Math.max(subbed, 0)), so the engine will NOT save the
    // player - the share has to be floored in the script. Removing that floor passed every other
    // check in this file at full health, so this is the one that holds it.
    const q: any = player('flames', 2994, 3375, 0);
    H.maxOut(q);
    H.clearInv(q);
    H.setVarBit(q, 'wanted_main', 30);
    // three sightings banked, so the next conversation is stop four
    for (const done of [1, 2, 3]) H.setVarBit(q, 'wanted_mission' + done + 'complete', 1);
    H.setVarBit(q, 'wanted_mission5', 1);
    H.give(q, 'wanted_crystal_ball');
    H.tick(2);
    const id = NpcType.getId('wanted_solus5');
    const npc = World.npcs.find((n: any) => n && n.isActive && n.type === id)!;
    q.teleport(npc.x + 1, npc.z, npc.level);
    q.levels[3] = 1;
    H.tick(2);
    check('he walks into the Flames on one hitpoint', q.levels[3], 1);
    H.opNpc(q, npc, 1);
    for (let t = 0; t < 40 && !q.activeScript; t++) H.tick(1);
    A.drive(q);
    H.tick(12);
    check('  ...the sighting still counts', H.getVarBit(q, 'wanted_mission5complete'), 1);
    check(`  ...and he is still standing (${q.levels[3]} hp)`, q.levels[3] >= 1, true);
    check('  ...and Savant still pulled him out to Falador', Math.max(Math.abs(q.x - 2966), Math.abs(q.z - 3380)) <= 10, true);
}

console.log('\n== and the decoy is at the cave-goblin mine, not in Ardougne');
{
    const id = NpcType.getId('wanted_solus_fake_woman');
    const npc = World.npcs.find((n: any) => n && n.isActive && n.type === id);
    check('the decoy is in the world', npc !== undefined, true);
    if (npc) {
        const d = Math.max(Math.abs(npc.x - 3169), Math.abs(npc.z - 9574));
        check(`  ...beside shell 3 in the swamp caves (${npc.x},${npc.z})`, d <= 8, true);
    }
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
