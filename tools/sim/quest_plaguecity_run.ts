// PLAGUE CITY, played through on foot.
//
// Quest 75 of the quest-by-quest pass. Edmond's daughter Elena went over the Ardougne wall to help
// the plague victims and never came back. You dig into the sewers from his garden, cross under the
// wall, and find her locked in a house with a black cross on the door.
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_plaguecity_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const GARDEN: [number, number, number] = [2569, 3334, 0];
const ALRENA_DOOR: [number, number] = [2570, 3333];
const TABLE_DOOR: [number, number] = [2578, 3333];
const PICTURE: [number, number] = [2576, 3333]; // beside the round table, not on it
// THE ONE A PLAYER CAN SEE, which is not the one this used to click.
//
// Edmond's garden has three locs in a column at x=2566, and only two of them are the mud patch:
//
//   2566,3331   plaguemudpatch1   name="Mud patch"  "Looks like someone's tried digging here."
//   2566,3332   plaguemudpatch2   NO NAME AT ALL    (and an op1=Climb-down nothing answers)
//   2566,3333   plaguemudpatch1   name="Mud patch"
//
// This clicked the middle one. Both locs take the bucket and the spade - quest_elena/mud_patch.rs2
// has an [oplocu] for each - so the run passed and the quest worked, but the manifest is what
// ExportHelper turns into the quest helper's highlight, so the panel pointed players at the one
// tile in that column with no name on it, between the two that are actually called Mud patch.
// Reported as "highlights wrong mud patch. should be 1 tile up" (DeathPlateau-Bugs#78), and one
// tile up from 3332 is exactly the north plaguemudpatch1.
const MUD_PATCH: [number, number] = [2566, 3333];
const MUD_PILE: [number, number] = [2519, 9759];
const GRILL: [number, number] = [2514, 9739];
const PIPE: [number, number] = [2514, 9737];
const JETHICK: [number, number, number] = [2540, 3308, 0];
const REHNISON_DOOR: [number, number] = [2531, 3328];
const REHNISON_STAIRS: [number, number] = [2527, 3332];
const MILLI: [number, number, number] = [2531, 3333, 1];
const PLAGUE_DOOR: [number, number] = [2540, 3273];
const PLAGUE_DOOR_OUT: [number, number, number] = [2540, 3274, 0];
const CLERK: [number, number, number] = [2528, 3318, 0];
const BRAVEK_DOOR: [number, number] = [2530, 3314];
const KEY_BARREL: [number, number] = [2534, 3268];
const PLAGUE_STAIRS: [number, number] = [2536, 3268];
const ELENA_GATE: [number, number] = [2539, 9672];

