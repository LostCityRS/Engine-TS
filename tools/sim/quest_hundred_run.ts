// RECIPE FOR DISASTER, played through on foot.
//
// The last quest on the list with no walk at all, and the only one that is ten quests: the Cook's
// frame, eight frozen victims each with their own sub-quest in their own corner of the world, and
// the Culinaromancer's gauntlet at the end of it. audit1.ts has covered it since September as a
// teleporting sim - every npc, loc, pick and stage value in this file came from there - and what
// this adds is the walking: which door, which side of it, and which legs are quest and which are
// travel.
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_hundred_run.ts
import * as H from './harness.js';
import { play, Manifest, Step } from './questrun.js';

await H.boot();

// --- Lumbridge castle, and the way into the frozen room
const COOK: [number, number, number] = [3208, 3214, 0];
const KITCHEN_DOOR: [number, number] = [3207, 3217]; // hundred_lumbridge_door
const PORTAL: [number, number] = [3209, 3218]; // hundred_portal_multi, in the dining hall
const CELLAR_CHEST: [number, number] = [3219, 9623]; // hundred_goodchest

// --- the frozen dining room. The barrier landing is the tile every plinth is walked to from; x=4
//     carries the time-barrier wall, so nothing stands on it.
const BARRIER_LANDING: [number, number, number] = [1861, 5318, 0];
const ARIS: [number, number, number] = [1866, 5326, 0];
const BARRIER_OUT: [number, number] = [1861, 5316]; // hundred_portal_door1, back to Lumbridge
const PLINTHS: [string, [number, number]][] = [
    ['hundred_dwarf_ambassador_base', [1862, 5321]],
    ['hundred_goblin1_base', [1862, 5325]],
    ['hundred_pirate_base', [1862, 5323]],
    ['hundred_guide_base', [1865, 5325]],
    ['hundred_dave_base', [1865, 5323]],
    ['hundred_ogre_base', [1863, 5328]],
    ['hundred_varze_base', [1865, 5321]],
    ['hundred_monkey_base', [1865, 5319]]
];

// --- and the places the sub-quests happen
const ROHAK: [number, number] = [2865, 9876]; // hundred_dwarf_dad_multi, in the dwarf camp
const TUNNEL_EAST: [number, number] = [2876, 9878]; // the White Wolf Mountain tunnel's east end
const FOUNTAIN: [number, number] = [3221, 3226]; // a watersource, 2x2, by Lumbridge castle
const RANGE: [number, number] = [3230, 3196]; // the Lumbridge cooking range
const GEE: [number, number] = [3220, 3230]; // lumbridge_guide2_man
const DONIE: [number, number] = [3236, 3229]; // lumbridge_guide2_woman
const TRAIBORN: [number, number, number] = [3113, 3160, 1]; // the Wizards' Tower, first floor
const AMIK: [number, number, number] = [2963, 3337, 2]; // Falador castle, top floor
const MONKEYS: [number, number, number][] = [
    [2786, 2795, 0], // hundred_ilm_mizaru
    [2789, 2794, 0], // hundred_ilm_kikazaru
    [2790, 2793, 0] // hundred_ilm_iwazaru
];
const BANANA_TREE: [number, number] = [2696, 2785]; // loc_12610, a red banana at the crown
const TEMPLE_TRAPDOOR: [number, number] = [2807, 2785]; // mm_temple_trapdoor, on Ape Atoll
const CRYPT_CRACK: [number, number] = [2805, 9199]; // loc_12617, into the nut cave
const NUT_BUSH: [number, number] = [3020, 5457]; // loc_12615
const NUT_CAVE_OUT: [number, number] = [3025, 5457]; // loc_12616
const TEMPLE_ROPE: [number, number] = [2808, 9201]; // mm_climbing_rope_bottom_temple
const SNAKE_PIT: [number, number] = [2921, 2721]; // loc_12602
const SNAKE_ROPE: [number, number] = [3023, 5488]; // loc_12601, out of the pit
const RANTZ: [number, number] = [2651, 2962]; // 100_rantz_multi_npc, on the Feldip shore
const PUSH_TREE: [number, number] = [2653, 2963]; // 100_jubbly_multi_push_tree, four tiles wide
const SHORE_FIRE: [number, number] = [2650, 2958]; // open shore, clear enough to light a fire on
const DORIS: [number, number] = [3081, 3491]; // hundred_dave_mum, in her house in Edgeville
const DAVE_TRAPDOOR: [number, number] = [3077, 3493]; // 100_dave_celler_trapdoor
const DAVE_STAIRS: [number, number] = [3076, 9893]; // 100_dave_celler_stairs, back up
const DAVE: [number, number] = [3081, 9893]; // hundred_evil_dave, in his mother's cellar
const MURPHY: [number, number] = [2668, 3161]; // on the Fishing Trawler jetty at Port Khazard
const KELP: [number, number] = [2949, 9480]; // kelp_pickingpoint, on the seabed
const CRAB_PEN: [number, number] = [2974, 9514]; // pen_wall_doorl
const ANCHOR: [number, number] = [2963, 9477]; // anchor_middle, the way back up
const WARTFACE: [number, number] = [2956, 3511]; // Goblin Village
const BENTNOZE: [number, number] = [2960, 3510];
const GOBLIN_LADDER: [number, number] = [2960, 3507]; // 100_goblin_ladder_down
const GOBLIN_CAULDRON: [number, number] = [2980, 9910]; // 100_goblin_cauldren_still
const GOBLIN_LADDER_UP: [number, number] = [2981, 9916];

