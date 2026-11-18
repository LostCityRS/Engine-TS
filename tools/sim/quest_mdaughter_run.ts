// MOUNTAIN DAUGHTER, played through on foot.
//
// Quest 67 of the quest-by-quest pass, and the one that needed rebuilding rather than fixing: what
// was here before had Svidi as Hamal's daughter, Asleif as his dead wife, three white pearls as the
// opening favour, the body dug out of the roots with a spade, the Kendal gated behind the burial and
// the half of the Ancient Rock set on the cairn. The cache says otherwise in its own words - the
// necklace is "Asleif, daughter of the mountain camp chieftain", the bubbles on the lake are a
// Shining pool you can hear singing in, the fruit's param is next_obj_stage,white_pearl_seed, and
// the safety guarantee "supposedly grants Svidi safe passage into Rellekka".
//
// So this walks the real one: in over the boulder, the pool's two errands done in either order,
// the man in the bear skin, and five rocks off the goat pen.
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_mdaughter_run.ts
import * as H from './harness.js';
import { play, Manifest, Step } from './questrun.js';

await H.boot();

const OUTSIDE: [number, number, number] = [2761, 3657, 0];
const ROCKSLIDE: [number, number] = [2760, 3658];
const LEDGE: [number, number] = [2765, 3665]; // the strip above the path, west route up
const BOULDER: [number, number] = [2765, 3666];
const GUARD: [number, number] = [2761, 3660]; // the rockslide's inside; the guard stands on 2760,3660
const TENT_DOOR: [number, number] = [2805, 3672];
const HAMAL: [number, number] = [2810, 3673];
const JOKUL: [number, number] = [2811, 3680];
const MUD_STAND: [number, number] = [2811, 3661];
const ROOTS: [number, number] = [2810, 3661];
const SHORE: [number, number] = [2771, 3680];
const TREE: [number, number] = [2772, 3679];
const LEDGE_N: [number, number] = [2773, 3686];
const ROCKS: [number, number] = [2773, 3688];
const STONES_W: [number, number] = [2774, 3691];
const STONE1: [number, number] = [2775, 3691];
const STONE2: [number, number] = [2777, 3691];
const BUBBLE: [number, number] = [2782, 3691]; // the bubbles out by the island carry her voice
const BUBBLE_STAND: [number, number] = [2781, 3691]; // it stands in the water; this is the island edge
const MOUND: [number, number] = [2783, 3694];
const MOUND_STAND: [number, number] = [2782, 3694];
const SVIDI: [number, number, number] = [2715, 3672, 0];
const BRUNDT: [number, number, number] = [2657, 3671, 0];
const ROCKTENT_OUT: [number, number, number] = [2799, 3666, 0];
const ROCKTENT_DOOR: [number, number] = [2799, 3665];
const ANCIENT_ROCK: [number, number] = [2799, 3660];
const ROCK_STAND: [number, number] = [2798, 3660];
const RAGNAR: [number, number, number] = [2765, 3677, 0];
const BUSH: [number, number] = [2849, 3497]; // White Wolf Mountain, by the glider
const TREE1: [number, number] = [2802, 3703]; // the two dead trees across the path to the cave
const TREE2: [number, number] = [2807, 3703];
const CAVE: [number, number] = [2809, 3703];
const KENDAL: [number, number] = [2786, 10081];
const CORPSE_PILE: [number, number] = [2788, 10078];
const CAVE_EXIT: [number, number] = [2805, 10104];
const PEN: [number, number][] = [
    [2810, 3684],
    [2810, 3686],
    [2811, 3685],
    [2812, 3684],
    [2813, 3686]
];

// Out to the island: the tree, the vault, the plank. Three clicks and three short walks, and the
// quest wants it three times - twice for the pool and once to bury her.
const out = (): Step[] => [
    { go: SHORE, exact: true, r: 90, why: 'to the tall tree on the shore' },
    { loc: 'mdaughter_lake_tree', at: TREE, op: 3, want: 'onto a ledge', why: 'climb it' },
    { go: LEDGE_N, exact: true, r: 10, why: 'to the north end of the ledge' },
    // the rocks stand in the water with no dry tile beside them: the op is an approach op fired
    // from two tiles off, so hop, and the exact walk after it is the proof
    { loc: 'mdaughter_polerocks', at: ROCKS, want: 'vault across', hop: true, why: 'the pole' },
    { go: STONES_W, exact: true, r: 10, why: 'to the flat stones' },
    { loc: 'mdaughter_flatstone1', at: STONE1, want: 'lay the plank', why: 'the plank' }
];

