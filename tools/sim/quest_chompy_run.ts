// BIG CHOMPY BIRD HUNTING, played through on foot.
//
// Quest 94 of the quest-by-quest pass, and the first one in it with no sim of any kind behind it.
//
// Almost everything in this quest is a dice roll, which is why it needs the `rng` step more than
// anything walked so far:
//
//   the ogre chest    random(3) = 0 fails to lift the rock and drains a Strength level - one
//                     attempt in three, and it is the = 0 branch that FAILS, not the one that works
//   the arrow shafts  ~random_range(2, 6) shafts per achey log, and tips per wolf bone
//   the bait          the bloated toad rolls random(5) = 1 every 25 ticks to call a chompy, and
//                     bursts on its fourth roll whether one came or not
//   Rantz's shot      [ai_timer,rantz] runs every tick and returns unless random(20) = 0
//
// Those pins pull against each other - the toad's 1 in 5 wants a return in [0.2, 0.4), the chest
// wants one at or above a third, and Rantz's 1 in 20 wants one under 0.05 - so the walk runs on
// 0.35, which satisfies the first two at once, drops to 0 to make Rantz shoot, and puts the
// real generator back before the player takes the bow, because a pinned roll makes every hit roll
// identical.
//
// The Chompy Bird's Attack is op5, not op2: [apnpc5,chompy_bird], with its own combat proc that
// refuses anything but an ogre bow with ogre arrows in the quiver. The fight step gained an `op`
// for it.
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_chompy_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const RANTZ: [number, number, number] = [2630, 2981, 0];
const CAVE_IN: [number, number] = [2629, 2998]; // rantzogrecaveentrance -> 2647,9379
const CAVE_OUT: [number, number] = [2647, 9377]; // rantzogrecaveexitl -> 2630,2997
const _CAVE_ARRIVECAVE_ARRIVE: [number, number, number] = [2647, 9379, 0];
const FYCIE: [number, number, number] = [2650, 9393, 0];
const BUGS: [number, number, number] = [2640, 9391, 0];
const CHEST: [number, number] = [2637, 9398];
// A CHOPPED ACHEY TREE IS A STUMP, so four logs means four trees. These are every achey in
// Rantz's own map square, nearest his clearing first.
const ACHEYS: [number, number][] = [
    [2625, 2977],
    [2626, 2974],
    [2625, 2972],
    [2625, 2959]
];
const WOLVES: [number, number, number] = [2605, 2963, 0];
const BUBBLES: [number, number] = [2595, 2966];
// THE SWAMP POOL IS NOT WALKABLE. Every swampbubbles loc blocks its own tile, so x 2595-2601 by
// z 2963-2968 is one solid island of them - stand on it and nothing can move at all. This is the
// walkable tile on its west edge.
const SWAMP: [number, number, number] = [2594, 2966, 0];
const CLEARING: [number, number, number] = [2636, 2966, 0]; // inzone(0_41_46_7_18, 0_41_46_15_27)
const SPIT: [number, number] = [2630, 2990];

