// HORROR FROM THE DEEP, played through on foot.
//
// Quest 93 of the quest-by-quest pass. tools/sim/horror2.ts already drives the pieces of this quest
// as set pieces - the two lighthouses, the lighting puzzle, the strange wall, the Mother's colour
// cycle - but nothing had ever walked it, and a walk is the only thing that answers "can a player
// get from Larrissa to the god book without being teleported".
//
// Two things about it are unlike every other quest in the pass:
//
//   The lighthouse is two buildings. m39_56 is the real one; m38_71 is a byte-identical copy with
//   the furniture smashed, the light out and Larrissa inside, and the player is in the copy from the
//   first time through the front door until the Dagannoth Mother is dead. So the walk's coordinates
//   jump 64 west and 960 north the moment the door opens, and come back when she dies. That is not a
//   teleport the walk is doing - ~horror_lighthouse_coord does it, which is the thing being tested.
//
//   The Mother cannot be fought by swinging at her. She changes colour every 30 ticks and only
//   damage of the matching type touches her, so a melee kill is seven attacks per orange phase and
//   nothing at all for the other 150 ticks. The fight step takes all six of her forms as its type
//   list (npc_changetype_keepall means she is a different npc_type in each one) and is judged on
//   %horror reaching completion rather than on a corpse.
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_horror_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

// --- the mainland
const LARRISSA: [number, number, number] = [2508, 3635, 0]; // m39_56 p0 12,51, outside the locked door
const GUNNJORN: [number, number, number] = [2540, 3548, 0]; // m39_55 p0 44,28, the Barbarian Outpost
const BRIDGE_E: [number, number] = [2598, 3608]; // horror_broken_bridge_right_spot
const BRIDGE_W: [number, number] = [2596, 3608]; // horror_broken_bridge_left_spot
const DOOR: [number, number] = [2509, 3636]; // horror_lighthouse_doorway, real lighthouse

// --- the attacked copy, m38_71 (the real lighthouse's tiles minus 64 x, plus 960 z)
const _C_ARRIVEC_ARRIVE: [number, number, number] = [2445, 4596, 0];
const C_STAIRS_BASE: [number, number] = [2442, 4600];
const C_STAIRS_MID: [number, number] = [2442, 4600]; // same tile, plane 1
const C_STAIRS_TOP: [number, number] = [2442, 4601];
const C_BOOKCASE: [number, number] = [2444, 4604];
const C_COG: [number, number] = [2443, 4599];
const C_LADDER: [number, number] = [2445, 4604];

// --- the basement and Jossik's cave, m39_72
const _BASEMENTBASEMENT: [number, number, number] = [2519, 4619, 1];
const WALL_PANEL: [number, number] = [2514, 4627]; // horror_mid_left_door, studied and used on
const WALL_DOOR: [number, number] = [2516, 4627]; // horror_far_right_door, the hinged one
const LADDER_DOWN: [number, number] = [2515, 4630]; // horror_ladder_top2
const JOSSIK: [number, number, number] = [2518, 4633, 0];
const LADDER_UP: [number, number] = [2519, 4618]; // horror_ladder_base, back to the lighthouse

// --- the real lighthouse again, after she is dead
const _R_ARRIVER_ARRIVE: [number, number, number] = [2510, 3644, 0];
const R_STAIRS_BASE: [number, number] = [2506, 3640];
const _R_JOSSIKR_JOSSIK: [number, number, number] = [2509, 3639, 1];

const MOTHER = ['horror_dagganoth_air', 'horror_dagganoth_water', 'horror_dagganoth_melee', 'horror_dagganoth_earth', 'horror_dagganoth_fire', 'horror_dagganoth_ranged'];

