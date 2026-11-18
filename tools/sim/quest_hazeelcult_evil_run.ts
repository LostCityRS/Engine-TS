// HAZEEL CULT, played through on foot - the Hazeel side.
//
// The other half of quest 76. Clivet's version of the story is that the Carnilleans murdered Lord
// Hazeel and stole his house, and he is telling the truth. Side with the cult and the quest is a
// different quest: poison the family's dinner, take the mark of Hazeel, find the scroll the butler
// has been hunting for years, and watch a Mahjarrat climb out of a coffin.
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_hazeelcult_evil_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const CERIL: [number, number, number] = [2565, 3271, 0];
const VALVE1: [number, number] = [2562, 3247];
const VALVE2: [number, number] = [2572, 3263];
const VALVE3: [number, number] = [2585, 3245];
const VALVE4: [number, number] = [2597, 3263];
const VALVE5: [number, number] = [2609, 3243];
const CAVE: [number, number] = [2585, 3233];
const RAFT: [number, number] = [2567, 9679];
const ALOMONE: [number, number, number] = [2610, 9671, 0];
const CELLAR_DOWN: [number, number] = [2570, 3267];
const RANGE: [number, number] = [2564, 9672];
const CRATE: [number, number] = [2571, 9669];
const CELLAR_UP: [number, number] = [2570, 9667];
const _CELLARCELLAR: [number, number, number] = [2570, 9668, 0];
const JONES: [number, number, number] = [2569, 3272, 0];
const KNOCK: [number, number] = [2572, 3270];
const LADDER: [number, number] = [2573, 3271];
const UPSTAIRS: [number, number, number] = [2573, 3270, 1];
const CHEST: [number, number] = [2571, 3269];
const ATTIC: [number, number, number] = [2572, 3270, 2];

