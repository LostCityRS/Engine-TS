// SHILO VILLAGE, played through on foot.
//
// Quest 97 of the quest-by-quest pass, and the third in a row with no sim of any kind behind it:
// 2,198 lines across six scripts, two underground map squares for Ah Za Rhoon, a tomb on Cairn
// Isle, a second tomb under the jungle, and a boss with three forms.
//
// The quest's own varp is %zombiequeen, not anything with "shilo" in it, which is why it is easy to
// miss when looking for coverage.
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_shilo_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

// --- southern Karamja
const MOSOL: [number, number, number] = [2883, 2952, 0];
const TRUFITUS: [number, number, number] = [2809, 3087, 0];
const BURY: [number, number, number] = [2796, 3088, 0]; // inzone(0_43_48_42_15, 0_43_48_46_18)

// --- Ah Za Rhoon
const MOUND: [number, number] = [2921, 2999]; // ahzarhoon_entrance
const _AZR_ARRIVEAZR_ARRIVE: [number, number, number] = [2898, 9401, 0];
const SECRET_STONE: [number, number] = [2901, 9379]; // zqsecretstone, the plaque
const RUBBLE_146: [number, number] = [2887, 9373]; // secretrubble, the cave-in
const _RUBBLE_145RUBBLE_145: [number, number] = [2886, 9283]; // its other side
const RUBBLE_BOOK: [number, number] = [2885, 9317]; // secretrubblebook, the tattered scroll
const SACKS: [number, number] = [2939, 9285]; // zqsacks, the crumpled scroll
const GALLOWS: [number, number] = [2934, 9325]; // zqgallows, the Zadimus corpse

// --- Cairn Isle and the tomb of Bervirius
const CLIMB_ROCKS: [number, number] = [2794, 2979]; // zqclimbingrocks, climbed from the east
const WELL_ROCKS: [number, number] = [2762, 2990]; // zqrocks, the well-stacked rocks
const BERV_DOLMEN: [number, number] = [2766, 9364]; // zqdolmen
const HANDHOLDS: [number, number] = [2765, 9376]; // zqhandholds, the way out

// --- the tomb of Rashiliyia
const PALM: [number, number] = [2916, 3092]; // zqquest_hidytree
const RASH_DOORS: [number, number] = [2917, 3090]; // hillsideclosedl, revealed by the palm
const _TOMB_ARRIVETOMB_ARRIVE: [number, number, number] = [2929, 9525, 0];
const GATE: [number, number] = [2929, 9516]; // zombiequeengateclosedr
const TOMB_DOOR: [number, number] = [2892, 9480]; // thzq_tombrooml1
const DOLMEN: [number, number] = [2892, 9487]; // zqrashdolmen, in Rashiliyia's tomb
const CAIRN_DOLMEN: [number, number] = [2766, 9364]; // zqdolmen, under Cairn Isle
const _RASH_DOLMENRASH_DOLMEN: [number, number] = [2892, 9487]; // zqrashdolmen

