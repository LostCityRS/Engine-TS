// THE GOLEM, played through on foot.
//
// Quest 64 of the quest-by-quest pass. A clay golem has been standing in the ruins of Uzer for a
// very long time with one instruction - guard the city against the demon Thammaron - and the demon
// has been dead for most of that time. The quest is telling him so, which takes a letter, a dead
// archaeologist's notes, a statuette stolen out of the Varrock Museum, four statues turned the right
// way, a mushroom, a phoenix feather and a sheet of papyrus.
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_golem_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const GOLEM: [number, number, number] = [3491, 3089, 0];
const LETTER: [number, number] = [3479, 3092];
const STAIRS_TOP: [number, number] = [3492, 3090];
const STAIRS_TOP_SIDE: [number, number] = [3491, 3090];
const STAIRS_BASE: [number, number] = [2721, 4884];
const STAIRS_BASE_SIDE: [number, number] = [2720, 4884];
const MUSHROOMS: [number, number] = [2728, 4888];
const IMPLEMENT: [number, number] = [2713, 4913];
const ELISSA: [number, number, number] = [3378, 3426, 0];
const BOOKCASE: [number, number] = [3366, 3332];
const CURATOR: [number, number, number] = [3258, 3444, 0];
const CASE: [number, number] = [3261, 3450];
const PHOENIX: [number, number, number] = [3416, 3161, 0];
const ALCOVE: [number, number] = [2725, 4896];
const STATUE_A: [number, number] = [2718, 4899];
const STATUE_B: [number, number] = [2718, 4896];
const PORTAL: [number, number] = [2720, 4912];
const DEMON_PORTAL: [number, number] = [2719, 4883];

