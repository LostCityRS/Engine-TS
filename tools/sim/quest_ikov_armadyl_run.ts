// TEMPLE OF IKOV - the Guardians' ending, played through on foot.
//
// THE OTHER HALF OF THE QUEST. Lucien hires you to fetch the Staff of Armadyl; the Guardians at the
// end of the dungeon will cleanse you, tell you what he is, and ask you to kill him instead. Taking
// them up on it writes ^ikov_helping_armadyl (70) and finishes the quest at ^ikov_completed_armadyl
// (80) when Lucien dies. quest_ikov_run.ts plays the other ending, 90, and the two are exclusive -
// a player who hands the staff over cannot then be cleansed, and a player who agrees to help can no
// longer lift the staff ("You decide not to steal the staff as you have agreed to help the
// Guardians").
//
// WHY A SECOND MANIFEST AND NOT A BRANCH IN THE FIRST. The quest helper's table is one row per
// manifest, and the row is what a player selects; two endings are two rows, exactly as HAZEEL CULT
// and HAZEEL CULT (Hazeel side) already are. The alternative - letting one manifest declare a leg
// it never plays - gives up the property the table is built on, that every row is proved by a run
// (DeathPlateau-Bugs#16).
//
// Stage 70 had no leg on any row before this. A player who had agreed to help the Guardians was
// shown leg 60 - "Talk to Winelda", the witch who had already teleported them across the lava -
// with no hint that the quest now wants Lucien dead.
//
// THE ROUTE TO 60 IS THE SAME ROUTE, and it is copied rather than imported: ExportHelper reads
// these manifests with the TypeScript AST and not by importing them, so the steps have to be a
// static literal in the file that claims them. Everything from here to `stage: 60` is
// quest_ikov_run.ts's, and any change there belongs in both.
//
// Three things this ending needs that the other does not:
//   - LUCIEN'S PENDANT MUST COME OFF before the Guardians will talk. Wearing it makes them call you
//     "a foul agent of Lucien" and attack, which is the wiki's own warning. There is no harness
//     call for unequipping, so it comes off the way the engine takes it off: wear something else in
//     the same slot.
//   - THE STAFF MUST NOT BE IN THE BAG either, for the same reason - "Halt! You will not leave here
//     with the Staff of Armadyl!" - so this run never goes to the table at all.
//   - ARMADYL'S PENDANT MUST BE WORN TO ATTACK HIM. ~lucien_attack reads worn, not inventory, and
//     refuses with "You don't want to attack me. I am your friend." without it.
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_ikov_armadyl_run.ts
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
const GUARDIAN: [number, number, number] = [2648, 9902, 0];
const LUCIEN_HOUSE: [number, number, number] = [3176, 3477, 0];
// THE STAFF'S TILE IS NOT USED ON THIS ENDING, and that is the point of it: agreeing to help
// the Guardians makes [opobj3,ikov_staffofarmardyl] refuse - "You decide not to steal the staff as
// you have agreed to help the Guardians" - and carrying it makes them attack on sight. This run
// never goes near the table.
const _STAFF: [number, number] = [2638, 9906]; // on the table in the north-west room

const m: Manifest = {
    quest: 'TEMPLE OF IKOV (Armadyl)',
    source: 'oldschool.runescape.wiki/w/Temple_of_Ikov',
    stageVar: 'ikov',
    // ^ikov_completed_armadyl, which is where this ending finishes and is also the value
    // quests.rs2 turns the row green at, so it is `done` for both rows.
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
        // NOT THE ARMADYL BRANCH, which is what these two were written off as. Winelda's teleport
        // is how you cross the lava on EITHER ending, so this run has always walked through 50 and
        // 60 - it just never wrote them down. DeathPlateau-Bugs#16 had both filed as step 4,
        // blocked behind a decision about branching quests; only 70 is actually branch-specific.
        // A player at 50 was shown leg 40, "Go to the witch by the lava. Talk to Winelda." - which
        // is exactly what they had just done.
        { stage: 50, why: '^ikov_spoken_winelda - she has named her price' },
        { talk: 'ikov_winelda', want: 'potion is nearly ready', why: 'and takes all twenty' },
        { stage: 60, why: '^ikov_paid_winelda - paid, and teleported over the lava' },
        { hasnt: 'limpwurt_root' },

        { note: 'wiki step 8, ending A: the Guardians of Armadyl keep the temple behind a brick' },
        { note: "wall in the north-west. They will not speak to anyone wearing Lucien's pendant, so" },
        { note: 'it comes off first - the engine takes it off by having something else go on.' },
        { give: 'amulet_of_strength' },
        { held: 'amulet_of_strength', op: 2, why: "something else in the amulet slot, so Lucien's pendant comes off" },
        { notworn: 'ikov_pendantoflucien' },
        { go: [BRICKWALL[0], BRICKWALL[1] - 1], exact: true, r: 60, why: 'to the brick wall' },
        { loc: 'secretdoor2', at: BRICKWALL, soft: true, why: 'push it' },
        { go: [GUARDIAN[0], GUARDIAN[1] - 1], exact: true, r: 60, why: 'to the Guardians' },

        { note: 'they tell you what Lucien is, cleanse you, and ask for his death. The way in is' },
        { note: '"What are your kind and what are you doing here?" - asking after the Mahjarrat is' },
        { note: 'what makes the Guardian realise who hired you.' },
        {
            talk: 'ikov_guardianmale',
            picks: ['What are your kind and what are you doing here?', 'Who are the Mahjarrat?', 'Did you say Lucien?', "You're right, it's time for my yearly bath.", "Ok! I'll help!"],
            want: 'pendant',
            why: 'agree to help them'
        },
        { stage: 70, why: '^ikov_helping_armadyl - cleansed, briefed, and carrying their pendant' },
        { has: 'ikov_pendantofarmardyl' },

        { note: 'wiki step 9: Lucien is between Edgeville and the Grand Exchange, and the pendant' },
        { note: 'has to be worn rather than carried for the attack to be allowed at all.' },
        { held: 'ikov_pendantofarmardyl', op: 2, why: 'wear it' },
        { worn: 'ikov_pendantofarmardyl' },
        { setpos: LUCIEN_HOUSE, why: 'to Lucien' },
        { note: 'he is not killed so much as banished - "You have defeated me for now! I shall' },
        { note: 'reappear in the North!" - and the quest completes out of his death queue.' },
        { fight: 'ikov_lucien2', untilvar: 'ikov', to: 80, tries: 4, r: 20, why: 'and finish him' },
        { stage: 80 }
    ]
};

const p: any = H.makePlayer('ikarm', m.start[0], m.start[1]);
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
