// WITCH'S HOUSE, played through on foot.
//
// Quest 32 of the quest-by-quest pass. A boy's ball is locked in the witch's shed. The house is a
// chain of locked things: a key under the flower pot, a magnet in the cellar behind an electrified
// gate, a mouse that has to be lured out with cheese and fitted with the magnet to unlock the back
// door, the diary upstairs, the shed key in the fountain, and the experiment in the shed, which has
// to be killed four times over.
//
//   npx tsx tools/sim/quest_ball_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const SHED: [number, number] = [2934, 3463];

const m: Manifest = {
    quest: "WITCH'S HOUSE",
    source: 'oldschool.runescape.wiki/w/Witch%27s_House',
    stageVar: 'ballquest',
    done: 7, // ^ball_complete
    start: [2927, 3456, 0],
    steps: [
        { note: 'leather gloves for the electrified gate (the wiki says to search the cellar boxes' },
        { note: 'for a pair) and a cheese for the mouse' },
        { give: 'leather_gloves' },
        { give: 'cheese' },
        { held: 'leather_gloves', op: 2, why: 'wear them - the gate shocks bare hands' },
        { worn: 'leather_gloves' },

        { note: 'wiki step 1: the boy by the east entrance to Taverley' },
        { talk: 'ballboy', picks: ["What's the matter", "Ok, I'll see what I can do"], want: 'Thanks', why: 'his ball is in the shed' },
        { stage: 1 },

        { note: 'wiki step 2: the key under the flower pot by the front door' },
        { setpos: [2900, 3475, 0], why: 'west and north around the hedge to the front door' },
        { loc: 'witchpot', at: [2900, 3474], want: 'key hidden under the flower pot', why: 'look under it' },
        { has: 'witches_doorkey' },

        { note: 'and the front door, which the key opens' },
        { go: [2900, 3473], exact: true, why: 'to the door' },
        { loc: 'witchhousedoor', at: [2901, 3473], why: 'unlock it' },
        { go: [2901, 3472], why: 'inside' },

        { note: 'wiki step 3: the cellar. The ladder is in the north room, through its own door,' },
        { note: 'and the magnet cupboard is behind an electrified gate.' },
        { go: [2902, 3474], why: 'to the north room door' },
        { loc: 'loc_1530', at: [2902, 3474], why: 'open it' },
        { go: [2906, 3476], why: 'through to the ladder' },
        { loc: 'loc_1754', at: [2907, 3476], why: 'down to the cellar' },
        { level: 0 },
        { go: [2903, 9873], why: 'west to the gate' },
        { loc: 'shockgater', at: [2902, 9873], why: 'through it, in gloves' },
        { go: [2899, 9873], why: 'to the cupboard' },
        { loc: 'magnetcbshut', at: [2898, 9873], why: 'open the cupboard' },
        { loc: 'magnetcbopen', at: [2898, 9873], want: 'find a magnet', why: 'take the magnet' },
        { stage: 2 },
        { has: 'magnet' },

        { note: 'wiki step 4: the mouse. Cheese on the hole in the south porch brings it out, and' },
        { note: 'the magnet on its harness unlocks the back door.' },
        { setpos: [2902, 3469, 0], why: 'back up the ladder into the house' },
        { go: [2902, 3468], why: 'to the porch door' },
        { loc: 'loc_1530', at: [2902, 3468], why: 'open it' },
        { go: [2903, 3467], why: 'into the porch' },
        { useLoc: 'witchmousehole', at: [2903, 3466], obj: 'cheese', want: 'A mouse runs out', why: 'the cheese' },
        { useNpc: 'witchrat', obj: 'magnet', want: 'whirring noise', why: 'the magnet on its harness' },
        { stage: 3 },

        { note: 'wiki step 5: the diary is upstairs, behind the door at the top, and reading it is' },
        { note: 'what the journal calls the next step' },
        { setpos: [2905, 3469, 0], why: 'back in and over to the stairs' },
        { loc: 'loc_1730', at: [2906, 3469], why: 'up them' },
        { level: 1 },
        { go: [2901, 3470], why: 'west along the landing' },
        { loc: 'loc_1530', at: [2901, 3471], why: 'the bedroom door' },
        { go: [2901, 3473], why: 'in to the dressers' },
        { take: 'witches_diary', r: 6, why: 'off the dresser' },
        { held: 'witches_diary', want: 'Pentember', why: 'read it - it names the fountain' },
        { stage: 5 },

        { note: 'wiki step 6: the back door is unlocked now, and the shed key is in the fountain.' },
        { note: 'The witch patrols the garden and teleports anybody she sees back out.' },
        { note: 'the garden is a hedge maze with one path round the outside: south from the porch,' },
        { note: 'east along the bottom, north up the far side and back west to the fountain' },
        { setpos: [2901, 3466, 0], why: 'down and out through the back door' },
        { loc: 'witchbackdoor', at: [2901, 3465], why: 'the back door the mouse unlocked' },
        { go: [2901, 3463], exact: true, why: 'into the garden, clear of the doorway' },
        // r IS HER RADIUS PLUS THE SLACK TO ALLOW HER, not a comfort distance: huntall(npc_coord,
        // 3, 0) is her reach and she covers a tile a tick, so 4 means "plan as though she may be
        // one tile closer than she looks". It was 8, which the old distance-only hold could never
        // wait out in a garden this size.
        { sneak: [2908, 3471], past: 'nora_t_hagg', r: 4, why: 'the long way round to the fountain, keeping out of her sight' },
        { loc: 'witchfountain', at: [2909, 3470], op: 2, want: 'small key', why: 'search it' },
        { has: 'witches_shedkey' },

        { note: 'wiki step 7: the shed, and the experiment. Reaching for the ball wakes it, and it' },
        { note: 'has to be killed four times over - a skavid, a spider, a bear and a wolf.' },
        { sneak: [2933, 3463], past: 'nora_t_hagg', r: 4, why: 'back round the maze to the shed' },
        { useLoc: 'witchsheddoor', at: SHED, obj: 'witches_shedkey', why: 'unlock it' },
        { go: [2935, 3461], why: 'in' },
        { take: 'ball', r: 6, soft: true, why: 'reaching for it wakes the shapeshifter instead' },
        { fight: ['shapeshifterglob', 'shapeshifterspider', 'shapeshifterbear', 'shapeshifterwolf'], untilvar: 'ballquest', to: 6, tries: 8, why: 'all four forms' },
        { stage: 6 },
        { take: 'ball', r: 6, why: 'and now the ball' },
        { has: 'ball' },

        { note: 'wiki step 8: the ball back to the boy' },
        { setpos: [2927, 3456, 0], why: 'out of the garden and back to Taverley' },
        { talk: 'ballboy', want: 'Thank you so much', why: 'hand it over' },
        { wait: 4, why: 'the completion is queued' },
        { stage: 7 },
        { hasnt: 'ball' }
    ]
};

const p: any = H.makePlayer('ballrun', m.start[0], m.start[1]);
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