const m: Manifest = {
    quest: 'PLAGUE CITY',
    source: 'oldschool.runescape.wiki/w/Plague_City',
    stageVar: 'elenaquest',
    done: 29, // ^elena_complete
    start: GARDEN,
    steps: [
        { note: 'no requirements. Items: dwellberries, a rope, a spade, four buckets of water, and' },
        { note: 'a hangover cure - chocolate dust in a bucket of milk, then snape grass.' },
        { give: 'dwellberries' },
        { give: 'rope' },
        { give: 'spade' },
        { give: 'bucket_water', n: 4 },
        { give: 'chocolate_dust' },
        { give: 'bucket_milk' },
        { give: 'snape_grass' },

        { note: 'wiki step 1: Edmond is looking for his daughter' },
        {
            talk: 'edmond_top',
            picks: ["What's happened to her?", 'Can I help find her?'],
            want: 'dwellberries',
            why: 'Elena crossed the wall three weeks ago'
        },
        { stage: 1 },

        { note: 'wiki steps 2-3: his wife makes the gas mask, and her picture is in the house.' },
        { note: 'The house is two rooms, each a sealed pocket with one door: Alrena is behind the' },
        { note: 'door at 2570,3333, the round table and her cupboard behind the one at 2578,3333.' },
        { go: ALRENA_DOOR, exact: true, r: 24, why: 'to her door' },
        { loc: 'loc_1530', at: ALRENA_DOOR, soft: true, why: 'in' },
        { talk: 'alrena', want: 'gas mask', why: 'the berries go into the mask' },
        { stage: 2 },
        { has: 'gasmask' },
        { loc: 'loc_1530', at: ALRENA_DOOR, soft: true, why: 'back out' },
        { go: TABLE_DOOR, exact: true, r: 24, why: 'round to the other door' },
        { loc: 'loc_1530', at: TABLE_DOOR, soft: true, why: 'into the room with the table' },
        { go: PICTURE, exact: true, r: 24, why: 'to the table' },
        { take: 'elena_picture', r: 4, why: 'the picture of Elena' },
        { has: 'elena_picture' },

        { note: 'wiki step 4: he explains the digging' },
        { talk: 'edmond_top', want: 'buckets of water', why: 'the soil is rock hard' },
        { stage: 3 },

        { note: 'wiki steps 5-6: four buckets of water, then the spade' },
        { go: [MUD_PATCH[0] + 1, MUD_PATCH[1]], exact: true, r: 24, why: 'to the mud patch behind the house' },
        { useLoc: 'plaguemudpatch1', at: MUD_PATCH, obj: 'bucket_water', want: 'softens slightly', why: 'one' },
        { stage: 4 },
        { useLoc: 'plaguemudpatch1', at: MUD_PATCH, obj: 'bucket_water', want: 'softens slightly', why: 'two' },
        { stage: 5 },
        { useLoc: 'plaguemudpatch1', at: MUD_PATCH, obj: 'bucket_water', want: 'softens slightly', why: 'three' },
        { stage: 6 },
        { useLoc: 'plaguemudpatch1', at: MUD_PATCH, obj: 'bucket_water', want: 'soft enough to dig', why: 'four' },
        { stage: 7 },
        { useLoc: 'plaguemudpatch1', at: MUD_PATCH, obj: 'spade', hop: true, want: 'crumbles away', why: 'and dig' },
        { stage: 8 },

        { note: 'wiki steps 7-10: the grill at the far end of the sewer, and the rope' },
        { go: [GRILL[0], GRILL[1] + 1], exact: true, r: 60, why: 'south to the farthest pipe' },
        { loc: 'plaguesewerpipe_open', at: PIPE, want: 'too secure', why: 'the grill will not budge' },
        { useLoc: 'plague_grill', at: GRILL, obj: 'rope', want: 'tie the end', why: 'tie the rope to it' },
        { stage: 9 },
        { talk: 'edmond_bottom', want: 'done the job', why: 'and the two of you pull' },
        { stage: 10 },

        { note: 'wiki step 11: the gas mask, then up the pipe' },
        { held: 'gasmask', op: 2, why: 'wear it' },
        { worn: 'gasmask' },
        { loc: 'plaguesewerpipe_open', at: PIPE, hop: true, soft: true, why: 'climb through the pipe' },

        { note: 'wiki step 12: Jethick recognises the picture and lends you a book' },
        { setpos: JETHICK, why: 'east to Jethick' },
        {
            talk: 'jethick',
            picks: ["I'm looking for a woman from East Ardougne."],
            want: 'Rehnison',
            why: 'she was staying with the Rehnisons'
        },
        { stage: 20 },
        { has: 'turnip_book' },

        { note: 'wiki steps 14-16: the Rehnisons, then Milli upstairs' },
        { go: [REHNISON_DOOR[0], REHNISON_DOOR[1] - 1], exact: true, r: 60, why: 'north to the timbered house' },
        { note: 'the door itself is the conversation with Ted: he turns you away until you mention' },
        { note: 'the book, and then opens it and takes the book as you walk in.' },
        { loc: 'rehnisondoorshut', at: REHNISON_DOOR, want: 'come in then', why: 'try the door' },
        { stage: 21 },
        { hasnt: 'turnip_book' },
        { talk: 'ted_rehnison', want: 'Milli is upstairs', why: 'Elena never managed to leave' },
        { stage: 22 },
        { loc: 'rehnisonstairs', at: REHNISON_STAIRS, hop: true, soft: true, why: 'upstairs' },
        { setpos: MILLI, why: 'the top of the stairs' },
        { talk: 'milli', want: 'sack over her head', why: 'the child saw them take her' },
        { stage: 23 },

        { note: 'wiki step 17: the house with the black cross, and the mourner on the door' },
        { setpos: PLAGUE_DOOR_OUT, why: 'south of the square, to the house with the cross' },
        {
            loc: 'loc_2535',
            at: PLAGUE_DOOR,
            picks: ['I fear not a mere plague.'],
            want: 'clearance',
            why: 'the mourner turns you away'
        },
        { stage: 24 },

        { note: 'wiki steps 18-19: the clerk, then Bravek the city warder' },
        { setpos: CLERK, why: 'to the big building north of the manhole' },
        {
            talk: 'clerk',
            picks: ['Who is through that door?', 'This is urgent though!'],
            want: 'come in then',
            why: 'and he lets you in to Bravek'
        },
        { stage: 25 },
        { note: 'his room is a sealed 28-tile pocket and the door is the only join, clicked from' },
        { note: '2529,3314 - the tile the noticeboard and the painting leave open.' },
        { go: [BRAVEK_DOOR[0] - 1, BRAVEK_DOOR[1]], exact: true, r: 24, why: 'to his door' },
        { loc: 'bravekdoorshut', at: BRAVEK_DOOR, soft: true, why: 'through his door' },
        {
            talk: 'bravek',
            picks: ['This is really important though!', 'Do you know what is in the cure?'],
            want: 'scribble it down',
            why: 'his head hurts too much to think'
        },
        { stage: 26 },
        { has: 'scruffy_note' },

        { note: 'wiki step 20: the cure is chocolate dust in milk, then snape grass' },
        { note: 'the note is a scroll interface built out of if_settext, so there is no message to' },
        { note: 'read back - only that it opened. Shut it again before anything else is clicked.' },
        { held: 'scruffy_note', op: 1, why: 'read the recipe' },
        { close: true, why: 'put the note away' },
        { use: ['chocolate_dust', 'bucket_milk'], want: 'mix the chocolate', why: 'chocolaty milk' },
        { use: ['snape_grass', 'chocolaty_milk'], want: 'mix the snape grass', why: 'and the cure' },
        { has: 'hangover_cure' },

        { note: 'wiki step 21: and he signs a warrant' },
        { useNpc: 'bravek', obj: 'hangover_cure', picks: ["They won't listen to me!"], want: 'warrant', why: 'give him the cure' },
        { stage: 27 },
        { has: 'warrant' },

        { note: 'wiki steps 22-24: the barrel, the cellar, and Elena behind a locked gate' },
        { setpos: PLAGUE_DOOR_OUT, why: 'back to the house with the cross' },
        { loc: 'loc_2535', at: PLAGUE_DOOR, hop: true, soft: true, why: 'the warrant gets you in' },
        { loc: 'plaguekeybarrel', at: KEY_BARREL, want: 'small key', why: 'search the barrel' },
        { has: 'elenakey' },
        { loc: 'plaguehousestairsdown', at: PLAGUE_STAIRS, hop: true, soft: true, why: 'down to the cellar' },
        { go: [ELENA_GATE[0] - 1, ELENA_GATE[1]], exact: true, r: 24, why: 'to her cell' },
        { useLoc: 'elenagateshut', at: ELENA_GATE, obj: 'elenakey', hop: true, soft: true, why: 'unlock the gate' },
        { talk: 'elenap', want: 'Thank you', why: 'and let her out' },
        { stage: 28 },

        { note: 'wiki step 25: back through the sewer to Edmond' },
        { setpos: [MUD_PILE[0] - 1, MUD_PILE[1], 0], why: 'to the mud pile in the sewer' },
        { loc: 'plaguemudpile', at: MUD_PILE, hop: true, soft: true, why: 'climb out' },
        { setpos: GARDEN, why: 'to Edmond in his garden' },
        { talk: 'edmond_top', want: 'magic scroll', why: 'Elena beat you home by minutes' },
        { stage: 29 },
        { has: 'ardougnescroll' }
    ]
};

const p: any = H.makePlayer('plaguerun', m.start[0], m.start[1]);
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
