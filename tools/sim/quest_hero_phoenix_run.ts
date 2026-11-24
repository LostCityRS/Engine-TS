// HEROES' QUEST, THE PHOENIX SIDE - the other gang's route to the master thief's armband.
//
// WHY A SECOND MANIFEST AND NOT A MARKER. %heroquest is one linear var holding two branches:
// stages 2-6 are the Phoenix route and 7-13 the Black Arm one. quest_hero_run.ts plays Black Arm,
// so stages 2, 3 and 4 were values the content writes and no run ever observed - and a Phoenix
// player sitting on any of them was shown the last leg at or below their value, which is leg 1:
// "Wield Rune scimitar. Go through the dwarven tunnel and down to her lair. Kill Ice Queen." They
// killed her at stage 1. That is DeathPlateau-Bugs#16's bug in its clearest form - not a crash,
// but being told to do again the thing you have just done.
//
// A second manifest per branch is already the house pattern rather than a new idea: HAZEEL CULT
// and HAZEEL CULT (Hazeel side) are two rows in the shipped table today, and ExportHelper emits
// one row per quest_*_run.ts. So this keeps the property that makes that table worth trusting -
// every leg proved by a playthrough - instead of letting a manifest declare a leg it never plays.
//
// WHERE THIS STOPS, AND WHY IT IS THE SAME PLACE. Stage 5 is Grip dead and 6 is the armband, and
// both need the two-player heist: [oplocu,pete_treasuredoor] refuses Grip's keys from anybody who
// has not handed over the ID papers, which only a Black Arm member does. So this run goes as far
// as one Phoenix player can - Charlie's secret door, stage 4 - exactly as quest_hero_run.ts stops
// at the deputy's post. tools/sim/heroes_candlestick.ts drives both players together and already
// asserts 5, 6, 12 and 13; it is hand-written rather than manifest-driven, so none of it reaches
// the table. Closing those four is the part of #16 still waiting on a decision.
//
//   npx tsx tools/sim/quest_hero_phoenix_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const FIRE: [number, number] = [2890, 9768];