const m: Manifest = {
    quest: 'THE GOLEM',
    source: 'oldschool.runescape.wiki/w/The_Golem',
    stageVar: 'golem_a',
    done: 10,
    start: GOLEM,
    steps: [
        { note: 'requirements: Crafting 20 to repair him and Thieving 25 for the curator and the' },
        { note: 'phoenix. Neither is needed to start.' },
        { give: 'softclay', n: 4 },
        { give: 'vial_empty' },
        { give: 'pestle_and_mortar' },
        { give: 'papyrus' },

        { note: 'wiki steps 2-3: the broken golem, and four lots of soft clay' },
        { talk: 'golem_golem', picks: ['Shall I try to repair you?'], want: 'clay', why: 'he is in pieces' },
        { stage: 1 },
        { useNpc: 'golem_golem', obj: 'softclay', want: 'clay to the golem', why: 'his wounds' },
        { useNpc: 'golem_golem', obj: 'softclay', want: 'legs', why: 'his legs' },
        { useNpc: 'golem_golem', obj: 'softclay', want: 'nearly whole', why: 'nearly' },
        { useNpc: 'golem_golem', obj: 'softclay', why: 'and the last of it' },
        { stage: 2 },

        { note: 'wiki step 4-5: he knows the portal wants four statuettes and not which way round,' },
        { note: "and Elissa's letter is lying in the sand behind him" },
        { talk: 'golem_golem', picks: ['How do I open the portal?'], want: 'statuette', why: 'what he knows' },
        { go: [LETTER[0], LETTER[1]], exact: true, r: 40, why: 'to the letter' },
        { take: 'golem_letter', r: 6, why: 'off the sand' },
        { held: 'golem_letter', want: 'Elissa', why: 'read it' },
        { varis: 'golem_b', to: 1 },

        { note: 'wiki steps 6-8: down into the temple for a black mushroom and the strange' },
        { note: 'implement, which is a ground spawn in the far corner and the only thing that opens' },
        { note: "the golem's head" },
        { go: [STAIRS_TOP_SIDE[0], STAIRS_TOP_SIDE[1]], exact: true, r: 40, why: 'to the stairs' },
        { loc: 'golem_insidestairs_top', at: STAIRS_TOP, why: 'down' },
        { go: [MUSHROOMS[0] + 1, MUSHROOMS[1]], r: 40, why: 'to the mushrooms' },
        { loc: 'golem_black_mushrooms', at: MUSHROOMS, want: 'pick a mushroom', why: 'one is enough' },
        { has: 'golem_mushroom' },
        { go: [IMPLEMENT[0], IMPLEMENT[1]], r: 60, why: 'to the far corner' },
        { take: 'golem_golemkey', r: 6, why: 'the strange implement' },

        { note: "wiki steps 10-13: Elissa at the Digsite, her husband's notes in the Exam Centre," },
        { note: 'and back to Elissa' },
        { go: [STAIRS_BASE_SIDE[0], STAIRS_BASE_SIDE[1]], exact: true, r: 60, why: 'back to the stairs' },
        { loc: 'golem_insidestairs_base', at: STAIRS_BASE, why: 'up' },
        { setpos: ELISSA, why: 'to the Digsite' },
        { talk: 'golem_elissa', picks: ['I found a letter in the desert with your name on.'], want: 'notes', why: 'she names the Exam Centre' },
        { varis: 'golem_b', to: 2 },
        { setpos: [BOOKCASE[0], BOOKCASE[1] + 1, 0], why: 'to the Exam Centre' },
        { loc: 'golem_bookcase', at: BOOKCASE, want: 'notes', why: 'the south-east bookshelf' },
        { has: 'golem_notes' },
        { held: 'golem_notes', why: 'read them; the book is an interface, so golem_b is the proof' },
        { varis: 'golem_b', to: 3 },
        { setpos: ELISSA, why: 'back to Elissa' },
        { talk: 'golem_elissa', picks: ['Where is the statuette that Varmen took back from Uzer?'], want: 'museum', why: 'she names the museum' },
        { note: 'and this is where 3 comes from - golem_elissa.rs2:52 writes ^golem_finished_b when' },
        { note: 'she names the museum. curator.rs2:98 writes it too, for a player who goes straight' },
        { note: 'to the museum without her, which is why the scan found two sites for one value.' },
        { note: 'The route crossed it already and never wrote it down. DeathPlateau-Bugs#16.' },
        { stage: 3 },

        { note: 'wiki steps 14-16: the curator, his pocket, and display case thirty' },
        { setpos: CURATOR, why: 'to the Varrock Museum' },
        { talk: 'curator', picks: ["I'm looking for a statuette recovered from the city of Uzer.", 'I want to open a portal to the lair of an elder-demon'], want: 'statuette', why: 'he will not hand it over' },
        { talk: 'curator', op: 3, want: 'tiny key', why: 'so it comes out of his pocket' },
        { has: 'golem_statuettekey' },
        { setpos: [CASE[0], CASE[1] - 1, 1], why: 'upstairs to the cases' },
        { useLoc: 'golem_displaycase', at: CASE, obj: 'golem_statuettekey', want: 'retrieve the statuette', why: 'the fourth case along' },
        { has: 'golem_statuette' },

        { note: 'the phoenix by the clay mine, for a feather' },
        { setpos: PHOENIX, why: 'to the desert phoenix' },
        { talk: 'golem_phoenix', op: 3, want: 'feather', why: 'Thieving 25' },
        { has: 'golem_phoenixfeather' },

        { note: 'wiki steps 20-22: the statuette in the alcove, then the four statues. The alcove is' },
        { note: 'the fourth one, and the pattern is left, left, right, right - a and b turned once' },
        { note: 'each, c left alone, d turned once after the statuette goes in.' },
        { setpos: [STAIRS_TOP_SIDE[0], STAIRS_TOP_SIDE[1], 0], why: 'back to Uzer' },
        { loc: 'golem_insidestairs_top', at: STAIRS_TOP, why: 'down' },
        { go: [ALCOVE[0] - 1, ALCOVE[1]], r: 60, why: 'to the empty alcove' },
        { useLoc: 'golem_statuetted', at: ALCOVE, obj: 'golem_statuette', want: 'insert the statuette', why: 'into the alcove' },
        { stage: 4 },
        { go: [STATUE_A[0] + 1, STATUE_A[1]], r: 40, why: 'to the first statue' },
        { loc: 'golem_statuettea', at: STATUE_A, want: 'to the left', why: 'turn it' },
        { go: [STATUE_B[0] + 1, STATUE_B[1]], r: 40, why: 'to the second' },
        { loc: 'golem_statuetteb', at: STATUE_B, want: 'to the left', why: 'turn it' },
        { go: [ALCOVE[0] - 1, ALCOVE[1]], r: 40, why: 'back to the alcove' },
        { loc: 'golem_statuetted', at: ALCOVE, want: 'grinds open', why: 'and the fourth, which opens the door' },
        { stage: 5 },

        { note: 'wiki step 22: Thammaron has been dead for a very long time' },
        { go: [PORTAL[0], PORTAL[1] - 1], r: 60, why: 'to the portal' },
        { loc: 'golem_portal', at: PORTAL, want: 'horned skeleton', why: 'in' },
        { stage: 6 },
        { go: [DEMON_PORTAL[0], DEMON_PORTAL[1] + 1], r: 40, why: 'back to the portal' },
        { loc: 'golem_demon_portal', at: DEMON_PORTAL, want: 'step into the portal', why: 'out' },

        { note: 'wiki steps 24-28: he does not believe you, so the mushroom becomes ink, the' },
        { note: 'feather becomes a pen, the papyrus becomes a program, and the implement opens his' },
        { note: 'head long enough to put it in' },
        { go: [STAIRS_BASE_SIDE[0], STAIRS_BASE_SIDE[1]], exact: true, r: 60, why: 'back to the stairs' },
        { loc: 'golem_insidestairs_base', at: STAIRS_BASE, why: 'up' },
        { setpos: GOLEM, why: 'to the golem' },
        { talk: 'golem_golem', want: 'demon is dead', why: 'he will not take your word for it' },
        { note: 'and 7 with it. This is the stage a player is most likely to be stuck at in the' },
        { note: 'whole quest: the golem will only answer "Task incomplete" from here, and the way' },
        { note: 'out is to grind a mushroom into ink, make a quill of the feather, write YOUR TASK' },
        { note: 'IS DONE on the papyrus and open his head with the implement - none of which he' },
        { note: 'says. The panel was naming leg 6, "Go back to the portal. Enter Portal.", which is' },
        { note: 'behind them. DeathPlateau-Bugs#16.' },
        { stage: 7 },
        { use: ['pestle_and_mortar', 'golem_mushroom'], why: 'black dye in the vial' },
        { has: 'golem_ink' },
        { use: ['golem_ink', 'golem_phoenixfeather'], why: 'a quill' },
        { has: 'golem_pen' },
        { use: ['papyrus', 'golem_pen'], why: 'the new instructions' },
        { has: 'golem_program' },
        { useNpc: 'golem_golem', obj: 'golem_golemkey', want: 'skull hinges open', why: 'the implement' },
        { varis: 'golem_head_open', to: 1 },
        { wait: 3, why: 'let the first click settle' },
        { useNpc: 'golem_golem', obj: 'golem_program', want: 'New instructions', why: 'and the program, while the skull is still open' },
        { hasnt: 'golem_program' },
        { wait: 30, why: 'he reads it out loud before the completion is queued' },
        { stage: 10 }
    ]
};

const p: any = H.makePlayer('golrun', m.start[0], m.start[1]);
H.tick(2);
p.teleport(m.start[0], m.start[1], m.start[2]);
p.applyDamage = function () {};
H.setVar(p, 'macro_event', 1);
H.maxOut(p);
H.tick(1);

const res = play(m, p);
const bad = res.filter(r => !r.ok);
console.log('');
if (bad.length) {
    console.log('WHAT WENT WRONG');
    for (const r of bad) console.log('  step ' + r.n + '  ' + r.what + (r.detail ? '  -- ' + r.detail : ''));
}
process.exit(bad.length ? 1 : 0);
