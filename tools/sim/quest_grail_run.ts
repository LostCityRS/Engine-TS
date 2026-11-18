// HOLY GRAIL, played through on foot.
//
// Quest 51 of the quest-by-quest pass. The Grail has passed into Gielinor, none of Arthur's
// knights came back with it last time, and the way in is a whistle off a table in Draynor Manor
// blown under a tower on the Karamja peninsula. The thing on the bridge heals to full if the last
// blow is not Excalibur's.
//
//   npx tsx tools/sim/quest_grail_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const ARTHUR: [number, number, number] = [2764, 3515, 0];
const WORKSHOP_DOOR: [number, number] = [2764, 3503];
const MERLIN: [number, number, number] = [2766, 3500, 1];
const ENTRANA: [number, number, number] = [2850, 3351, 0];
const GALAHAD: [number, number, number] = [2611, 3474, 0];
const MANOR_DOOR: [number, number] = [3106, 3361];
const WHISTLE_SPOT: [number, number, number] = [3107, 3359, 2];
// The whistle only works in a four-by-four box under the tower on the Karamja peninsula.
const KARAMJA: [number, number, number] = [2741, 3235, 0];
const FISHERMAN: [number, number, number] = [2800, 4707, 0];
const FISHER_KING: [number, number, number] = [2762, 4689, 1];
const SACKS: [number, number] = [2962, 3506];