const m: Manifest = {
    quest: 'HORROR FROM THE DEEP',
    source: 'oldschool.runescape.wiki/w/Horror_from_the_Deep/Quick_guide',
    stageVar: 'horror',
    done: 6, // ^horror_complete
    start: LARRISSA,
    steps: [
        { note: "requirement: Alfred Grimhand's Barcrawl (the 35 Agility is the Barbarian Outpost" },
        { note: 'pipe between the player and Gunnjorn, which barbarian_course.rs2 enforces itself).' },
        { setvar: 'barcrawl', to: 2, why: '^barcrawl_complete' },
        { note: 'items: a hammer, 60 steel nails and 2 planks for the bridge; swamp tar, a tinderbox' },
        { note: 'and molten glass for the light; one of each elemental rune, a sword and an arrow for' },
        { note: 'the wall - all six are taken and not given back.' },
        { give: 'hammer' },
        { give: 'nails', n: 60 },
        { give: 'woodplank', n: 2 },
        { give: 'swamp_tar' },
        { give: 'tinderbox' },
        { give: 'molten_glass' },
        { give: 'firerune' },
        { give: 'airrune' },
        { give: 'waterrune' },
        { give: 'earthrune' },
        { give: 'bronze_sword' },
        { give: 'bronze_arrow' },

        { note: 'wiki step 1: Larrissa, stranded on the causeway outside the locked lighthouse' },
        { setpos: LARRISSA, why: 'to Larrissa' },
        {
            talk: 'horror_girlfriend_prequest',
            picks: ['With what?', 'But how can I help?', 'Yes.', "I'll see what I can do."],
            want: 'THANK YOU SO MUCH',
            why: 'take the job'
        },
        { stage: 1 },

        { note: 'wiki step 2: her cousin Gunnjorn has the spare key - he is the agility arena guard' },
        { note: 'at the Barbarian Outpost, not behind the broken bridge at all.' },
        { setpos: GUNNJORN, why: 'to the Barbarian Outpost' },
        { talk: 'gunnjorn', want: 'Here you go', why: "ask for Larrissa's key" },
        { has: 'horror_key' },

        { note: 'wiki steps 3-4: a plank on the span you are standing on, then jump the gap and do' },
        { note: 'the other one. Both spans are placed on PLANE 1 of m40_56 with the tile marked' },
        { note: 'LINK_BELOW, which GameMap resolves to plane 0 - they are at 2596/2598,3608.' },
        { setpos: [BRIDGE_E[0] + 2, BRIDGE_E[1], 0], why: 'to the east end of the broken bridge' },
        { useLoc: 'horror_broken_bridge_right_spot', at: BRIDGE_E, obj: 'woodplank', want: 'jump across', why: 'nail the east span' },
        { varis: 'horror_bridges', to: 18 },
        { loc: 'horror_broken_bridge_right_spot', at: BRIDGE_E, want: 'leap across', why: 'leap the gap' },
        { useLoc: 'horror_broken_bridge_left_spot', at: BRIDGE_W, obj: 'woodplank', want: 'safe to cross', why: 'and nail the west span' },
        { varis: 'horror_bridges', to: 19 },

        { note: 'wiki step 5: the key opens the front door once and is taken. Larrissa will not let' },
        { note: 'the player in before the bridge is mended, which is why that came first.' },
        { setpos: [DOOR[0], DOOR[1] - 2, 0], why: 'to the lighthouse door' },
        { loc: 'horror_lighthouse_doorway', at: DOOR, want: 'unlock the lighthouse', why: 'in' },
        { hasnt: 'horror_key' },
        { varis: 'horror_bridges', to: 23 },
        { note: 'and the player is now in the attacked copy of the building, 64 west and 960 north' },

        { note: 'wiki step 6 (optional, and the only place the puzzles are explained): the bookcase' },
        { note: "on the middle floor holds the manual, Silas's diary and Jossik's journal." },
        { loc: 'horror_lighthouse_spiralstairs_base', at: C_STAIRS_BASE, why: 'up to the middle floor' },
        { loc: 'horror_bookcase', at: C_BOOKCASE, picks: ['Take all three books.'], why: 'search the bookcase' },
        { has: 'horror_diary1' },
        { has: 'horror_diary2' },
        { has: 'horror_diary3' },
        { held: 'horror_diary3', op: 1, want: 'molten glass', why: 'the manual says how the light is mended' },
        { close: true },
        { held: 'horror_diary2', op: 1, want: "warrior's sword", why: 'and the diary how the wall is opened' },
        { close: true },

        { note: 'wiki step 7: swamp tar, a tinderbox and molten glass on the mechanism, any order' },
        { loc: 'horror_lighthouse_spiralstairs_middle', at: C_STAIRS_MID, op: 2, why: 'up to the lantern room' },
        { useLoc: 'horror_lighthouse_cog_broken', at: C_COG, obj: 'swamp_tar', want: 'flammable', why: 'tar the torch' },
        { useLoc: 'horror_lighthouse_cog_broken', at: C_COG, obj: 'tinderbox', want: 'light the torch', why: 'light it' },
        { useLoc: 'horror_lighthouse_cog_broken', at: C_COG, obj: 'molten_glass', want: 'repair the lighthouse torch', why: 'and mend the lens' },
        { varis: 'horror_lighting', to: 7 },

        { note: 'wiki step 8: back down and through the iron ladder on the ground floor. Larrissa' },
        { note: 'blocks the ladder until the light is burning, which is why that came first too.' },
        { loc: 'horror_lighthouse_spiralstairs_top', at: C_STAIRS_TOP, why: 'down to the middle floor' },
        { loc: 'horror_lighthouse_spiralstairs_middle', at: C_STAIRS_MID, op: 3, why: 'and down to the ground floor' },
        { loc: 'horror_ladder_top', at: C_LADDER, want: 'lighthouse basement', why: 'down the iron ladder' },

        { note: 'wiki step 9: the strange wall. One of each elemental rune, a sword and an arrow,' },
        { note: 'each consumed - the carving is only readable from the lighthouse side.' },
        { loc: 'horror_mid_left_door', at: WALL_PANEL, want: 'six icons', why: 'study the wall' },
        { close: true },
        { useLoc: 'horror_mid_left_door', at: WALL_PANEL, obj: 'firerune', picks: ['Yes'], want: 'into the slot', why: 'fire' },
        { useLoc: 'horror_mid_left_door', at: WALL_PANEL, obj: 'airrune', picks: ['Yes'], want: 'into the slot', why: 'air' },
        { useLoc: 'horror_mid_left_door', at: WALL_PANEL, obj: 'waterrune', picks: ['Yes'], want: 'into the slot', why: 'water' },
        { useLoc: 'horror_mid_left_door', at: WALL_PANEL, obj: 'earthrune', picks: ['Yes'], want: 'into the slot', why: 'earth' },
        { useLoc: 'horror_mid_left_door', at: WALL_PANEL, obj: 'bronze_sword', picks: ['Yes'], want: 'into the slot', why: 'the sword' },
        { useLoc: 'horror_mid_left_door', at: WALL_PANEL, obj: 'bronze_arrow', picks: ['Yes'], want: 'something moving', why: 'and the arrow' },
        { varis: 'horror_wall', to: 63 },
        { stage: 2 },
        { hasnt: 'bronze_sword' },

        { note: 'the hinged panels are deleted for ^horror_wall_reopen_delay, so the way north is' },
        { note: 'open ground now rather than a loc to click - walk it before the wall comes back.' },
        { go: [WALL_DOOR[0], WALL_DOOR[1] + 2], why: 'north through the opened panel' },
        { loc: 'horror_ladder_top2', at: LADDER_DOWN, want: 'into darkness', why: 'down to Jossik' },

        { note: 'wiki step 10: Jossik, and the level-100 Dagannoth that comes out of the water at' },
        { note: 'the end of his story' },
        { setpos: JOSSIK, why: 'to the fallen Jossik' },
        { talk: 'horror_lighthousekeeeper_injured', want: 'Do something', why: 'he tells you what happened' },
        { nearnpc: 'horror_dagannoth_jr4', r: 20, why: 'and a Dagannoth comes out of the water' },
        { fight: 'horror_dagannoth_jr4', untilvar: 'horror', to: 3, tries: 4, r: 20, why: 'kill it' },
        { note: 'and 3 is asserted, because the Mother fight that follows is long and the player' },
        { note: 'spends all of it at this value. Without a leg here the panel kept naming leg 2 -' },
        { note: '"go north through the panel, down the ladder, to the fallen Jossik" - at somebody' },
        { note: 'standing over the first Dagannoth with the Mother coming out of the water behind' },
        { note: 'them. The step waited on this value already and never wrote it down.' },
        { note: 'DeathPlateau-Bugs#16.' },
        { stage: 3 },
        { note: 'killing it runs horror_jossik_babies off the player queue - "that was one of its' },
        { note: 'babies" - and the Mother emerges on the end of that.' },
        { say: [], why: 'hear him out' },
        { note: 'she is not asserted by name here: horror_dagganoth_aira/airb/airc are three' },
        { note: 'emergence stages two ticks apart, and by the time Jossik has finished talking' },
        { note: 'she is already wearing her first colour. The fight step below says what is' },
        { note: 'standing there if she is missing, which is the same finding.' },

        { note: 'wiki steps 11-12: she cycles white/air, blue/water, orange/melee, brown/earth,' },
        { note: 'red/fire, green/ranged every 30 ticks and only the matching damage touches her, so a' },
        { note: 'melee-only kill lands hits for 30 of every 180 ticks. Her six forms are six npc' },
        { note: 'types, and the one she is wearing when she dies is the one the death hook fires on.' },
        { wait: 8, why: 'she finishes emerging' },
        { fight: MOTHER, untilvar: 'horror', to: 6, tries: 60, r: 40, why: 'kill the Dagannoth Mother' },
        { note: 'her death completes the quest, puts the player back by the strange wall and hands' },
        { note: 'over the rusty casket.' },
        { say: [], why: 'Jossik says to bring the casket to his library' },
        { has: 'horror_casket' },

        { note: 'wiki step 13: back up into the real lighthouse - the copy is gone now - and up to' },
        { note: "Jossik's library, where he reads the casket with you" },
        { loc: 'horror_ladder_base', at: LADDER_UP, want: 'climb up', why: 'up out of the basement' },
        { loc: 'horror_lighthouse_spiralstairs_base', at: R_STAIRS_BASE, why: 'up to the library' },
        { note: 'he asks what the casket says twice and will not open it until the answer matches.' },
        { talk: 'horror_lighthousekeeeper_well', picks: ['Saradomin.', 'Saradomin.'], want: 'holy book of Saradomin', why: 'open the casket' },
        { has: 'unfinished_saradominbook' },
        { hasnt: 'horror_casket' },
        { stage: 6 }
    ]
};

const p: any = H.makePlayer('horrorrun', m.start[0], m.start[1]);
H.tick(2);
p.teleport(m.start[0], m.start[1], m.start[2]);
p.applyDamage = function () {};
H.setVar(p, 'macro_event', 1);
H.maxOut(p);
// A WEAPON, which maxOut does not give: she has +150 to every melee defence bonus (the wiki guide's
// "higher resistance to melee") and an unarmed 99 Attack barely scratches her inside a 30-tick
// window.
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
