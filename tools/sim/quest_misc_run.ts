// THRONE OF MISCELLANIA, played through on foot.
//
// Quest 105 of the quest-by-quest pass. miscellania.ts already drives the whole quest - 57 checks
// over Vargas, Sigrid, the anthem, the treaty, the pen, all three courting rounds and the regency -
// but it teleports between every one of them, and the castle is the most door-bound building in the
// pass: SIX clicks from the courtyard to King Vargas, and eight to Princess Astrid.
//
// tools/sim/walkgraph.ts (written for this quest, out of templewalk.ts) is what found those routes.
// It also found something a teleporting sim cannot: of the thirty-six herb patches outside the
// castle, TWENTY-NINE cannot be reached. They are placed as shape-11 centrepieces in a seven-by-
// eight block and the ring of them walls off the forty-seven tiles in the middle, so the wiki's
// main free favour source - "rake herbs and flax outside the palace walls" - is four fifths
// unreachable. That is the 377 cache's own placement, not this server's, so it is recorded rather
// than changed.
//
// WHAT IS DELEGATED: the two courting emotes, because an emote pushed through the harness does
// not hold the protected lock [label,emote]'s p_finduid wants and so never reaches
// misc_emote_react - miscellania.ts drives both for real. And the last of the favour arithmetic. Approval starts at 32 (25%) when the treaty
// is signed and the regency wants 96 (75%), and the walk demonstrates every source it can reach -
// seven weeds and a maple - before setting the remainder. Repeating one click sixty-four times is
// not what a walk is for, and miscellania.ts drives the per-source arithmetic already.
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_misc_run.ts
import * as H from './harness.js';
import { play, Manifest, Step } from './questrun.js';

await H.boot();

// --- the island
const GANGPLANK: [number, number, number] = [2581, 3846, 0];
const FLOWER_GIRL: [number, number, number] = [2518, 3864, 0];
// Derrik stands at 2552,3897 and 2552,3895/3896 are both blocked, so 2551,3897 is the only
// tile in the smithy he can be spoken to from
const DERRIK: [number, number, number] = [2551, 3897, 0];
const SMITHY_DOOR: [number, number] = [2551, 3893];
const MAPLE: [number, number] = [2545, 3865];

// --- the Miscellania castle. Every door below came off walkgraph.ts, with the tile to stand on.
const DOOR_A: [number, number] = [2510, 3860]; // courtyard -> the hall
const DOOR_B: [number, number] = [2505, 3860]; // the hall -> the stair lobby
const DOOR_C: [number, number] = [2506, 3851]; // the lobby -> the staircase room
const STAIRS: [number, number] = [2505, 3848]; // loc_1742, up to the first floor
const DOOR_D: [number, number] = [2506, 3851]; // first floor: the landing -> the ante-room
const THRONE_S: [number, number] = [2506, 3857]; // the guarded throne-room door
const _THRONE_NTHRONE_N: [number, number] = [2506, 3863]; // and the north one, to Astrid's side
const DOOR_BRAND: [number, number] = [2504, 3853]; // the ante-room -> Prince Brand
const _DOOR_ASTRIDDOOR_ASTRID: [number, number] = [2504, 3867]; // the north room -> Princess Astrid
const VARGAS: [number, number, number] = [2503, 3857, 1];
const GHRIM: [number, number, number] = [2501, 3860, 1];
const BRAND: [number, number, number] = [2503, 3851, 1];
const GUARD: [number, number, number] = [2505, 3856, 1];

// --- Etceteria
const BRIDGE: [number, number] = [2600, 3860];
const ETC_DOOR_A: [number, number] = [2608, 3875];
const ETC_DOOR_B: [number, number] = [2611, 3866];
const ETC_STAIRS: [number, number] = [2613, 3867]; // loc_1738
const ETC_DOOR_C: [number, number] = [2615, 3870];
const SIGRID: [number, number, number] = [2617, 3879, 1];

// --- the seven herb patches that can actually be reached, and the tile each is weeded from
const WEEDS: [string, number, number, number, number][] = [
    ['misc_heather_normal', 2526, 3855, 2526, 3856],
    ['misc_heather_normal', 2527, 3855, 2527, 3856],
    ['misc_heather_light', 2528, 3848, 2529, 3848],
    ['misc_heather_light', 2529, 3851, 2530, 3851],
    ['misc_heather_light', 2529, 3855, 2529, 3856],
    ['misc_heather_light', 2530, 3853, 2531, 3853],
    ['misc_heather_light', 2530, 3854, 2531, 3854]
];

