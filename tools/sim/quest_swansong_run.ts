// SWAN SONG, played through on foot.
//
// Quest 62 of the quest-by-quest pass. Seventy-one people behind a palisade with five holes in it,
// eleven days into a siege by things that come up out of the fishing grounds. Herman Caranos writes
// to the one man who could stop it, the man comes, and the water takes him out in four seconds.
//
// Two of the wiki's beats are not here and cannot be: the Draynor rune delivery (neither
// swan_wom_draynor nor the ordinary wise_old_man is placed anywhere on this server) and the
// Malignius Mortifer army chain (he does not exist in this cache, nor the airtight pot). The
// quest's own multinpc tables show the condensed shape was intended - stage 25 is not one of their
// legal values, so the Draynor trip was always meant to happen inside stage 20.
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_swansong_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const KATHY: [number, number, number] = [2368, 3485, 0];
const OUTSIDE: [number, number] = [2347, 3647]; // swan_multioutside: Herman, then the Wise Old Man
const HOLE_OUT: [number, number] = [2344, 3651];
const HOLE_IN: [number, number] = [2344, 3654]; // the loc's own tile blocks; it lands you on 3655
const GATE: [number, number] = [2344, 3662];
const FRANKLIN: [number, number] = [2341, 3665];
// The workshop is a 30-tile pocket of its own with one door on its west side, loc_14923 on
// 2337,3675 - so the press and the firebox are behind it and it shuts itself again.
const SHOP_DOOR: [number, number] = [2337, 3675];
const FIREBOX: [number, number] = [2343, 3675];
const PRESS: [number, number] = [2341, 3675];
const WALLS: [number, number][] = [
    [2311, 3688],
    [2311, 3687],
    [2311, 3686],
    [2311, 3685],
    [2311, 3684]
];
const SPOT: [number, number] = [2310, 3697];
const ARNOLD: [number, number] = [2327, 3692];
const HERMAN: [number, number] = [2354, 3684]; // moved out of the blocked office tile
const QUEEN: [number, number] = [2344, 3646];

