// MONK'S FRIEND, played through on foot.
//
// Quest 25 of the quest-by-quest pass. Brother Omad in the Ardougne monastery cannot sleep for the
// crying of Brother Androe's son, whose blanket was stolen by thieves; the thieves' cave is under a
// ring of stones in the forest, and its ladder only exists while the quest is live - a timer spawns
// it when the player comes within two tiles. Then Brother Cedric, drunk in the forest with a broken
// cart, a jug of water and some logs, and a party.
//
//   npx tsx tools/sim/quest_drunkmonk_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const _OMADOMAD: [number, number, number] = [2605, 3211, 0];
const CEDRIC: [number, number, number] = [2614, 3261, 0];

const m: Manifest = {
    quest: "MONK'S FRIEND",
    source: 'oldschool.runescape.wiki/w/Monk%27s_Friend',
    stageVar: 'drunkmonkquest',
    done: 80, // ^drunkmonk_complete
    start: [2605, 3211, 0],
    steps: [
        { note: 'wiki: a jug of water and some logs, both carried from elsewhere' },
        { give: 'jug_water' },
        { give: 'logs' },

        { note: 'wiki step 1: Brother Omad, in the monastery south of Ardougne' },
        { talk: 'brother_omad', picks: ["Why can't you sleep", 'Can I help at all'], want: 'secret cave in the forest', why: 'the blanket the thieves took' },
        { stage: 10 },

        { note: 'wiki step 2: the ring of stones in the forest. The ladder does not exist until the' },
        { note: 'quest is started - a timer adds it when the player gets within two tiles, which is' },
        { note: 'why this leg walks to the stones rather than to the ladder.' },
        { setpos: [2566, 3225, 0], why: 'west into the forest' },
        { go: [2562, 3222], exact: true, why: 'up to the ring of stones - two tiles is not close enough' },
        { wait: 2, why: 'the timer runs once a tick and adds the ladder' },
        { loc: 'loc_1765', at: [2561, 3222], why: 'the ladder that has just appeared' },
        { level: 0 },

        { note: 'the cave: east along the entrance passage, south down the west branch, and the' },
        { note: 'blanket is through the door at the bottom of it' },
        { go: [2565, 9613], why: 'down the west branch' },
        { loc: 'loc_1530', at: [2565, 9612], why: 'the door into the thieves’ room' },
        { go: [2570, 9605], why: 'in to the blanket' },
        { take: 'childs_blanket', r: 6, why: 'off the floor' },
        { has: 'childs_blanket' },

        { note: 'wiki step 3: back to Omad with it' },
        { setpos: [2605, 3211, 0], why: 'out of the cave and back to the monastery' },
        { talk: 'brother_omad', want: 'able to get some rest', why: 'hand it over' },
        { stage: 20 },
        { hasnt: 'childs_blanket' },

        { note: 'wiki step 4: and again, for the party and for Brother Cedric, who never came back' },
        { note: 'with the wine' },
        { talk: 'brother_omad', picks: ["Who's Brother Cedric?", 'Where should I look?'], want: 'out in the forest', why: 'he sends you looking' },
        { stage: 30 },

        { note: 'wiki step 5: Cedric, drunk in the forest north-east of the monastery' },
        { setpos: CEDRIC, why: 'north-east into the forest' },
        { talk: 'brother_cedric', want: 'jug of water', why: 'he wants sobering up first' },
        { stage: 40 },

        { note: 'wiki step 6: the water, and then the cart. Both are in the one conversation, and' },
        { note: 'this leg used to take the Yes at the end of it and jump 40 straight to 60. But the' },
        { note: 'choice is a real fork: handing the water over writes 50 before the question is' },
        { note: 'asked, and only Yes writes 60. Answer No and brother_cedric.rs2 leaves the quest' },
        { note: 'at 50, where its own switch sends the next talk back to the same question - so 50' },
        { note: 'is a stage a player can be sitting at for good, and the table had no leg for it.' },
        { note: 'DeathPlateau-Bugs#16. The No is played first for that reason.' },
        { talk: 'brother_cedric', picks: ["No, I've helped enough monks today!"], want: 'drink more wine', why: 'the water sobers him up, and declining the cart leaves the quest at 50' },
        { stage: 50 },
        { hasnt: 'jug_water' },

        { note: 'and talking to him again puts the same question, which is the step a player stuck' },
        { note: 'at 50 needs and the leg that was missing' },
        { talk: 'brother_cedric', picks: ["Yes, I'd be happy to!"], want: 'just need some wood', why: 'agreeing to the cart this time' },
        { stage: 60 },

        { note: 'wiki step 7: the logs for the cart' },
        { talk: 'brother_cedric', want: 'head back to Brother Omad', why: 'hand over the logs' },
        { stage: 70 },
        { hasnt: 'logs' },

        { note: 'wiki step 8: tell Omad, collect eight law runes, and the monks throw a party' },
        { setpos: [2605, 3211, 0], why: 'back to the monastery' },
        { talk: 'brother_omad', want: 'Take these Rune Stones', why: 'the reward and the dancing' },
        { wait: 24, why: 'the party dances through several delays before it completes' },
        { stage: 80 },
        { has: 'lawrune', n: 8 }
    ]
};

const p: any = H.makePlayer('monkrun', m.start[0], m.start[1]);
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