// A courting round asks one of nine questions at random and each has its own flattering answer, so
// the pick is the whole list and a1lib takes whichever of them is on the menu.
const FLATTER = 'Be still, my heart||understand your poetry||greatest bard||How poetic||How inspiring||nobler pursuit||touched||presume to have the skill||glad to hear it';

const _TO_THRONE_ROOMTO_THRONE_ROOM: Step[] = [
    { go: [2509, 3859], r: 192, why: 'to the castle hall door' },
    { loc: 'loc_1512', at: DOOR_A, soft: true, why: 'open it' },
    { go: [2504, 3859], why: 'through, to the next door' },
    { loc: 'loc_1512', at: DOOR_B, soft: true, why: 'open it' },
    { go: [2505, 3850], why: 'through, to the staircase door' },
    { loc: 'loc_1512', at: DOOR_C, soft: true, why: 'open it' },
    { go: [2504, 3847], why: 'to the staircase' },
    { loc: 'loc_1742', at: STAIRS, hop: true, why: 'up to the first floor' },
    { level: 1 },
    { go: [2505, 3850], why: 'to the landing door' },
    { loc: 'loc_1512', at: DOOR_D, soft: true, why: 'open it' },
    { go: [GUARD[0], GUARD[1]], why: 'to the throne-room door' },
    { loc: 'misc_ulby_throneroomdoor', at: THRONE_S, soft: true, why: 'open it' },
    { go: [VARGAS[0] + 1, VARGAS[1]], why: 'in to the King' }
];

