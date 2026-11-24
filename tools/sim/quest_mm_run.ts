// MONKEY MADNESS, played through on foot. Nothing here teleports except the quest's own transport -
// Daero's blindfolded walk down to the hangar, Waydar's glider, Lumdo's boat and Kruk - which is the
// quest working rather than the runner cheating.
//
// Each `note` says which step of the real quest the stretch below it stands in for. Where the real
// quest has a step and this server does not, the note says so and there are no steps under it: the
// Karamja shipyard leg, the hangar's sliding puzzle and the whole jail sequence are all missing, and
// a run cannot walk through what was never built.
//
// The player is maxed before the run. Monkey Madness has no skill requirements - it gates on combat
// ability - and the tunnel to Zooknock is full of level 98 monkey zombies and level 142 skeletons,
// so an unarmed level 3 would be measuring how fast it dies rather than whether the quest works.
//
//   npx tsx tools/sim/quest_mm_run.ts
import * as H from './harness.js';
import { play, Manifest, Step } from './questrun.js';

// The gate reads which side you are standing on and puts you through, so one pair of steps serves
// both directions. Ape Atoll's level 0 is two walkable regions - the beach and the tunnel mouth in
// one, Garkor and the temple in the other - and this is the only join between them, so every leg of
// stage two and three crosses it.
// OUT of Marim: a human on the inside is sneaking and nobody stops them.
const marimOut = (): Step[] => [
    { go: [2720, 2768], r: 250, why: 'the Marim gate, from inside' },
    { loc: 'mm_bamboo_largedoor', at: [2719, 2766], why: 'slip out' }
];
// IN as a human: you are shot off your feet and wake in the cell, and picking that lock is what
// gets you inside the walls at all - wiki steps 13-14. The cell is north of the gate, in the same
// walkable region as Garkor, which is the whole point of being arrested.
const marimArrest = (count: number): Step[] => [
    { go: [2720, 2764], r: 250, why: 'walk up to the Marim gate as a human' },
    { loc: 'mm_bamboo_largedoor', at: [2719, 2766], why: 'and get shot for it' },
    { varis: 'mm_jail_count', to: count },
    { loc: 'mm_jail_door', at: [2771, 2795], why: 'pick the cell lock' },
    { go: [2771, 2797], r: 32, why: 'out into Marim' }
];
// and IN as a monkey, which nobody looks at twice
const _marimIn = (): Step[] => [
    { go: [2720, 2764], r: 250, why: 'the Marim gate' },
    { loc: 'mm_bamboo_largedoor', at: [2719, 2766], why: 'slip through' }
];

await H.boot();