const m: Manifest = {
    quest: 'HOLY GRAIL',
    source: 'oldschool.runescape.wiki/w/Holy_Grail',
    stageVar: 'grail',
    done: 10, // ^grail_complete
    start: [2764, 3515, 0],
    steps: [
        { note: 'requirement: Merlin’s Crystal, which was already the gate on King Arthur offering' },
        { note: 'this at all, and 20 Attack, which nothing was asking for until now' },
        { setvar: 'arthur', to: 7, why: '^arthur_complete' },
        { give: 'excalibur' },
        { held: 'excalibur', op: 2, why: 'wield it - the Titan heals unless the last blow is Excalibur’s' },

        { note: 'wiki step 1: King Arthur at the round table' },
        { talk: 'king_arthur', picks: ['Tell me of this quest.', "I'd enjoy trying that."], want: 'speak to Merlin', why: 'he sets the quest' },
        { stage: 2 },

        { note: 'wiki step 2: Merlin, in the workshop next to the library. He is spawned by the door,' },
        { note: 'which is why he appears on the minimap only once you are through it.' },
        { setpos: [2764, 3504, 1], why: 'up the main staircase' },
        { loc: 'merlinworkshop', at: WORKSHOP_DOOR, why: 'open the workshop door' },
        { setpos: MERLIN, why: 'into the workshop' },
        { talk: 'merlin2', picks: ['Where can I find Sir Galahad?'], want: 'Galahad', why: 'what he knows about the Grail' },
        { stage: 3 },

        { note: 'wiki step 4: the High Priest on Entrana, who sends knights out searching' },
        { setpos: ENTRANA, why: 'to Entrana' },
        { talk: 'high_priest_of_entrana', picks: ['Ok, I will go searching.'], why: 'agree to go searching' },
        { note: 'and that talk is where stage 4 comes from, which took some finding. The header of' },
        { note: 'grail_crone.rs2 opens "THE CRONE IS NOT PLACED ANYWHERE ... stage 4 is a stage no' },
        { note: 'player can reach", and she is indeed in no jm2 NPC section - 0 spawns for npc 217.' },
        { note: 'But high_priest_of_entrana.rs2 npc_adds her beside him and jumps straight into her' },
        { note: 'dialogue, so her conversation - and the stage it writes - runs off HIS click. The' },
        { note: 'route below already went through him; it just never asserted what he moved.' },
        { note: 'DeathPlateau-Bugs#16.' },
        { stage: 4 },

        { note: 'wiki step 6: Galahad, west of McGrubor’s Wood, and the holy table napkin' },
        { setpos: GALAHAD, why: 'to Galahad’s house' },
        { talk: 'brother_galahad', picks: ['I seek an item from the realm of the Fisher King.'], why: 'the napkin' },
        { has: 'holy_table_napkin' },

        { note: 'wiki step 7: the southernmost room on Draynor Manor’s top floor. The whistles are' },
        { note: 'put on the table by the door, which is why they are not there until you go in.' },
        { setpos: [3106, 3362, 2], why: 'up to the top of Draynor Manor' },
        { loc: 'whistledoor', at: MANOR_DOOR, why: 'into the whistle room' },
        { setpos: WHISTLE_SPOT, why: 'to the table' },
        { take: 'magic_whistle', r: 3, why: 'the first whistle' },
        { take: 'magic_whistle', r: 3, soft: true, why: 'and the second, for Percival' },

        { note: 'wiki step 11: stand under the tower on the Karamja peninsula and blow it' },
        { setpos: KARAMJA, why: 'north-west of Brimhaven' },
        { held: 'magic_whistle', why: 'blow the whistle' },

        { note: 'wiki step 12: the Black Knight Titan on the bridge, who heals to full if the last' },
        { note: 'blow is not Excalibur’s - which is why Excalibur is the only weapon this run carries' },
        { worn: 'excalibur' },
        { note: 'beating him sets no var: ^grail_failed_defeat_titan (7) is the FAILURE stage, set' },
        { note: 'when the last blow was not Excalibur’s. Nothing records the kill, which matches the' },
        { note: 'quest - you fight him every time you enter the realm until Percival is found, and' },
        { note: 'after that the whistle lands you on the far side of him instead.' },
        { fight: 'black_knight_titan', tries: 3, r: 24, why: 'the Titan' },

        { note: 'wiki step 13: the fisherman, south along the river' },
        { setpos: FISHERMAN, why: 'south along the river' },
        { talk: 'grail_fisherman', picks: ['Any idea how to get into the castle?'], why: 'how to get into the castle' },

        { note: 'wiki step 14: the Grail bell off the ground by the bricks, rung in front of a maiden' },
        { note: 'he puts the bell on the ground by the bricks at 2762,4694 as he says it' },
        { setpos: [2762, 4695, 0], why: 'south-west to the bricks' },
        { take: 'grail_bell', r: 4, why: 'the bell' },
        { nearnpc: 'grail_maiden', r: 16, why: 'a maiden to ring it at' },
        { note: 'the maiden’s welcome and the teleport are a mesbox this step does not capture, so' },
        { note: 'what proves the ring worked is the Fisher King being reachable on the next step' },
        { held: 'grail_bell', why: 'ring it' },

        { note: 'wiki step 15: the Fisher King, and both of the options that matter' },
        { setpos: FISHER_KING, why: 'up to the Fisher King' },
        { talk: 'fisher_king', picks: ['I seek the Holy Grail.', "You don't look too well."], want: 'known as Percival', why: 'the Grail and his son' },
        { stage: 8 },

        { note: 'wiki step 16-19: Arthur’s feather, the sacks in Goblin Village, and Percival' },
        { setpos: ARTHUR, why: 'back to Camelot' },
        { talk: 'king_arthur', why: 'the magic gold feather' },
        { has: 'magic_golden_feather' },
        { setpos: [2962, 3507, 0], why: 'north to Goblin Village' },
        { loc: 'percy_sacks', at: SACKS, op: 2, picks: ['Come with me, I shall make you a king.'], want: 'hardly breathe', why: 'open the sack' },
        { stage: 9 },

        { note: 'wiki step 20-21: back to the realm - no Titan this time - and the Grail off the top' },
        { note: 'floor of the castle’s eastern tower' },
        { setpos: KARAMJA, why: 'back to Karamja' },
        { held: 'magic_whistle', why: 'blow the second whistle' },
        { note: 'the Grail sits on the top floor of the castle’s eastern tower, up the stairs at' },
        { note: '2768,4682 - and until now it sat nowhere at all, because no map placed one' },
        { setpos: [2768, 4684, 2], why: 'up the eastern tower' },
        { take: 'holy_grail', r: 4, why: 'the Holy Grail' },
        { has: 'holy_grail' },

        { note: 'wiki step 22: and Arthur, who did not expect it either' },
        { setpos: ARTHUR, why: 'back to Camelot' },
        { talk: 'king_arthur', want: 'splendid knight', why: 'hand it over' },
        { wait: 4, why: 'the completion is queued' },
        { stage: 10 }
    ]
};

const p: any = H.makePlayer('grailrun', m.start[0], m.start[1]);
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
