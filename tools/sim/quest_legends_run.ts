// LEGENDS' QUEST, played through on foot.
//
// Quest 106 of the quest-by-quest pass, the last of the list and the biggest thing in it: 5,886
// lines across twenty-one files, sixty-one steps in the quick guide, thirty-five stages and
// thirty-one sub-bits, three fights with the same demon, a seven-gem puzzle, a tree that has to be
// grown and carved before it rots, and no coverage at all before this.
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_legends_run.ts
import * as H from './harness.js';
import { play, Manifest, Step } from './questrun.js';

await H.boot();

// --- the Legends' Guild, east of Ardougne
const GUARD: [number, number, number] = [2724, 3351, 0];
const _GUILD_GATEGUILD_GATE: [number, number] = [2728, 3349];
const _GUILD_DOORGUILD_DOOR: [number, number] = [2728, 3373];
const RADIMUS: [number, number, number] = [2726, 3367, 0];
const STUDY_DOOR: [number, number] = [2726, 3368];
const CUPBOARD: [number, number] = [2724, 3370];
const MAIN_HALL: [number, number, number] = [2727, 3378, 0];

// --- the Kharazi Jungle. Three zones, one papyrus-and-charcoal map each:
//     west 2757-2815, middle 2816-2879, east 2880-2974, all z 2882-2935.
const JUNGLE_GATE_N: [number, number] = [2820, 2940]; // the north edge, outside the dense bush
const DENSE_BUSH: [number, number] = [2820, 2939]; // kharazi_jungle_tree2
const MAP_WEST: [number, number] = [2780, 2920];
const MAP_MIDDLE: [number, number] = [2840, 2920];
const MAP_EAST: [number, number] = [2910, 2920];
const FORESTER: [number, number, number] = [2764, 2946, 0];
const TOTEM: [number, number] = [2793, 2908]; // lg_ord_totem_pole
const SHAMAN_ROCKS: [number, number] = [2781, 2936]; // lgshamancaverock1, the mossy rock

// --- Ungadulu's cave, under the jungle
const _UNGADULUUNGADULU: [number, number, number] = [2791, 9328, 0];
const FIREWALL_W: [number, number] = [2787, 9328]; // lqfirewall_diagonal, the west face of the octagram
// and the plain west wall two tiles north of it, which is the one to cross. ~legends_fire_wall_walk
// reads the player's own coord against the loc's to decide which side to put you on, and for a
// STRAIGHT wall angled east it only looks at x - so any tile west of it lands you at 2789,9331,
// inside the ring. The diagonal next door compares x AND z, and a router that stops a tile off in
// z throws you out onto the ring instead, where the shaman is out of spell range.
const FIREWALL_CROSS: [number, number] = [2788, 9331]; // lqfirewall_straight, angle east
const FIREWALL_CROSS_OUT: [number, number] = [2787, 9331]; // stand here to cross in
const _FIREWALL_CROSS_INFIREWALL_CROSS_IN: [number, number] = [2789, 9331]; // and here to cross back
const CAVE_EXIT: [number, number] = [2772, 9342]; // shaman_entrance_cavel
const REEDS: [number, number] = [2836, 2916];
const POOL: [number, number] = [2837, 2915]; // sacred_water

// --- the catacombs, reached through the crevice behind the shaman's bookcase. Every room in this
//     cave is its own pocket: walkgraph finds 262 regions and seventeen edges in the region, and
//     the only joins it can see are the two ancient gates, the crumbled wall and the magic trial
//     gate. The bookcase, the boulders and the marked wall all move the player by script.
const BOOKCASE: [number, number] = [2795, 9339]; // shaman_bookcase, clicked from 2795,9338
const CATACOMB_IN: [number, number] = [2809, 9333]; // where the crevice puts you, north of the gates
const LOCKPICK_GATE: [number, number] = [2810, 9332]; // lglockpickgatebottoml - 50 Thieving
const BOULDERS: [number, number][] = [
    [2809, 9327],
    [2809, 9323],
    [2809, 9319]
]; // mine_test_boulder1/2/3 - 52 Mining
const STRENGTH_GATE: [number, number] = [2810, 9314]; // lgstrengthtrialgatel - 50 Strength
const CRUMBLED_WALL: [number, number] = [2790, 9296]; // jumped from 2790,9295 - 50 Agility
const MARKED_WALL: [number, number] = [2779, 9305]; // lgancientwalldoor, the five depressions
const GEM_ROOM_IN: [number, number] = [2774, 9301]; // where the marked wall drops you
const MAGIC_GATE: [number, number] = [2762, 9313]; // lgmagictrialgateclosed, fused into the rock
const WINCH: [number, number] = [2759, 9329]; // lg_winchdown_norope, over the hole

// --- the Viyeldi caves, at the bottom of the hole. The rope drops you on an eleven-tile ledge and
//     the cave proper is 1458 tiles away across six climbs, every one of them a teleport: walkgraph
//     finds 1032 regions down here and six edges, none of which are these.
const _VIYELDI_INVIYELDI_IN: [number, number] = [2377, 4712]; // where the rope lands you
const CLIMBS: [string, [number, number], [number, number], string][] = [
    ['rocky_ledge', [2377, 4717], [2378, 4717], 'nothing more exciting'],
    ['rocky_ledge1', [2377, 4728], [2377, 4727], 'nothing more exciting'],
    ['rocky_ledge2', [2382, 4729], [2382, 4728], 'nothing more exciting'],
    ['viycaves_climbrock1', [2387, 4728], [2386, 4728], 'climb over the rocks'],
    ['viycaves_climbrock2', [2390, 4724], [2390, 4725], 'climb over the rocks'],
    ['viycaves_climbrock3', [2390, 4718], [2390, 4719], 'climb over the rocks']
];
// and the same six the other way. Each climb has a quick branch from one side and the dialogue on
// the other, so coming back is not the same list read backwards.
// - and every one of them is the QUICK branch from this side, so there is no menu to answer. That
// is the whole asymmetry: the descent asks "are you sure?" at each of the six, the climb back does
// not ask at all.
const CLIMBS_BACK: [string, [number, number], [number, number]][] = [
    ['viycaves_climbrock3', [2390, 4718], [2390, 4717]],
    ['viycaves_climbrock2', [2390, 4724], [2390, 4723]],
    ['viycaves_climbrock1', [2387, 4728], [2388, 4728]],
    ['rocky_ledge2', [2382, 4729], [2382, 4728]],
    ['rocky_ledge1', [2377, 4728], [2378, 4728]],
    ['rocky_ledge', [2377, 4717], [2376, 4717]]
];
const _VIYELDI_HATVIYELDI_HAT: [number, number] = [2379, 4712]; // the only viyeldihat on the map
const FURNACE: [number, number] = [2426, 4726]; // furnace_legendsquest
const DRAGONS_EYE: [number, number] = [2410, 4715]; // dragons_eye_rock
const HEART_RECESS: [number, number] = [2422, 4691]; // heart_recess_empty
const BARRIER: [number, number] = [2420, 4690]; // legendsquest_force_barrier
const BOULDER: [number, number] = [2386, 4689]; // a boulder_legends NPC, not a loc
const BOULDER_EAST: [number, number] = [2390, 4689]; // and the push only works from the east
const BARRIER_S: [number, number] = [2421, 4690]; // the other half, clicked from inside the cavern