const m: Manifest = {
    quest: 'SWAN SONG',
    source: 'oldschool.runescape.wiki/w/Swan_Song',
    stageVar: 'swansong',
    done: 200,
    start: KATHY,
    steps: [
        { note: 'requirements: 100 quest points, One Small Favour and Garden of Tranquillity. The six' },
        { note: 'skill levels are not needed to start; Fishing 62 is checked at the spots.' },
        { setvar: 'qp', to: 100, why: 'a hundred quest points' },
        { setvar: 'onesmallfavour', to: 70, why: '^osf_complete' },
        { setvar: 'garden_quest', to: 50, why: '^garden_complete' },
        { give: 'iron_bar', n: 5 },
        { give: 'logs' },
        { give: 'net' },
        { give: 'bones', n: 7 },
        { give: 'mistrune', n: 10 },
        { give: 'lavarune', n: 10 },
        { give: 'bloodrune', n: 5 },

        { note: 'the colony ground is not joined to the rest of the map on foot in this cache, so' },
        { note: "Kathy Corkat's boat is the only way in - which is what her conversation is for" },
        { talk: 'swan_boat_boatwoman', picks: ['Yes please.'], want: 'rows you along the coast', why: 'up the coast' },
        { wait: 6, why: 'the crossing' },

        { note: 'wiki step 1: Herman Caranos, outside the palisade, counting the holes in it' },
        { go: [OUTSIDE[0] + 1, OUTSIDE[1]], r: 40, why: 'to Herman at the hole' },
        { talk: 'swan_multioutside', picks: ["What's happening here?"], want: 'Start with the wall', why: 'he sets the quest' },
        { stage: 5 },

        { note: 'wiki step 4: through the crawl-hole, which he does not let strangers through' },
        { go: [HOLE_OUT[0], HOLE_OUT[1] - 1], exact: true, why: 'south of the hole' },
        { loc: 'loc_14922', at: HOLE_OUT, want: 'crawl through the hole', soft: true, why: 'in' },
        { go: [GATE[0], GATE[1]], exact: true, r: 40, why: 'the inner gate' },
        { loc: 'loc_14931', at: GATE, why: 'through it' },

        { note: 'Franklin Caranos and his press. He hands over the tinderbox and the hammer.' },
        { go: [FRANKLIN[0] + 1, FRANKLIN[1]], r: 40, why: 'to Franklin' },
        { talk: 'swan_franklin', want: 'press in the workshop', why: 'he asks for five sheets' },
        { has: 'tinderbox' },
        { has: 'hammer' },
        { varis: 'swansong_franklin', to: 1 },

        { note: "logs in the firebox at the press's east end, then a tinderbox, then the bars" },
        { go: [SHOP_DOOR[0], SHOP_DOOR[1]], exact: true, r: 40, why: 'the workshop door' },
        { loc: 'loc_14923', at: SHOP_DOOR, soft: true, why: 'open it' },
        { go: [FIREBOX[0], FIREBOX[1] - 1], r: 40, why: 'to the firebox' },
        { useLoc: 'loc_14955', at: FIREBOX, obj: 'logs', want: 'logs in the firebox', why: 'fuel' },
        { useLoc: 'loc_14955', at: FIREBOX, obj: 'tinderbox', want: 'press starts to heat up', why: 'light it' },
        { varis: 'swansong_franklin', to: 3 },
        { go: [PRESS[0], PRESS[1] - 1], why: 'to the press' },
        { useLoc: 'loc_14954', at: PRESS, obj: 'iron_bar', want: 'comes out as a sheet', why: 'one' },
        { useLoc: 'loc_14954', at: PRESS, obj: 'iron_bar', why: 'two' },
        { useLoc: 'loc_14954', at: PRESS, obj: 'iron_bar', why: 'three' },
        { useLoc: 'loc_14954', at: PRESS, obj: 'iron_bar', why: 'four' },
        { useLoc: 'loc_14954', at: PRESS, obj: 'iron_bar', why: 'five' },
        { has: 'iron_sheet', n: 5 },

        { note: 'and a sheet on each of the five holes in the west palisade, north to south' },
        { go: [SHOP_DOOR[0] + 1, SHOP_DOOR[1]], exact: true, why: 'back to the workshop door' },
        { loc: 'loc_14923', at: SHOP_DOOR, soft: true, why: 'open it again' },
        { go: [WALLS[0][0] + 1, WALLS[0][1]], r: 60, why: 'to the first hole' },
        { useLoc: 'loc_14933', at: WALLS[0], obj: 'iron_sheet', why: 'one' },
        { useLoc: 'loc_14934', at: WALLS[1], obj: 'iron_sheet', why: 'two' },
        { useLoc: 'loc_14935', at: WALLS[2], obj: 'iron_sheet', why: 'three' },
        { useLoc: 'loc_14936', at: WALLS[3], obj: 'iron_sheet', why: 'four' },
        { useLoc: 'loc_14937', at: WALLS[4], obj: 'iron_sheet', why: 'five' },
        { hasnt: 'iron_sheet' },

        { note: 'wiki step 4 again: back to Herman, who moves on to the second problem' },
        { go: [GATE[0], GATE[1] + 1], exact: true, r: 60, why: 'the inner gate from inside' },
        { loc: 'loc_14931', at: GATE, soft: true, why: 'through it' },
        { go: [HOLE_IN[0], HOLE_IN[1] + 1], exact: true, r: 60, why: 'back to the hole' },
        { loc: 'loc_14922', at: HOLE_IN, want: 'crawl back out', soft: true, why: 'out' },
        { go: [OUTSIDE[0] + 1, OUTSIDE[1]], r: 40, why: 'to Herman' },
        { talk: 'swan_multioutside', want: 'Nobody has eaten', why: 'the wall is done' },
        { stage: 10 },

        { note: 'five monkfish off the spots on the north shore, with a net' },
        { go: [HOLE_OUT[0], HOLE_OUT[1] - 1], exact: true, why: 'south of the hole' },
        { loc: 'loc_14922', at: HOLE_OUT, want: 'crawl through the hole', soft: true, why: 'in' },
        { go: [GATE[0], GATE[1]], exact: true, r: 40, why: 'the inner gate' },
        { loc: 'loc_14931', at: GATE, why: 'through it' },
        { go: [SPOT[0], SPOT[1] + 1], r: 80, why: 'to a fishing spot' },
        { talk: 'swan_fishingspot', op: 3, want: '1 of 5', why: 'one' },
        { talk: 'swan_fishingspot', op: 3, why: 'two' },
        { talk: 'swan_fishingspot', op: 3, why: 'three' },
        { talk: 'swan_fishingspot', op: 3, why: 'four' },
        { talk: 'swan_fishingspot', op: 3, why: 'five' },
        { varis: 'swansong_fish', to: 5 },

        { note: 'Herman again: the colony is fed, the letter goes out on the boat, and the boat' },
        { note: 'comes back the next morning with one extremely old passenger on it' },
        { go: [GATE[0], GATE[1] + 1], exact: true, r: 80, why: 'the inner gate from inside' },
        { loc: 'loc_14931', at: GATE, soft: true, why: 'through it' },
        { go: [HOLE_IN[0], HOLE_IN[1] + 1], exact: true, r: 80, why: 'back to the hole' },
        { loc: 'loc_14922', at: HOLE_IN, want: 'crawl back out', soft: true, why: 'out' },
        { go: [OUTSIDE[0] + 1, OUTSIDE[1]], r: 40, why: 'to Herman' },
        // STAGE 15 IS WRITTEN THREE LINES INTO THIS CONVERSATION and the next thing the script
        // does is write 20, so a driven talk never stands still on it: ^swan_fed had no leg in the
        // helper table, and a player who walked out of Herman between the count and the letter was
        // sent back to net a fishing spot they had just finished. DeathPlateau-Bugs#16 listed it as
        // the one real-and-unfixed value, "unassertable ... needs a harness that can abandon a
        // conversation". This is that: stop the moment the var moves, then walk away.
        { talk: 'swan_multioutside', stopvar: 'swansong', stopto: 15, want: 'Seventy-one people fed', why: 'he counts the fish, and you walk out before the letter' },
        { stage: 15, why: '^swan_fed - the colony is fed and the letter is still unwritten' },
        { note: 'wiki: the colony is fed, and the letter to the magician still has to go out on the' },
        { note: 'boat, so Herman wants one more word' },
        { talk: 'swan_multioutside', want: 'letter goes out', why: 'back to him, and this time hear him out' },
        { stage: 20 },

        { note: 'wiki step 2: the man the letter is addressed to, who is in Draynor pretending to' },
        { note: 'be a pensioner. He was placed nowhere at all until now, which is why this step used' },
        { note: 'to happen by itself in a mesbox; he wants the ten mist, ten lava and five blood the' },
        { note: "wiki's item list wants." },
        { note: 'HE IS [wom_multi] AT 3088,3255, not [wise_old_man] at 3089,3251. Draynor had two of' },
        { note: 'him - the duplicate outside the house was deleted from maps/m48_50.jm2 and the one' },
        { note: 'that was always there is the multinpc indoors, which resolves to wise_old_man.' },
        { note: 'area_draynor/scripts/wise_old_man.rs2 records the whole thing; this looked for him' },
        { note: 'by name and found nobody. The TILE here was right all along - he is out by the' },
        { note: 'house, not inside it: standing the player at 3088,3256 only got them stuck indoors' },
        { note: 'five tiles from him. Only the name was ever wrong.' },
        { setpos: [3089, 3251, 0], why: 'to Draynor' },
        { talk: 'wom_multi', want: 'extremely old', why: 'the runes, and he takes the boat himself' },
        { stage: 30 },
        { hasnt: 'mistrune' },
        { setpos: KATHY, why: "back to Kathy Corkat's boat" },
        { talk: 'swan_boat_boatwoman', picks: ['Yes please.'], want: 'rows you along the coast', why: 'up the coast again' },
        { wait: 6, why: 'the crossing' },
        { go: [OUTSIDE[0] + 1, OUTSIDE[1]], r: 40, why: 'to the Wise Old Man outside the palisade' },

        { note: 'wiki step 3 in this telling: the Wise Old Man looks at them, and then the water' },
        { note: 'takes him out in four seconds and they carry him into the office' },
        { talk: 'swan_multioutside', want: 'never seen a sea troll', why: 'he wants a look first' },
        { stage: 40 },
        { talk: 'swan_multioutside', want: 'not waking up', why: 'the ambush' },
        { stage: 65 },

        { note: "wiki step 5 as the cache allows it: Arnold has Herman's book and the packet of" },
        { note: "bone seeds that was in the old man's hand, and the book wants seven bones" },
        { go: [HOLE_OUT[0], HOLE_OUT[1] - 1], exact: true, why: 'south of the hole' },
        { loc: 'loc_14922', at: HOLE_OUT, want: 'crawl through the hole', soft: true, why: 'in' },
        { go: [GATE[0], GATE[1]], exact: true, r: 40, why: 'the inner gate' },
        { loc: 'loc_14931', at: GATE, why: 'through it' },
        { go: [ARNOLD[0] + 1, ARNOLD[1]], r: 60, why: 'to Arnold in the stores' },
        { talk: 'swan_arnold', want: 'packet of seeds', why: 'the book and the seeds' },
        { stage: 80 },
        { has: 'swan_army' },
        { has: 'swan_book' },
        { use: ['bones', 'swan_army'], want: '1 of 7', why: 'one' },
        { use: ['bones', 'swan_army'], why: 'two' },
        { use: ['bones', 'swan_army'], why: 'three' },
        { use: ['bones', 'swan_army'], why: 'four' },
        { use: ['bones', 'swan_army'], why: 'five' },
        { use: ['bones', 'swan_army'], why: 'six' },
        { use: ['bones', 'swan_army'], want: 'losing consciousness', why: 'seven' },
        { varis: 'swansong_bones', to: 7 },
        { held: 'swan_army', op: 4, want: 'ground along forty yards', why: 'plant them' },
        { stage: 90 },

        { note: 'wiki step 6: Herman starts it. He is in his own office now, with the old man on the' },
        { note: 'floor of it - the multinpc outside stops rendering anybody from stage 65.' },
        { go: [HERMAN[0] - 1, HERMAN[1]], exact: true, r: 60, why: "to Herman's desk" },
        { talk: 'swan_herman', want: 'Sea Troll General', why: 'the battle' },
        { stage: 100 },

        { note: 'and the queen, who used to be two mesboxes. 200 hitpoints, Water Wave for 37, and' },
        { note: 'she comes up out of the water on the shore south of the palisade.' },
        { go: [GATE[0], GATE[1] + 1], exact: true, r: 60, why: 'the inner gate from inside' },
        { loc: 'loc_14931', at: GATE, soft: true, why: 'through it' },
        { go: [HOLE_IN[0], HOLE_IN[1] + 1], exact: true, r: 60, why: 'out through the colony' },
        { loc: 'loc_14922', at: HOLE_IN, want: 'crawl back out', soft: true, why: 'out' },
        { go: [QUEEN[0] + 2, QUEEN[1] + 2], r: 40, why: 'down to the water' },
        { nearnpc: 'swan_seatroll_queen', r: 16, why: 'she is up' },
        { fight: 'swan_seatroll_queen', untilvar: 'swansong', to: 150, tries: 12, r: 20, why: 'level 170' },
        { stage: 150 },

        { note: 'wiki step 7: Herman, twice - once for the news and once for the count' },
        { go: [HOLE_OUT[0], HOLE_OUT[1] - 1], exact: true, r: 40, why: 'back to the hole' },
        { loc: 'loc_14922', at: HOLE_OUT, want: 'crawl through the hole', soft: true, why: 'in' },
        { go: [GATE[0], GATE[1]], exact: true, r: 40, why: 'the inner gate' },
        { loc: 'loc_14931', at: GATE, why: 'through it' },
        { go: [HERMAN[0] - 1, HERMAN[1]], exact: true, r: 60, why: "to Herman's desk" },
        { talk: 'swan_herman', want: 'pleased to be useless', why: 'she is dead' },
        { stage: 190 },
        { talk: 'swan_herman', want: 'Seventy-one', why: 'the count' },
        { wait: 10, why: 'he sits down on the ground' },
        { stage: 200 },
        { has: 'coins', n: 25000 }
    ]
};

const p: any = H.makePlayer('swanrun', m.start[0], m.start[1]);
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
