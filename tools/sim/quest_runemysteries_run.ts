// RUNE MYSTERIES, played through on foot.
//
// Quest 6 of the full quest-by-quest pass. Three towns, two long overland legs and one cellar: the
// Duke on the first floor of Lumbridge Castle, Sedridor under the Wizards' Tower, Aubury in his
// Varrock rune shop, and then back to Sedridor. The overland legs are declared with setpos - they
// are road, not quest - but every door, staircase and ladder between the street and the npc is
// clicked, because "talk to the Duke upstairs" is four doors and a staircase and any one of them
// could be the thing that is broken.
//
//   npx tsx tools/sim/quest_runemysteries_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

// The walk to Sedridor, from the tower's front step down to his cellar. It is done twice.
const toSedridor = (): any[] => [
    { setpos: [3109, 3171, 0], why: 'the road down past Lumbridge swamp to the tower island' },
    { loc: 'fai_wiztower_poor_door', at: [3109, 3167], why: "the tower's front door", soft: true },
    { go: [3108, 3163], why: 'across the entrance hall' },
    { loc: 'fai_wiztower_poor_door', at: [3107, 3162], why: 'the inner door to the west chamber', soft: true },
    { go: [3105, 3162], why: 'to the foot of the cellar ladder' },
    { loc: 'wizards_tower_laddertop', at: [3104, 3162], why: 'down into the cellar' },
    { go: [3108, 9571], why: 'round the cellar passage' },
    { loc: 'loc_1530', at: [3108, 9570], why: "the door into Sedridor's study", soft: true }
];

const m: Manifest = {
    quest: 'RUNE MYSTERIES',
    source: 'oldschool.runescape.wiki/w/Rune_Mysteries',
    stageVar: 'runemysteries',
    done: 6, // ^runemysteries_complete
    start: [3222, 3218, 0],
    steps: [
        { note: 'wiki: no requirements and no items. Everything is handed over in the dialogue.' },

        { note: 'wiki step 1: Duke Horacio, FIRST FLOOR of Lumbridge Castle. From the courtyard that is' },
        { note: 'the front door, the south corridor door, the south-west spiral staircase, and the door' },
        { note: 'off the first-floor corridor into his room.' },
        { loc: 'loc_1516', at: [3217, 3218], why: "the castle's front door" },
        { go: [3215, 3212], why: 'across the entrance corridor' },
        { loc: 'loc_1536', at: [3215, 3211], why: 'the door into the south corridor' },
        { go: [3205, 3209], why: 'west to the foot of the spiral staircase' },
        { loc: 'loc_1738', at: [3204, 3207], why: 'up to the first floor' },
        { go: [3207, 3221, 1], why: 'north up the first-floor corridor' },
        { loc: 'loc_1536', at: [3207, 3222], why: "the door into the Duke's room" },
        { talk: 'duke_of_lumbridge', picks: ['quests for me', 'Sure, no problem'], why: 'he hands over the talisman' },
        { stage: 1 },
        { has: 'air_talisman' },

        { note: 'wiki step 2: the Wizards Tower, south-west, and Sedridor in the cellar' },
        ...toSedridor(),
        { note: 'Handing the talisman over writes 2 before the errand is offered, and only "Yes,' },
        { note: 'certainly" goes on to 3. Decline and sedridor.rs2 leaves the quest at 2, where its' },
        { note: 'own dispatch sends the next talk back to @head_wizard_incredible and the same' },
        { note: 'question. So 2 is a stage a player can sit at, holding no talisman and no package,' },
        { note: 'and the panel was showing them leg 1 - travel to the tower and climb down to the' },
        { note: 'cellar they are already standing in. DeathPlateau-Bugs#16.' },
        { talk: 'head_wizard', picks: ['looking for the head wizard', 'here you are', "No, I'm busy."], why: 'he takes the talisman, and declining the errand leaves the quest at 2' },
        { stage: 2 },
        { hasnt: 'air_talisman' },

        { note: 'and talking to him again puts the errand back, which is what a player at 2 does' },
        { talk: 'head_wizard', picks: ['Yes, certainly'], why: 'accept it this time, and take the research package' },
        { stage: 3 },
        { hasnt: 'air_talisman' },
        { has: 'research_package' },

        { note: 'wiki step 3: Aubury, in the rune shop in south-east Varrock. He is also the Runecraft' },
        { note: 'skillcape seller, so a 99 player is offered the cape before the quest dialogue - which' },
        { note: 'is why the first pick here is "Something else."' },
        { loc: 'wizards_tower_ladder', at: [3103, 9576], why: 'back up out of the cellar' },
        { setpos: [3253, 3402, 0], why: 'Draynor, round the manor, Barbarian Village, then east to Varrock' },
        { go: [3253, 3397], why: 'in through the rune shop door' },
        { talk: 'aubury', picks: ['Something else', 'package for you'], why: 'hand over the package' },
        { stage: 4 },
        { hasnt: 'research_package' },

        { note: 'wiki step 3: "then speak to him again" - the notes come on the second conversation' },
        { talk: 'aubury', picks: ['Something else'], why: 'and he gives you his research notes' },
        { stage: 5 },
        { has: 'research_notes' },

        { note: 'wiki step 4: back to Sedridor with the notes' },
        ...toSedridor(),
        { talk: 'head_wizard', why: 'the whole Rune Essence story, and the quest completes' },
        { stage: 6 },
        { hasnt: 'research_notes' },
        { has: 'air_talisman' }
    ]
};

const p: any = H.makePlayer('runemyst', m.start[0], m.start[1]);
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
