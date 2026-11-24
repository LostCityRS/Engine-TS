// WANTED!: the orb has to name the place Solus is actually standing in.
// Usage: NODE_MEMBERS=true npx tsx tools/sim/wantedhunt.ts   (exit code is the verdict)
//
// Two reports, one bug. DeathPlateau-Bugs#97 - "wanted! quest. tile 'solus dellagar' around me.
// commorb doesnt work" - and DeathPlateau-Bugs#98 - "wanted! quest is written incorrectly. can't
// find solus based off the clues". The hunt machinery works: a scan sets one of twelve
// %wanted_missionN bits, each [wanted_solusN] shell carries multivar=wanted_missionN and
// multinpc=1,wanted_solus, and talking to the shell clears the bit and counts a sighting. All of
// that was verified before anything was changed.
//
// WHAT WAS WRONG IS THE PROSE. ~wanted_place_name named a town and for seven of the twelve Solus
// was somewhere else. The two that mattered most:
//
//   shell 6  2948,3146 is Musa Point on KARAMJA - the orb said "Rimmington", whose map label is
//            seventy-six tiles away across water.
//   shell 10 3100,3279 is DRAYNOR VILLAGE - the orb said "Falador", a hundred and seventy off.
//
// The reporter on #97 was standing at 2569,3382, two tiles from shell 2, while the orb called that
// spot "west Ardougne" - a walled town eighty tiles south. Standing next to the man you are hunting
// while the orb names a different town is exactly "the commorb doesn't work".
//
// THIS FILE CHECKS THE NAME AGAINST THE WORLD, NOT AGAINST MY MEMORY. Every place is proved two
// ways: the spawn tile is where the table says, and the thing the name points at - a label in
// maps/labels.txt, which is the word the player reads on their own map, or a distinctive npc - is
// actually within a stated number of tiles of it.
import * as H from './harness.js';
import * as A from './a1lib.js';
import { check, R, player } from './a1lib.js';
import fs from 'fs';
import World from '#/engine/World.js';
import NpcType from '#/cache/config/NpcType.js';
import Environment from '#/util/Environment.js';

await H.boot();
H.loginOrder();