const m: Manifest = {
    quest: 'HAZEEL CULT (Hazeel side)',
    source: 'oldschool.runescape.wiki/w/Hazeel_Cult',
    stageVar: 'hazeelcultquest',
    done: 9, // ^hazeelcult_complete
    start: CERIL,
    steps: [
        { note: 'no requirements, no items, and on this side no fight at all.' },

        { note: 'wiki step 1: Ceril still starts it - he just does not get what he asked for' },
        {
            talk: 'sir_ceril_carnillean',
            picks: ["What's wrong?", "Yes, of course, I'd be happy to help."],
            want: 'cave entrance',
            why: 'the cult keeps breaking in'
        },
        { stage: 2 },

        { note: 'Route B step 1: Clivet, and this time you take him up on it' },
        { setpos: [CAVE[0], CAVE[1] - 1, 0], why: 'to the cave entrance in the forest' },
        { loc: 'hazeelcultcave', at: CAVE, hop: true, soft: true, why: 'into the cave' },
        { note: 'Clivet writes 3 before his question, and both answers are offered again by his own' },
        { note: 'case ^hazeelcult_spoken_clivet - so walking away on "I have heard enough of your' },
        { note: 'rubbish" leaves the quest at 3 for good. The table had no leg there and the panel' },
        { note: 'went on naming the leg before it. DeathPlateau-Bugs#16.' },
        { talk: 'clivet_hazeel_cultist', picks: ["I've heard enough of your rubbish."], want: 'Then leave, fool', why: 'walk away from him first, which leaves the quest at 3' },
        { stage: 3 },

        { note: 'and going back to him puts the same question, which is what a player at 3 does' },
        {
            talk: 'clivet_hazeel_cultist',
            picks: ['What do you mean?', 'So what would I have to do?', 'Ok, count me in.'],
            want: 'Pour it into their food',
            why: 'and he hands you poison'
        },
        { stage: 4 },
        { varis: 'hazeelcult_side', to: 1 },
        { has: 'poison' },

        { note: 'Route B steps 6-7: the kitchen is in the cellar, and so is the range' },
        { setpos: [CELLAR_DOWN[0] + 1, CELLAR_DOWN[1], 0], why: "to the Carnilleans' cellar stairs" },
        { loc: 'loc_1754', at: CELLAR_DOWN, hop: true, soft: true, why: 'down to the kitchen' },
        { go: [RANGE[0], RANGE[1] - 1], exact: true, r: 24, why: "to Claus's range" },
        { useLoc: 'carnilleanrange', at: RANGE, obj: 'poison', want: 'dissolves into the', why: 'poison the pot' },
        { stage: 5 },

        { note: 'Route B step 8: Ceril is mourning the dog that ate it' },
        { loc: 'loc_1755', at: CELLAR_UP, hop: true, soft: true, why: 'back up' },
        { setpos: CERIL, why: 'to Ceril on the ground floor' },
        { talk: 'sir_ceril_carnillean', want: 'Scruffy', why: 'his son fed his dinner to the dog' },

        { note: 'Route B step 9: Clivet pays you in the mark of Hazeel, which is the valve answer' },
        { setpos: [CAVE[0], CAVE[1] - 1, 0], why: 'back to the cave' },
        { loc: 'hazeelcultcave', at: CAVE, hop: true, soft: true, why: 'in' },
        { talk: 'clivet_hazeel_cultist', want: 'Sign Of Hazeel', why: 'you have proved your loyalty' },
        { has: 'mark_of_hazeel' },

        { note: 'Route B steps 3-5 and 10-11: the five valves, left to right as the amulet shows.' },
        { note: 'Only the one north of the cave - the cache’s sewervalve3 - goes left.' },
        { setpos: [VALVE1[0], VALVE1[1] + 1, 0], why: 'to the westernmost valve' },
        { loc: 'sewervalve1', at: VALVE1, op: 2, want: 'to the right', why: 'right' },
        { setpos: [VALVE2[0], VALVE2[1] + 1, 0], why: 'to the second' },
        { loc: 'sewervalve2', at: VALVE2, op: 2, want: 'to the right', why: 'right' },
        { setpos: [VALVE3[0], VALVE3[1] + 1, 0], why: 'to the one north of the cave' },
        { loc: 'sewervalve3', at: VALVE3, op: 1, want: 'to the left', why: 'LEFT' },
        { setpos: [VALVE4[0], VALVE4[1] + 1, 0], why: 'to the fourth' },
        { loc: 'sewervalve4', at: VALVE4, op: 2, want: 'to the right', why: 'right' },
        { setpos: [VALVE5[0], VALVE5[1] + 1, 0], why: 'to the fifth' },
        { loc: 'sewervalve5', at: VALVE5, op: 2, want: 'to the right', why: 'right' },
        { varis: 'hazeelcult_valves', to: 31 },

        { note: 'Route B step 12: Alomone sends you back for the scroll' },
        { setpos: [CAVE[0], CAVE[1] - 1, 0], why: 'to the cave' },
        { loc: 'hazeelcultcave', at: CAVE, hop: true, soft: true, why: 'in' },
        { go: [RAFT[0], RAFT[1] + 1], exact: true, r: 24, why: 'to the raft' },
        { loc: 'hazeelsewerraft', at: RAFT, hop: true, want: 'end of the sewer', why: 'board it' },
        { go: [ALOMONE[0], ALOMONE[1]], exact: true, r: 40, why: 'south to Alomone' },
        { talk: 'alomone_hazeel_cultist', want: 'assist us in finding', why: 'the scroll is in the mansion' },
        { stage: 6 },

        { note: 'Route B step 13: Jones has been looking for it for years and never found it' },
        { setpos: JONES, why: 'back to the butler' },
        { talk: 'butler_jones_hazeel_cultist', want: 'somewhere in this house', why: 'he cannot find it' },

        { note: 'Route B step 14: the chest key is in a crate in the cellar' },
        { setpos: [CELLAR_DOWN[0] + 1, CELLAR_DOWN[1], 0], why: 'to the cellar stairs' },
        { loc: 'loc_1754', at: CELLAR_DOWN, hop: true, soft: true, why: 'down' },
        { go: [CRATE[0] - 1, CRATE[1]], exact: true, r: 24, why: 'to the crate' },
        { loc: 'carnilleancrate', at: CRATE, want: 'rusty key', why: 'search it' },
        { has: 'carnilleanchestkey' },

        { note: 'Route B steps 15-16: knock on the wall in the east room, then up the ladder' },
        { loc: 'loc_1755', at: CELLAR_UP, hop: true, soft: true, why: 'back up' },
        { setpos: UPSTAIRS, why: "to the first floor's east room" },
        { loc: 'loc_2854', at: KNOCK, soft: true, want: 'secret passageway', why: 'knock on the wall' },
        { loc: 'ladder', at: LADDER, hop: true, soft: true, why: 'up the ladder' },
        { setpos: ATTIC, why: 'into the attic' },
        { useLoc: 'carnilleanshutchest', at: CHEST, obj: 'carnilleanchestkey', want: 'unlock', why: 'unlock the chest' },
        { loc: 'carnilleanopenchest', at: CHEST, want: 'Scroll of Hazeel', why: 'and take the scroll' },
        { stage: 7 },
        { has: 'hazeel_scroll' },

        { note: 'Route B step 17: Alomone reads it, and Hazeel climbs out of his coffin' },
        { setpos: [CAVE[0], CAVE[1] - 1, 0], why: 'to the cave' },
        { loc: 'hazeelcultcave', at: CAVE, hop: true, soft: true, why: 'in' },
        { go: [RAFT[0], RAFT[1] + 1], exact: true, r: 24, why: 'to the raft' },
        { loc: 'hazeelsewerraft', at: RAFT, hop: true, want: 'end of the sewer', why: 'board it' },
        { go: [ALOMONE[0], ALOMONE[1]], exact: true, r: 40, why: 'south to Alomone' },
        { talk: 'alomone_hazeel_cultist', want: 'glorious rebirth', why: 'hand over the scroll' },
        { wait: 12, why: 'Hazeel takes a few ticks to leave, and the queue finishes the quest' },
        { stage: 9 },
        { has: 'coins', n: 2000 }
    ]
};

const p: any = H.makePlayer('hazevil', m.start[0], m.start[1]);
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