// And back. The rocks send you all the way round the tree to the shore from the far ledge, which is
// deliberate: nobody can be left standing on it.
const back = (): Step[] => [
    { loc: 'mdaughter_flatstone2', at: STONE2, want: 'lay the plank', why: 'plank back west' },
    { loc: 'mdaughter_polerocks', at: ROCKS, want: 'back round the tree', hop: true, why: 'and round to the shore' }
];

const m: Manifest = {
    quest: 'MOUNTAIN DAUGHTER',
    source: 'oldschool.runescape.wiki/w/Mountain_Daughter',
    stageVar: 'mdaughter_quest_var',
    done: 90,
    start: OUTSIDE,
    steps: [
        { note: 'requirements: Agility 20 for the vault, and a level 70 opponent at the end of it.' },
        { note: 'Items: a rope to get in, an axe, a pickaxe, a plank, gloves for the thorns, and a' },
        { note: 'pole - which Jokul hands out, so it is the only one the run does not have to carry.' },
        { setpos: OUTSIDE, why: 'the path below the camp, south of the rockslide' },

        { note: 'wiki step 1: the camp does not let outsiders over the slide, which is what the' },
        { note: 'boulder on the ledge above the path is for.' },
        { loc: 'mdaughter_rockslide', at: ROCKSLIDE, want: 'not letting you in', why: 'the slide is watched' },
        { give: 'rope' },
        { go: LEDGE, exact: true, r: 90, why: 'up the west path onto the ledge' },
        // hop because the op's own teleport is three tiles down a sheer cliff: the tile it lands
        // you on is not next to the boulder and never can be. The exact walk below is the
        // assertion - the ledge cannot reach that tile on foot.
        { useLoc: 'mdaughter_cliff_boulder', at: BOULDER, obj: 'rope', want: 'climb down into the camp', hop: true, why: 'rope the boulder' },
        { go: [2766, 3663], exact: true, r: 4, why: 'and you are in the camp' },
        { has: 'rope' },
        { go: GUARD, exact: true, r: 40, why: 'to the guard inside the slide' },
        { talk: 'mdaughter_rockslide_guard', want: 'determined or stupid', why: 'he lets you past' },

        { note: 'wiki step 2: Hamal is in the longhouse at the east end, behind a tent door' },
        { go: [TENT_DOOR[0] - 1, TENT_DOOR[1]], exact: true, r: 90, why: "to the chieftain's tent" },
        { loc: 'mdaughter_tent_door', at: TENT_DOOR, soft: true, why: 'open the flap' },
        { go: HAMAL, r: 20, why: 'inside' },
        {
            talk: 'mdaughter_hamal',
            picks: ['Why is everyone so hostile?', 'I could look for her.'],
            want: 'Her name is Asleif',
            why: 'he lets an outsider ask after his daughter'
        },
        { stage: 10 },

        { note: 'wiki step 2: a pole off Jokul, and mud from the roots by the pond' },
        { go: JOKUL, r: 40, why: 'to Jokul and the goats' },
        { talk: 'mdaughter_jokul', picks: ['Have you got a pole I could borrow?'], want: 'off the pen', why: 'the pole' },
        { has: 'mdaughter_stick' },
        { go: MUD_STAND, exact: true, r: 60, why: 'to the mud pond south of the tent' },
        { loc: 'mdaughter_roots_1', at: ROOTS, want: 'handful of mud', why: 'dig below the roots' },
        { has: 'mdaughter_mud' },

        { note: 'wiki step 3: the tall tree by the geysers is wet through until somebody muds it' },
        // woodplank: `plank` is the dead duplicate the login migration strips off a player, so
        // giving it here tested the quest against an item nobody can hold.
        { give: 'woodplank' },
        { go: SHORE, exact: true, r: 90, why: 'west along the shore to the tall tree' },
        { loc: 'mdaughter_lake_tree', at: TREE, op: 3, want: 'wet through', why: 'and you slide back down' },
        { useLoc: 'mdaughter_lake_tree', at: TREE, obj: 'mdaughter_mud', want: 'hold a boot', why: 'mud on the bark' },
        { varis: 'mdaughter_mud_var', to: 1 },

        { note: 'wiki step 3: climb, vault, plank, and listen to the pool from the island' },
        ...out(),
        { go: BUBBLE_STAND, exact: true, r: 20, why: 'out to the bubbles by the island' },
        {
            loc: 'mdaughter_sulphar_gas',
            at: BUBBLE,
            picks: ['Your father has people looking for you.'],
            want: 'two things',
            why: 'Asleif, ten years dead'
        },
        { stage: 20 },
        { varis: 'mdaughter_relations_var', to: 1 },
        { varis: 'mdaughter_food_var', to: 1 },

        { note: 'wiki step 4: peace with Rellekka. Svidi is in the forest west of the camp, above' },
        { note: "the dwarves' road, and will not cross Fremennik land on anybody's word." },
        ...back(),
        { setpos: SVIDI, why: 'to the forest west of the camp' },
        {
            talk: 'mdaughter_svidi',
            picks: ["Can't I persuade you to go in there somehow?"],
            want: 'go and see Brundt',
            why: 'he wants it in writing'
        },
        { varis: 'mdaughter_relations_var', to: 2 },
        { setpos: BRUNDT, why: "to Brundt in Rellekka's longhall" },
        { talk: 'viking_brundt', want: 'Ancient Rock of Rellekka', why: 'he wants the stone back first' },
        { varis: 'mdaughter_relations_var', to: 3 },

        { note: 'wiki step 4: the Rock is in a tent in the camp and the camp will not give it up' },
        { note: 'whole, so you split it - half each, which is what Brundt settles for.' },
        { setpos: ROCKTENT_OUT, why: "back to the camp, outside the Rock's tent" },
        { talk: 'mdaughter_ancientrock_guard', want: 'Take a pickaxe', why: 'he lets you in' },
        { loc: 'mdaughter_rocktent_door', at: ROCKTENT_DOOR, want: 'tent flap', why: 'through the flap' },
        { give: 'bronze_pickaxe' },
        { go: ROCK_STAND, exact: true, r: 20, why: 'to the Ancient Rock' },
        { useLoc: 'mdaughter_ancient_rock', at: ANCIENT_ROCK, obj: 'bronze_pickaxe', want: 'splits cleanly', why: 'split it' },
        { has: 'mdaughter_half_rock' },
        { setpos: BRUNDT, why: 'back to Brundt' },
        { talk: 'viking_brundt', want: 'Half each', why: 'he takes half' },
        { varis: 'mdaughter_relations_var', to: 4 },
        { has: 'mdaughter_safety_guarantee' },
        { hasnt: 'mdaughter_half_rock' },
        { setpos: SVIDI, why: 'back to Svidi' },
        { talk: 'mdaughter_svidi', want: 'put his name to it', why: 'and he will go' },
        { varis: 'mdaughter_relations_var', to: 5 },

        { note: 'wiki step 5: a food source. Jokul names the White Pearl, the bushes are on White' },
        { note: 'Wolf Mountain, the thorns want gloves, and the seed is inside the fruit.' },
        { setpos: [JOKUL[0], JOKUL[1], 0], why: 'back to Jokul' },
        { talk: 'mdaughter_jokul', want: 'White Pearl', why: 'what grows this high up' },
        { varis: 'mdaughter_food_var', to: 2 },
        { give: 'leather_gloves' },
        { held: 'leather_gloves', op: 2, why: 'the thorns go through bare hands' },
        { worn: 'leather_gloves' },
        { setpos: [BUSH[0] + 1, BUSH[1], 0], why: 'to the thorn bushes on White Wolf Mountain' },
        { loc: 'mdaughter_white_pearl_bush', at: BUSH, op: 3, want: 'pick a white pearl', why: 'with gloves on' },
        { has: 'mdaughter_white_pearl_fruit' },
        { held: 'mdaughter_white_pearl_fruit', op: 3, want: 'seed in the middle', why: 'eat it' },
        { has: 'mdaughter_white_pearl_seed' },
        { varis: 'mdaughter_food_var', to: 3 },
        { setpos: [HAMAL[0], HAMAL[1], 0], why: 'back to Hamal' },
        { talk: 'mdaughter_hamal', want: 'camp eats next year', why: 'he takes the seed' },
        { varis: 'mdaughter_food_var', to: 4 },
        { talk: 'mdaughter_hamal', want: 'Brundt put his name', why: 'and hears about the peace' },
        { varis: 'mdaughter_hamal_relations_done', to: 1 },

        { note: 'wiki step 6: both errands done, so she asks for the third thing' },
        ...out(),
        { go: BUBBLE_STAND, exact: true, r: 20, why: 'out to the bubbles again' },
        {
            loc: 'mdaughter_sulphar_gas',
            at: BUBBLE,
            want: 'believe I am dead',
            why: 'the Kendal'
        },
        { stage: 30 },

        { note: 'wiki step 6: two dead trees across the path, then the cave. Each tree is chopped' },
        { note: 'and then stepped over - the stump still blocks the gap.' },
        ...back(),
        { give: 'bronze_axe' },
        { setpos: [TREE1[0] - 1, TREE1[1], 0], why: 'east along the path to the dead trees' },
        { loc: 'mdaughter_passable_tree', at: TREE1, want: 'fell the dead tree', why: 'chop it' },
        { loc: 'mdaughter_passable_tree_stump', at: TREE1, want: 'step over', why: 'and over the stump' },
        { go: [TREE2[0] - 1, TREE2[1]], exact: true, r: 20, why: 'to the second tree' },
        { loc: 'mdaughter_passable_tree', at: TREE2, want: 'fell the dead tree', why: 'chop it' },
        { loc: 'mdaughter_passable_tree_stump', at: TREE2, want: 'step over', why: 'and over the stump' },
        { go: [CAVE[0] - 1, CAVE[1]], exact: true, r: 20, why: 'to the cave mouth' },
        { loc: 'mdaughter_caveentrance', at: CAVE, want: 'squeeze into the cave', why: 'in' },

        { note: 'wiki step 6: he is a man in a bear skin and he has had thirty years of being a god' },
        { go: [KENDAL[0] + 1, KENDAL[1]], r: 90, why: 'to the pillar he stands by' },
        {
            talk: 'mdaughter_multi_bear',
            picks: ["It's just me, no one special.", 'You mean a sacrifice?', 'Give me her remains.', "Then I'll take her off your body."],
            want: 'drops onto all fours',
            why: 'the whole confession'
        },
        { varis: 'mdaughter_bear_discovery', to: 1 },
        { varis: 'mdaughter_bear_mayattack', to: 1 },
        { fight: 'mdaughter_multi_bear', untilvar: 'mdaughter_quest_var', to: 40, tries: 4, why: 'kill him' },
        { stage: 40 },
        { take: 'mdaughter_bear_helmet', r: 8, why: 'the bearhead' },
        { go: CORPSE_PILE, exact: true, r: 20, why: 'to the foot of the pillars' },
        { take: 'mdaughter_daughter_corpse', r: 6, why: 'and Asleif' },

        { note: 'wiki step 6: out of the cave and show him' },
        { go: [CAVE_EXIT[0] + 1, CAVE_EXIT[1]], r: 90, why: 'back to the cave mouth' },
        { loc: 'mdaughter_caveexit', at: CAVE_EXIT, want: 'into the daylight', why: 'out' },
        { setpos: [HAMAL[0], HAMAL[1], 0], why: 'to Hamal' },
        { talk: 'mdaughter_hamal', want: 'Ten years I have had men on that shore', why: 'he sees her' },
        { stage: 50 },
        { varis: 'mdaughter_hamal_heardofdeath', to: 1 },

        { note: 'wiki step 7: Ragnar has kept her necklace for ten years' },
        { setpos: RAGNAR, why: 'to Ragnar by the water' },
        { talk: 'mdaughter_ragnar', want: 'put it on her', why: 'the necklace' },
        { stage: 60 },
        { has: 'mdaughter_necklace' },

        { note: 'wiki step 7: five rocks off the churned ground in the goat pen' },
        { setpos: [PEN[0][0], PEN[0][1], 0], why: 'to the goat pen' },
        { take: 'mdaughter_rock', r: 2, why: 'one' },
        { go: PEN[1], exact: true, r: 10, why: 'two' },
        { take: 'mdaughter_rock', r: 2, why: 'two' },
        { go: PEN[2], exact: true, r: 10, why: 'three' },
        { take: 'mdaughter_rock', r: 2, why: 'three' },
        { go: PEN[3], exact: true, r: 10, why: 'four' },
        { take: 'mdaughter_rock', r: 2, why: 'four' },
        { go: PEN[4], exact: true, r: 10, why: 'five' },
        { take: 'mdaughter_rock', r: 2, why: 'five' },
        { has: 'mdaughter_rock', n: 5 },

        { note: 'wiki step 7: bury her on the island with the necklace on, and build the cairn' },
        ...out(),
        { go: MOUND_STAND, exact: true, r: 20, why: 'to the burial ground' },
        { held: 'mdaughter_daughter_corpse', op: 3, want: 'lay her in the ground', why: 'bury her' },
        { stage: 70 },
        { varis: 'mdaughter_burial_state', to: 1 },
        { hasnt: 'mdaughter_necklace' },
        { useLoc: 'mdaughter_multimound', at: MOUND, obj: 'mdaughter_rock', want: 'stack the rocks over her', why: 'five stones on top' },
        { varis: 'mdaughter_burial_state', to: 2 },
        { wait: 6, why: 'the completion is queued behind the cairn' },
        { stage: 90 },
        { has: 'mdaughter_bear_helmet' }
    ]
};

const p: any = H.makePlayer('mdrun', m.start[0], m.start[1]);
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
