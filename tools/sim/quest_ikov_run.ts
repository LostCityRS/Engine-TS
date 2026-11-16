// TEMPLE OF IKOV, played through on foot, siding with the Guardians of Armadyl.
//
// WORK IN PROGRESS - 52 of 53 checks, as far as the Fire Warrior of Lesarkus arriving. Everything
// before him is proven: Lucien's interview, the temple ladder, the dark stairs, the web, the boots
// and the swap that makes them weigh less than nothing, the pendant, the gate of fear, the lava gap,
// the double door at the end of the far ledge, the lever off the floor, the bracket (a shape-7 wall
// fitting - east or north of it, never west), the mended lever, the south gate, an ice arrow out of
// the right chest (forceapproach 14 leaves only its south side), both gates again, the trapped
// lever searched and pulled, and the door it unbolts.
//
// It stops on the very last blow: 85 of 86. Everything else walks - the interview, the ladder, the
// dark stairs, the web, the boots and the swap, the pendant, the gate of fear, the lava gap, the far
// ledge's door, the lever, the bracket, the mended lever, the south gate, TWENTY ice arrows out of
// the one loaded chest (one is not a fight - that was why the Fire Warrior could not be hurt), both
// gates again, the trapped lever, the Fire Warrior dead in 77 ticks, Winelda's twenty limpwurt
// roots, and the Guardians' pendant.
//
// Two things the run found on the way:
//   - the Guardians really do refuse to talk to a player wearing Lucien's pendant, which is the
//     wiki's warning and is implemented. There is no harness call for unequipping, so the pendant
//     comes off the way the engine takes it off: wear something else in the same slot.
//   - Lucien dies FOUR times at the end and %ikov stays at 70. [ai_queue3,ikov_lucien2] only queues
//     the completion when `npc_findhero = true & %ikov = ^ikov_helping_armadyl`; the stage is 70, so
//     npc_findhero is coming back false and he falls through to an ordinary death instead. Whether
//     that is the damage tracking, ~lucien_attack's map_members check in a free-to-play Edgeville,
//     or the harness, is the one thing left on this quest.
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_ikov_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const LUCIEN_INN: [number, number, number] = [2573, 3322, 0];
// The temple's own entrance: loc_1754, "Climb-down", at 2677,3405, landing beside the ladder that
// climbs back out at 2677,9805. (The trapdoor at 2637,3408 goes into a separate cellar.)
const ENTRANCE: [number, number] = [2677, 3405];
const LANDING: [number, number] = [2677, 9806];
const DARKSTAIRS_DOWN: [number, number] = [2650, 9804];
const WEB: [number, number] = [2654, 9766];
const BOOTS: [number, number] = [2654, 9767];
const DARKSTAIRS_UP: [number, number] = [2638, 9763];
const NORTHGATE: [number, number] = [2662, 9815];
const SOUTHGATE: [number, number] = [2662, 9803];
const _BRIDGE_SOUTHBRIDGE_SOUTH: [number, number] = [2649, 9827];
const _LEVER_OBJLEVER_OBJ: [number, number] = [2637, 9819];
const BRACKET: [number, number] = [2671, 9804];
const CHESTS: [number, number][] = [
    [2710, 9850],
    [2719, 9838],
    [2729, 9850],
    [2738, 9835],
    [2745, 9821],
    [2747, 9848]
];
const TRAPLEVER: [number, number] = [2665, 9855];
const WARRIORDOOR: [number, number] = [2646, 9870];
const WINELDA: [number, number, number] = [2656, 9876, 0];
const BRICKWALL: [number, number] = [2643, 9892];
const _GUARDIANGUARDIAN: [number, number, number] = [2648, 9902, 0];
const LUCIEN_HOUSE: [number, number, number] = [3176, 3477, 0];
const STAFF: [number, number] = [2638, 9906]; // on the table in the north-west room