const m: Manifest = {
    quest: 'MONKEY MADNESS',
    source: 'oldschool.runescape.wiki/w/Monkey_Madness_I/Quick_guide (2004 quest)',
    stageVar: 'mm_main',
    done: 20,
    start: [2465, 3498, 0],
    steps: [
        { give: 'gold_bar' },
        { give: 'lockpick' },
        { give: 'ball_of_wool' },
        { give: 'mm_normal_monkey_bones' },
        { setvar: 'grandtree', to: 160, why: 'The Grand Tree, a real requirement, complete' },

        { note: 'real step 1: King Narnode at the Grand Tree' },
        { go: [2465, 3497], why: 'the King' },
        { talk: 'grandtree_narnode' },
        { stage: 1 },
        { has: 'mm_gnome_royal_seal' },

        { note: 'wiki steps 2-5: the glider to Gandius, monkey bones, the shipyard, and Caranock' },
        { setpos: [2956, 3030, 0], why: 'Gandius, by gnome glider from the top of the Grand Tree - the glider network is pre-existing world travel, not part of this quest' },
        { go: [2955, 3022], r: 200, why: 'the shipyard office, north through the gate' },
        { talk: 'mm_caranock', why: 'he wants to see the seal' },
        { varis: 'mm_caranock', to: 1 },

        { note: 'wiki step 6: back to Narnode, who writes the orders' },
        { setpos: [2465, 3497, 0], why: 'the Grand Tree, by glider again' },
        { talk: 'grandtree_narnode', why: 'report what Caranock said' },
        { has: 'mm_narnode_orders' },

        { note: 'real step 7: Daero in the Blurberry bar, through every chat option' },
        { go: [2466, 3494], why: 'the ladder up the Grand Tree' },
        { loc: 'ladder', at: [2466, 3495], why: 'climb up to the bar' },
        { level: 1 },
        { go: [2482, 3490], r: 64, why: 'the bar' },
        { talk: 'mm_daero', picks: [1, 2, 3, 1], why: 'all three questions, then the trip down' },
        { stage: 3 },

        { note: 'wiki step 8: Daero in the hangar' },
        { go: [2586, 4516], r: 64, why: 'Daero, in the hangar' },
        { talk: 'mm_daero' },

        { note: 'wiki step 9: the launch panel - solve it, or buy the code off Glough' },
        // Both routes have their own sim: tools/sim/mmpanel.ts drives the panel, the zone guard
        // that stops a clue puzzle in Varrock opening it, and Glough taking the 200,000 through
        // the bars of his cage. Neither belongs here - the puzzle is a hundred clicks that test
        // the puzzle rather than the quest, and the walked runner cannot get line of sight to
        // Glough through a cage that is sealed by design.
        { setvar: 'mm_hangar_puzzle_complete', to: 1, why: 'the panel, done in mmpanel.ts' },

        { note: 'real step 10: Waydar, and the glider to Crash Island' },
        { go: [2585, 4518], why: 'Waydar' },
        { talk: 'mm_waydar', picks: [1] },
        { stage: 4 },

        { note: 'real steps 11-12: Lumdo. The real quest needs Waydar talked to TWICE to convince him' },
        { go: [2892, 2724], r: 64, why: 'Lumdo, on the Crash Island beach' },
        { talk: 'mm_lumdo', why: 'he wants a reference' },
        { go: [2893, 2729], r: 64, why: 'Waydar' },
        { talk: 'mm_waydar', why: 'who has a word with him' },
        { talk: 'mm_waydar', why: 'and another' },
        { varis: 'mm_waydar', to: 2 },
        { go: [2892, 2724], r: 64 },
        { talk: 'mm_lumdo', picks: [1], why: 'and now he will row' },
        { stage: 5 },

        { note: 'wiki steps 13-14: shot at the gate, arrested, and pick the cell lock' },

        { note: 'the Marim gate. Ape Atoll is TWO disconnected walkable regions and this gate is the only join' },
        ...marimArrest(1),

        { note: 'wiki step 15: Garkor, who now tells you where the mould and the dentures are instead of handing them over' },
        { go: [2804, 2761], r: 200, why: 'Garkor, by the temple' },
        { talk: 'mm_garkor' },
        { stage: 6 },

        { note: 'wiki steps 16-19: the warehouse, the crate with no bottom, and the cave under it' },
        { go: [2767, 2770], r: 250, why: "the monkeys' warehouse" },
        { loc: 'mm_denture_crate', at: [2767, 2769], why: 'search the stacked crates' },
        { has: 'mm_monkey_dentures' },
        { go: [2769, 2766], r: 64, why: 'the crate in the south-east corner' },
        { loc: 'mm_crate_over_hole', at: [2769, 2765], why: 'and go through it' },
        { go: [2782, 9173], r: 64, why: 'across the cave to the moulds' },
        { loc: 'mm_monkey_amulet_mould_crate', at: [2782, 9172], why: 'the amulet mould' },
        { has: 'mm_monkey_amulet_mould' },
        { go: [2764, 9166], r: 64, why: 'the rope under the western warehouse' },
        { loc: 'mm_climbing_rope_bottom_western_warehouse', at: [2764, 9165], why: 'climb out' },

        { note: 'real steps 23-26: the tunnel to Zooknock' },
        ...marimOut(),
        { go: [2764, 2704], r: 250, why: 'the tunnel mouth on the west shore' },
        { loc: 'mm_bamboo_ladder_dungeon_entrance', at: [2763, 2703], why: 'climb down' },
        { go: [2800, 9144], r: 200, why: 'the far end of the tunnel' },
        { talk: 'mm_zooknock' },
        { stage: 7 },
        { talk: 'mm_zooknock', why: 'hand over the gold bar, the mould and the dentures' },

        { has: 'mm_enchanted_gold_bar' },
        { has: 'mm_monkey_amulet_mould', why: 'handed back, and needed at the flames' },

        { note: 'real step 30: the wall of flames in the crypt under the Temple of Marimbo' },
        { go: [2764, 9104], r: 250, why: 'back across the tunnel to the exit' },
        { loc: 'mm_bamboo_ladder_dungeon_exit', at: [2763, 9103], why: 'climb out' },
        ...marimArrest(2),
        { go: [2807, 2784], r: 250, why: 'the temple of Marimbo' },
        { loc: 'mm_temple_trapdoor', at: [2807, 2785], why: 'open the trapdoor', soft: true },
        { loc: 'mm_temple_trapdoor_open', at: [2807, 2785], why: 'climb down into the crypt' },
        { go: [2809, 9192], r: 64, why: 'the wall of fire' },
        { useLoc: 'mm_iban_firewall_straight', at: [2809, 9191], obj: 'mm_enchanted_gold_bar', why: 'pour the bar into the mould' },
        { has: 'mm_amulet_of_monkey_speak_without_string' },
        { use: ['mm_amulet_of_monkey_speak_without_string', 'ball_of_wool'] },
        { has: 'mm_amulet_of_monkey_speak' },
        { stage: 8 },
        // "Equip the M'speak amulet and talk to the Monkey Child" - without it every monkey on the
        // island answers in gibberish, which is correct and is also easy to forget.
        { held: 'mm_amulet_of_monkey_speak', op: 2, why: 'wear the amulet' },
        { note: 'real steps 32-37: the monkey child, five bananas and the talisman' },
        { loc: 'mm_climbing_rope_bottom_temple', at: [2808, 9201], why: 'up the rope out of the crypt' },
        { go: [2744, 2794], r: 250, why: "the monkey child's garden" },
        // real step 34: "pick five bananas from the garden trees". One tree carries five - the
        // full/four/three/two/one/empty chain - so this is one tree stripped, which is the garden
        // behaving like every other banana tree in the game.
        { loc: 'mm_bananatreefull', at: [2741, 2795], why: 'pick a banana' },
        { loc: 'mm_bananatreefour', at: [2741, 2795], why: 'and another' },
        { loc: 'mm_bananatreethree', at: [2741, 2795], why: 'and another' },
        { loc: 'mm_bananatreetwo', at: [2741, 2795], why: 'and another' },
        { loc: 'mm_bananatreeone', at: [2741, 2795], why: 'the last one on the tree' },
        { has: 'banana', n: 5 },
        { loc: 'mm_bananatreeempty', at: [2741, 2795], why: 'and the tree is bare', soft: true },
        { go: [2740, 2793], r: 40, why: 'the child, with the aunt out of earshot' },
        // the aunt is out of earshot only 6% of the time, so one click is not a fair test
        { talk: 'mm_monkey_child', picks: [1], tries: 80, why: 'ask for the talisman' },
        { talk: 'mm_monkey_child', tries: 80, until: 'mm_monkey_talisman', why: 'hand over five bananas' },
        { has: 'mm_monkey_talisman' },
        { stage: 9 },

        { note: 'real steps 39-41: back down the tunnel for the greegree' },
        ...marimOut(),
        { go: [2764, 2704], r: 250, why: 'the tunnel mouth again' },
        { loc: 'mm_bamboo_ladder_dungeon_entrance', at: [2763, 2703] },
        { go: [2800, 9144], r: 200, why: 'Zooknock' },
        { talk: 'mm_zooknock', why: 'talisman and monkey bones' },
        { talk: 'mm_zooknock', why: 'and the carving' },
        { has: 'mm_monkey_greegree_for_normal_monkey' },
        { stage: 10 },

        { note: 'real steps 47-52: as a monkey, Kruk carries you to Awowogei' },
        { go: [2764, 9104], r: 200, why: 'the tunnel exit' },
        { loc: 'mm_bamboo_ladder_dungeon_exit', at: [2763, 9103], why: 'climb out' },
        { held: 'mm_monkey_greegree_for_normal_monkey', op: 2, why: 'wield the greegree and become a monkey' },
        // Kruk stands in the walled yard between the two halves of the gate and NO tile beside him
        // can be walked to from either side - which is why the content gives him an [apnpc1]. So the
        // walk stops short and the conversation happens across the palisade.
        { go: [2722, 2763], r: 250, why: 'as close to Kruk as the ground allows - four tiles' },
        { talk: 'mm_kruk', picks: [1], tries: 30, why: 'across the palisade, as he wanders' },
        { talk: 'mm_awowogei_cutscene', tries: 20, why: 'the first audience - he shifts about on the dais' },
        { stage: 11 },

        { note: 'real steps 43-46: the Ardougne Zoo, and the walk back with no teleports' },
        ...marimOut(),
        { go: [2802, 2706], r: 250, why: "Lumdo's boat on the Ape Atoll shore" },
        { talk: 'mm_lumdo', picks: [1], why: 'back to Crash Island' },
        { go: [2893, 2729], r: 64, why: 'Waydar' },
        { talk: 'mm_waydar', picks: [1], why: 'back to the hangar' },
        { go: [2588, 4494], r: 160, why: 'the bunker teleport pad' },
        { loc: 'bunker_teleport', at: [2589, 4494], why: 'out of the hangar' },
        // the pad puts you back on the Blurberry bar walkway, a floor up
        { go: [2467, 3495], r: 64, why: 'the ladder down the Grand Tree' },
        { loc: 'laddermiddle', at: [2466, 3495], op: 3, why: 'climb down' },
        { level: 0 },
        {
            setpos: [2608, 3290, 0],
            why: 'Ardougne. The Tree Gnome Stronghold has no walkable exit on level 0 in this build - you leave by gnome glider, which is world travel rather than this quest. The glider carries the monkey: gnome_glider.rs2 has no teleport gate at all.'
        },
        { go: [2596, 3275], r: 250, why: 'the zoo' },
        // AND HOLD THE GREEGREE UP AGAIN, because leaving Ape Atoll took it off - which is the
        // whole of DeathPlateau-Bugs#49. Zooknock's magic reaches the island, the dungeon under it
        // and this monkey pen, and the walk back through the Grand Tree is none of those, so the
        // carving went back in the pack somewhere over the Feldip Hills. This step is what an OSRS
        // player does at the zoo gate and what this run was quietly not having to do.
        { held: 'mm_monkey_greegree_for_normal_monkey', op: 2, why: 'a monkey again, at the pen' },
        { talk: 'mm_monkey_minder', why: 'as a monkey, get into the cage' },
        { talk: 'mm_zoo_monkey', picks: [1], why: 'into the backpack' },
        { has: 'mm_monkey_in_backpack' },
        { stage: 12 },

        { note: 'and back to Ape Atoll carrying him - the leg the quest says you must WALK' },
        { setpos: [2465, 3490, 0], why: 'the Grand Tree by glider - the same world travel in reverse' },
        { go: [2465, 3491], r: 64, why: 'the tree doors' },
        { loc: 'treedoorl', at: [2464, 3492], why: 'open the Grand Tree door', soft: true },
        { go: [2466, 3494], r: 64, why: 'inside, to the ladder' },
        { loc: 'ladder', at: [2466, 3495] },
        { go: [2482, 3490], r: 64, why: 'Daero' },
        { talk: 'mm_daero', picks: [1], why: 'down to the hangar again' },
        { go: [2585, 4518], r: 64, why: 'Waydar' },
        { talk: 'mm_waydar', picks: [1], why: 'the glider, carrying the monkey' },
        { stage: 12 },

        { note: 'real steps 53-58: the sigil, the Jungle Demon and the King' },
        { go: [2892, 2724], r: 64 },
        { talk: 'mm_lumdo', picks: [1] },
        // And once more, for the same reason: the zoo is not Ape Atoll either, so the greegree came
        // off on the way out of Ardougne.
        { held: 'mm_monkey_greegree_for_normal_monkey', op: 2, why: 'a monkey again, back on the island' },
        { go: [2722, 2763], r: 250, why: 'Kruk again, from the only standable side' },
        // NO PICK THE SECOND TIME. By now you are a monkey with Awowogei's business to finish, and
        // Kruk does not ask - he picks you up by the scruff of the neck and puts you through the
        // gate. Asking for option 1 here reported a failure for a conversation that went perfectly.
        { talk: 'mm_kruk', tries: 30, why: 'he carries you through without asking' },
        { talk: 'mm_awowogei_cutscene', tries: 20, why: 'hand over the monkey' },
        { stage: 13 },
        { go: [2804, 2761], r: 250, why: 'Garkor' },
        { talk: 'mm_garkor' },
        { has: 'mm_sigil' },
        { stage: 14 },
        { held: 'mm_sigil', op: 2, why: 'wear it - the arena' },
        { fight: 'mm_demon' },
        { stage: 15 },
        { setpos: [2465, 3497, 0], why: 'the Grand Tree by glider again - world travel, as above' },
        { talk: 'grandtree_narnode' },
        { stage: 20 }
    ]
};

