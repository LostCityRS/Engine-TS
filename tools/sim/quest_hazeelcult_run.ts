// HAZEEL CULT, played through on foot - the Carnillean side.
//
// Quest 76 of the quest-by-quest pass. Sir Ceril's house was built by Lord Hazeel, a Mahjarrat his
// ancestors murdered, and the cult in the sewer under Ardougne wants it back. You can take either
// side; this run takes Ceril's, which ends with the butler arrested. The Hazeel side is walked by
// quest_hazeelcult_evil_run.ts.
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_hazeelcult_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const CERIL: [number, number, number] = [2565, 3271, 0];
// The five sewer valves, west to east. The one the guide calls Valve 1 - "north of the cave" - is
// the cache's sewervalve3 at 2585,3245, and it is the only one turned LEFT.
const VALVE1: [number, number] = [2562, 3247];
const VALVE2: [number, number] = [2572, 3263];
const VALVE3: [number, number] = [2585, 3245];
const VALVE4: [number, number] = [2597, 3263];
const VALVE5: [number, number] = [2609, 3243];
const CAVE: [number, number] = [2585, 3233];
const RAFT: [number, number] = [2567, 9679];
const ALOMONE: [number, number, number] = [2610, 9671, 0];
const _STAIRSSTAIRS: [number, number] = [2570, 9683];
const UPSTAIRS: [number, number, number] = [2572, 3267, 1];
const CUPBOARD: [number, number] = [2573, 3267];

const m: Manifest = {
    quest: 'HAZEEL CULT',
    source: 'oldschool.runescape.wiki/w/Hazeel_Cult',
    stageVar: 'hazeelcultquest',
    done: 9, // ^hazeelcult_complete
    start: CERIL,
    steps: [
        { note: 'no requirements, no items. The only fight is Alomone, a level 13 cultist.' },

        { note: 'wiki step 1: Ceril wants his stolen armour back' },
        {
            talk: 'sir_ceril_carnillean',
            picks: ["What's wrong?", "Yes, of course, I'd be happy to help."],
            want: 'cave entrance',
            why: 'the cult keeps breaking in'
        },
        { stage: 2 },

        { note: 'wiki step 2: five sewer valves, and only the one north of the cave goes left' },
        { setpos: [VALVE1[0], VALVE1[1] + 1, 0], why: 'to the westernmost valve' },
        { loc: 'sewervalve1', at: VALVE1, op: 2, want: 'to the right', why: 'right' },
        { setpos: [VALVE2[0], VALVE2[1] + 1, 0], why: 'to the second' },
        { loc: 'sewervalve2', at: VALVE2, op: 2, want: 'to the right', why: 'right' },
        { setpos: [VALVE3[0], VALVE3[1] + 1, 0], why: 'to the one north of the cave' },
        { loc: 'sewervalve3', at: VALVE3, op: 1, want: 'to the left', why: 'LEFT - this is the odd one' },
        { setpos: [VALVE4[0], VALVE4[1] + 1, 0], why: 'to the fourth' },
        { loc: 'sewervalve4', at: VALVE4, op: 2, want: 'to the right', why: 'right' },
        { setpos: [VALVE5[0], VALVE5[1] + 1, 0], why: 'to the fifth' },
        { loc: 'sewervalve5', at: VALVE5, op: 2, want: 'to the right', why: 'right' },
        { varis: 'hazeelcult_valves', to: 31 },

        { note: 'wiki step 6: Clivet guards the raft, and offers you the other side of the story' },
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
            picks: ['What do you mean?', "You're crazy, I'd never help you."],
            want: 'never know the glories',
            why: 'and you turn him down'
        },
        { stage: 4 },
        { varis: 'hazeelcult_side', to: 0 },

        { note: 'wiki step 7: with all five valves set the raft goes the whole way' },
        { go: [RAFT[0], RAFT[1] + 1], exact: true, r: 24, why: 'to the raft' },
        { loc: 'hazeelsewerraft', at: RAFT, hop: true, want: 'end of the sewer', why: 'board it' },

        { note: 'wiki step 8: Alomone leads them, and will not be talked to' },
        { go: [ALOMONE[0], ALOMONE[1]], exact: true, r: 40, why: 'south to Alomone' },
        { talk: 'alomone_hazeel_cultist', want: 'DIE', why: 'he recognises you' },
        { fight: 'alomone_hazeel_cultist', until: 'carnillean_armour', tries: 4, r: 12, why: 'and attacks' },
        { stage: 6 },
        { take: 'carnillean_armour', r: 8, why: 'the family armour' },
        { has: 'carnillean_armour' },

        { note: 'wiki steps 9-10: back up to the house. Ceril only takes the armour upstairs -' },
        { note: 'on the ground floor he says "come with me upstairs" and nothing else happens.' },
        { setpos: UPSTAIRS, why: "to the Carnilleans' first floor" },
        { talk: 'sir_ceril_carnillean', want: 'sort this out', why: 'hand over the armour' },
        { stage: 7 },
        { close: true, why: 'the five-coin "quest complete" scroll' },
        { hasnt: 'carnillean_armour' },

        { note: 'wiki step 11: the evidence is in the cupboard in the room east of the stairs,' },
        { note: 'and both Ceril and Jones have to be standing there to hear it.' },
        { loc: 'hazeelcbshut', at: CUPBOARD, soft: true, why: 'open the cupboard' },
        { loc: 'hazeelcbopen', at: CUPBOARD, want: 'Port Sarim Jail', why: 'and search it' },
        { stage: 9 },
        { has: 'coins', n: 2005 }
    ]
};

const p: any = H.makePlayer('hazrun', m.start[0], m.start[1]);
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