// --- back in the jungle, for the tree and the pole
const FERTILE: [number, number] = [2778, 2916]; // ^yommi_spot1, the nearest patch to the totem pole
// the seven stalagmites of the gem room - each takes one gem and no other
const GEM_ROCKS: [string, [number, number]][] = [
    ['opal', [2764, 9309]],
    ['jade', [2771, 9303]],
    ['red_topaz', [2772, 9295]],
    ['sapphire', [2781, 9291]],
    ['diamond', [2774, 9287]],
    ['ruby', [2767, 9289]],
    ['emerald', [2757, 9297]]
];

const m: Manifest = {
    quest: "LEGENDS' QUEST",
    source: "oldschool.runescape.wiki/w/Legends'_Quest/Quick_guide",
    stageVar: 'legendsquest',
    done: 75, // ^legends_complete - which is 75, not 100: the stage counter runs out at the four
    // training sessions (55, 60, 65, 70) and completion is the next step on from the last of them
    start: GUARD,
    steps: [
        { note: 'requirements: 107 quest points and five quests - Family Crest, Heroes’ Quest,' },
        { note: 'Shilo Village, Underground Pass and Waterfall Quest. The guard reads all six off' },
        { note: 'a scroll before he will even mention Radimus.' },
        { setvar: 'crestquest', to: 11, why: '^crest_complete' },
        { setvar: 'heroquest', to: 15, why: '^hero_complete' },
        { setvar: 'zombiequeen', to: 15, why: '^zombiequeen_complete - Shilo Village' },
        { setvar: 'upass', to: 10, why: '^upass_complete' },
        { setvar: 'waterfall_quest', to: 10, why: '^waterfall_complete' },
        { setvar: 'qp', to: 107, why: '^legends_required_questpoints' },

        { note: 'wiki step 1: a Legends’ Guard outside the gate, and four menus to get past him' },
        { go: [GUARD[0], GUARD[1]], why: 'to the guard' },
        { note: '_legends_guard is a CATEGORY; the two guards are legends_guild_guard1 and 2' },
        { talk: 'legends_guild_guard1', picks: ['What is this place', 'Can I go on the quest', 'Who is Grand Vizier Erkle', "Yes, I'd like to talk"], want: 'Good Luck', why: 'ask to be let in' },
        { note: 'and he opens it himself: @legends_guard_open_gate forcemoves you to the outside' },
        { note: 'tile, swings the gate and teleports you two tiles in, so there is no gate to click.' },
        { note: 'Clicking it afterwards starts his dialogue over from inside.' },
        { level: 0 },

        { note: 'wiki step 2: Radimus Erkle is in the STUDY - a seventeen-tile room behind' },
        { note: 'loc_1533 at 2726,3368. legendsguilddoorl at 2728,3373 is the main hall, where the' },
        { note: 'other Radimus stands for the reward at the end, and walking in there instead is' },
        { note: 'what a manifest does if it trusts the door with the obvious name.' },
        { go: [2725, 3367], why: 'to the study door' },
        { loc: 'loc_1533', at: STUDY_DOOR, soft: true, why: 'open it' },
        { go: [RADIMUS[0], RADIMUS[1]], why: 'into the study, to Radimus' },
        { talk: 'radimus_erkle', picks: ["what's involved", 'it sounds great'], want: 'Kharazi', why: 'take the quest' },
        { stage: 1 },
        { has: 'thkaramjamap' },

        { note: 'the machete is in the cupboard beside him - and only while he is within five tiles' },
        { go: [CUPBOARD[0], CUPBOARD[1] - 2], why: 'to the cupboard' },
        { loc: 'legends_cupboard', at: CUPBOARD, soft: true, why: 'open it' },
        { loc: 'legends_cupboardopen', at: CUPBOARD, op: 2, want: 'machete', why: 'take the machete' },
        { has: 'machette' },

        { note: 'items: papyrus and charcoal for the map (three sheets is enough with the roll' },
        { note: 'pinned), and an axe for the jungle trees. The guide buys these; the walk is handed' },
        { note: 'them, because shopping is not the quest.' },
        { give: 'papyrus', n: 5 },
        { give: 'charcoal', n: 5 },
        { give: 'rune_axe' },

        { note: 'wiki step 4: the jungle is sealed behind its own undergrowth - kharazi_jungle_tree' },
        { note: 'and kharazi_jungle_plant locs all along the north edge, and nothing else gets in' },
        { setpos: [JUNGLE_GATE_N[0], JUNGLE_GATE_N[1], 0], why: 'to the north edge of the Kharazi Jungle - the crossing is travel' },
        { loc: 'kharazi_jungle_tree2', at: DENSE_BUSH, soft: true, tries: 3, why: 'chop a way in' },
        { go: [DENSE_BUSH[0], DENSE_BUSH[1] - 2], r: 64, why: 'south into the jungle' },
        { note: 'AND THE INTERIOR IS THE SAME THING AGAIN, a hundred times over: the Kharazi Jungle' },
        { note: 'is a hedge maze of choppable kharazi_jungle_tree and kharazi_jungle_plant locs with' },
        { note: 'no open lane across it, so walking from the entrance to the middle section is not a' },
        { note: 'route - it is forty or fifty chops, each one a loc that grows back. The chop is' },
        { note: 'walked above, once, where the quest actually requires it; the crossings between the' },
        { note: 'three map sections are jumped, the way every other stretch of world travel is.' },

        { note: 'wiki step 6: map all three sections. Each wants papyrus, charcoal, 50 Crafting and' },
        { note: 'a stat_random roll, and only counts inside its own zone.' },
        { rng: 0.0, why: 'the mapping roll' },
        { setpos: [MAP_MIDDLE[0], MAP_MIDDLE[1], 0], why: 'into the middle section' },
        { held: 'thkaramjamap', op: 2, want: 'map', why: 'map the middle' },
        { setpos: [MAP_WEST[0], MAP_WEST[1], 0], why: 'west' },
        { held: 'thkaramjamap', op: 2, want: 'map', why: 'map the west' },
        { setpos: [MAP_EAST[0], MAP_EAST[1], 0], why: 'east' },
        { held: 'thkaramjamap', op: 2, want: 'map', why: 'map the east' },
        { rng: null },
        { has: 'thkaramjamapcomp' },
        { stage: 2 },

        { note: 'wiki step 7: a Jungle forester south of Shilo trades the notes for a bullroarer' },
        { setpos: FORESTER, why: 'back out of the jungle to the foresters' },
        { note: 'and it is the map USED on him, not a conversation - talking only offers three' },
        { note: 'questions about the jungle' },
        { useNpc: 'jungleforester_m', obj: 'thkaramjamapcomp', picks: ['go ahead make a copy'], want: 'strange looking object', why: 'the bullroarer' },
        { has: 'bullroarer' },
        { stage: 3 },

        { note: 'wiki step 8: swing it by a totem pole and Gujuo comes out of the trees. Two rolls' },
        { note: 'in one queue: random(6) = 0 makes a nearby animal attack instead, and random(6) < 5' },
        { note: 'is the summon - so the pin has to miss the first and hit the second.' },
        { setpos: [TOTEM[0] + 1, TOTEM[1], 0], why: 'back into the jungle, to a totem pole' },
        { rng: 0.3, why: 'random(6) = 1: no animal, and the summon lands' },
        { note: 'the swing is a QUEUE - [queue,bullroarer_use] runs a tick later and opens Gujuo’s' },
        { note: 'conversation - so the swing itself sees no menu and the six answers go on the talk' },
        { note: 'that follows, which finds the conversation already open.' },
        { held: 'bullroarer', op: 1, soft: true, why: 'swing it' },
        { note: '^legends_swung_bullroarer (4) is never written when Gujuo actually turns up -' },
        { note: 'the conversation goes straight to 5 - so there is nothing to assert here' },
        { rng: null },
        { note: 'and Gujuo opens with a menu of his own, straight off the bullroarer - five more' },
        { note: 'to the point where he asks you to free Ungadulu' },
        {
            talk: 'gujuo',
            tries: 3,
            picks: ['attract the attention', 'friendly relations', 'get your people together', 'What can we do instead', 'How do we make the totem pole', 'I will release Ungadulu'],
            want: 'triangular shape',
            why: 'hear him out'
        },
        { stage: 5 },

        { note: 'wiki step 9: the mossy rock in the north-west, and 50 Agility to crawl inside' },
        { setpos: [SHAMAN_ROCKS[0], SHAMAN_ROCKS[1] + 1, 0], why: 'to the mossy rocks in the north-west' },
        { loc: 'lgshamancaverock1', at: SHAMAN_ROCKS, picks: ["I'll crawl through"], hop: true, soft: true, why: 'search them and crawl in' },
        { stage: 6 },
        { level: 0 },

        { note: 'wiki step 10: Ungadulu is inside a flaming octagram and the only way to speak to' },
        { note: 'him is to INVESTIGATE the fire wall (op2) from within ten tiles of him - there is' },
        { note: 'no zone trigger and no way to reach him, and a plain click on him only gets "run' },
        { note: 'for your life" and a curse.' },
        { go: [FIREWALL_W[0] + 1, FIREWALL_W[1]], r: 192, why: 'to the west face of the octagram' },
        { note: 'and "Who are you?" is the answer that matters: it sets BOTH asked_ungadulu_where' },
        { note: 'and asked_ungadulu_who, and Gujuo will not talk about pure water without the' },
        { note: 'second one. Then "Where do I get pure water from?" sets called_vacu, which is what' },
        { note: 'puts the pure-water line on his menu at all.' },
        { loc: 'lqfirewall_diagonal', at: FIREWALL_W, op: 2, picks: ['Who are you', 'Where do I get pure water'], want: 'heat kills me', why: 'investigate the flames' },
        { stage: 7 },

        { note: 'wiki step 11: out of the cave and swing the bullroarer again' },
        { go: [CAVE_EXIT[0] + 1, CAVE_EXIT[1]], r: 192, why: 'back to the cave mouth' },
        { loc: 'shaman_entrance_cavel', at: CAVE_EXIT, hop: true, soft: true, why: 'out' },
        { setpos: [TOTEM[0] + 1, TOTEM[1], 0], why: 'to a totem pole in the jungle' },
        { rng: 0.3, why: 'random(6) = 1 again: no animal, and the summon lands' },
        { held: 'bullroarer', op: 1, soft: true, why: 'swing it' },
        { rng: null },
        { talk: 'gujuo', tries: 3, picks: ['pure water to douse', 'Ok, thanks'], want: 'metal of the sun', why: 'ask about pure water' },
        { stage: 8 },

        { note: 'wiki step 12: two gold bars and a hammer make the golden bowl on any ordinary' },
        { note: 'anvil. That is the generic Smithing panel rather than quest logic, so the bowl is' },
        { note: 'handed over here the way the papyrus and the axe were.' },
        { give: 'goldbowl_empty', how: 'Forge a gold bowl on an anvil from 2 gold bars' },

        { note: 'wiki step 13: and Gujuo blesses it - 42 Prayer, and he asks before he does it.' },
        { note: 'He is npc_add-ed with a 500-tick life and wanders off, so every conversation with' },
        { note: 'him after the first needs the bullroarer again.' },
        { has: 'goldbowl_empty' },
        { note: 'and with a bowl in the pack his conversation OPENS with the blessing offer, before' },
        { note: 'any menu - so the answer goes on a resume of what the bullroarer queue opened, not' },
        { note: 'on a talk after it' },
        { rng: 0.3, why: 'the summon' },
        { held: 'bullroarer', op: 1, soft: true, why: 'swing it again' },
        { note: 'and the blessing itself is a stat_random(prayer, 80, 250) whose TRUE branch is the' },
        { note: 'failure - "you were not able to go into a deep enough trance" - so the pin here has' },
        { note: 'to be high, the opposite way round from every other roll in this walk' },
        { rng: 0.99, why: 'stat_random false: the trance holds first time' },
        { note: 'and once the bowl is blessed gujuo_start no longer sees a plain golden bowl, so the' },
        { note: 'same conversation runs straight on into the how-goes-Ungadulu menu behind it.' },
        { note: 'A plain talk rather than a resume of the bullroarer queue: [opnpc1,gujuo] goes to' },
        { note: 'the same @gujuo_start, and a resume depends on the queue having fired inside the' },
        { note: 'swing step - which it does not always manage.' },
        { talk: 'gujuo', tries: 3, picks: ['like you to bless my gold bowl', 'Ok thanks for your help'], want: 'bowl is blessed', why: 'have the bowl blessed' },
        { rng: null },
        { has: 'goldbowlbless_empty' },

        { note: 'wiki step 14: a reed cut with the machete, and the reed used on the pool to syphon' },
        { note: 'the water out - the gap in the rocks is too narrow for the bowl itself' },
        { setpos: [REEDS[0] + 1, REEDS[1], 0], why: 'to the water pool' },
        { useLoc: 'tall_reeds', at: REEDS, obj: 'machette', want: 'cut down a reed', why: 'cut a reed' },
        { has: 'reed_hollow' },
        { useLoc: 'sacred_water', at: POOL, obj: 'reed_hollow', want: 'syphon', why: 'fill the bowl' },
        { has: 'goldbowlbless_pure' },
        { stage: 10 },

        { note: 'wiki step 15: back down into the cave, and the pure water on the flames. The bowl' },
        { note: 'is good for ten douses before it empties, which is what the uses counter in' },
        { note: '%legends_bits is for - the quest needs several of them.' },
        { setpos: [SHAMAN_ROCKS[0], SHAMAN_ROCKS[1] + 1, 0], why: 'to the mossy rocks in the north-west' },
        { rng: 0, why: 'stat_random true: the crawl works first time' },
        { loc: 'lgshamancaverock1', at: SHAMAN_ROCKS, picks: ["I'll crawl through"], hop: true, soft: true, why: 'crawl back in' },
        { rng: null },
        { level: 0 },
        { note: 'and WHICH WALL YOU DOUSE DECIDES WHERE IT PUTS YOU - see FIREWALL_CROSS above' },
        { go: FIREWALL_CROSS_OUT, r: 192, why: 'to the west wall of the octagram' },
        { useLoc: 'lqfirewall_straight', at: FIREWALL_CROSS, obj: 'goldbowlbless_pure', want: 'splash some pure water', hop: true, why: 'douse the flames and step inside' },
        { has: 'goldbowlbless_pure' },
        { level: 0 },

        { note: 'wiki step 16: Ungadulu, face to face. The first thing he does is tell you to run,' },
        { note: 'and the demon surfaces for a moment before he comes back to himself - which is' },
        { note: 'what sets the ungadulu_curse timer, for 40 ticks.' },
        { talk: 'ungadulu_good', want: 'Run like the leopard', why: 'he begs you to run' },
        { note: 'a combat spell cast on him INSIDE the ring while that timer is up frees him for' },
        { note: 'long enough to say where the Book of Binding is: [apnpct,magic:confuse] on' },
        { note: 'ungadulu_good goes to ~legends_spell_usage instead of the ordinary spell, and the' },
        { note: 'spell fizzles anywhere outside legends_fire_wall_correct.' },
        { note: 'and the cast has to LAND, first time: ~player_npc_hit_roll is' },
        { note: 'randominc(attack) > randominc(defence), so a high pin makes a maxed player’s magic' },
        { note: 'roll beat the shaman’s defence outright. The curse timer only runs for 40 ticks,' },
        { note: 'and a second attempt after it expires gets "the shaman somehow resists" instead.' },
        { note: 'and Confuse costs 2 earth, 3 water and 1 body - a miss makes him retaliate, and' },
        { note: 'his retaliation is the spell that throws you out of the octagram' },
        { give: 'earthrune', n: 100 },
        { give: 'waterrune', n: 100 },
        { give: 'bodyrune', n: 100 },
        { rng: 0.99, why: 'the hit roll, not a stat_random: high means hit' },
        { note: 'and what he says is all ~chatnpc, so the line to look for is one drive() reads' },
        { note: 'rather than the first page, which the click that opens the conversation eats' },
        { cast: 'magic:confuse', on: 'ungadulu_good', tries: 3, want: 'many trials you must pass', why: 'free him for a moment' },
        { rng: null },
        { level: 0 },

        { note: 'wiki step 17: and out again, which is the leap. Investigating the flames from' },
        { note: 'inside is the only way back out before the demon is dead - see the leap-out gate' },
        { note: 'in quest_legends.rs2, which was testing for a DIFFERENT player being inside.' },
        { rng: 0, why: 'stat_random true: over the top rather than through' },
        { loc: 'lqfirewall_straight', at: FIREWALL_CROSS, op: 2, picks: ['Leap out'], want: 'over the top of the flame wall', hop: true, why: 'leap out of the octagram' },
        { level: 0 },
        { rng: null },

        { note: 'wiki step 18: the crevice behind the shaman bookcase is the way into the' },
        { note: 'catacombs - it crawls you through and drops you north of the ancient gates' },
        { go: [BOOKCASE[0], BOOKCASE[1] - 1], r: 192, why: 'to the bookcase' },
        { rng: 0, why: 'stat_random true: you fit through the crevice' },
        { loc: 'shaman_bookcase', at: BOOKCASE, op: 2, picks: ['Yes please'], want: 'squeeze through the crevice', hop: true, why: 'into the catacombs' },
        { rng: null },

        { note: 'wiki step 19: the first trial is the lock - a lockpick and 50 Thieving, on SEARCH' },
        { note: 'rather than open, and stat_random(thieving, 0, 255) = false is the failure' },
        { give: 'lockpick' },
        { go: CATACOMB_IN, r: 96, why: 'to the ancient gates' },
        { rng: 0, why: 'stat_random true: the lock tumbles' },
        { loc: 'lglockpickgatebottoml', at: LOCKPICK_GATE, op: 2, want: 'CLICK!', why: 'pick the lock' },
        { rng: null },
        { go: [LOCKPICK_GATE[0] - 1, LOCKPICK_GATE[1] - 1], r: 32, why: 'through the gates' },

        { note: 'wiki step 20: three boulders and 52 Mining. Each one teleports you past itself and' },
        { note: 'drops another behind, so the corridor between them is three separate pockets.' },
        { give: 'rune_pickaxe' },
        { rng: 0, why: 'stat_random true: the rock gives on the first swing' },
        { loc: 'mine_test_boulder1', at: BOULDERS[0], want: 'smash the rock to bits', hop: true, why: 'mine through the first boulder' },
        { loc: 'mine_test_boulder2', at: BOULDERS[1], want: 'smash the rock to bits', hop: true, why: 'the second' },
        { loc: 'mine_test_boulder3', at: BOULDERS[2], want: 'smash the rock to bits', hop: true, why: 'the third' },

        { note: 'wiki step 21: the second gate is brute strength - 50 Strength, and here' },
        { note: 'stat_random(strength, 0, 255) = true is the one that opens it' },
        { go: [STRENGTH_GATE[0] - 1, STRENGTH_GATE[1]], r: 48, why: 'to the metal doors' },
        { loc: 'lgstrengthtrialgatel', at: STRENGTH_GATE, picks: ['force them open'], want: 'force the doors open slightly', why: 'force the doors' },
        { go: [STRENGTH_GATE[0] - 1, STRENGTH_GATE[1] - 2], r: 32, why: 'through them' },

        { note: 'wiki step 22: the crumbled wall, jumped NORTH from 2790,9295 - the exactmove hard-' },
        { note: 'codes that tile as its start, so the side you stand on decides the direction' },
        { go: [CRUMBLED_WALL[0], CRUMBLED_WALL[1] - 1], r: 192, exact: true, why: 'to the south side of the crumbled wall' },
        { loc: 'crumbled_wall', at: CRUMBLED_WALL, op: 2, want: 'sail majestically over the wall', hop: true, why: 'jump it' },
        { rng: null },

        { note: 'wiki step 23: the marked wall and its five depressions. SMELL - Soul, Mind, Earth,' },
        { note: 'Law, Law - and a rune out of order burns your hand and drops on the floor.' },
        { give: 'soulrune' },
        { give: 'mindrune' },
        { give: 'earthrune' },
        { give: 'lawrune', n: 2 },
        { go: [MARKED_WALL[0] - 1, MARKED_WALL[1]], r: 192, why: 'to the marked wall' },
        { loc: 'lgancientwalldoor', at: MARKED_WALL, op: 2, picks: ["I'll read it"], want: 'five slightly round depressions', why: 'read the riddle' },
        { useLoc: 'lgancientwalldoor', at: MARKED_WALL, obj: 'soulrune', want: "letter 'S' appears", why: 'first: the spirit of man or beast' },
        { useLoc: 'lgancientwalldoor', at: MARKED_WALL, obj: 'mindrune', want: "letter 'M' appears", why: 'second: the place where thoughts are born' },
        { useLoc: 'lgancientwalldoor', at: MARKED_WALL, obj: 'earthrune', want: "letter 'E' appears", why: 'third: the soil from which good things grow' },
        { useLoc: 'lgancientwalldoor', at: MARKED_WALL, obj: 'lawrune', want: 'fourth depression', why: 'fourth: the rules all men should know' },
        { note: 'and the fifth opens the door, which is the way into the gem room' },
        { useLoc: 'lgancientwalldoor', at: MARKED_WALL, obj: 'lawrune', picks: ["I'll go through"], want: 'pools of water', hop: true, why: 'fifth, and through' },

        { note: 'wiki step 24: seven stalagmites and seven gems. Each rock takes one gem and no' },
        { note: 'other - "But nothing happens" is the wrong rock, not the wrong order.' },
        ...(GEM_ROCKS.flatMap(([gem, at]) => [{ give: gem }, { useLoc: 'lg_gemplacerock', at, obj: gem, want: 'glows and starts spinning', why: 'the ' + gem.split('_').join(' ') + ' rock' }]) as Step[]),
        { note: 'and the seventh blows you into the middle of the room, where the book lands - but' },
        { note: 'not at once: ~check_gem_puzzle_complete is thirteen world_delays of shooting stars' },
        { note: 'from the seven rocks before the obj_add, on top of the exactmove that carries you' },
        { wait: 40, why: 'the stars, and the book landing' },
        { take: 'book_of_binding', r: 16, why: 'the Book of Binding' },
        { has: 'book_of_binding' },

        { note: 'wiki step 25: the book held open in front of Ungadulu, and the demon comes out of' },
        { note: 'him. Back through the flames first - the bowl still has pure water in it.' },
        { setpos: [FIREWALL_CROSS_OUT[0], FIREWALL_CROSS_OUT[1], 0], why: 'back to the west wall of the octagram' },
        { useLoc: 'lqfirewall_straight', at: FIREWALL_CROSS, obj: 'goldbowlbless_pure', want: 'splash some pure water', hop: true, why: 'douse the flames again' },
        { useNpc: 'ungadulu_good', obj: 'book_of_binding', want: 'outline of a huge demon', why: 'read the binding over him' },
        { stage: 11 },
        { note: 'EVERY ONE OF THE THREE SUMMONS CAN MISS. The demon is npc_add-ed onto a' },
        { note: 'map_findsquare, and when that comes back with nowhere to put him the stage is' },
        { note: 'already written and nothing is standing there - inside the flaming octagram, which' },
        { note: 'is sixty-eight tiles with a shaman in it, that happens about one run in four. The' },
        { note: 'book can be opened over him again at stage 11, so the walk does what a player' },
        { note: 'does: reads it again and fights what turns up.' },
        { fight: 'nezikchened', untilvar: 'legendsquest', to: 12, tries: 400, r: 24, soft: true, why: 'Nezikchened, the first time' },
        { useNpc: 'ungadulu_good', obj: 'book_of_binding', soft: true, why: 'open the book again if he did not land' },
        { fight: 'nezikchened', untilvar: 'legendsquest', to: 12, tries: 400, r: 24, why: 'and finish him' },
        { stage: 12 },

        { note: 'wiki step 26: Ungadulu, himself again, hands over three Yommi tree seeds' },
        { talk: 'ungadulu_good', tries: 3, picks: ['collect some Yommi tree seeds', 'Ok, thanks...'], want: 'three largish green seeds', why: 'the seeds' },
        { has: 'yommiseeds', n: 3 },

        { note: 'wiki step 27: germinated in the bowl of pure sacred water, which empties it' },
        { use: ['yommiseeds', 'goldbowlbless_pure'], want: 'germinated now', why: 'germinate the seeds' },
        { has: 'yommiseeds_germ', n: 3 },
        { stage: 13 },

        { note: 'wiki step 28: and the pool the water came from has gone. The reed is spent, so' },
        { note: 'this takes another one off the plants by the waterside.' },
        { setpos: [REEDS[0] + 1, REEDS[1], 0], why: 'back to the water pool' },
        { useLoc: 'tall_reeds', at: REEDS, obj: 'machette', want: 'cut down a reed', why: 'cut another reed' },
        { useLoc: 'sacred_water', at: POOL, obj: 'reed_hollow', want: 'this pool has dried up', why: 'try to fill the bowl' },
        { stage: 14 },

        { note: 'wiki step 29: Gujuo again - the source of the spring, and the recipe for the' },
        { note: 'bravery potion. @gujuo_helpme is what writes stage 15.' },
        { setpos: [TOTEM[0] + 1, TOTEM[1], 0], why: 'to a totem pole in the jungle' },
        { rng: 0.3, why: 'random(6) = 1: no animal, and the summon lands' },
        { held: 'bullroarer', op: 1, soft: true, why: 'swing it again' },
        { rng: null },
        {
            talk: 'gujuo',
            tries: 3,
            picks: ['water pool has dried up', 'Where is the source of the spring', 'could you help me', 'Ok thanks for your help'],
            want: 'bravery of the Kharazi lion',
            why: 'ask about the source'
        },
        { stage: 15 },

        { note: 'wiki step 30: Snake weed and Ardrigal in a vial of water. Both grow in the' },
        { note: 'jungle - the gathering is ordinary Herblore, so the halves are handed over here,' },
        { note: 'and the mixture is the one that carries the trigger.' },
        { give: 'snakeweed_sol' },
        { give: 'ardrigal' },
        { use: ['ardrigal', 'snakeweed_sol'], want: 'heady brew', why: 'mix the bravery potion' },
        { has: 'bravery_pot' },
        { held: 'bravery_pot', op: 1, picks: ['bravely drink'], want: 'feel quite okay', why: 'drink it' },

        { note: 'AND THE PACK HAS TO HAVE A SLOT FREE BEFORE THE GATE. Charging an orb against it' },
        { note: 'does nothing at all on a full inventory - no refusal, no message, nothing - which' },
        { note: 'reads exactly like a cast the engine never delivered. Twenty-eight slots is a' },
        { note: 'real constraint on a quest this long, and the trials above are finished with.' },
        {
            drop: ['papyrus', 'charcoal', 'rune_axe', 'lockpick', 'rune_pickaxe', 'soulrune', 'mindrune', 'lawrune', 'thkaramjamap', 'swamprocks1', 'bodyrune', 'waterrune', 'vial_empty', 'scrawled_note1', 'scrawled_note2', 'scrawled_note3'],
            why: 'the spent trial kit'
        },

        { note: 'wiki step 31: the magic trial gate, back in the catacombs. It is fused into the' },
        { note: 'rock and will not open from the south at all - the way through is to charge an orb' },
        { note: 'against it, which ~magic_spell_charge_orb intercepts before it ever asks whether' },
        { note: 'the loc is the right obelisk. The gem room itself has no walking route from here:' },
        { note: 'the five trials above are the only way back in, and they are already walked.' },
        { setpos: [GEM_ROOM_IN[0], GEM_ROOM_IN[1], 0], why: 'back into the gem room' },
        { give: 'stafforb', n: 3 },
        { give: 'airrune', n: 100 },
        { give: 'cosmicrune', n: 100 },
        { note: 'and the tile matters, because there is exactly ONE of them: the gate is a solid' },
        { note: 'centrepiece at 2762,9313 with rock on three sides - 2761,9313, 2763,9313 and' },
        { note: '2762,9314 are all blocked - so 2762,9312 is the only tile the click can come' },
        { note: 'from. Walked to within two, the router settles on 2763,9312, which is diagonal,' },
        { note: 'and the cast is dropped without a word.' },
        { go: [MAGIC_GATE[0], MAGIC_GATE[1] - 1], r: 192, exact: true, why: 'to the one tile the gate can be reached from' },
        { castLoc: 'lgmagictrialgateclosed', at: MAGIC_GATE, spell: 'magic:air_orb', tries: 3, want: 'large gaping hole', why: 'charge an orb against the gate' },
        { level: 0 },

        { note: 'wiki step 32: a rope on the winch over the hole, the bravery potion inside you,' },
        { note: 'and down into the Viyeldi caves' },
        { give: 'rope' },
        { go: [WINCH[0], WINCH[1] + 1], r: 192, why: 'to the winch over the hole' },
        { useLoc: 'lg_winchdown_norope', at: WINCH, obj: 'rope', want: 'throw a rope around the winch', why: 'tie the rope' },
        { rng: 0, why: 'stat_random true: down the rope without slipping' },
        { loc: 'lg_winchdown_rope', at: WINCH, picks: ['shimmy down the rope'], want: 'top of a tall ledge', hop: true, why: 'climb down' },
        { rng: null },
        { stage: 16 },
        { level: 0 },

        { note: 'wiki step 33: six climbs between the rope and the cave floor. Each one is its own' },
        { note: 'loc with its own wording and its own idea of which side you came from, and each' },
        { note: 'is a teleport rather than a walk, so the ledges between them are tiny pockets.' },
        { rng: 0, why: 'stat_random true: no slips on the ledges' },
        ...(CLIMBS.flatMap(([loc, at, from, pick]) => [{ go: from, r: 64, why: 'to ' + loc }, { loc, at, picks: [pick], hop: true, soft: true, why: 'climb it' }, { level: 0 }]) as Step[]),
        { rng: null },

        { note: 'and the pack has to have room before the heroes: each of the three inv_adds a' },
        { note: 'chunk with "// no space check" over it, so a full pack loses the chunk and the' },
        { note: 'kill rewards nothing. The trials above are done with - this is what a player' },
        { note: 'would have banked on the way through.' },
        { drop: ['stafforb', 'cosmicrune', 'airrune', 'rope', 'bravery_pot'], why: 'what the descent is done with' },

        { note: 'wiki step 34: three long-dead heroes, one chunk of the heart crystal each. They' },
        { note: 'are spread across the cave floor and there are several of each - the nearest will' },
        { note: 'do, which is what `fight` finds.' },
        { fight: 'san_tojalon', until: 'heartcrystal_sectiona', tries: 20, r: 32, why: 'San Tojalon' },
        { fight: 'irvig_senay', until: 'heartcrystal_sectionb', tries: 20, r: 32, why: 'Irvig Senay' },
        { fight: 'ranalph_devere', until: 'heartcrystal_sectionc', tries: 20, r: 32, why: 'Ranalph Devere' },
        { has: 'heartcrystal_sectiona' },
        { has: 'heartcrystal_sectionb' },
        { has: 'heartcrystal_sectionc' },

        { note: 'wiki step 35: the three chunks fused in the ancient furnace - 50 Crafting. Each' },
        { note: 'use leaves an objbox open and the rest of the script - the inv_del, the bit, the' },
        { note: 'count - waiting behind it, so without a resume between them the second click is' },
        { note: 'thrown away and only the first chunk ever goes in.' },
        { go: [FURNACE[0] - 1, FURNACE[1]], r: 192, why: 'to the lava furnace' },
        { note: 'The three uses say nothing drive can read back - every word is inside an objbox' },
        { note: 'that the use’s own click closes - so what each one is judged on is the obj it' },
        { note: 'leaves behind, which is the stronger test anyway.' },
        { useLoc: 'furnace_legendsquest', at: FURNACE, obj: 'heartcrystal_sectiona', why: 'the first chunk' },
        { hasnt: 'heartcrystal_sectiona' },
        { useLoc: 'furnace_legendsquest', at: FURNACE, obj: 'heartcrystal_sectionb', why: 'the second' },
        { hasnt: 'heartcrystal_sectionb' },
        { useLoc: 'furnace_legendsquest', at: FURNACE, obj: 'heartcrystal_sectionc', why: 'the third, and the fusing' },
        { has: 'heartcrystal' },
        { stage: 17 },

        { note: 'wiki step 36: "bring life to the dragons eye" - the crystal on the humming rocks' },
        { go: [DRAGONS_EYE[0], DRAGONS_EYE[1] - 1], r: 192, why: 'to the dragon’s eye' },
        { useLoc: 'dragons_eye_rock', at: DRAGONS_EYE, obj: 'heartcrystal', why: 'charge the crystal' },
        { has: 'heartcrystal_glow' },

        { note: 'wiki step 37: and the glowing heart into the recess by the dragon’s teeth' },
        { go: [HEART_RECESS[0] - 1, HEART_RECESS[1]], r: 192, why: 'to the heart-shaped recess' },
        { useLoc: 'heart_recess_empty', at: HEART_RECESS, obj: 'heartcrystal_glow', want: 'glows even brighter', why: 'open the way on' },
        { stage: 18 },

        { note: 'wiki step 38: and the barrier by the dragon’s teeth lets you through at last' },
        { go: [BARRIER[0], BARRIER[1] + 1], r: 192, why: 'to the invisible barrier' },
        { loc: 'legendsquest_force_barrier', at: BARRIER, want: 'into the darkness of the cavern', hop: true, why: 'walk through it' },
        { level: 0 },

        { note: 'wiki step 39: a boulder stoppers the stream, and pushing it brings Echned Zekin' },
        { note: 'out of the water. He wants Viyeldi dead and hands over a dagger of pure obsidian.' },
        { note: 'The boulders are NPCs, not locs - [opnpc1,boulder_legends].' },
        { go: BOULDER_EAST, r: 192, why: 'to the boulder in the stream' },
        { note: 'The push itself writes 19 - echned_zekin.rs2 moves ^legends_heart_in_recess on' },
        { note: 'before a word is said - and the conversation that follows reaches 20 only at the end' },
        { note: 'of a five-deep option tree. Break off anywhere in it and the quest stays at 19,' },
        { note: 'with the panel still naming leg 18, which ends "go to the boulder in the stream" -' },
        { note: 'the boulder they have already pushed, and no mention of Echned at all.' },
        { note: 'DeathPlateau-Bugs#16.' },
        { talk: 'boulder_legends', tries: 3, want: 'Who disturbs the rocks', why: 'push it, and break off before answering - which leaves the quest at 19' },
        { stage: 19 },

        { note: 'and pushing it again puts the same question, which is what a player at 19 does' },
        {
            talk: 'boulder_legends',
            tries: 3,
            picks: ['Er... me?', 'need it for my quest', 'What can I do about that', 'what I must to get the water', "Ok, I'll do it"],
            want: 'dark black dagger',
            why: 'push it, and hear the spirit out'
        },
        { has: 'deathdagger' },
        { stage: 20 },

        { note: 'wiki step 40: Viyeldi’s clothes lie on the ledge the rope landed you on, so the six' },
        { note: 'climbs have to be walked back - and the barrier first: the inner cavern is 767' },
        { note: 'tiles with no other way out of it' },
        { go: [BARRIER_S[0], BARRIER_S[1] - 1], r: 192, why: 'back to the barrier' },
        { loc: 'legendsquest_force_barrier', at: BARRIER_S, hop: true, soft: true, why: 'back out through it' },
        { note: 'Each climb has its quick branch on the side the' },
        { note: 'descent used the dialogue on, so this is not the same list reversed.' },
        { rng: 0, why: 'stat_random true: no slips on the way back either' },
        ...(CLIMBS_BACK.flatMap(([loc, at, from]) => [
            { go: from, r: 64, why: 'back to ' + loc },
            { loc, at, hop: true, soft: true, why: 'climb it' }
        ]) as Step[]),
        { level: 0 },

        { note: 'and the hat is a ground obj whose TAKE animates the clothes instead of picking them' },
        { note: 'up, which is why the take itself cannot succeed. His speech ends in npc_del, so it' },
        { note: 'must NOT be clicked through: the dagger goes into him while he is still talking,' },
        { note: 'which is why the take is brief and the chat is closed rather than driven.' },
        { take: 'viyeldihat', r: 16, soft: true, tries: 1, brief: 4, why: 'reach for the hat' },
        { close: true, why: 'stop his speech before it slumps the clothes again' },
        { useNpc: 'viyeldi', obj: 'deathdagger', want: 'dagger glows brightly', why: 'the dagger, as agreed' },
        { has: 'deathdaggerdone' },

        { note: 'wiki step 41: back down to the stream, and the dagger handed over. Echned Zekin' },
        { note: 'takes the spirit out of it and is Nezikchened all along.' },
        ...(CLIMBS.flatMap(([loc, at, from, pick]) => [
            { go: from, r: 64, why: 'to ' + loc },
            { loc, at, picks: [pick], hop: true, soft: true, why: 'climb it' }
        ]) as Step[]),
        { rng: null },
        { go: [BARRIER[0], BARRIER[1] + 1], r: 192, why: 'to the barrier' },
        { loc: 'legendsquest_force_barrier', at: BARRIER, hop: true, soft: true, why: 'through it' },
        { go: BOULDER_EAST, r: 192, why: 'back to the boulder' },
        { talk: 'boulder_legends', tries: 3, want: 'Now I am revealed to you', why: 'push it again, and hand the dagger over' },
        { note: 'and this demon is npc_add-ed for FIVE HUNDRED TICKS, which is not much more than' },
        { note: 'the fight takes - so the summon can be gone before the fight starts, or expire' },
        { note: 'part way through it. The push is repeatable (with the dagger already handed over' },
        { note: 'it goes straight back to @summon_nezi_dagger, and says "the rock is motionless"' },
        { note: 'while he is still standing there), so the walk shoves again and fights again.' },
        { fight: 'nezikchened', untilvar: 'legendsquest', to: 22, tries: 400, r: 48, soft: true, why: 'Nezikchened, the second time' },
        { talk: 'boulder_legends', tries: 2, soft: true, why: 'shove it again if he slipped away' },
        { fight: 'nezikchened', untilvar: 'legendsquest', to: 22, tries: 400, r: 48, why: 'and finish him' },
        { stage: 22 },

        { note: 'wiki step 42: with the spirit gone the boulder moves, and the source is a pool of' },
        { note: 'sacred water. The push only works from the east - two tiles clear of the rock.' },
        { note: 'AND THE SPRING IS OPEN FOR THIRTY TICKS. loc_add puts lgwaterpool on the' },
        { note: 'boulder’s own tile for 30, and the boulder rolls back into place on a queue of' },
        { note: 'the same length - so the fill has to land inside that window, and missing it is' },
        { note: 'not fatal: once the rock is home again the shove works a second time.' },
        { go: [BOULDER[0] + 2, BOULDER[1]], r: 64, exact: true, why: 'two tiles east of the boulder - the only angle it moves from' },
        { talk: 'boulder_legends', tries: 3, want: 'push the boulder out of the way', soft: true, why: 'push it clear' },
        { useLoc: 'lgwaterpool', at: BOULDER, near: 3, obj: 'goldbowlbless_empty', soft: true, why: 'fill the bowl from the source' },
        { wait: 36, why: 'the boulder rolling back into place' },
        { talk: 'boulder_legends', tries: 3, soft: true, why: 'shove it clear again' },
        { useLoc: 'lgwaterpool', at: BOULDER, near: 3, obj: 'goldbowlbless_empty', soft: true, why: 'and fill it' },
        { has: 'goldbowlbless_pure' },
        { stage: 25 },

        { note: 'wiki step 43: and now the tree. Six steps on one patch of fertile soil, and every' },
        { note: 'one of them has fifty-one ticks before the stage it just reached rots - plant,' },
        { note: 'water, fell, trim, carve, carry. 45 Herblore, 50 Woodcutting and a rune axe.' },
        { setpos: [FERTILE[0] + 1, FERTILE[1], 0], why: 'back up to the jungle, at a patch of fertile soil' },
        { give: 'rune_axe' },
        { rng: 0, why: 'stat_random true: the seed takes' },
        { useLoc: 'fertilesoil', at: FERTILE, obj: 'yommiseeds_germ', want: 'plant the Yommi tree seed', why: 'plant a germinated seed' },
        { rng: null },
        { useLoc: 'yommitree_sapling', at: FERTILE, obj: 'goldbowlbless_pure', want: 'remarkable rate', why: 'water it from the bowl' },
        { useLoc: 'yommitree_adult', at: FERTILE, obj: 'rune_axe', want: 'chop the Yommi tree down', why: 'fell it' },
        { useLoc: 'yommitree_felled', at: FERTILE, obj: 'rune_axe', want: 'trim the branches', why: 'trim it' },
        { useLoc: 'yommitree_trimmed', at: FERTILE, obj: 'rune_axe', want: 'carve a wonderful totem pole', why: 'carve it' },
        { loc: 'yommitree_totem', at: FERTILE, want: 'very heavy', why: 'pick the totem pole up' },
        { has: 'thtotempole' },
        { stage: 30 },

        { note: 'wiki step 44: the carved pole used on the tribe’s corrupted one. Nezikchened comes' },
        { note: 'out of it a third time - and because Viyeldi is dead and collecting the totem' },
        { note: 'cleared the three defeated bits, he throws the dead heroes at you first and' },
        { note: 'vanishes between each one. One `fight` over all four types is exactly that.' },
        { setpos: [TOTEM[0] + 1, TOTEM[1], 0], why: 'to the tribe’s totem pole' },
        { useLoc: 'lg_ord_totem_pole', at: TOTEM, obj: 'thtotempole', want: 'dread demon Nezikchened', why: 'replace the evil pole' },
        { stage: 32 },
        {
            fight: ['san_tojalon', 'irvig_senay', 'ranalph_devere', 'nezikchened'],
            untilvar: 'legendsquest',
            to: 35,
            tries: 400,
            r: 24,
            soft: true,
            why: 'the three heroes, then the demon'
        },
        // The fight ends on 35 and the pole offer below is a real click, so this is a leg a player
        // can be sitting at - without it the panel went quiet between 32 and 45.
        { stage: 35 },
        { note: 'and the same five-hundred-tick summon, four fights deep this time - so the pole is' },
        { note: 'offered again whatever happened. At stage 32 that brings the next one of them' },
        { note: 'back; at 35 it IS the replacement, which is the step after this anyway, so the' },
        { note: 'same click covers both and the stage at the end says which it was.' },
        { useLoc: 'lg_ord_totem_pole', at: TOTEM, obj: 'thtotempole', soft: true, why: 'offer the pole again' },
        {
            fight: ['san_tojalon', 'irvig_senay', 'ranalph_devere', 'nezikchened'],
            untilvar: 'legendsquest',
            to: 35,
            tries: 400,
            r: 24,
            soft: true,
            why: 'and finish whichever is left'
        },
        { note: 'and with the demon gone the pole can actually be replaced' },
        { useLoc: 'lg_ord_totem_pole', at: TOTEM, obj: 'thtotempole', soft: true, why: 'replace it for good' },
        { hasnt: 'thtotempole' },

        { note: 'wiki step 45: and Gujuo comes out of the trees on his own this time - the' },
        { note: 'replacement npc_add-s him with npc_setmode(opplayer2), so he walks over and starts' },
        { note: 'the conversation himself. It is usually finished, gilded totem pole and all,' },
        { note: 'before the step after the replacement has stopped waiting - so stage 40 is a' },
        { note: 'value this walk rarely gets to see, and the talk here is only for the run where' },
        { note: 'he has not arrived yet.' },
        { talk: 'gujuo', tries: 3, soft: true, why: 'the tribe’s gift, if he has not handed it over already' },
        { has: 'thtotempolegift' },
        { stage: 45 },

        { note: 'wiki step 46: Radimus, in the study, takes the gilded pole AND the completed map' },
        { setpos: [2725, 3367, 0], why: 'back to the Legends’ Guild study' },
        { talk: 'radimus_erkle', tries: 3, want: 'welcome to the Legends Guild', why: 'hand both in' },
        { stage: 50 },

        { note: 'wiki step 47: and the other Radimus, in the main hall, gives the four lots of' },
        { note: '7,650 XP. Each one loops straight back to the menu, so they go in one conversation,' },
        { note: 'and the fourth drops through to the completion queue.' },
        { note: 'The hall is through the guild’s own doors and the hand-in leaves you shut in the' },
        { note: 'study behind loc_1533, so getting there is two doors of ordinary building' },
        { note: 'furniture rather than anything the quest asks for - jumped, like every other' },
        { note: 'stretch of travel in this walk.' },
        { setpos: [MAIN_HALL[0], MAIN_HALL[1] - 1, 0], why: 'into the Legends’ Guild main hall' },
        { note: 'all four go in one conversation: @radimus_train loops straight back into' },
        { note: '@radimus_training, which counts down the areas left and shows the menu again, and' },
        { note: 'the fourth drops through to the completion queue.' },
        {
            talk: 'radimus_erkle',
            tries: 3,
            picks: ["Yes, I'll train now", '* Attack *', '* Attack *', '* Attack *', '* Attack *'],
            want: 'all the training I can offer',
            why: 'train four times'
        },
        { stage: 75 }
    ]
};

const p: any = H.makePlayer('legrun', m.start[0], m.start[1]);
H.tick(2);
p.teleport(m.start[0], m.start[1], m.start[2]);
p.applyDamage = function () {};
H.setVar(p, 'macro_event', 1);
H.maxOut(p);
// AND THE COMBAT VARPS HAVE TO BE RECOMPUTED. maxOut sets the levels straight onto the player, so
// [changestat,_] never fires and %com_magicattack is still whatever login worked out for a level-1
// mage. Confuse on Ungadulu is decided by randominc(%com_magicattack) > randominc(his defence
// roll), and with the attack roll left at its starting value no pin of the rng can make it land.
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