const p: any = H.makePlayer('mmrun', m.start[0], m.start[1]);
H.tick(2);
p.teleport(m.start[0], m.start[1], m.start[2]);
// THIS PLAYER DOES NOT TAKE DAMAGE, and that is a deliberate choice rather than a convenience.
// Ape Atoll is hostile to a human on foot - monkey guards and archers - and the quest walks you
// across it half a dozen times. Three runs died at different points, and a death loses the pack:
// the amulet goes, and the monkey child then answers in gibberish, so the trace blames the child
// for a fight the runner lost. This is an audit of whether the quest can be completed, not of
// whether it can be survived. The Jungle Demon still has to die properly - damage going the other
// way is untouched.
(p as any).applyDamage = function () {};
// AND NO RANDOM EVENTS. These runs walk for hundreds of ticks at a stretch and a random event
// teleports the player out of the middle of it - one run lost the walk to Zooknock at 2523,4780,
// 262 tiles into a 628-tile route, which reads as a pathing failure and is not one.
// ~macro_event_allowed refuses to spawn one while %macro_event is already set, so setting it is
// the switch. A player being interrupted by a random event is real; it is just not what is
// under test here.
H.setVar(p, 'macro_event', 1);
H.maxOut(p);
H.equip(p, { rhand: 'dragon_scimitar', torso: 'rune_platebody', legs: 'rune_platelegs', hat: 'rune_full_helm' });
H.tick(1);

const res = play(m, p);
const bad = res.filter(r => !r.ok);
console.log('');
if (bad.length) {
    console.log('WHAT WENT WRONG');
    for (const r of bad) console.log('  step ' + r.n + '  ' + r.what + (r.detail ? '  -- ' + r.detail : ''));
}
process.exit(bad.length ? 1 : 0);