// The world map's own labels, which is what a player has to navigate by.
const labels: [string, number, number][] = [];
for (const line of fs.readFileSync(`${Environment.BUILD_SRC_DIR}/maps/labels.txt`, 'ascii').split(/\r?\n/)) {
    const m = /^=([^,]+),(\d+),(\d+),(\d+)/.exec(line.trim());
    if (m) labels.push([m[1].replace(/\//g, ' '), Number(m[2]), Number(m[3])]);
}
const labelNear = (x: number, z: number, name: string) => {
    const hit = labels.find(l => l[0] === name);
    if (!hit) return -1;
    return Math.max(Math.abs(hit[1] - x), Math.abs(hit[2] - z));
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

type Proof = { label: string; within: number } | { npc: string; within: number };
const PLACES: { n: number; at: [number, number]; says: string; proof: Proof }[] = [
    { n: 1, at: [2566, 3084], says: 'Yanille', proof: { label: 'Yanille', within: 20 } },
    // Named by what stands there, because the nearest label is forty tiles off and naming a town
    // eighty tiles south is the bug this file exists for.
    { n: 2, at: [2567, 3384], says: 'north of Ardougne', proof: { npc: 'Moss giant', within: 25 } },
    { n: 3, at: [2603, 3421], says: 'Fishing Guild', proof: { label: 'Fishing Guild', within: 25 } },
    { n: 4, at: [2691, 3496], says: "Seers' Village", proof: { label: "Seers's Village", within: 15 } },
    { n: 5, at: [2803, 3431], says: 'Catherby', proof: { label: 'Catherby', within: 25 } },
    { n: 6, at: [2948, 3146], says: 'Musa Point', proof: { npc: 'Luthas', within: 15 } },
    { n: 7, at: [3007, 3458], says: 'Dwarven Mine', proof: { label: 'Dwarven Mine', within: 25 } },
    { n: 8, at: [2974, 3742], says: 'Wilderness', proof: { label: 'The Forgotten Cemetary', within: 20 } },
    { n: 9, at: [3011, 3236], says: 'Port Sarim', proof: { label: 'Port Sarim', within: 40 } },
    { n: 10, at: [3100, 3279], says: 'Draynor Village', proof: { label: 'Draynor Village', within: 25 } },
    { n: 11, at: [3207, 3227], says: 'Lumbridge', proof: { label: 'Lumbridge', within: 40 } },
    { n: 12, at: [3279, 3496], says: 'Lumber Yard', proof: { label: 'Lumber Yard', within: 35 } }
];

const p: any = player('wanted', 2994, 3375, 0);
H.maxOut(p);
H.clearInv(p);

// READ THE NAME THE PLAYER READS, not the proc's return. H.runProc hands back the int stack and
// ~wanted_place_name returns a STRING, so calling it that way gives "" for all twelve - and an
// empty string passes every `name does not contain "Rimmington"` check in this file. Two of them
// did exactly that before this was noticed. Going through the orb costs a player each and tests the
// sentence that actually reaches the chatbox.
const orbCache = new Map<number, string>();
const orbSays = (n: number): string => {
    // Memoised: each call logs a player in, and a second call for the same shell would ask for a
    // username that is already online.
    const had = orbCache.get(n);
    if (had !== undefined) return had;
    const q: any = player('orb' + n, 2994, 3375, 0);
    H.maxOut(q);
    H.clearInv(q);
    H.setVarBit(q, 'wanted_main', 20); // ^wanted_briefed
    H.setVarBit(q, 'wanted_mission' + n, 1); // he is already there, so Scan reports rather than rolls
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
const nameOf = orbSays;

console.log('== every shell stands where the table says');
{
    for (const pl of PLACES) {
        const id = NpcType.getId('wanted_solus' + pl.n);
        const npc = World.npcs.find((n: any) => n && n.isActive && n.type === id);
        check(`wanted_solus${pl.n} is in the world`, npc !== undefined, true);
        if (npc) {
            // THEY WANDER, so this is a radius and not a tile. Asserting the exact spawn passed on
            // the first run of this file and failed on the next, because by then the shells had
            // each drifted one to three tiles - the run logs twelve players in before it gets here
            // and that is plenty of ticks. The radius is what the table needs to stay true: the
            // landmark proofs below are measured from the recorded tile, so the npc has to still
            // be near it.
            const drift = Math.max(Math.abs(npc.x - pl.at[0]), Math.abs(npc.z - pl.at[1]));
            check(`  ...within a few tiles of ${pl.at[0]},${pl.at[1]} (drifted ${drift})`, drift <= 8 && npc.level === 0, true);
        }
    }
}

console.log('\n== and the orb names a landmark that is really beside it');
{
    for (const pl of PLACES) {
        const said = nameOf(pl.n);
        check(`shell ${pl.n} is called "${said}"`, said.includes(pl.says), true);
        if ('label' in pl.proof) {
            const d = labelNear(pl.at[0], pl.at[1], pl.proof.label);
            check(`  ...and the "${pl.proof.label}" map label is ${d} tiles away`, d >= 0 && d <= pl.proof.within, true);
        } else {
            const d = npcNearName(pl.at[0], pl.at[1], pl.proof.npc);
            check(`  ...and a ${pl.proof.npc} stands ${d} tiles away`, d >= 0 && d <= pl.proof.within, true);
        }
    }
}

console.log('\n== the two that sent players to the wrong town, by name');
{
    // Kept as their own checks because they are the reports, and a table is easy to edit back.
    const six = nameOf(6);
    const ten = nameOf(10);
    const two = nameOf(2);
    // THE EMPTY-STRING TRAP, written down because this file fell into it: "the name does not say
    // Rimmington" is true of a name that says nothing at all. Each of the three asserts it read a
    // sentence before it asserts what the sentence lacks.
    check('the orb actually said something for shell 6', six.length > 20, true);
    check('Musa Point is not called Rimmington', six.includes('Rimmington'), false);
    check('  ...and the Rimmington label really is a long way off', labelNear(2948, 3146, 'Rimmington') > 60, true);
    check('the orb actually said something for shell 10', ten.length > 20, true);
    check('Draynor Village is not called Falador', ten.includes('Falador'), false);
    check('  ...and the Falador label really is a long way off', labelNear(3100, 3279, 'Falador') > 100, true);
    check('the orb actually said something for shell 2', two.length > 20, true);
    check('the walled town is not named for a tile outside it', two.includes('west Ardougne'), false);
}

console.log('\n== and the hunt still works end to end');
{
    // The machinery was never the bug, but a name change that broke the chase would be worse than
    // the names. Scan, walk to whichever shell lit up, talk, and the sighting has to count.
    H.setVarBit(p, 'wanted_main', 20); // ^wanted_briefed
    H.give(p, 'wanted_crystal_ball');
    H.tick(2);
    H.clearLogs();
    H.opheld(p, 'wanted_crystal_ball', 1);
    for (let t = 0; t < 30 && !p.activeScript; t++) H.tick(1);
    A.drive(p);
    H.tick(5);
    let lit = 0;
    for (let i = 1; i <= 12; i++) if (H.getVarBit(p, 'wanted_mission' + i) === 1) lit = i;
    check('a scan puts him somewhere', lit > 0, true);
    const said = H.ifaces
        .filter(i => i.who === p.username && i.kind === 'text' && i.text)
        .map(i => i.text!)
        .join(' ');
    check('  ...and the orb says where, in the words this file pins', said.includes(PLACES[lit - 1].says), true);

    const id = NpcType.getId('wanted_solus' + lit);
    const npc = World.npcs.find((n: any) => n && n.isActive && n.type === id)!;
    p.teleport(npc.x + 1, npc.z, npc.level);
    H.tick(2);
    check('  ...Talk-to is on his menu when you get there', H.npcOpWord(p, npc, 1), 'Talk-to');
    H.opNpc(p, npc, 1);
    for (let t = 0; t < 30 && !p.activeScript; t++) H.tick(1);
    A.drive(p);
    H.tick(8);
    check('  ...talking makes him jump', H.getVarBit(p, 'wanted_mission' + lit), 0);
    check('  ...and the sighting is counted', H.getVarBit(p, 'wanted_mission' + lit + 'complete'), 1);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