const m: Manifest = {
    quest: 'BIG CHOMPY BIRD HUNTING',
    source: 'oldschool.runescape.wiki/w/Big_Chompy_Bird_Hunting/Quick_guide',
    stageVar: 'chompybird',
    done: 65, // ^chompybird_complete
    start: RANTZ,
    steps: [
        { note: 'no quest requirements. Skills: Fletching 5, Cooking 30, Ranged 30.' },
        { note: "items: an axe, about 100 feathers, coins for Fycie's flufsies and Bugs's" },
        { note: 'scratchers, and the six seasonings - the family each want one of two at random,' },
        { note: 'so all six have to be carried to the spit.' },
        { give: 'rune_axe' },
        { give: 'feather', n: 100 },
        { give: 'coins', n: 100 },
        { give: 'potato' },
        { give: 'onion' },
        { give: 'cabbage' },
        { give: 'tomato' },
        { give: 'equa_leaves' },
        { give: 'doogleleaves' },

        { note: 'every roll in this quest is pinned to 0.35 unless a step says otherwise: random(3)' },
        { note: 'gives 1 (the rock lifts - the chest FAILS on 0), random(5) gives 1 (the toad calls' },
        { note: 'a chompy) and random_range(2, 6) gives 3 (three shafts a log, three tips a bone).' },
        { rng: 0.35, why: 'the whole fletching and baiting chain' },

        { note: 'wiki step 1: Rantz, east of the Feldip Hills' },
        { setpos: RANTZ, why: 'to Rantz' },
        {
            talk: 'rantz',
            picks: ["What are 'stabbers'?", "What's a 'chompy'?", "Ok, I'll make you some 'stabbers'."],
            want: 'sticksies from achey tree',
            why: 'agree to make the stabbers'
        },
        { stage: 5 },

        { note: 'the children are in the cave north of Rantz: Fycie sells 25 feathers for 50 coins' },
        { note: 'and Bugs a chisel and a knife for 10 - which is where the quest expects a player' },
        { note: 'with neither to get them.' },
        { setpos: [CAVE_IN[0], CAVE_IN[1] - 2, 0], why: 'to the cave mouth' },
        { loc: 'rantzogrecaveentrance', at: CAVE_IN, want: 'dimly lit cave', why: 'into the cave' },
        { setpos: FYCIE, why: 'to Fycie' },
        { talk: 'fycie', picks: ["Ok, I'll give you 50 bright pretties."], want: 'flufsies', why: 'buy the feathers' },
        { has: 'feather', n: 125 },
        { setpos: BUGS, why: 'to Bugs' },
        { talk: 'bugs', picks: ["Ok, I'll give you 10 bright pretties."], want: 'scratchers', why: 'buy the chisel and knife' },
        { has: 'chisel' },
        { has: 'knife' },
        { loc: 'rantzogrecaveexitl', at: CAVE_OUT, want: 'back out of the darkness', why: 'out again' },

        { note: 'wiki steps 2-3: achey logs, cut into shafts with the knife. Four logs at three' },
        { note: 'shafts each is twelve: six for Rantz to practise with and six to shoot with.' },
        ...ACHEYS.map((at, i) => ({
            loc: 'achey_tree',
            at,
            why: i === 0 ? 'chop an achey tree' : 'and the next one along'
        })),
        { has: 'achey_tree_logs', n: 4 },
        { note: 'knife on logs - and this has to happen BEFORE the wolf bones are picked up, because' },
        { note: 'achey logs plus wolf bones is also the recipe for the comp ogre bow and the knife' },
        { note: 'then asks which you meant.' },
        { use: ['knife', 'achey_tree_logs'], want: 'arrow shafts', why: 'cut the first log' },
        { use: ['knife', 'achey_tree_logs'], why: 'the second' },
        { use: ['knife', 'achey_tree_logs'], why: 'the third' },
        { use: ['knife', 'achey_tree_logs'], why: 'and the fourth' },
        { has: 'ogre_arrow_shaft', n: 12 },

        { note: 'wiki step 4: four feathers a shaft, six shafts at a time' },
        { use: ['feather', 'ogre_arrow_shaft'], want: 'feathers to', why: 'flight six shafts' },
        { use: ['feather', 'ogre_arrow_shaft'], why: 'and the other six' },
        { has: 'ogre_headless_arrow', n: 12 },

        { note: 'wiki steps 5-6: wolf bones from the wolves west of Rantz, chiselled into tips' },
        { rng: null, why: 'a pinned roll makes every combat roll identical' },
        { setpos: WOLVES, why: 'to the wolves' },
        { fight: 'wolf', until: 'wolf_bones', tries: 8, r: 20, why: 'kill a wolf for its bones' },
        { take: 'wolf_bones', r: 6, why: 'pick the bones up' },
        { rng: 0.35, why: 'back to three tips a bone' },
        { note: 'the other three bones are the same wolves again - the kill above is what proves' },
        { note: 'they drop them.' },
        { give: 'wolf_bones', n: 3 },
        { use: ['chisel', 'wolf_bones'], want: 'arrow tips', why: 'chisel the first bone' },
        { use: ['chisel', 'wolf_bones'], why: 'the second' },
        { use: ['chisel', 'wolf_bones'], why: 'the third' },
        { use: ['chisel', 'wolf_bones'], why: 'and the fourth' },
        { has: 'wolfbone_arrowheads', n: 12 },

        { note: 'wiki step 7: tips onto the flighted shafts, six at a time' },
        { use: ['wolfbone_arrowheads', 'ogre_headless_arrow'], want: 'ogre arrows', why: 'make six' },
        { use: ['wolfbone_arrowheads', 'ogre_headless_arrow'], why: 'and six more' },
        { has: 'ogre_arrow', n: 12 },

        { note: 'wiki step 8: Rantz takes six. He checks that the player made them themselves -' },
        { note: '%chompybird_kills bit 0, set by make_ogre_arrows - before he counts them.' },
        { setpos: RANTZ, why: 'back to Rantz' },
        { talk: 'rantz', want: 'takes six ogre arrows', why: 'hand over the stabbers', picks: ['Ok, thanks.'] },
        { stage: 10 },
        { has: 'ogre_arrow', n: 6 },

        { note: 'wiki steps 9-10: asking Rantz about the toadies is what gives permission to open' },
        { note: 'his chest, and the chest is a Strength roll - one attempt in three drains a level' },
        { note: 'instead of lifting the rock.' },
        { talk: 'rantz', picks: ['How do we make the chompys come?', 'Ok, thanks.'], want: 'swamp gas', why: 'ask about the fatsy toadies' },
        { stage: 15 },
        { setpos: [CAVE_IN[0], CAVE_IN[1] - 2, 0], why: 'to the cave mouth' },
        { loc: 'rantzogrecaveentrance', why: 'into the cave', at: CAVE_IN },
        { note: 'the success and the failure both say "lift the huge rock", so the line to wait' },
        { note: 'for is the whole of the successful one - and the op ends in a p_delay, so the' },
        { note: 'loc_change and the stage write land a tick after the click returns.' },
        { loc: 'chompybird_chest', at: CHEST, want: 'manage to lift the huge rock', why: 'lift the rock off the chest' },
        { wait: 3, why: 'the rock comes off' },
        { stage: 20 },
        { loc: 'chompybird_chest_open', at: CHEST, want: 'ogre bellows', why: 'search the chest' },
        { has: 'empty_ogre_bellows' },
        { loc: 'rantzogrecaveexitl', at: CAVE_OUT, why: 'out again' },

        { note: 'wiki steps 11-12: fill the bellows at the swamp bubbles, then use them on a swamp' },
        { note: 'toad. One fill is three toads and the bellows count down a model at a time, so each' },
        { note: 'use is a different obj - which is the thing worth walking here.' },
        { setpos: SWAMP, why: 'to the west edge of the swamp' },
        { useLoc: 'swampbubbles', at: BUBBLES, obj: 'empty_ogre_bellows', want: 'gas from the swamp', why: 'fill the bellows' },
        { has: 'filled_ogre_bellow3' },
        { useNpc: 'toad', obj: 'filled_ogre_bellow3', want: 'bloated toad to your inventory', why: 'inflate a toad' },
        { useNpc: 'toad', obj: 'filled_ogre_bellow2', want: 'bloated toad to your inventory', why: 'and a second' },
        { useNpc: 'toad', obj: 'filled_ogre_bellow1', want: 'bloated toad to your inventory', why: 'and a third' },
        { has: 'bloated_toad', n: 3 },
        { has: 'empty_ogre_bellows' },

        { note: 'wiki steps 13-15: show Rantz the toad, drop it where he points, and wait. The' },
        { note: 'clearing is a zone - inzone(0_41_46_7_18, 0_41_46_15_27) - and anywhere else is' },
        { note: '"too far away for Rantz to shoot the chompy bird".' },
        { setpos: RANTZ, why: 'back to Rantz' },
        { talk: 'rantz', want: 'good fatsy toady', why: 'show him the bait' },
        { stage: 25 },
        { setpos: CLEARING, why: 'to the clearing south of him' },
        { held: 'bloated_toad', op: 1, want: 'place the bloated toad bait', why: 'put the bait down' },
        { stage: 30 },
        { note: 'wiki step 15: the bait is down. A chompy comes for it on its own; there is nothing' },
        { note: 'to click until Rantz has had his shot.' },
        { note: 'That heading is the whole reason this leg exists in the table. Stage 30 was being' },
        { note: 'asserted here already and still had no row, because everything below it is a kind' },
        { note: 'the exporter drops as robot-only - wait, nearnpc, wakehunt - and the notes that' },
        { note: 'followed did not open "wiki", so the leg carried no step, no item and no heading' },
        { note: 'and push() threw it away. Same shape as Fight Arena 8. With the leg present and' },
        { note: 'stepless, legNow walks the panel on past it and past Rantz to the next thing a' },
        { note: 'player can actually do, instead of leaving them on leg 25 - "Drop Bloated toad" -' },
        { note: 'which they have just done. DeathPlateau-Bugs#16.' },
        { wait: 40, why: 'the toad calls a chompy' },
        { nearnpc: 'chompy_bird', r: 20, why: 'a chompy bird lands' },
        { note: 'and then it has to HUNT the toad to eat it, which is a hunt with the default' },
        { note: 'nobodynear - so it only runs while a real client is watching the bird, and a' },
        { note: 'harness player watches nothing. The step does what the engine would do.' },
        { wakehunt: 'chompy_bird', untilvar: 'chompybird', to: 35, tries: 60, why: 'it eats the bait' },
        { stage: 35 },

        { note: 'wiki step 16: Rantz shoots and misses. [ai_timer,rantz] runs every tick but' },
        { note: 'returns unless random(20) = 0, so the pin drops to 0 for this one step.' },
        { rng: 0, why: 'so Rantz actually takes his shot' },
        { wait: 20, why: 'he lines it up, fires, and misses' },
        { stage: 40 },
        { setpos: RANTZ, why: 'to Rantz' },
        {
            talk: 'rantz',
            picks: ['Come on, let me have a go...', "I'm actually quite strong... please let me try."],
            want: 'hands over an ogre bow',
            why: 'talk him into lending the bow'
        },
        { stage: 45 },
        { has: 'ogre_bow' },

        { note: 'wiki step 17: the bow and the arrows have to be WORN - the combat proc reads' },
        { note: 'inv_getobj(worn, rhand) and the quiver, and refuses anything else.' },
        { rng: null, why: 'real rolls for the kill' },
        { held: 'ogre_bow', op: 2, why: 'wield the ogre bow' },
        { worn: 'ogre_bow' },
        { held: 'ogre_arrow', op: 2, why: 'and the arrows into the quiver' },
        { worn: 'ogre_arrow' },
        { note: 'the first bird is long gone - npc_add gave it 100 ticks and getting the bow out' },
        { note: 'of Rantz took longer than that, which is the wiki’s own "if you are too slow,' },
        { note: 'place another toad in the clearing". That is what the other two toads are for.' },
        { rng: 0.35, why: 'so the second toad calls a bird straight away' },
        { setpos: CLEARING, why: 'back to the clearing' },
        { held: 'bloated_toad', op: 1, want: 'place the bloated toad bait', why: 'put a second toad down' },
        { wait: 30, why: 'and a bird comes to it' },
        { nearnpc: 'chompy_bird', r: 20, why: 'the second chompy lands' },
        { rng: null, why: 'real rolls for the shooting' },
        { note: 'the kill leaves no carcass - it leaves a chompybird_dead npc, and PLUCKING that' },
        { note: 'is what puts the raw chompy on the ground - so the shot is judged on the stage.' },
        { fight: 'chompy_bird', op: 5, untilvar: 'chompybird', to: 50, tries: 4, r: 20, why: 'shoot the chompy bird' },
        { stage: 50 },

        { note: 'wiki step 18: the dead bird is a separate npc with a Pluck op, and plucking it is' },
        { note: 'what leaves the carcass on the ground.' },
        { talk: 'chompybird_dead', op: 4, want: 'plucking the chompy bird', why: 'pluck it' },
        { take: 'raw_chompy', r: 8, why: 'pick up the carcass' },

        { note: 'wiki step 19: Rantz looks at it and tells you to cook it' },
        { setpos: RANTZ, why: 'back to Rantz' },
        { talk: 'rantz', want: 'cook da chompy', why: 'show him the chompy' },
        { stage: 55 },

        { note: 'wiki step 20: Fycie and Bugs each name one of two seasonings at random, and the' },
        { note: 'spit refuses to cook until both have been asked.' },
        { setpos: [CAVE_IN[0], CAVE_IN[1] - 2, 0], why: 'to the cave mouth' },
        { loc: 'rantzogrecaveentrance', at: CAVE_IN, why: 'into the cave' },
        { setpos: FYCIE, why: 'to Fycie' },
        { talk: 'fycie', want: 'wiv mine', why: 'ask what she wants' },
        { setpos: BUGS, why: 'to Bugs' },
        { talk: 'bugs', want: 'wiv mine', why: 'and what Bugs wants' },
        { loc: 'rantzogrecaveexitl', at: CAVE_OUT, why: 'out again' },

        { note: 'wiki step 21: the spit roast north of Rantz' },
        { useLoc: 'multi_chompybird_spitroast_entity', at: SPIT, obj: 'raw_chompy', want: 'chompy is cooked', why: 'cook the chompy' },
        { stage: 60 },
        { has: 'cooked_s_chompy' },

        { note: 'wiki step 22: hand it over' },
        { setpos: RANTZ, why: 'back to Rantz' },
        { talk: 'rantz', want: 'enjoy your well cooked chompy', why: 'hand over the seasoned chompy' },
        { stage: 65 },
        { hasnt: 'cooked_s_chompy' }
    ]
};

const p: any = H.makePlayer('chompyrun', m.start[0], m.start[1]);
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