const m: Manifest = {
    quest: "HEROES' QUEST (Phoenix side)",
    source: 'oldschool.runescape.wiki/w/Heroes%27_Quest',
    stageVar: 'heroquest',
    // ^hero_complete, not the last stage this run reaches. `done` is the quest's own completion
    // because that is what the helper reads as finished - the same reason quest_hero_run.ts says
    // 15 while stopping at 11.
    done: 15,
    start: [2904, 3510, 0],
    steps: [
        { note: 'requirements: 55 quest points, Shield of Arrav, Lost City, Merlin’s Crystal and' },
        { note: 'Dragon Slayer. Declared here as PHOENIX, which is the gang this run continues with' },
        { note: 'and the whole difference between this manifest and quest_hero_run.ts.' },
        { setvar: 'qp', to: 55 },
        { setvar: 'zanaris', to: 6, why: '^zanaris_complete' },
        { setvar: 'dragonquest', to: 10, why: '^dragon_complete' },
        { setvar: 'arthur', to: 7, why: '^arthur_complete' },
        { setvar: 'phoenixgang', to: 10, why: '^phoenixgang_complete - Straven only talks shop to his own' },

        { note: 'a rod and oil for the eel, and a tinderbox and log to cook it on. No black armour:' },
        { note: 'that is the Black Arm route’s disguise for Garv on the mansion gate, and no weapon,' },
        { note: 'because the firebird is on Entrana where the monks allow none.' },
        { give: 'fishing_rod' },
        { give: 'blamish_oil' },
        { give: 'fishing_bait', n: 20 },
        { give: 'tinderbox' },
        { give: 'logs' },

        { note: 'wiki step 1: Achietties, outside the Heroes’ Guild. Identical on both routes.' },
        { talk: 'achietties', picks: ['may I apply to join', "I'll start looking for all those things"], want: 'Firebird', why: 'she lists the three items' },
        { stage: 1 },

        { note: 'wiki step 2: the Ice Queen, deep under White Wolf Mountain. Her ice gloves are the' },
        { note: 'only thing that can pick up a firebird’s feather.' },
        { give: 'rune_scimitar' },
        { held: 'rune_scimitar', op: 2, why: 'wield it for her' },
        { setpos: [2867, 9956, 0], why: 'through the dwarven tunnel and down to her lair' },
        { fight: 'ice_queen', until: 'ice_gloves', tries: 4, why: 'she drops the gloves' },
        { take: 'ice_gloves', r: 10, why: 'off the ice' },
        { held: 'ice_gloves', op: 2, why: 'wear them' },
        { worn: 'ice_gloves' },

        { note: 'wiki step 3: the firebird on Entrana.' },
        { setpos: [2850, 3385, 0], why: 'the monks’ ship to Entrana' },
        { fight: 'fire_bird', until: 'hot_feather', tries: 4, why: 'it leaves a feather' },
        { take: 'hot_feather', r: 10, why: 'off the ground' },
        { has: 'hot_feather' },

        { note: 'wiki step 4: the lava eel - oil on the rod, fish the lava in the Taverley dungeon,' },
        { note: 'and cook it. 53 Fishing and 53 Cooking.' },
        { use: ['blamish_oil', 'fishing_rod'], want: 'rub the oil into the fishing rod', why: 'make the oily rod' },
        { has: 'oily_fishing_rod' },
        { setpos: [2890, 9767, 0], why: 'down into the Taverley dungeon, to the lava' },
        { talk: '0_45_152_lavafish', op: 1, tries: 12, until: 'raw_lava_eel', want: 'lava eel', why: 'fish it out' },
        { has: 'raw_lava_eel' },
        { go: FIRE, exact: true, why: 'onto clear ground' },
        { use: ['tinderbox', 'logs'], why: 'light a fire' },
        { wait: 12, why: 'lighting a fire takes a few attempts' },
        { useLoc: 'fire', at: FIRE, obj: 'raw_lava_eel', want: 'lava eel', why: 'cook it' },
        { has: 'lava_eel' },

        { note: 'wiki step 5, AND THE BRANCH: Straven in the Phoenix hideout under Varrock, where' },
        { note: 'the Black Arm route goes to Katrine instead. He names the target - Scarface Pete’s' },
        { note: 'candlesticks - and the contact and password to reach them: Alfonse, "gherkin".' },
        { note: 'No dialogue option to pick; being a Phoenix member at ^hero_started is enough.' },
        { setpos: [3247, 9781, 0], why: 'into the Phoenix Gang hideout' },
        { talk: 'straven', want: 'gherkin', why: 'ask how to get a master thief armband' },
        { stage: 2, why: '^hero_phoenix_gangmember_spoken - legless until now' },

        { note: 'wiki step 6: Alfonse the waiter in the Shrimp and Parrot, Brimhaven. The gherkin' },
        { note: 'option only appears at stage 2, so this step is the proof the stage took.' },
        { setpos: [2796, 3188, 0], why: 'by ship to Brimhaven, into the Shrimp and Parrot' },
        { talk: 'alfonse_the_waiter', picks: ['Do you sell Gherkins?'], want: 'Charlie the cook', why: 'the password' },
        { stage: 3, why: '^hero_phoenix_talked_alfonse - legless until now' },

        { note: 'wiki step 7: Charlie the cook, round the back, who gives the Phoenix route its one' },
        { note: 'piece of real help - the secret door through Mr Olbors’ garden to the mansion’s' },
        { note: 'blocked side entrance.' },
        { setpos: [2790, 3192, 0], why: 'round the back into the kitchen' },
        { talk: 'charlie_the_cook', picks: ["I'm looking for a gherkin", "I want to steal Scarface Pete's candlesticks"], want: 'side entrance', why: 'the secret door' },
        { stage: 4, why: '^hero_phoenix_talked_charlie - legless until now' },

        { note: 'wiki step 8: through the secret door behind the kitchen and Mr Olbors’ garden to' },
        { note: 'the mansion’s blocked side entrance, which only a Black Arm partner can open from' },
        { note: 'the inside - with the odd key Grip hands his own deputy.' },
        { note: 'NO STEP ON PURPOSE, and the heading above is why this leg exists at all: the' },
        { note: 'exporter keeps a leg only if it carries a step, an item or a heading, so the first' },
        { note: 'version of this manifest asserted stage 4 and still had no row in the table - a' },
        { note: 'Phoenix player at 4 was shown leg 3, "Talk to Alfonse", which they had just done.' },
        { note: 'Same mechanism as Fight Arena 8. There is nothing for one player to click here,' },
        { note: 'which is what makes legNow walk the panel on rather than park it. #16.' }
    ]
};

const p: any = H.makePlayer('herophoenix', m.start[0], m.start[1]);
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
