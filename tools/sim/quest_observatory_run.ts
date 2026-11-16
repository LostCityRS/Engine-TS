// OBSERVATORY QUEST, played through on foot.
//
// Quest 72 of the quest-by-quest pass. Goblins have wrecked the professor's telescope; you bring
// him wood, bronze and glass, then fetch the lens mould the goblins hid in their kitchen - which
// means a key out of a chest in the cavern and a guard on the kitchen gate.
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_observatory_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const RECEPTION: [number, number, number] = [2441, 3186, 0];
const DUNGEON_LADDER: [number, number] = [2444, 3191];
const KEY_CHEST: [number, number] = [2428, 9419];
const GATE: [number, number] = [2391, 9457];
const SACK: [number, number] = [2389, 9454];
const OUT_LADDER: [number, number] = [2420, 9460];
const DOME_LADDER: [number, number] = [2423, 9439];
const TELESCOPE: [number, number] = [2440, 3157];
const GRAVE: [number, number] = [2462, 3227];

const m: Manifest = {
    quest: 'OBSERVATORY QUEST',
    source: 'oldschool.runescape.wiki/w/Observatory_Quest',
    stageVar: 'itgronigen',
    // ^itgronigen_complete. The run goes on to 8 (^itgronigen_claimed_wine) so the wine is checked
    // too, but that is a state after the quest, not part of it: a player who has finished and not
    // claimed the wine is finished, and the helper must not keep showing them a step.
    done: 7,
    start: RECEPTION,
    steps: [
        { note: 'no requirements. Items: 3 planks, a bronze bar and a molten glass.' },

        { note: 'wiki step 1: the professor in the reception room north of Castle Wars' },
        {
            talk: 'observatory_professor',
            picks: ["I'd like to have a look through that telescope.", 'Sounds interesting, what can I do for you?'],
            want: 'three planks of wood',
            why: 'the goblins tampered with the telescope'
        },
        { stage: 1 },

        { note: 'wiki step 2: the three parts, one conversation each' },
        { give: 'woodplank', n: 3 },
        { talk: 'observatory_professor', want: 'tripod construction', why: 'the tripod' },
        { stage: 2 },
        { give: 'bronze_bar' },
        { talk: 'observatory_professor', want: 'lens made', why: 'the tube' },
        { stage: 3 },
        { give: 'molten_glass' },
        { talk: 'observatory_professor', want: 'lens mould', why: 'and the glass he cannot cast' },
        { stage: 4 },

        { note: 'wiki step 3: the goblin kitchen key is in a chest in the cavern' },
        { talk: 'observatory_assistant', picks: ["I can't find the lens mould."], want: 'hidden it', why: 'the assistant points at the goblins' },
        { go: [DUNGEON_LADDER[0], DUNGEON_LADDER[1] - 1], exact: true, r: 40, why: 'up the east hill' },
        { loc: 'obs_dungeonladderdown', at: DUNGEON_LADDER, hop: true, soft: true, why: 'down into the dungeon' },
        { note: 'the ladder drops you at 2420,9459. The key is in the last chest, 2428,9419.' },
        { go: [KEY_CHEST[0], KEY_CHEST[1] - 1], exact: true, r: 60, why: 'to the last chest' },
        { loc: 'loc_2197', at: KEY_CHEST, soft: true, why: 'open it' },
        { loc: 'loc_2198', at: KEY_CHEST, op: 2, want: 'keep key', why: 'and search it' },
        { has: 'keep_key' },

        { note: 'wiki step 4: the key unlocks the kitchen gate, and a guard objects' },
        { note: 'The guard has to go FIRST. Opening the gate leaves an inviswall in the doorway for' },
        { note: 'the three ticks it is open and teleports you through, so once you are inside he is' },
        { note: 'sealed out and cannot be fought at all - which is the "or trap him" the guide means.' },
        { go: [GATE[0], GATE[1] + 2], exact: true, r: 90, why: 'north of the kitchen gate' },
        { talk: 'goblin_guard', want: 'Begone foul human', why: 'prod the sleeping guard' },
        { fight: 'goblin_guard', tries: 4, r: 12, why: 'and he wakes up angry' },
        { useLoc: 'keepgate_closed', at: GATE, obj: 'keep_key', hop: true, want: 'unlocks', why: 'then unlock the gate' },
        { hasnt: 'keep_key' },

        { note: 'wiki step 5: the mould is under a sack in the goblin kitchen' },
        { go: [SACK[0] + 1, SACK[1]], exact: true, r: 24, why: 'to the sack' },
        { loc: 'loc_2212', at: SACK, want: 'mould', why: 'look under it' },
        { has: 'lens_mould' },

        { note: 'wiki step 6: back up to the professor, who hands the glass back. The gate shuts' },
        { note: 'behind you, but %itkeepgatelock is set now, so op1 works from either side.' },
        { loc: 'keepgate_closed', at: GATE, hop: true, soft: true, why: 'back out through the gate' },
        { go: [OUT_LADDER[0], OUT_LADDER[1] - 1], exact: true, r: 90, why: 'to the way out' },
        { loc: 'loc_2188', at: OUT_LADDER, hop: true, soft: true, why: 'up the ladder' },
        { setpos: RECEPTION, why: 'back to the reception room' },
        { talk: 'observatory_professor', want: 'molten glass', why: 'his crafting is not good enough' },
        { stage: 5 },
        { has: 'molten_glass' },

        { note: 'wiki step 7: cast the lens, and hand over lens and mould' },
        { use: ['molten_glass', 'lens_mould'], want: 'convex glass disc', why: 'cast the lens' },
        { has: 'lens' },
        { talk: 'observatory_professor', want: 'Meet me at the Observatory', why: 'the telescope is whole again' },
        { stage: 6 },
        { hasnt: 'lens_mould' },

        { note: 'wiki step 8: the Observatory itself is reached through the cavern' },
        { go: [DUNGEON_LADDER[0], DUNGEON_LADDER[1] - 1], exact: true, r: 40, why: 'back up the hill' },
        { loc: 'obs_dungeonladderdown', at: DUNGEON_LADDER, hop: true, soft: true, why: 'down into the dungeon again' },
        { go: [DOME_LADDER[0], DOME_LADDER[1] - 1], exact: true, r: 60, why: 'to the stairs at the south end' },
        { loc: 'loc_2189', at: DOME_LADDER, hop: true, soft: true, why: 'up into the Observatory' },

        { note: 'and the professor is waiting at the telescope. The constellation is random, so the' },
        { note: 'rng is pinned for the one click: 0 is Capricorn, which pays in Strength.' },
        { go: [TELESCOPE[0] + 1, TELESCOPE[1]], exact: true, r: 40, why: 'to the telescope' },
        { rng: 0, why: 'random(12) -> Capricorn' },
        { loc: 'telescope', at: TELESCOPE, want: 'look through the telescope', why: 'look through it' },
        { note: 'the constellation dialogue is a queue the telescope started, not a click, so there' },
        { note: 'is nothing to hang picks on - it has to be answered with a say step.' },
        { close: true, why: 'an open interface blocks the queue, so shut the telescope view' },
        { say: ['I can see a constellation.'], want: 'Capricorn the goat', why: 'and he reads it for you' },
        { rng: null },
        { stage: 7 },
        { has: 'uncut_sapphire' },

        { note: 'wiki reward: the assistant stands you a drink afterwards' },
        { setpos: RECEPTION, why: 'back to the reception room' },
        { talk: 'observatory_assistant', want: 'drink on me', why: 'and he gives you his wine' },
        { stage: 8 },
        { has: 'jug_wine' },

        { note: 'and the Spirit of Scorpius, in the graveyard north of the Observatory, will hand' },
        { note: 'over an unholy mould to anybody who has now seen beyond the stars.' },
        { setpos: [GRAVE[0] - 1, GRAVE[1] - 1, 0], why: 'to the grave' },
        { loc: 'scorpiusgrave', at: GRAVE, want: 'Scorpius', why: 'read the headstone' },
        { talk: 'spirit_of_scorpius', picks: ['I seek your wisdom.'], want: 'unholy symbol', why: 'and ask his counsel' },
        { has: 'unholy_symbol_mould' }
    ]
};

const p: any = H.makePlayer('obsrun', m.start[0], m.start[1]);
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