// EVERY SUB-QUEST ENDS AT A PLINTH, and the way back to them is the portal the Cook's frame left
// standing in the Lumbridge dining hall - not a teleport. These two little chains are walked once
// per victim, which is exactly what a player does.
const INTO_THE_ROOM: Step[] = [
    { setpos: [PORTAL[0] - 1, PORTAL[1], 0], why: 'back to Lumbridge castle, to the portal' },
    { loc: 'hundred_portal_multi', at: PORTAL, hop: true, soft: true, why: 'step through it' },
    { go: [BARRIER_LANDING[0], BARRIER_LANDING[1]], r: 32, soft: true, why: 'to the barrier landing' }
];
const OUT_OF_THE_ROOM: Step[] = [
    { go: [BARRIER_OUT[0], BARRIER_OUT[1] + 1], r: 32, soft: true, why: 'to the time barrier' },
    { loc: 'hundred_portal_door1', at: BARRIER_OUT, hop: true, soft: true, why: 'back through it' }
];

const m: Manifest = {
    quest: 'RECIPE FOR DISASTER',
    source: 'oldschool.runescape.wiki/w/Recipe_for_Disaster/Quick_guide',
    stageVar: 'hundred_main_quest_var',
    done: 5, // ^hundred_complete
    start: COOK,
    steps: [
        { note: 'requirement: Cook’s Assistant, which is what puts the Cook on speaking terms' },
        { setvar: 'cookquest', to: 2, why: '^cook_complete' },

        { note: 'wiki step 1: the Cook. The whole castle is inside a time bubble and he is the only' },
        { note: 'one out of it.' },
        { go: [COOK[0], COOK[1]], why: 'to the Cook in the castle kitchen' },
        { talk: 'cook', picks: [1], want: 'help', why: 'hear him out' },
        { stage: 1 },

        { note: 'wiki step 2: out of the kitchen and through the portal in the dining hall' },
        { go: [KITCHEN_DOOR[0], KITCHEN_DOOR[1] - 1], r: 32, why: 'to the kitchen door' },
        { loc: 'hundred_lumbridge_door', at: KITCHEN_DOOR, soft: true, why: 'open it' },
        { go: [PORTAL[0] - 1, PORTAL[1]], r: 32, why: 'to the portal' },
        { loc: 'hundred_portal_multi', at: PORTAL, hop: true, why: 'step through it' },
        { stage: 2 },
        { level: 0 },

        { note: 'wiki step 3: Aris, who explains the nine victims and the chest' },
        { go: [ARIS[0], ARIS[1] - 1], r: 64, why: 'to Aris' },
        { talk: 'hundred_aris', want: 'Culinaromancer', why: 'hear the whole story' },
        { note: 'and the Cook’s own sub-quest is already done, so the tally is 1 and the stage' },
        { note: 'goes straight to 4 - the portal in the dining hall is live from here on' },
        { stage: 4 },

        { note: 'wiki step 4: the eight other plinths, each one inspected to start its sub-quest' },
        ...(PLINTHS.flatMap(([loc, at]) => [
            { go: [BARRIER_LANDING[0], BARRIER_LANDING[1]], r: 32, why: 'back to the barrier landing' },
            { loc, at, soft: true, why: 'inspect it' }
        ]) as Step[]),
        // EIGHT BRANCHES DRAWN, NOT A STEP REACHED - hence `nomark` on every one of them.
        // Inspecting a plinth starts that person's sub-quest and moves its own varbit off zero, and
        // the player may inspect them in any order. These seven asserts land beside step 16 of this
        // leg, which is the first step of the Mountain Dwarf's, so as marks they told the panel that
        // anybody who had inspected ANY plinth was standing there - reported as "rfd. needs to track
        // only the npc inspected" (DeathPlateau-Bugs#60). The checks stay; the claim about where the
        // player is does not. The per-sub-quest marks further down the leg are real progress and are
        // left alone.
        { varis: 'hundred_dwarf_quest', to: 1, nomark: true },
        { varis: '100goblin', to: 1, nomark: true },
        { varis: '100_pirate_quest_var', to: 1, nomark: true },
        { varis: '100guide_prog', to: 1, nomark: true },
        { varis: 'hundred_dave_main', to: 1, nomark: true },
        { varis: '100_ogre_prog', to: 1, nomark: true },
        { varis: 'hundred_ilm_quest', to: 1, nomark: true },

        { note: 'and back out through the barrier, which lands you in the dining hall' },
        { go: [BARRIER_OUT[0], BARRIER_OUT[1] + 1], r: 32, why: 'to the time barrier' },
        { loc: 'hundred_portal_door1', at: BARRIER_OUT, hop: true, why: 'walk back through it' },
        { level: 0 },

        { note: 'wiki step 5: the Culinaromancer’s chest in the castle cellar, which opens its' },
        { note: 'first tier of food the moment Aris has explained it' },
        { setpos: [CELLAR_CHEST[0] - 1, CELLAR_CHEST[1] + 1, 0], why: 'down to the castle cellar' },
        { loc: 'hundred_goodchest', at: CELLAR_CHEST, op: 2, soft: true, why: 'open the food shop' },
        { close: true, why: 'shut the shop again' },

        // ------------------------------------------------------------------ Freeing the Mountain Dwarf
        { note: 'SUB-QUEST 2, the Mountain Dwarf. Rohak is at the east end of the tunnel under' },
        { note: 'White Wolf Mountain - the one the Fishing Contest opens - and he is two npcs: a' },
        { note: 'multi that is "An old Dwarf" until you learn his name, and a second shell for the' },
        { note: 'drunk version that the first one vanishes behind.' },
        { setpos: [TUNNEL_EAST[0], TUNNEL_EAST[1], 0], why: 'to the east end of the White Wolf tunnel' },
        { go: [ROHAK[0] + 1, ROHAK[1]], r: 64, why: 'to the old dwarf' },
        { talk: 'hundred_dwarf_dad_multi', want: 'Rohak', why: 'learn his name and what he wants' },
        { varis: 'hundred_dwarf_quest', to: 3 },
        { note: 'an ale with a coin in the bottom of it, which is a use rather than a shop' },
        { give: 'asgarnian_ale' },
        { give: 'coins', n: 10 },
        { use: ['coins', 'asgarnian_ale'], why: 'drop a coin in the ale' },
        { has: 'hundred_dwarf_asgarnian_ale' },
        { useNpc: 'hundred_dwarf_dad_multi', obj: 'hundred_dwarf_asgarnian_ale', why: 'hand it over' },
        { varis: 'hundred_dwarf_quest', to: 4 },
        { note: 'and drunk, he bakes the rock cake he would never have baked sober' },
        { talk: 'hundred_dwarf_drunk_multi', tries: 3, why: 'ask him again' },
        { has: 'hundred_dwarf_hot_rockcake' },
        { note: 'it comes out red hot, and the nearest water is the fountain by Lumbridge castle' },
        { setpos: [FOUNTAIN[0] - 1, FOUNTAIN[1], 0], why: 'to the fountain by Lumbridge castle' },
        { useLoc: 'fountain', at: FOUNTAIN, obj: 'hundred_dwarf_hot_rockcake', why: 'cool it down' },
        { has: 'hundred_dwarf_cool_rockcake' },
        ...INTO_THE_ROOM,
        { useLoc: 'hundred_dwarf_ambassador_base', at: PLINTHS[0][1], obj: 'hundred_dwarf_cool_rockcake', why: 'put it in his hand' },
        { varis: 'hundred_dwarf_quest', to: 7 },

        // ------------------------------------------------------------------ Freeing the Lumbridge Guide
        { note: 'SUB-QUEST 5, the Lumbridge Guide. The dish is a cake, and the three ingredients' },
        { note: 'come from the three people in Lumbridge who would have them - the Cook and the' },
        { note: 'two local farmers, Gee and Donie.' },
        ...OUT_OF_THE_ROOM,
        // THE KITCHEN DOOR HAS SHUT ITSELF BY NOW. doors.rs2 opens every door_closed with
        // ~open_door(500), and that duration is the loc_del/loc_add pair's - so the door the intro
        // opened at step 5 reverts to hundred_lumbridge_door five hundred ticks later, and this is
        // the first step that needs it again, five sub-quests downstream. Whether the run had got
        // here inside five hundred ticks was the only thing deciding it, which is how an unrelated
        // content commit could turn it red: nothing about the door or the castle changed, the run
        // simply took a few ticks longer. A player walking back to the Cook opens the door again,
        // so the run does too. soft, and named for the CLOSED stage, so it is a no-op on a run
        // that did get here in time - the open door is a different loc and this simply does not
        // find it, rather than helpfully closing it again.
        { loc: 'hundred_lumbridge_door', at: KITCHEN_DOOR, soft: true, why: 'the kitchen door shuts itself, so it is closed again by now' },
        { go: [COOK[0], COOK[1]], r: 64, why: 'to the Cook' },
        { talk: 'cook', tries: 3, why: 'ask for flour' },
        { setpos: [GEE[0], GEE[1] - 1, 0], why: 'out to the farms east of the castle' },
        { talk: 'lumbridge_guide2_man', tries: 3, why: 'ask Gee for an egg' },
        { go: [DONIE[0], DONIE[1] - 1], r: 96, why: 'to Donie' },
        { talk: 'lumbridge_guide2_woman', tries: 3, why: 'ask Donie for milk' },
        { has: 'pot_flour' },
        { has: 'egg' },
        { has: 'bucket_milk' },
        { give: 'cake_tin' },
        { use: ['pot_flour', 'cake_tin'], why: 'mix the cake' },
        { has: 'uncooked_cake' },
        { note: 'AND THE RANGE IS NOT REACHABLE FROM THE WEST. It is a 1x2 oven at 3230,3196-7,' },
        { note: 'and a use sent from 3229,3196 gets the engine’s cannot-reach line and nothing' },
        { note: 'else - no refusal about the cake, no cooking, just silence in the step report.' },
        { note: 'From 3230,3197, on the oven itself, it cooks.' },
        { setpos: [RANGE[0], RANGE[1] + 1, 0], why: 'to the range south of the castle' },
        { note: 'and the range takes a few ticks to finish, while the use step stops as soon as' },
        { note: 'the chat goes quiet' },
        { useLoc: 'range', at: RANGE, obj: 'uncooked_cake', why: 'bake it' },
        { wait: 10, why: 'the range' },
        { has: 'cake' },
        { note: 'and A PLAIN CAKE IS NOT THE DISH - the plinth says so in as many words. What he' },
        { note: 'is reaching for is a cake of GUIDANCE, and Wizard Traiborn is the one who makes' },
        { note: 'one, so the plain cake is offered first to see it refused.' },
        ...INTO_THE_ROOM,
        { useLoc: 'hundred_guide_base', at: PLINTHS[3][1], obj: 'cake', soft: true, why: 'offer the plain cake' },
        { has: 'cake' },
        ...OUT_OF_THE_ROOM,
        { note: 'and 3113,3159 - the tile south of him - is WALL, so a jump to it leaves the talk' },
        { note: 'with nothing to click and no menu to answer' },
        { setpos: [TRAIBORN[0] - 1, TRAIBORN[1], TRAIBORN[2]], why: 'to the Wizards’ Tower, first floor' },
        { talk: 'traiborn', picks: [2], tries: 3, why: 'have it enchanted' },
        { has: 'hundred_cake_of_guidance' },
        ...INTO_THE_ROOM,
        { useLoc: 'hundred_guide_base', at: PLINTHS[3][1], obj: 'hundred_cake_of_guidance', why: 'put it in his hand' },
        { varis: '100guide_prog', to: 2 },

        // ------------------------------------------------------------------ Freeing Sir Amik Varze
        { note: 'SUB-QUEST 8, Sir Amik Varze. He is ASKED, not taken over - option 2 of his menu,' },
        { note: 'because the quest branch running first would leave Black Knights’ Fortress' },
        { note: 'unstartable. The dish is a fruit blast with ashes in it.' },
        ...OUT_OF_THE_ROOM,
        { setpos: [AMIK[0], AMIK[1] - 1, AMIK[2]], why: 'to the top floor of Falador castle' },
        { talk: 'sir_amik_varze', picks: [2], tries: 3, why: 'ask him what he wanted' },
        { give: 'fruit_blast' },
        { give: 'ashes' },
        { use: ['ashes', 'fruit_blast'], why: 'spoil it properly' },
        { has: 'hundred_fruit_blast' },
        ...INTO_THE_ROOM,
        { useLoc: 'hundred_varze_base', at: PLINTHS[6][1], obj: 'hundred_fruit_blast', why: 'put it in his hand' },

        // ------------------------------------------------------------------ Freeing the Goblin generals
        { note: 'SUB-QUEST 3, the Goblin generals. Two generals who cannot agree, three dishes to' },
        { note: 'bring them, and a cauldron in the goblin kitchen that makes one out of all three.' },
        ...OUT_OF_THE_ROOM,
        { setpos: [WARTFACE[0], WARTFACE[1] - 1, 0], why: 'to Goblin Village' },
        { talk: 'general_wartface', tries: 3, why: 'ask Wartface' },
        { go: [BENTNOZE[0], BENTNOZE[1] - 1], r: 32, why: 'to Bentnoze' },
        { talk: 'general_bentnoze', tries: 3, why: 'and Bentnoze' },
        { varis: '100goblin', to: 2 },
        { give: 'bread' },
        { give: 'bucket_water' },
        { give: 'fishing_bait' },
        { give: 'spicespot' },
        { give: 'orange_slices' },
        { give: 'reddye' },
        { use: ['bucket_water', 'bread'], why: 'soggy bread' },
        { use: ['spicespot', 'fishing_bait'], why: 'spicy maggots' },
        { use: ['reddye', 'orange_slices'], why: 'dyed oranges' },
        { has: '100goblin_soggy_bread' },
        { has: '100goblin_spicey_maggots' },
        { has: '100goblin_dyed_oranges' },
        { note: 'and the cauldron in the kitchen under the village blows the three into one' },
        { note: 'AND THE LADDER IS IN A DIFFERENT HUT. Nothing around it has a walking route from' },
        { note: 'the generals’ hut, because there are two doors in the way - walkgraph named them' },
        { note: 'both: out through the generals’ own double door, then in through the next hut’s.' },
        { go: [2956, 3508], r: 64, why: 'to the generals’ door' },
        { loc: 'goblin_outpost_poordoor_double_inner', at: [2957, 3509], soft: true, why: 'out of their hut' },
        { go: [2957, 3505], r: 64, why: 'round to the next hut' },
        { loc: 'goblin_outpost_poordoor', at: [2958, 3506], soft: true, why: 'in through its door' },
        { go: [GOBLIN_LADDER[0], GOBLIN_LADDER[1] - 1], r: 32, why: 'to the ladder down' },
        { loc: '100_goblin_ladder_down', at: GOBLIN_LADDER, hop: true, soft: true, why: 'climb down' },
        { useLoc: '100_goblin_cauldren_still', at: GOBLIN_CAULDRON, obj: '100goblin_soggy_bread', why: 'in it goes' },
        { wait: 12, why: 'the cauldron' },
        { has: '100goblin_compromise_mush' },
        { varis: '100goblin', to: 3 },
        { go: [GOBLIN_LADDER_UP[0], GOBLIN_LADDER_UP[1] - 1], r: 64, soft: true, why: 'back to the ladder' },
        { loc: '100_goblin_ladder_up', at: GOBLIN_LADDER_UP, hop: true, soft: true, why: 'climb out' },
        ...INTO_THE_ROOM,
        { useLoc: 'hundred_goblin1_base', at: PLINTHS[1][1], obj: '100goblin_compromise_mush', why: 'put it in his hand' },

        // ------------------------------------------------------------------ Freeing Pirate Pete
        { note: 'SUB-QUEST 4, Pirate Pete. The dish is a fishcake, and three of its four' },
        { note: 'ingredients are on the seabed under the Fishing Trawler - Murphy lends the' },
        { note: 'diving gear and lowers you down. He is ASKED, not taken over: option 2 of his' },
        { note: 'menu, so the trawler still works while this is open.' },
        ...OUT_OF_THE_ROOM,
        { setpos: [MURPHY[0], MURPHY[1] - 1, 0], why: 'to Port Khazard, the trawler jetty' },
        { talk: 'murphy', picks: [2], tries: 3, why: 'ask about the seabed' },
        { varis: '100_pirate_quest_var', to: 2 },
        { has: 'hundred_pirate_diving_helmet' },
        { has: 'hundred_pirate_diving_backpack' },
        { note: 'and BOTH have to be WORN before he will lower you - he checks the worn inventory,' },
        { note: 'not the pack' },
        { held: 'hundred_pirate_diving_helmet', op: 2, why: 'put the helmet on' },
        { held: 'hundred_pirate_diving_backpack', op: 2, why: 'and the apparatus' },
        { worn: 'hundred_pirate_diving_helmet' },
        { worn: 'hundred_pirate_diving_backpack' },
        { talk: 'murphy', picks: [2, 1], tries: 3, why: 'ask to be lowered down' },
        { varis: '100_pirate_quest_var', to: 3 },
        { level: 1 },
        { note: 'kelp off the seabed floor' },
        { go: [KELP[0] + 1, KELP[1]], r: 192, soft: true, why: 'to the kelp' },
        { loc: 'kelp_pickingpoint', at: KELP, why: 'pick some' },
        { has: 'hundred_pirate_kelp' },
        { note: 'and crab meat out of the pen, which has to be opened first' },
        { setpos: [CRAB_PEN[0], CRAB_PEN[1] - 1, 1], why: 'round to the crab pen' },
        { loc: 'pen_wall_doorl', at: CRAB_PEN, soft: true, why: 'open the pen' },
        { fight: ['hundred_pirate_giant_crab', 'hundred_pirate_giant_crab_2'], until: 'hundred_pirate_giant_crab_meat', r: 12, tries: 20, why: 'a giant crab' },
        { take: 'hundred_pirate_giant_crab_meat', r: 8, soft: true, why: 'the meat' },
        { has: 'hundred_pirate_giant_crab_meat' },
        { note: 'and back up the anchor chain, which comes out at Port Khazard' },
        { setpos: [ANCHOR[0], ANCHOR[1] + 2, 1], why: 'to the anchor' },
        { loc: 'anchor_middle', at: ANCHOR, hop: true, soft: true, why: 'climb the chain' },
        { level: 0 },
        { note: 'four things ground in a pestle and mortar, and the kelp mixed into the crumbs' },
        { give: 'raw_cod' },
        { give: 'bread' },
        { give: 'pestle_and_mortar' },
        { use: ['pestle_and_mortar', 'hundred_pirate_kelp'], why: 'grind the kelp' },
        { use: ['pestle_and_mortar', 'hundred_pirate_giant_crab_meat'], why: 'the crab meat' },
        { use: ['pestle_and_mortar', 'raw_cod'], why: 'the cod' },
        { use: ['pestle_and_mortar', 'bread'], why: 'and breadcrumbs' },
        { has: 'hundred_pirate_ground_kelp' },
        { has: 'hundred_pirate_ground_giant_crab_meat' },
        { has: 'hundred_pirate_ground_cod' },
        { has: 'hundred_pirate_breadcrumbs' },
        { use: ['hundred_pirate_ground_kelp', 'hundred_pirate_breadcrumbs'], why: 'mix the fishcake' },
        { has: 'hundred_pirate_raw_fishcake' },
        { setpos: [RANGE[0], RANGE[1] + 1, 0], why: 'back to the Lumbridge range' },
        { useLoc: 'range', at: RANGE, obj: 'hundred_pirate_raw_fishcake', why: 'cook it' },
        { wait: 10, why: 'the range' },
        { has: 'hundred_pirate_fishcake' },
        ...INTO_THE_ROOM,
        { useLoc: 'hundred_pirate_base', at: PLINTHS[2][1], obj: 'hundred_pirate_fishcake', why: 'put it in his hand' },

        // ------------------------------------------------------------------ Freeing Evil Dave
        { note: 'SUB-QUEST 6, Evil Dave. His mother points you at the cellar under her house; the' },
        { note: 'dish is a stew spiced to a recipe he will not tell you, three doses out of four' },
        { note: 'colours, and the hints in the journal are all you get.' },
        ...OUT_OF_THE_ROOM,
        { setpos: [DORIS[0], DORIS[1] - 1, 0], why: 'to Doris’s house in Edgeville' },
        { talk: 'hundred_dave_mum', tries: 3, why: 'ask after her son' },
        { varis: 'hundred_dave_main', to: 2 },
        { note: 'the trapdoor takes two clicks: one to open it, one to go down' },
        { go: [DAVE_TRAPDOOR[0] + 1, DAVE_TRAPDOOR[1]], r: 32, soft: true, why: 'to the trapdoor' },
        { loc: '100_dave_celler_trapdoor', at: DAVE_TRAPDOOR, soft: true, why: 'open it' },
        { loc: '100_dave_celler_trapdoor', at: DAVE_TRAPDOOR, hop: true, soft: true, why: 'climb down' },
        { note: 'AND THE THREE DOSES ARE ROLLED WHEN HE NAMES THE STEW - three times random(4),' },
        { note: 'one per dose, into four colour counters. Pinned low they all come out red, which' },
        { note: 'is the only way a step list can know what he wants without reading the varps back.' },
        { rng: 0, why: 'random(4) = 0 three times: all three doses red' },
        { go: [DAVE[0] - 1, DAVE[1]], r: 48, soft: true, why: 'to Evil Dave' },
        { talk: 'hundred_evil_dave', tries: 3, why: 'let him name the stew' },
        { rng: null },
        { varis: 'hundred_dave_main', to: 3 },
        { varis: 'hundred_dave_red_target', to: 3 },
        { note: 'the spice itself comes off a pet cat catching hell-rats in this cellar - a shaker' },
        { note: 'a rat, random colour, one to four doses. That loop is the cat’s, not the walk’s,' },
        { note: 'and audit1.ts drives it through [proc,hundred_dave_hellrat_caught]; here the' },
        { note: 'shaker is handed over, like the papyrus and the axes elsewhere.' },
        { give: 'stew' },
        { give: 'hundred_dave_spice_red_4' },
        { use: ['hundred_dave_spice_red_4', 'stew'], why: 'the first dose' },
        { use: ['hundred_dave_spice_red_3', 'hundred_dave_stew'], why: 'the second' },
        { use: ['hundred_dave_spice_red_2', 'hundred_dave_stew'], why: 'and the third' },
        { varis: 'hundred_dave_red', to: 3 },
        { useNpc: 'hundred_evil_dave', obj: 'hundred_dave_stew', tries: 3, why: 'let him taste it' },
        { varis: 'hundred_dave_main', to: 4 },
        { go: [DAVE_STAIRS[0] + 1, DAVE_STAIRS[1]], r: 48, soft: true, why: 'back to the cellar stairs' },
        { loc: '100_dave_celler_stairs', at: DAVE_STAIRS, hop: true, soft: true, why: 'climb out' },
        { level: 0 },
        ...INTO_THE_ROOM,
        { useLoc: 'hundred_dave_base', at: PLINTHS[4][1], obj: 'hundred_dave_stew', why: 'put it in his hand' },

        // ------------------------------------------------------------------ Freeing Skrach Uglogwee
        { note: 'SUB-QUEST 7, Skrach Uglogwee. The dish is a jubbly bird, which lives on an island' },
        { note: 'off the Feldip shore - so the sub-quest is really a boat: Rantz pushes a tree' },
        { note: 'over, you cut the roots off and hollow it out, and his kids row you across.' },
        ...OUT_OF_THE_ROOM,
        { setpos: [RANTZ[0], RANTZ[1] - 1, 0], why: 'to the Feldip shore' },
        { talk: '100_rantz_multi_npc', tries: 3, why: 'ask Rantz for help' },
        { varis: '100_ogre_prog', to: 3 },
        { note: 'the tree is one six-state multiloc and none of the six declares an op, so every' },
        { note: 'step of the boat is an axe used on it' },
        { give: 'bronze_axe' },
        { go: [PUSH_TREE[0] - 2, PUSH_TREE[1] - 2], r: 64, soft: true, why: 'to the fallen tree' },
        { useLoc: '100_jubbly_multi_push_tree', at: PUSH_TREE, obj: 'bronze_axe', soft: true, why: 'cut the roots off' },
        { useLoc: '100_jubbly_multi_push_tree', at: PUSH_TREE, obj: 'bronze_axe', soft: true, why: 'and hollow it out' },
        { varis: '100_ogre_prog', to: 5 },
        { go: [RANTZ[0], RANTZ[1] - 1], r: 64, soft: true, why: 'back to Rantz' },
        { talk: '100_rantz_multi_npc', tries: 3, why: 'have him launch it' },
        { varis: '100_ogre_prog', to: 6 },
        { has: '100_jubbly_balloon_toad_brown' },
        { note: 'and the boat on the shore is out on the water by then, so the crossing is asked' },
        { note: 'of Rantz rather than clicked on the boat' },
        { talk: '100_rantz_multi_npc', picks: [1], tries: 3, why: 'ask to be rowed across' },
        { wait: 6, why: 'the crossing' },
        { level: 0 },
        { note: 'a balloon toad inflated on the island brings a jubbly bird down on it' },
        { held: '100_jubbly_balloon_toad_brown', op: 1, soft: true, why: 'inflate a toad' },
        { fight: '100_jubbly_bird', r: 16, tries: 20, why: 'the jubbly bird' },
        { talk: '100_jubbly_bird_dead', op: 4, tries: 3, soft: true, why: 'pluck it' },
        { varis: '100_ogre_prog', to: 7 },
        { note: 'and the bird DROPS its meat rather than handing it over - seven pieces on the' },
        { note: 'floor where it fell, which is why the pluck leaves the pack empty' },
        { take: '100_jubbly_meat_raw', r: 8, soft: true, why: 'the raw jubbly' },
        { has: '100_jubbly_meat_raw' },
        { note: 'back across, and A BIRD THAT SIZE NEEDS AN OPEN FIRE - the cooking row says so in' },
        { note: 'as many words, so the range is no use and the walk lights one on the shore.' },
        { talk: '100_jubbly_multi_boat_karamja', tries: 3, soft: true, why: 'row back' },
        { wait: 6, why: 'the crossing' },
        { setpos: [SHORE_FIRE[0], SHORE_FIRE[1], 0], why: 'to a clear patch of the Feldip shore' },
        { give: 'tinderbox' },
        { give: 'logs' },
        { rng: 0, why: 'the firemaking roll' },
        { use: ['tinderbox', 'logs'], soft: true, why: 'light a fire' },
        { rng: null },
        { wait: 4, why: 'the fire catching' },
        { useLoc: 'fire', at: SHORE_FIRE, near: 3, obj: '100_jubbly_meat_raw', why: 'roast the jubbly' },
        { wait: 10, why: 'the fire' },
        { has: '100_jubbly_meat_cooked' },
        ...INTO_THE_ROOM,
        { useLoc: 'hundred_ogre_base', at: PLINTHS[5][1], obj: '100_jubbly_meat_cooked', why: 'put it on his platter' },

        // ------------------------------------------------------------------ Freeing King Awowogei
        { note: 'SUB-QUEST 9, King Awowogei. Every step of it is on or under Ape Atoll, so it' },
        { note: 'needs Monkey Madness. The three wise monkeys give the recipe; the dish is a snake' },
        { note: 'stuffed with sliced red banana and Tchiki nut paste.' },
        ...OUT_OF_THE_ROOM,
        { note: 'AND BY NOW THE PACK IS FULL, which in this build means a range does nothing at' },
        { note: 'all when you use something on it - no refusal, no message, no cooking, exactly' },
        { note: 'as the Legends’ Quest orb cast behaves. Eight sub-quests of leftovers go here.' },
        {
            drop: [
                '100_jubbly_balloon_toad_brown',
                'hundred_pirate_ground_giant_crab_meat',
                'hundred_pirate_ground_cod',
                'hundred_pirate_diving_helmet',
                'hundred_pirate_diving_backpack',
                'bronze_axe',
                'tinderbox',
                'logs',
                'hundred_dave_spice_red_1',
                'egg',
                'bucket_milk',
                'coins',
                'raw_cod',
                'bread',
                'fishing_bait',
                'spicespot',
                'orange_slices',
                'reddye',
                'bucket_water',
                '100goblin_spicey_maggots',
                '100goblin_dyed_oranges',
                'cake_tin',
                'asgarnian_ale',
                'ashes',
                'fruit_blast',
                'stew'
            ],
            why: 'eight sub-quests of leftovers'
        },
        { setpos: [MONKEYS[0][0], MONKEYS[0][1] - 1, 0], why: 'to Marim, on Ape Atoll' },
        { talk: 'hundred_ilm_mizaru', tries: 3, why: 'see no evil' },
        { go: [MONKEYS[1][0], MONKEYS[1][1] - 1], r: 32, soft: true, why: 'to the second' },
        { talk: 'hundred_ilm_kikazaru', tries: 3, why: 'hear no evil' },
        { go: [MONKEYS[2][0], MONKEYS[2][1] - 1], r: 32, soft: true, why: 'to the third' },
        { talk: 'hundred_ilm_iwazaru', tries: 3, why: 'speak no evil' },
        { varis: 'hundred_ilm_quest', to: 2 },
        { note: 'the red bananas grow at the crown, out of reach - the tree’s middle state has the' },
        { note: 'pull-down animation and no ops at all, which is the mechanic written into the' },
        { note: 'cache. Two clicks: haul the crown down, then pick.' },
        { note: 'and hauling it down takes a rope and a gorilla. hundred_monkey.rs2 asks for both -' },
        { note: 'it was changed after a player reported "it auto used rope didnt have in inv, and" ' },
        { note: 'didnt need to be a gorilla" - and each refusal is a mesbox and a return, so the' },
        { note: 'tree never bent and there was never a red one to pick.' },
        { note: 'and a greegree only works once Monkey Madness has carved you one - mm_stage3 guards' },
        { note: 'the hold on %mm_main, which this run has never touched. ^mm_has_greegree is 10.' },
        { setvar: 'mm_main', to: 10, why: 'Zooknock has carved the greegree' },
        { give: 'rope' },
        { give: 'mm_monkey_greegree_for_normal_gorilla' },
        { held: 'mm_monkey_greegree_for_normal_gorilla', op: 2, why: "wear it - the pull needs a gorilla's shoulders" },
        { worn: 'mm_monkey_greegree_for_normal_gorilla' },
        { setpos: [BANANA_TREE[0] + 1, BANANA_TREE[1] - 1, 0], why: 'to the banana tree' },
        { note: 'AND WIELDING ONE TAKES MONKEY MADNESS. [opheld2,_mm_greegree] is a category trigger' },
        { note: 'and beats the global wear, so it does the equip itself and refuses below' },
        { note: '%mm_main = ^mm_has_greegree with "Nothing happens. Whatever this is, it is not for' },
        { note: 'you yet." Awowogei\'s subquest requires Monkey Madness anyway, so the run has it.' },
        { setvar: 'mm_main', to: 10, why: '^mm_has_greegree - Zooknock has carved the first one' },
        { give: 'mm_monkey_greegree_for_normal_gorilla' },
        { held: 'mm_monkey_greegree_for_normal_gorilla', op: 2, why: 'wield it - a gorilla has the shoulders for the haul' },
        { give: 'rope' },
        { loc: 'loc_12610', at: BANANA_TREE, soft: true, why: 'haul the crown down' },
        { loc: 'loc_12610', at: BANANA_TREE, soft: true, why: 'and pick one' },
        { has: 'hundred_ilm_red_banana' },
        { note: 'the Tchiki nuts are in a cave only reachable through the Monkey Madness crypt -' },
        { note: 'the temple trapdoor, the crypt, a crack in its wall, and back up the rope' },
        { setpos: [2792, 2772, 0], why: 'to the temple' },
        { go: [TEMPLE_TRAPDOOR[0] - 1, TEMPLE_TRAPDOOR[1]], r: 192, soft: true, why: 'to the trapdoor' },
        { loc: 'mm_temple_trapdoor', at: TEMPLE_TRAPDOOR, soft: true, why: 'open it' },
        { loc: 'mm_temple_trapdoor_open', at: TEMPLE_TRAPDOOR, hop: true, soft: true, why: 'climb down' },
        { go: [CRYPT_CRACK[0] + 1, CRYPT_CRACK[1]], r: 96, soft: true, why: 'through the crypt to the crack' },
        { loc: 'loc_12617', at: CRYPT_CRACK, hop: true, soft: true, why: 'squeeze through it' },
        { go: [NUT_BUSH[0] + 1, NUT_BUSH[1]], r: 96, soft: true, why: 'to the nut bush' },
        { loc: 'loc_12615', at: NUT_BUSH, soft: true, why: 'pick the Tchiki nuts' },
        { has: 'hundred_ilm_tchiki_monkey_nuts' },
        { go: [NUT_CAVE_OUT[0] - 1, NUT_CAVE_OUT[1]], r: 96, soft: true, why: 'to the way out' },
        { loc: 'loc_12616', at: NUT_CAVE_OUT, hop: true, soft: true, why: 'climb out' },
        { go: [TEMPLE_ROPE[0] - 1, TEMPLE_ROPE[1]], r: 96, soft: true, why: 'back to the rope' },
        { loc: 'mm_climbing_rope_bottom_temple', at: TEMPLE_ROPE, hop: true, soft: true, why: 'climb it' },
        { note: 'and the snake is in a pit in the south-east jungle' },
        { setpos: [SNAKE_PIT[0] - 1, SNAKE_PIT[1], 0], why: 'to the pit in the jungle' },
        { loc: 'loc_12602', at: SNAKE_PIT, hop: true, soft: true, why: 'climb in' },
        { fight: 'hundred_ilm_snake', until: 'hundred_ilm_snake_corpse', r: 16, tries: 20, soft: true, why: 'a big snake' },
        { take: 'hundred_ilm_snake_corpse', r: 8, soft: true, why: 'its corpse' },
        { has: 'hundred_ilm_snake_corpse' },
        { go: [SNAKE_ROPE[0] - 1, SNAKE_ROPE[1]], r: 96, soft: true, why: 'to the rope out' },
        { loc: 'loc_12601', at: SNAKE_ROPE, hop: true, soft: true, why: 'climb out' },
        { give: 'knife' },
        { give: 'pestle_and_mortar' },
        { use: ['knife', 'hundred_ilm_red_banana'], why: 'slice the banana' },
        { use: ['pestle_and_mortar', 'hundred_ilm_tchiki_monkey_nuts'], why: 'grind the nuts' },
        { use: ['hundred_ilm_sliced_red_banana', 'hundred_ilm_snake_corpse'], why: 'stuff the snake' },
        { has: 'hundred_ilm_correctly_stuffed_snake' },
        { setpos: [RANGE[0], RANGE[1] + 1, 0], why: 'back to the Lumbridge range' },
        // AN OPEN BOX EATS THE CLICK, SILENTLY. This cook did nothing at all in a full run - no
        // message, no Cooking xp, and the RAW snake still in the pack two steps later, where it
        // surfaced as "not carrying hundred_ilm_cooked_stuffed_snake" and read like a missing item
        // rather than a cook that never happened. It is not the burn roll and not the range: the
        // same obj on the same range at the same coord cooks twenty times out of twenty in
        // isolation through this very helper, and the cake (step 75) and the fishcake (step 170)
        // both cook on that range earlier in this same run.
        //
        // What stops it is the state the run arrives in. audit1.ts roasts the same snake and found
        // the same thing - "A LEFTOVER DELAY OR AN OPEN BOX EATS THE CLICK, silently" - and gets
        // there with a loop of its own, up to eight goes, clearing the delay and the modal before
        // each. Clearing them here without retrying was NOT enough on its own, so the retry is the
        // part that matters; `tries` on useLoc exists for this and does the same clearing between
        // attempts. Clicking again is what a player does when nothing happens.
        //
        // The `want` goes on at the same time, because without it this step reported ok on arrival
        // alone - the silent false pass questrun's own useLoc comment is about - so a cook that
        // never happened was recorded as a pass for as long as this manifest has existed.
        { useLoc: 'range', at: RANGE, obj: 'hundred_ilm_correctly_stuffed_snake', want: 'You roast the stuffed snake', tries: 8, why: 'roast it' },
        { wait: 10, why: 'the range' },
        { has: 'hundred_ilm_cooked_stuffed_snake' },
        ...INTO_THE_ROOM,
        { useLoc: 'hundred_monkey_base', at: PLINTHS[7][1], obj: 'hundred_ilm_cooked_stuffed_snake', why: 'put it on his platter' },

        // ------------------------------------------------------------------ The Culinaromancer
        { note: 'SUB-QUEST 10, the Culinaromancer himself. Nine victims out, and Aris will put you' },
        { note: 'in the arena with him - five minions and then the man, one after another.' },
        { go: [ARIS[0], ARIS[1] - 1], r: 64, soft: true, why: 'to Aris' },
        { talk: 'hundred_aris', picks: [1], tries: 3, why: 'ask to be sent in' },
        { level: 2 },
        { fight: 'hundred_minion1', untilvar: 'hundred_minionskilled_tally', to: 1, r: 16, tries: 40, why: 'the first minion' },
        { fight: 'hundred_minion2', untilvar: 'hundred_minionskilled_tally', to: 2, r: 16, tries: 40, why: 'the second' },
        { fight: 'hundred_minion3', untilvar: 'hundred_minionskilled_tally', to: 3, r: 16, tries: 40, why: 'the third' },
        { fight: 'hundred_minion4', untilvar: 'hundred_minionskilled_tally', to: 4, r: 16, tries: 40, why: 'the fourth' },
        { note: 'THE GELATINNOTH MOTHER IS ONE NPC WITH SIX FORMS, changed every thirty ticks, and' },
        { note: 'five of the six sit behind a magic defence of 1000 - so a scimitar gets one window' },
        { note: 'in six to land her 190 hitpoints inside the lifetime she has. All six names go in' },
        { note: 'one fight step, because they are the same npc and killing her is one kill.' },
        {
            fight: ['hundred_minion5_air', 'hundred_minion5_water', 'hundred_minion5_fire', 'hundred_minion5_earth', 'hundred_minion5_melee', 'hundred_minion5_ranged'],
            untilvar: 'hundred_minionskilled_tally',
            to: 5,
            r: 16,
            tries: 60,
            why: 'the Gelatinnoth Mother'
        },
        { fight: 'hundred_culinaromancer_final', untilvar: 'hundred_minionskilled_tally', to: 6, r: 16, tries: 60, why: 'the Culinaromancer' },
        { note: 'and the end of it is two mesboxes with the teleport out and the lamp BETWEEN them,' },
        { note: 'so they have to be clicked through rather than closed - a close here leaves the' },
        { note: 'Culinaromancer dead, the player still in the arena and no lamp given, which is' },
        { note: 'the shape ~hundred_finale_finish’s own comment warns about.' },
        { resume: true, want: 'dining hall is a dining hall again', why: 'click through to the end' },
        { wait: 8, why: 'the reward' },
        { stage: 5 },
        { has: 'hundred_rewardlamp' },
        { level: 0 }
    ]
};

const p: any = H.makePlayer('hundredrun', m.start[0], m.start[1]);
H.tick(2);
p.teleport(m.start[0], m.start[1], m.start[2]);
p.applyDamage = function () {};
H.setVar(p, 'macro_event', 1);
H.maxOut(p);
H.equip(p, { rhand: 'rune_scimitar', torso: 'rune_platebody', legs: 'rune_platelegs' });
// and the combat varps after both, or the gauntlet at the end is unwinnable - see
// quest_shilo_run.ts for the same thing costing a whole fight
H.runProc(p, '[proc,player_combat_stat]');
H.tick(1);

const res = play(m, p);
const bad = res.filter(r => !r.ok);
console.log('');
if (bad.length) {
    console.log('WHAT WENT WRONG');
    for (const r of bad) console.log('  step ' + r.n + '  ' + r.what + (r.detail ? '  -- ' + r.detail : ''));
}
process.exit(bad.length ? 1 : 0);