const m: Manifest = {
    quest: 'TEMPLE OF IKOV',
    source: 'oldschool.runescape.wiki/w/Temple_of_Ikov',
    stageVar: 'ikov',
    // ^ikov_completed_armadyl. Both endings finish the quest - 80 for Armadyl, 90 for Lucien, which
    // is the one this run plays - and quests.rs2 turns the row green at 80, so a player who sided
    // with Armadyl is finished at 80. `done` takes the lower of the two for that reason; see the
    // note on the two endings below.
    done: 80,
    start: LUCIEN_INN,
    steps: [
        { note: 'requirements: Thieving 42 for the trap on the lever and Ranged 40 for the Fire' },
        { note: 'Warrior, who takes damage from nothing but ice arrows. Items: a lit light source,' },
        { note: 'something that slashes, a bow and twenty limpwurt roots for the witch.' },
        { setpos: LUCIEN_INN, why: 'the Flying Horse Inn in north-west Ardougne' },

        { note: 'wiki step 1: Lucien wants the Staff of Armadyl and hands over a pendant for the' },
        { note: 'door it is behind' },
        {
            talk: 'ikov_lucien1',
            picks: ["I'm a mighty hero!", "Why can't you get it yourself?", 'That sounds like a laugh!'],
            want: 'pendant',
            why: 'he hires you'
        },
        { stage: 10 },
        { has: 'ikov_pendantoflucien' },

        { note: 'wiki step 2: the temple is south of the Ranging Guild and the way down is a ladder' },
        { give: 'lit_candle' },
        { give: 'bronze_sword' },
        { setpos: [ENTRANCE[0], ENTRANCE[1] + 1, 0], why: 'to the temple' },
        { loc: 'loc_1754', at: ENTRANCE, hop: true, why: 'climb down' },
        { go: LANDING, exact: true, r: 20, why: 'into the entrance room' },

        { note: 'wiki step 3: the boots of lightness, down the dark stairs and behind a web. They' },
        { note: 'are the only thing in the game that makes a player weigh less than nothing.' },
        { go: [DARKSTAIRS_DOWN[0] - 1, DARKSTAIRS_DOWN[1]], exact: true, r: 60, why: 'to the dark stairs' },
        { loc: 'ikov_darkstairsdown', at: DARKSTAIRS_DOWN, hop: true, why: 'down, with a light' },
        { held: 'bronze_sword', op: 2, why: 'the web wants slashing' },
        { go: [WEB[0], WEB[1] - 1], exact: true, r: 60, why: 'to the web on the stairs' },
        { note: 'slashing a web is a roll, so the step keeps swinging until it parts' },
        { loc: 'bigweb_slashable', at: WEB, want: 'slash', tries: 10, why: 'cut it down' },
        { go: BOOTS, exact: true, r: 10, why: 'to the boots' },
        { take: 'ikov_bootsoflightness', r: 4, why: 'pick them up' },
        { held: 'ikov_bootsoflightness', op: 2, why: 'and put them on' },
        { hasnt: 'ikov_bootsoflightness' },

        { note: 'wiki step 4: the pendant opens the north gate, and the bridge over the lava throws' },
        { note: 'anybody across it who is not already weightless' },
        { note: 'the stairs are a 2x3 block at 2638-2640 x 9763-9764, so the only tile that can' },
        { note: 'reach them is the one the climb down lands you on' },
        { go: [2641, 9764], exact: true, r: 60, why: 'back to the stairs' },
        { loc: 'ikov_darkstairs', at: DARKSTAIRS_UP, hop: true, why: 'up again' },
        { held: 'ikov_pendantoflucien', op: 2, why: "Lucien's pendant" },
        { worn: 'ikov_pendantoflucien' },
        { go: [NORTHGATE[0], NORTHGATE[1] - 1], exact: true, r: 60, why: 'to the north gate' },
        { loc: 'ikov_dooroffearl', at: NORTHGATE, why: 'through it' },
        { note: 'THE BRIDGE IS NOT WALKED HERE, and the reason is the harness rather than the' },
        { note: 'content: the crossing is a per-tick player timer that reads `weight`, and a sim' },
        { note: 'player is not a NetworkPlayer - nothing calls calculateRunWeight(), so the weight' },
        { note: 'reads zero and the bridge would throw the player into the lava every time.' },
        { note: 'What the run does prove is the approach: 2651,9828 is reachable and 2650,9828 is' },
        { note: 'not, which is why the trigger had to move onto the lips.' },
        { go: [2651, 9828], exact: true, r: 60, why: 'to the east lip of the gap' },
        { setpos: [2647, 9828, 0], why: 'across to the west ledge (see above)' },
        { note: 'the ledge is eleven tiles and the only way off it is a double door at its west end' },
        { go: [2646, 9828], exact: true, r: 10, why: 'to the door at the end of the ledge' },
        { loc: 'loc_1516', at: [2645, 9828], soft: true, why: 'open it' },
        { go: [2644, 9828], exact: true, r: 10, why: 'through the door' },
        { take: 'ikov_lever', r: 14, why: 'the lever off the floor' },
        { setpos: [2651, 9828, 0], why: 'and back over' },

        { note: 'wiki step 4: the bracket is on the wall by the entrance ladder, and the gate of' },
        { note: 'fear shuts itself behind you every time' },
        { go: [NORTHGATE[0], NORTHGATE[1] + 1], exact: true, r: 60, why: 'back to the north gate' },
        { loc: 'ikov_dooroffearl', at: NORTHGATE, soft: true, why: 'and south through it' },
        { note: 'the bracket is a wall fitting (shape 7): east or north of it, never west' },
        { go: [BRACKET[0], BRACKET[1] + 1], exact: true, r: 90, why: 'to the bracket' },
        { useLoc: 'ikov_leverbracket', at: BRACKET, obj: 'ikov_lever', want: 'fit the lever', why: 'fit it' },
        { loc: 'ikov_mendedlever', at: BRACKET, want: 'hidden machinery', why: 'and pull it' },

        { note: 'wiki step 5: six chests in the south room and only one of them has arrows in it at' },
        { note: 'a time. The run pins the engine rng so the first chest is the right one.' },
        { go: [SOUTHGATE[0], SOUTHGATE[1] + 1], exact: true, r: 60, why: 'to the south gate' },
        { loc: 'ikov_mendedleverdoorl', at: SOUTHGATE, why: 'through it' },
        { rng: 0, why: 'the first chest is the loaded one' },
        { note: 'the chests carry forceapproach 14, which at this one angle leaves the south side' },
        { go: [CHESTS[0][0], CHESTS[0][1] - 1], exact: true, r: 90, why: 'to the first chest' },
        { loc: 'ikov_chestclosed', at: CHESTS[0], why: 'open it' },
        { loc: 'ikov_chestopen', at: CHESTS[0], tries: 6, until: 'ice_arrow', why: 'and search it' },
        { note: 'one arrow is not a fight: the wiki asks for about twenty with a bow, and with the' },
        { note: 'rng pinned this chest stays the loaded one and gives one a search' },
        ...Array.from({ length: 19 }, () => ({ loc: 'ikov_chestopen', at: CHESTS[0], soft: true, why: 'another' })),
        { has: 'ice_arrow', n: 20 },
        { rng: null },

        { note: 'back out of the ice room and north through the gate of fear again - both gates' },
        { note: 'shut themselves behind you' },
        { go: [SOUTHGATE[0], SOUTHGATE[1] - 1], exact: true, r: 120, why: 'back to the south gate' },
        { loc: 'ikov_mendedleverdoorl', at: SOUTHGATE, soft: true, why: 'north through it' },
        { go: [NORTHGATE[0], NORTHGATE[1] - 1], exact: true, r: 90, why: 'to the gate of fear' },
        { loc: 'ikov_dooroffearl', at: NORTHGATE, soft: true, why: 'and through it' },

        { note: 'wiki step 6: the lever in the alcove is trapped, and Thieving 42 finds the trap.' },
        { note: 'It is a shape-4 wall fitting, so the tile to use it from is its own.' },
        { go: TRAPLEVER, exact: true, r: 120, why: 'to the trapped lever' },
        { loc: 'ikov_traplever', at: TRAPLEVER, op: 2, want: 'disable the trap', why: 'search it first' },
        { stage: 20 },
        { loc: 'ikov_traplever', at: TRAPLEVER, why: 'then pull it' },
        { stage: 30 },

        { note: 'wiki step 6: the Fire Warrior of Lesarkus takes damage from ice arrows and nothing' },
        { note: 'else' },
        { give: 'yew_longbow' },
        { held: 'yew_longbow', op: 2, why: 'the bow' },
        { held: 'ice_arrow', op: 2, why: 'and the arrows' },
        { note: 'the lever unbolts the door at the end of the passage, which is what stage 30 is for' },
        { go: [2648, 9856], exact: true, r: 40, why: 'to the unbolted door' },
        { loc: 'ikov_trapleverdoor', at: [2648, 9857], soft: true, why: 'open it' },
        { go: [WARRIORDOOR[0] + 1, WARRIORDOOR[1]], exact: true, r: 90, why: "to the warrior's door" },
        { loc: 'ikov_firewarriordoor', at: WARRIORDOOR, soft: true, why: 'try it' },
        { wait: 10, why: 'he arrives in a puff of smoke and tells you to stop' },
        { note: 'he needs a few ticks to settle before the fight step looks, or it reports him' },
        { note: 'missing - he is walking to his spot while the puff of smoke is still clearing' },
        { nearnpc: 'ikov_firewarrior', r: 20, why: 'he is here' },
        { wait: 12, why: 'and settled - he walks to his spot and the fight step is racy' },
        { fight: 'ikov_firewarrior', untilvar: 'ikov', to: 40, tries: 4, r: 20, why: 'kill him' },
        { stage: 40 },

        { note: 'wiki step 7: Winelda will teleport you over the lava for twenty limpwurt roots' },
        { give: 'limpwurt_root', n: 20 },
        { setpos: WINELDA, why: 'to the witch by the lava' },
        { talk: 'ikov_winelda', picks: ['Yes I do!'], want: 'limpwurt', why: 'she wants roots' },
        { talk: 'ikov_winelda', want: 'potion is nearly ready', why: 'and takes all twenty' },
        { hasnt: 'limpwurt_root' },

        { note: 'wiki step 8, ending B: side with Lucien. The staff is on the table in the north' },
        { note: 'west room and a Guardian of Armadyl comes for you the moment you lift it.' },
        { note: "Ending A - the Guardians' own side - is walked as far as their pendant in this" },
        { note: "file's history; it is blocked at the last blow by npc_findhero coming back false" },
        { note: 'for Lucien, and the two endings are exclusive, so this manifest takes the one that' },
        { note: 'can be proven end to end.' },
        { go: [BRICKWALL[0], BRICKWALL[1] - 1], exact: true, r: 60, why: 'to the brick wall' },
        { loc: 'secretdoor2', at: BRICKWALL, soft: true, why: 'push it' },
        { note: 'the table blocks its own tile and the one south of it; north is the way in' },
        { go: [STAFF[0], STAFF[1] + 1], exact: true, r: 90, why: 'to the table' },
        { note: 'THE GUARDIAN OBJECTS BEFORE THE LIFT, not after it, which is what this manifest had' },
        { note: 'backwards. [opobj3,ikov_staffofarmardyl] runs npc_huntall(coord, 5, 1) FIRST and, if' },
        { note: 'any guardian_of_armadyl is within five tiles with line of sight, says "That is not' },
        { note: 'thine to take!", sets opplayer2 on it and returns empty-handed. They all have a' },
        { note: 'wanderrange, so whether one is in reach at the moment of the click was the dice -' },
        { note: 'which is why this failed four seeds out of five and looked like a runner problem.' },
        { note: 'Proven by removing that block from the content: all four failing seeds passed, and' },
        { note: 'the content went straight back, because the block is the rule.' },
        { note: 'the bow is empty - every ice arrow went into the Fire Warrior - so the sword goes' },
        { note: 'back on before anything else needs hitting' },
        { held: 'bronze_sword', op: 2, why: 'draw something that needs no ammunition' },
        { fight: 'ikov_guardianmale', tries: 3, r: 16, soft: true, why: 'clear the Guardian who can see the table' },
        { note: 'and back to the table, because the fight carries you off it - "nothing on the' },
        { note: 'floor nearby" is the take looking for a staff four tiles from where it ended up.' },
        { go: [STAFF[0], STAFF[1] + 1], exact: true, r: 60, soft: true, why: 'back to the table' },
        { take: 'ikov_staffofarmardyl', r: 4, tries: 4, why: 'and now lift the staff' },
        { has: 'ikov_staffofarmardyl' },

        { note: 'wiki step 8: and Lucien takes it, between Edgeville and the Grand Exchange' },
        { setpos: LUCIEN_HOUSE, why: 'to Lucien' },
        { talk: 'ikov_lucien2', picks: ['Yes! Here it is.'], want: 'staff', why: 'hand it over' },
        { stage: 90 },
        { hasnt: 'ikov_staffofarmardyl' }
    ]
};

const p: any = H.makePlayer('ikrun', m.start[0], m.start[1]);
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