const m: Manifest = {
    quest: 'THRONE OF MISCELLANIA',
    source: 'oldschool.runescape.wiki/w/Throne_of_Miscellania/Quick_guide',
    stageVar: 'misc_quest',
    done: 100, // ^misc_complete
    start: GANGPLANK,
    steps: [
        { note: 'requirements: Heroes’ Quest, which is what the door guard checks, and The' },
        { note: 'Fremennik Trials. items: an iron bar and logs for the giant pen, a gold ring and a' },
        { note: 'cake and flowers for Prince Brand, and a rake for the herbs.' },
        { setvar: 'heroquest', to: 15, why: '^hero_complete - the guard wants a Heroes’ Guild member' },
        { setvar: 'viking', to: 10, why: 'The Fremennik Trials' },

        { note: 'wiki step 1: the boat from Rellekka. The crossing is travel, not the quest.' },
        { setpos: GANGPLANK, why: 'off the boat onto Miscellania' },
        { go: [FLOWER_GIRL[0], FLOWER_GIRL[1]], r: 192, why: 'into the castle courtyard' },

        { note: 'wiki step 3: King Vargas, up on the first floor of the south-west castle - which is' },
        { note: 'six clicks away through four doors and a staircase, and a guard who only lets a' },
        { note: 'Heroes’ Guild member past' },
        { go: [2509, 3859], r: 192, why: 'to the castle hall door' },
        { loc: 'loc_1512', at: DOOR_A, soft: true, why: 'open it' },
        { go: [2504, 3859], why: 'through, to the next door' },
        { loc: 'loc_1512', at: DOOR_B, soft: true, why: 'open it' },
        { go: [2505, 3850], why: 'through, to the staircase door' },
        { loc: 'loc_1512', at: DOOR_C, soft: true, why: 'open it' },
        { go: [2504, 3847], why: 'to the staircase' },
        { loc: 'loc_1742', at: STAIRS, hop: true, why: 'up to the first floor' },
        { level: 1 },
        { go: [2505, 3850], why: 'to the landing door' },
        { loc: 'loc_1512', at: DOOR_D, soft: true, why: 'open it' },
        { go: [GUARD[0], GUARD[1]], why: 'to the throne-room door' },
        { talk: 'misc_ulby_doorguard', want: 'you may pass', why: 'the guard, and the Guild' },
        { varis: 'misc_grantedaudience', to: 1 },
        { loc: 'misc_ulby_throneroomdoor', at: THRONE_S, soft: true, why: 'open the door' },
        { go: [VARGAS[0] + 1, VARGAS[1]], why: 'in to the King' },
        { talk: 'misc_king_vargas', picks: ['Yes.', "Prince Brand's approval"], want: 'I survived, barely', why: 'take the quest' },
        { stage: 10 },

        { note: 'Advisor Ghrim, beside him, says where to start' },
        { talk: 'misc_advisor_ghrim', picks: ['How do I make peace'], want: 'Queen Sigrid', why: 'ask' },

        { note: 'wiki steps 20-21: east over the bridge to Etceteria, and Queen Sigrid upstairs' },
        { loc: 'misc_ulby_throneroomdoor', at: THRONE_S, soft: true, why: 'back out of the throne room' },
        { go: [2505, 3850], why: 'to the landing' },
        { loc: 'loc_1743', at: STAIRS, op: 3, hop: true, soft: true, why: 'down the staircase' },
        { level: 0 },
        { go: [BRIDGE[0], BRIDGE[1]], r: 256, why: 'east across the bridge' },
        { go: [2607, 3874], why: 'to the Etceteria castle door' },
        { loc: 'loc_1512', at: ETC_DOOR_A, soft: true, why: 'open it' },
        { go: [2610, 3865], why: 'through, to the next' },
        { loc: 'loc_1512', at: ETC_DOOR_B, soft: true, why: 'open it' },
        { go: [2612, 3866], why: 'to the staircase' },
        { loc: 'loc_1738', at: ETC_STAIRS, hop: true, why: 'up' },
        { level: 1 },
        { go: [2614, 3869], why: 'to the last door' },
        { loc: 'loc_1512', at: ETC_DOOR_C, soft: true, why: 'open it' },
        { go: [SIGRID[0], SIGRID[1] - 1], why: 'to Queen Sigrid' },
        { talk: 'misc_queen_sigrid', want: 'sovereign nation', why: 'her terms' },
        { stage: 20 },

        { note: 'wiki step 22: and back west to Vargas, who wants the anthem changed first' },
        { setpos: [VARGAS[0] + 1, VARGAS[1], 1], why: 'back across the bridge and up the castle - walked above' },
        { talk: 'misc_king_vargas', picks: ['Never mind.'], want: 'The title alone', why: 'his answer' },
        { stage: 30 },
        { setpos: [SIGRID[0], SIGRID[1] - 1, 1], why: 'back to Etceteria' },
        { talk: 'misc_queen_sigrid', want: 'nonny-nonny', why: 'she will change it' },
        { stage: 40 },

        { note: 'wiki step 24: Prince Brand writes it - and his room is two more doors past the' },
        { note: 'throne room' },
        { setpos: [VARGAS[0] + 1, VARGAS[1], 1], why: 'back to the Miscellania throne room' },
        { loc: 'misc_ulby_throneroomdoor', at: THRONE_S, soft: true, why: 'out of the throne room' },
        { go: [2503, 3852], why: "to Prince Brand's door" },
        { loc: 'loc_1512', at: DOOR_BRAND, soft: true, why: 'open it' },
        // EXACT, BECAUSE THE TWO TILES OF SLACK ARE THE DOORWAY. travel() accepts landing within
        // two of the target, and from the ante-room that is 2505,3854 - outside Brand's door, with
        // a posh chair blocking the diagonal. The talk step then cannot route to him and reports
        // him four tiles off, which reads as the npc having wandered somewhere unreachable. He had
        // not: the player never came through the door (tracker issue 21).
        { go: [BRAND[0], BRAND[1] + 1], exact: true, why: 'in to the Prince' },
        { talk: 'misc_prince_brand', want: 'So I wrote a song about it', why: 'the awful anthem' },
        { has: 'misc_awful_anthem' },

        { note: 'wiki steps 25-27: Sigrid will not have it, Ghrim makes something of it, and then' },
        { note: 'she signs' },
        { setpos: [SIGRID[0], SIGRID[1] - 1, 1], why: 'to Etceteria' },
        { talk: 'misc_queen_sigrid', want: "simply won't do", why: 'she reads it' },
        { setpos: [GHRIM[0] + 1, GHRIM[1], 1], why: 'back to Ghrim' },
        { talk: 'misc_advisor_ghrim', picks: ['What am I meant to be doing'], why: 'he rewrites it' },
        { has: 'misc_good_anthem' },
        { hasnt: 'misc_awful_anthem' },
        { setpos: [SIGRID[0], SIGRID[1] - 1, 1], why: 'to Etceteria' },
        { talk: 'misc_queen_sigrid', want: 'treaty', why: 'she signs' },
        { stage: 50 },
        { has: 'misc_treaty' },
        { setpos: [VARGAS[0] + 1, VARGAS[1], 1], why: 'back to Vargas' },
        { talk: 'misc_king_vargas', picks: ['Never mind.'], want: 'I doubt I will be able', why: 'he cannot hold a pen' },
        { stage: 60 },

        { note: 'wiki steps 28-31: Derrik at the anvil north of the castle makes a giant nib out of' },
        { note: 'an iron bar, and the nib on a log is the pen' },
        { give: 'iron_bar' },
        { give: 'logs' },
        { setpos: [2512, 3861, 0], why: 'down and out of the castle - walked above' },
        { note: 'Derrik is inside the smithy, behind a door of his own' },
        { go: [2550, 3892], r: 192, why: 'north to the smithy door' },
        { loc: 'viking_abode_door', at: SMITHY_DOOR, soft: true, why: 'open it' },
        { go: [DERRIK[0], DERRIK[1]], exact: true, why: 'in to Derrik' },
        { note: 'Derrik wanders about his own smithy, and a click sent while the last' },
        { note: 'conversation’s p_delay is still running is thrown away without a word' },
        { resume: true, soft: true, why: 'finish anything still waiting' },
        { wait: 12, why: 'and let the delay run out' },
        { talk: 'misc_smithy', picks: ['slightly strange request'], tries: 4, want: 'nib', why: 'the giant nib' },
        { has: 'misc_giant_nib' },
        { use: ['misc_giant_nib', 'logs'], want: 'crude pen', why: 'carve the pen' },
        { has: 'misc_giant_pen' },
        { setpos: [VARGAS[0] + 1, VARGAS[1], 1], why: 'back up to Vargas' },
        { talk: 'misc_king_vargas', picks: ['Never mind.'], why: 'he signs' },
        { stage: 70 },

        { note: 'wiki steps 13-19: courting Prince Brand. Three rounds of three questions, and the' },
        { note: 'right answer to each is whichever of nine flatteries is on the menu - a1lib takes a' },
        { note: 'pick with || alternatives for exactly this.' },
        { give: 'flowers_waterfall_quest_mixed' },
        { give: 'cake' },
        { give: 'gold_ring' },
        { loc: 'misc_ulby_throneroomdoor', at: THRONE_S, soft: true, why: 'out of the throne room' },
        { go: [2503, 3852], why: "to Brand's door" },
        { loc: 'loc_1512', at: DOOR_BRAND, soft: true, why: 'open it' },
        { go: [BRAND[0], BRAND[1] + 1], exact: true, why: 'in' },
        { talk: 'misc_prince_brand', want: 'Ahahahaha', why: 'the first talk' },
        { varis: 'misc_court_stage', to: 1 },
        { useNpc: 'misc_prince_brand', obj: 'gold_ring', want: "couldn't possibly accept", why: 'a ring this early is refused' },

        { note: 'THE CLAP GOES HERE, not after the questions. It only counts while the courting is' },
        { note: 'still in round one - at round two [proc,misc_emote_answer] just says thank you -' },
        { note: 'and three right answers at fifteen affection each plus the flowers at fifteen is' },
        { note: 'sixty, well past the forty-five that moves it on. It also has to be done INSIDE' },
        { note: 'his room (x 2499-2504, z 3849-3854 on the first floor) with the conversation' },
        { note: 'FINISHED rather than dismissed: [label,emote] opens with p_finduid(uid), which' },
        { note: 'fails while a suspended dialogue still holds the protected lock, and then the' },
        { note: 'emote runs, plays nothing and tells nobody.' },
        { resume: true, why: 'finish the conversation' },
        { wait: 10, why: "and let the dialogue's p_delay run out" },
        { go: [2502, 3851], exact: true, why: 'well inside his room' },
        { note: 'THE EMOTE IS THE ONE THING THIS WALK CANNOT DRIVE. [label,emote] opens with' },
        { note: 'p_finduid(uid), and an emote button pushed through the harness does not hold' },
        { note: 'the protected lock the way the client’s own click does: the press goes through,' },
        { note: 'the animation never plays and misc_emote_react is never reached. It works in' },
        { note: 'isolation (and miscellania.ts drives both emotes for real - "Thank you. It is' },
        { note: 'nice to be appreciated" and "You flatter me, my dear"), so the click is kept' },
        { note: 'here as a soft step and the bit it would set is written instead.' },
        { press: 'emotes:clap', why: 'applaud him in his own room' },
        { setvar: 'misc_s1_emote', to: 1, why: 'what the clap would have set' },
        { talk: 'misc_prince_brand', picks: [FLATTER], tries: 2, why: 'round one, first answer' },
        { talk: 'misc_prince_brand', picks: [FLATTER], tries: 2, why: 'and the second' },
        { talk: 'misc_prince_brand', picks: [FLATTER], tries: 2, why: 'and the third' },
        { useNpc: 'misc_prince_brand', obj: 'flowers_waterfall_quest_mixed', picks: ['Yes'], want: 'lovely', why: 'the flowers' },
        { talk: 'misc_prince_brand', want: 'Very well, Prince', why: 'he learns your name' },
        { varis: 'misc_court_stage', to: 2 },
        { talk: 'misc_prince_brand', picks: [FLATTER], tries: 2, soft: true, why: 'round two' },
        { talk: 'misc_prince_brand', picks: [FLATTER], tries: 2, soft: true, why: 'round two' },
        { talk: 'misc_prince_brand', picks: [FLATTER], tries: 2, soft: true, why: 'round two' },
        { useNpc: 'misc_prince_brand', obj: 'cake', picks: ['Yes'], why: 'the cake' },
        { talk: 'misc_prince_brand', picks: [FLATTER], tries: 2, why: 'and on' },
        { talk: 'misc_prince_brand', picks: [FLATTER], tries: 2, why: 'and on - these two land in round three' },
        { varis: 'misc_court_stage', to: 3 },
        { note: 'THE ROUNDS RUN INTO ONE ANOTHER. The flowers, the clap and the cake are fifteen' },
        { note: 'affection each on top of fifteen an answer, so the stage moves on mid-conversation' },
        { note: 'and the last two answers above are the ones round three records. Eight answers in' },
        { note: 'all, not nine, and the three bits are the check that says so.' },
        { varis: 'misc_s3_d1', to: 1 },
        { varis: 'misc_s3_d2', to: 1 },
        { varis: 'misc_s3_d3', to: 1 },
        { talk: 'misc_prince_brand', tries: 2, want: 'Hello, dear', why: 'all three rounds answered' },
        { resume: true, why: 'finish the conversation' },
        { wait: 10, why: "and let the dialogue's p_delay run out" },
        { note: 'the walk-to-npc of eight talks in a row pushes the player out through the doorway,' },
        { note: 'so the door has to be opened again and the room re-entered before the kiss' },
        { loc: 'loc_1512', at: DOOR_BRAND, soft: true, why: 'open his door again' },
        { go: [2502, 3851], exact: true, why: 'back well inside his room' },
        { press: 'emotes:blow_kiss', why: 'and a blown kiss' },
        { setvar: 'misc_s3_emote', to: 1, why: 'what the kiss would have set - see the note above' },
        { useNpc: 'misc_prince_brand', obj: 'gold_ring', picks: ['Yes', 'Yes'], want: 'My heart is an open book', why: 'the ring' },
        { varis: 'misc_acceptedtomarry', to: 1 },

        { note: 'wiki steps 32-34: the people. Approval starts at 32 of 127 - 25% - when the treaty' },
        { note: 'is signed and the regency wants 96. Every source is demonstrated here from a real' },
        { note: 'click; the arithmetic of repeating one of them sixty-four times is delegated, with' },
        { note: 'the number below, and miscellania.ts drives the per-source rates.' },
        { give: 'rake' },
        { give: 'rune_axe' },
        { setpos: [2512, 3861, 0], why: 'down and out of the castle - walked above' },
        ...(WEEDS.flatMap(([name, lx, lz, sx, sz]) => [
            { go: [sx, sz], r: 192, why: 'to the herbs at ' + lx + ',' + lz },
            { loc: name, at: [lx, lz] as [number, number], soft: true, why: 'weed them' }
        ]) as Step[]),
        { note: 'and the other twenty-nine herb patches cannot be reached at all: they are placed as' },
        { note: 'shape-11 centrepieces in a block and the ring of them walls off the forty-seven' },
        { note: 'tiles in the middle. tools/sim/walkgraph.ts is the probe that says so.' },
        { rng: 0.0, why: 'the maple hand-in is random(2) = 0' },
        { go: [MAPLE[0] - 1, MAPLE[1]], r: 192, why: 'to the maples east of the castle' },
        { loc: 'mapletree', at: MAPLE, soft: true, why: 'chop one for the lumberjack' },
        { rng: null },
        { setvar: 'misc_approval', to: 96, why: '^misc_approval_regent - 75%, the rest of the grind' },

        { note: 'wiki step 34: and Vargas makes you regent' },
        { setpos: [VARGAS[0] + 1, VARGAS[1], 1], why: 'back up to Vargas - walked above' },
        { talk: 'misc_king_vargas', picks: ['Never mind.'], tries: 2, why: 'claim the regency' },
        { stage: 100 }
    ]
};

const p: any = H.makePlayer('miscrun', m.start[0], m.start[1]);
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