const m: Manifest = {
    quest: 'SHILO VILLAGE',
    source: 'oldschool.runescape.wiki/w/Shilo_Village/Quick_guide',
    stageVar: 'zombiequeen',
    done: 15, // ^zombiequeen_complete
    start: MOSOL,
    steps: [
        { note: 'requirements: Jungle Potion and Druidic Ritual. 20 Crafting and 32 Agility are' },
        { note: 'recommended, 15 Agility for the Cairn Isle rocks, 32 to squeeze into both tombs.' },
        { setvar: 'junglepotion', to: 100, why: 'Jungle Potion complete' },
        { setvar: 'druidquest', to: 4, why: '^druid_complete' },
        { note: 'items: a spade, a rope, bronze wire, a chisel, a lit candle (the light source is' },
        { note: 'consumed) and three plain bones for the skeletal door.' },
        { give: 'spade' },
        { give: 'rope' },
        { give: 'bronzecraftwire' },
        { give: 'chisel' },
        { give: 'lit_candle' },
        { give: 'bones', n: 3 },

        { note: 'wiki step 1: Mosol Rei, outside the sealed village, gives you the wampum belt' },
        { setpos: MOSOL, why: 'to Mosol Rei' },
        {
            talk: 'mosol_rei',
            picks: ['Why do I need to run?', 'Rashiliyia? Who is she?', 'What can we do?', "I'll go to see the Shaman.", "Yes, I'm sure and I'll take the Wampum belt to Trufitus."],
            want: 'Wampum belt',
            why: 'take the belt'
        },
        { has: 'mosol_wampum_belt' },

        { note: 'wiki step 2: the belt on Trufitus in Tai Bwo Wannai is what starts the quest' },
        { setpos: TRUFITUS, why: 'to Trufitus' },
        {
            useNpc: 'trufitus',
            obj: 'mosol_wampum_belt',
            picks: ['Mosol Rei said something about a legend?', 'Why was it called Ah Za Rhoon?', 'I am going to search for Ah Za Rhoon!', "Yes, I will seriously look for Ah Za Rhoon and I'd appreciate your help."],
            want: 'good luck with your quest',
            why: 'commit to finding Ah Za Rhoon'
        },
        { stage: 1 },
        { hasnt: 'mosol_wampum_belt' },

        { note: 'wiki steps 3-5: the mound of earth south-west of the Shipyard. Search it, dig it,' },
        { note: 'drop a light down the fissure, tie the rope on, and squeeze in.' },
        { setpos: [MOUND[0], MOUND[1] - 1, 0], why: 'to the mound of earth' },
        { loc: 'ahzarhoon_entrance', at: MOUND, op: 2, why: 'search the mound' },
        // `stage`, not `varis`: both assert the same number, but only `stage` is a leg boundary to
        // ExportHelper, and each of these four has a real click after it - dig, light, rope, climb.
        // As varis they were four stages a player could be sitting at with nothing in the panel.
        { stage: 3 },
        { useLoc: 'ahzarhoon_entrance', at: MOUND, obj: 'spade', why: 'dig it' },
        { stage: 4 },
        { useLoc: 'ahzarhoon_entrance_fissure', at: MOUND, obj: 'lit_candle', want: 'anchor point', why: 'light the fissure' },
        { stage: 5 },
        { useLoc: 'ahzarhoon_entrance_fissure', at: MOUND, obj: 'rope', want: 'secure the rope', why: 'tie the rope on' },
        { stage: 6 },
        { note: 'the way down is the SEARCH op, not the first one: op1 on the roped fissure only' },
        { note: 'describes it, and only op2 asks whether you want to crawl through.' },
        { loc: 'ahzarhoon_entrance_fissure_withrope', at: MOUND, op: 2, picks: ["Yes, I'll give it a go!"], want: 'lower yourself', why: 'climb down' },
        { stage: 7 },

        { note: 'wiki steps 6-9: the cave. The plaque, the cave-in, the two scrolls and the gallows.' },
        { loc: 'zqsecretstone', at: SECRET_STONE, op: 2, why: 'search the secret stone' },
        { loc: 'secretrubble', at: RUBBLE_146, op: 2, picks: ["Yes, I'll wriggle through."], soft: true, why: 'the cave-in between the two halves' },
        { setpos: [RUBBLE_BOOK[0], RUBBLE_BOOK[1] - 1, 0], why: 'to the loose rocks' },
        { loc: 'secretrubblebook', at: RUBBLE_BOOK, op: 2, picks: ["Yes, I'm quite sure."], want: 'delicate scroll', tries: 4, until: 'zqberviriusscroll', why: 'search them' },
        { has: 'zqberviriusscroll' },
        { held: 'zqberviriusscroll', op: 1, picks: ['Yes please.'], want: 'Bervirius', why: 'read it' },
        { close: true },
        { setpos: [SACKS[0], SACKS[1] - 1, 0], why: 'to the sacks' },
        { loc: 'zqsacks', at: SACKS, op: 2, until: 'zqrashiliyiascroll', tries: 3, why: 'search the sacks' },
        { has: 'zqrashiliyiascroll' },
        { held: 'zqrashiliyiascroll', op: 1, picks: ['Yes please.'], want: 'Rashiliyia', why: 'read it' },
        { close: true },
        { setpos: [GALLOWS[0], GALLOWS[1] - 1, 0], why: 'to the ancient gallows' },
        { loc: 'zqgallows', at: GALLOWS, op: 2, picks: ['Yes, I may find something else on the corpse.'], until: 'zqzadimusbones', tries: 3, why: 'search the gallows' },
        { has: 'zqzadimusbones' },

        { note: 'LEAVING is a stage of its own: [mapzoneexit,0_45_145] and [mapzoneexit,0_45_146]' },
        { note: 'set ^zombiequeen_left_ah_za_rhoon, and the tomb of Bervirius will not let you in' },
        { note: 'without it. mapzoneexit is fired from NetworkPlayer.processMovement, so a harness' },
        { note: 'player never gets one - questrun gained a `mapexit` step for it.' },
        { note: 'wiki step 10: bury the corpse by the tribal statue in Tai Bwo Wannai' },
        { setpos: BURY, why: 'to the tribal statue' },
        { note: 'and the queue only counts the exit once the player is actually OUT of both squares' },
        { mapexit: [2886, 9283], why: 'out of Ah Za Rhoon' },
        { stage: 8 },
        { held: 'zqzadimusbones', op: 1, want: 'lay the remains of Zadimus to rest', why: 'bury it' },
        { has: 'zqboneshard' },

        { note: 'wiki steps 11-12: Cairn Isle. Climb the rocks, cross the bridge, and search the' },
        { note: 'well-stacked rocks to get into the tomb of Bervirius.' },
        { setpos: [CLIMB_ROCKS[0] + 1, CLIMB_ROCKS[1], 0], why: 'to the rocks east of Cairn Isle' },
        { loc: 'zqclimbingrocks', at: CLIMB_ROCKS, soft: true, why: 'climb them' },
        { setpos: [WELL_ROCKS[0], WELL_ROCKS[1] - 1, 0], why: 'to the well-stacked rocks' },
        { note: 'the squeeze is an Agility roll - stat_random(agility, 125, 250), which is 251 in' },
        { note: '256 at 99 - and yet it loses whole runs, because the five tries behind it are' },
        { note: 'not five rolls: a run that came back with neither the success line nor the' },
        { note: '"you manage to get yourself stuck" one had answered the choice and then stopped,' },
        { note: 'and the retries after that were spent on clicks nothing picked up. Pinned, like' },
        { note: 'every other stat_random in these walks, so the walk does not turn on one roll.' },
        { rng: 0, why: 'stat_random true: through the crevice first time' },
        {
            loc: 'zqrocks',
            at: WELL_ROCKS,
            op: 2,
            picks: ['Yes Please, I can think of nothing nicer!'],
            tries: 5,
            want: 'narrow underground corridor',
            soft: true,
            why: 'crawl into the crevice'
        },
        { rng: null },
        { stage: 9 },

        { note: 'wiki steps 13-15: the dolmen gives the sword pommel, the locating crystal and a' },
        { note: 'copy of the inscription. The pommel is chiselled into bone beads and the bronze' },
        { note: 'wire ties them into the Beads of the Dead.' },
        { setpos: [BERV_DOLMEN[0], BERV_DOLMEN[1] - 1, 0], why: 'to the dolmen' },
        { loc: 'zqdolmen', at: BERV_DOLMEN, op: 2, want: 'ivory pommel', why: 'search it' },
        { has: 'zqbevsword' },
        { has: 'zqcrystal' },
        { use: ['chisel', 'zqbevsword'], want: 'beads', why: 'chisel the pommel' },
        { has: 'zqbonebeads' },
        { use: ['bronzecraftwire', 'zqbonebeads'], want: 'Beads of the Dead', why: 'thread them' },
        { has: 'zqdeadbeads' },
        { loc: 'zqhandholds', at: HANDHOLDS, soft: true, why: 'climb out of the tomb' },

        { note: 'wiki steps 16-18: the palm trees hide the doors into the tomb of Rashiliyia, the' },
        { note: 'bone shard is chiselled into the bone key, and the beads have to be WORN.' },
        { note: 'THE PALMS SPRING BACK after fifty ticks - longqueue(hide_rashiliyia_doors, 50) -' },
        { note: 'and the bone key cannot be made until the doors have been SEARCHED, which is what' },
        { note: 'sets ^zq_found_door. So the trees are pulled apart twice: once to find the keyhole' },
        { note: 'and once to use the key, exactly as a player has to.' },
        { setpos: [PALM[0], PALM[1] + 1, 0], why: 'to the bright green palm trees' },
        { note: 'every door step pulls the trees apart itself, through `first` - fifty ticks is not' },
        { note: 'long enough to be sure the doors are still there a step later.' },
        {
            loc: 'hillsideclosedl',
            at: RASH_DOORS,
            op: 2,
            first: 'zqquest_hidytree',
            firstAt: PALM,
            firstOp: 2,
            tries: 4,
            want: 'made out of bone',
            why: 'find the keyhole'
        },
        { use: ['chisel', 'zqboneshard'], want: 'key out of the bone shard', why: 'chisel the bone key' },
        { has: 'zqbonekey' },
        { held: 'zqdeadbeads', op: 2, why: 'wear the Beads of the Dead' },
        { worn: 'zqdeadbeads' },
        {
            useLoc: 'hillsideclosedl',
            at: RASH_DOORS,
            obj: 'zqbonekey',
            first: 'zqquest_hidytree',
            firstAt: PALM,
            firstOp: 2,
            want: 'creak open',
            why: 'unlock the doors'
        },
        { stage: 10 },
        { note: 'getting inside is three clicks inside one fifty-tick window: search the palms,' },
        { note: 'open the carved doors, walk through the opened ones. `first` is a chain for it.' },
        {
            loc: 'loc_2238',
            at: RASH_DOORS,
            first: [
                ['zqquest_hidytree', PALM[0], PALM[1], 2],
                ['hillsideclosedl', RASH_DOORS[0], RASH_DOORS[1], 1]
            ],
            want: 'winding tunnel',
            why: 'walk in'
        },
        { level: 0 },

        { note: 'wiki step 19: the ancient gate, with the beads on' },
        { setpos: [GATE[0], GATE[1] + 1, 0], why: 'to the ancient gate' },
        { loc: 'zombiequeengateclosedr', at: GATE, want: 'Beads of the Dead start to glow', why: 'open it' },
        { stage: 11 },

        { note: 'wiki steps 20-21: three plain bones into the skeletal door, one recess at a time' },
        { setpos: [TOMB_DOOR[0], TOMB_DOOR[1] - 1, 0], why: 'through the dungeon to the tomb doors' },
        { loc: 'thzq_tombrooml1', at: TOMB_DOOR, op: 2, want: 'three recesses', why: 'look at the door' },
        { useLoc: 'thzq_tombrooml1', at: TOMB_DOOR, obj: 'bones', want: 'two recesses left', why: 'the first bone' },
        { useLoc: 'thzq_tombrooml2', at: TOMB_DOOR, obj: 'bones', want: 'one recess left', why: 'the second' },
        { useLoc: 'thzq_tombrooml3', at: TOMB_DOOR, obj: 'bones', want: 'push the huge doors open', why: 'and the third' },
        { stage: 12 },

        { note: 'wiki step 22: the dolmen in the tomb, and Nazastarool three times over - zombie,' },
        { note: 'skeleton, ghost, each one summoned by the MESBOX of the one before.' },
        { note: 'AND THE WHOLE SHOWDOWN HAPPENS INSIDE THIS ONE CLICK. That is what stopped this' },
        { note: 'walk for two sessions: the fight step after it reported "none of zq_mainzombie1' },
        { note: 'is spawned anywhere near", which reads as a summon that never fired, and the' },
        { note: 'conclusion written down was that the content was broken. It is not. drive() runs' },
        { note: 'up to six hundred ticks and keeps clicking, and each form is summoned by a mesbox' },
        { note: 'and killed by the player’s own retaliation - so a maxed player with a dragon' },
        { note: 'scimitar fights all three, takes the last mesbox and has the corpse waiting on' },
        { note: 'the dolmen before the loc step has returned. The bits are the proof: 4084 is' },
        { note: '0b111111110100, and the top three of those are zq_defeated_nazastarool1, 2 and 3.' },
        { setpos: [DOLMEN[0], DOLMEN[1] - 1, 0], why: 'to the dolmen chamber' },
        { loc: 'zqrashdolmen', at: DOLMEN, op: 2, want: 'ground starts to shake', why: 'touch the dolmen' },
        { note: 'and for the run where the drive window does not cover all three' },
        { fight: ['zq_mainzombie1', 'zq_mainzombie2', 'zq_mainzombie3'], untilvar: 'zq_map_mechanisms', to: 4084, r: 12, tries: 20, why: 'whichever form is still standing' },
        { varis: 'zq_map_mechanisms', to: 4084 },
        { loc: 'zqrashdolmen', at: DOLMEN, op: 2, want: 'mumified remains', why: 'search the dolmen' },
        { has: 'zqcorpse' },
        { stage: 14 },

        { note: 'wiki step 23: her remains on the dolmen under Cairn Isle, where she was looking' },
        { note: 'for her son. She thanks you and the quest finishes on a queue.' },
        { setpos: [CAIRN_DOLMEN[0], CAIRN_DOLMEN[1] - 1, 0], why: 'to the dolmen under Cairn Isle' },
        { useLoc: 'zqdolmen', at: CAIRN_DOLMEN, obj: 'zqcorpse', want: 'gratitude for releasing my spirit', why: 'lay the remains down' },
        { hasnt: 'zqcorpse' },
        { wait: 8, why: 'the completion queue' },
        { stage: 15 }
    ]
};

const p: any = H.makePlayer('shilorun', m.start[0], m.start[1]);
H.tick(2);
p.teleport(m.start[0], m.start[1], m.start[2]);
p.applyDamage = function () {};
H.setVar(p, 'macro_event', 1);
H.maxOut(p);
H.equip(p, { rhand: 'dragon_scimitar', torso: 'rune_platebody', legs: 'rune_platelegs', hat: 'rune_full_helm' });
// AND THE COMBAT VARPS AFTER THE EQUIP, not before. maxOut writes the levels straight onto the
// player and equip writes the worn inventory, so [changestat,_] never fires for either and
// %com_slashattack is still what login worked out for a level-1 player in nothing - which is the
// difference between killing Nazastarool inside the dolmen click and never scratching him.
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
