// RECRUITMENT DRIVE, played through on foot - all SEVEN tests, not the five a real run draws.
//
// Quest 83 of the quest-by-quest pass. Sir Tiffy runs five of seven Temple Knight aptitude tests,
// drawn at random by marking two of the seven completion bits as already done. This walk clears all
// seven bits after the draw, so every test is sat in one run: the bridge, the statues, Sir Leye, Sir
// Tinley's eight seconds, the acrostic lock, Miss Cheevers' lab and Ms. Hynn Terprett's logic.
//
// Three of them are randomised inside the room, so the rng is pinned where it matters and let go
// again around the fight:
//   room 2  random(12) + 1 -> arrangement 1, whose empty shell is statue 6
//   room 5  random(4)      -> the BITE riddle, answer option 1
//   room 7  random(3)      -> the starving wolves, answer option 3
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_rd_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const TIFFY: [number, number, number] = [2997, 3374, 0];

// m38_77, base (2432,4928). Room 1: Sir Spishyus' bridge.
const R1: [number, number, number] = [2489, 4972, 0];
const BRIDGE_E: [number, number] = [2483, 4972];
const BRIDGE_W: [number, number] = [2477, 4972];
const FOX_E: [number, number] = [2485, 4974];
const CHICK_E: [number, number] = [2487, 4974];
const GRAIN_E: [number, number] = [2486, 4974];
const CHICK_W: [number, number] = [2473, 4970];
const R1_DOOR: [number, number] = [2472, 4972];
// Room 2: Lady Table.
const STATUE6: [number, number] = [2452, 4976];
const R2_DOOR: [number, number] = [2447, 4979];
// Room 3: Sir Kuam Ferentse and Sir Leye.
const R3_DOOR: [number, number] = [2463, 4963];
// Room 4: Sir Tinley.
const R4_DOOR: [number, number] = [2480, 4956];
// Room 5: Sir Ren Itchood.
const R5_DOOR: [number, number] = [2446, 4956];
// Room 6: Miss Cheevers' lab.
const SHELF_WATER: [number, number] = [2471, 4944];
const SHELF_GYPSUM: [number, number] = [2472, 4944];
const SHELF_SULPHATE: [number, number] = [2473, 4944];
const SHELF_TIN_ORE: [number, number] = [2474, 4944];
const SHELF_COPPER_ORE: [number, number] = [2474, 4936];
const BOOKSHELF: [number, number] = [2468, 4943];
const CRATE_SPADE: [number, number] = [2476, 4943];
const CRATE_TIN: [number, number] = [2476, 4937];
const CRATE_KNIFE: [number, number] = [2475, 4943];
const BURNER: [number, number] = [2472, 4940];
const KEY_WALL: [number, number] = [2468, 4938];
const STONE_DOOR: [number, number] = [2477, 4940];
const R6_DOOR: [number, number] = [2478, 4940];
// Room 7: Ms. Hynn Terprett.
const R7_DOOR: [number, number] = [2452, 4943];

const m: Manifest = {
    quest: 'RECRUITMENT DRIVE',
    source: 'oldschool.runescape.wiki/w/Recruitment_Drive',
    stageVar: 'rd_main',
    done: 2, // ^recruitmentdrive_complete
    start: TIFFY,
    steps: [
        { note: 'requirements: Black Knights’ Fortress and Druidic Ritual. No items - Sir Tiffy' },
        { note: 'sends you in with nothing carried and nothing worn, which is why this run gives' },
        { note: 'the player nothing at all.' },
        { note: 'Black Knights’ Fortress is the hard prerequisite, and it is what gates the offer:' },
        { note: 'sir_amik_varze.rs2 switches on %spy and only its case 4 - the post-quest branch -' },
        { note: 'reaches @rd_amik_recruitment at all.' },
        { setvar: 'spy', to: 4, why: 'Black Knights’ Fortress finished, which is what lets Sir Amik offer this' },

        // WALKED, NOT WRITTEN. This was a setvar to ^rd_started with a note saying Sir Amik's
        // half is one dialogue - which it is, and it is also the first thing a player clicks in
        // this quest, so writing the stage instead left the helper with no opening step at all.
        { note: 'wiki step 1: Sir Amik Varze, top of the western tower of the White Knights castle' },
        // The tower rather than the park, and by setpos as quest_blackknight_run reaches him -
        // that run STARTS on plane 2 beside him, and there is no walk from Falador park up three
        // floors that the router will take.
        { setpos: [2962, 3339, 2], why: 'up the western tower of the White Knights castle' },
        { talk: 'sir_amik_varze', picks: ['Go on.'], want: 'Sir Tiffy Cashien', why: 'he sends you to the park' },
        { note: 'and that is where ^rd_started comes from, at the end of his conversation. It was' },
        { note: 'never asserted, so leg 0 carried the whole quest - the tower, Sir Amik, Sir Tiffy' },
        { note: 'and all seven rooms - and a player anywhere in the maze was being told to go up' },
        { note: 'the western tower of the White Knights castle and talk to Sir Amik, which is how' },
        { note: 'they got in. The var only holds 0, 1 and 2, so this one marker is the whole of the' },
        { note: 'split there is to make. DeathPlateau-Bugs#16.' },
        { stage: 1 },
        { varis: 'rd_main', to: 1 },

        { note: 'wiki step 2: Sir Tiffy on the bench in Falador Park' },
        { setpos: TIFFY, why: 'to Sir Tiffy' },
        { talk: 'rd_teleporter_guy', picks: ["I'm ready. Test me."], want: 'Good luck', why: 'he starts the run' },
        { varis: 'rd_room1_initiated', to: 1 },

        { note: 'a real run skips two of the seven at random. All seven bits are cleared here so' },
        { note: 'every test is sat, and the walk starts at room 1.' },
        { setvar: 'rd_room1_complete', to: 0 },
        { setvar: 'rd_room2_complete', to: 0 },
        { setvar: 'rd_room3_complete', to: 0 },
        { setvar: 'rd_room4_complete', to: 0 },
        { setvar: 'rd_room5_complete', to: 0 },
        { setvar: 'rd_room6_complete', to: 0 },
        { setvar: 'rd_room7_complete', to: 0 },
        { setpos: R1, why: "into Sir Spishyus' room" },

        { note: 'ROOM 1: fox, chicken, grain; the bridge takes one of them at a time. Leaving the' },
        { note: 'fox with the chicken, or the chicken with the grain, fails the room - so the five' },
        { note: 'crossings below are the only order that works.' },
        { talk: 'rd_observer_room_1', want: 'arithmetic', why: 'Sir Spishyus sets it out' },
        { note: 'chicken across; fox and grain left together, which is safe' },
        { loc: 'rd_room2_chicken_multi', at: CHICK_E, want: 'pick it up', why: 'take the chicken' },
        { loc: 'rd_bridge_left', at: BRIDGE_E, hop: true, soft: true, why: 'cross west' },
        { note: 'back empty' },
        { loc: 'rd_bridge_right', at: BRIDGE_W, hop: true, soft: true, why: 'cross east' },
        { note: 'fox across, and bring the chicken back' },
        { loc: 'rd_room2_fox_multi', at: FOX_E, want: 'pick it up', why: 'take the fox' },
        { loc: 'rd_bridge_left', at: BRIDGE_E, hop: true, soft: true, why: 'cross west' },
        { loc: 'rd_room2_chicken_multi_right', at: CHICK_W, want: 'pick it up', why: 'take the chicken back' },
        { loc: 'rd_bridge_right', at: BRIDGE_W, hop: true, soft: true, why: 'cross east' },
        { note: 'grain across, leaving the chicken alone' },
        { loc: 'rd_room2_grain_multi', at: GRAIN_E, want: 'pick it up', why: 'take the grain' },
        { loc: 'rd_bridge_left', at: BRIDGE_E, hop: true, soft: true, why: 'cross west' },
        { note: 'and back for the chicken' },
        { loc: 'rd_bridge_right', at: BRIDGE_W, hop: true, soft: true, why: 'cross east' },
        { loc: 'rd_room2_chicken_multi', at: CHICK_E, want: 'pick it up', why: 'take the chicken' },
        { loc: 'rd_bridge_left', at: BRIDGE_E, hop: true, soft: true, why: 'cross west with the last of them' },
        { varis: 'rd_room1_complete', to: 1 },
        { loc: 'rd_room1_exitdoor', at: R1_DOOR, hop: true, soft: true, why: 'through to the next test' },

        { note: 'ROOM 2: twelve statues, one taken away. Arrangement 1 leaves shell 6 empty, and' },
        { note: 'the shell left empty is the statue to touch once they are all back.' },
        { rng: 0, why: 'random(12) + 1 -> arrangement 1' },
        { talk: 'rd_observer_room_2', picks: ["I've looked. Go ahead."], want: 'all twelve are back', why: 'she shuffles them' },
        { rng: null },
        { loc: 'rd_statue_multi_6', at: STATUE6, want: 'Correct', why: 'touch the one that went away' },
        { varis: 'rd_room2_complete', to: 1 },
        { loc: 'rd_room2_exitdoor', at: R2_DOOR, hop: true, soft: true, why: 'on again' },

        { note: 'ROOM 3: Sir Leye is blessed against blades, so this is an unarmed kill - the run' },
        { note: 'carries no weapon at all, which makes every hit crush.' },
        { talk: 'rd_observer_room_3', want: 'blunt weapon', why: 'he explains the blessing' },
        { fight: 'rd_combat_npc_room_3', untilvar: 'rd_room3_complete', to: 1, tries: 6, r: 16, why: 'put him on the floor' },
        { varis: 'rd_room3_complete', to: 1 },
        { loc: 'rd_room3_exitdoor', at: R3_DOOR, hop: true, soft: true, why: 'on again' },

        { note: 'ROOM 4: Sir Tinley. Thirteen ticks of p_delay and a queue a tick past it; any' },
        { note: 'click at all aborts the delay and the queue then fails the room.' },
        { talk: 'rd_observer_room_4', picks: ["I'm ready."], want: 'perfectly still', why: 'do nothing' },
        { wait: 6, why: 'and keep doing nothing while the queue checks' },
        { varis: 'rd_room4_complete', to: 1 },
        { loc: 'rd_room4_exitdoor', at: R4_DOOR, hop: true, soft: true, why: 'on again' },

        { note: 'ROOM 5: an acrostic. random(4) = 0 is the BITE riddle.' },
        { rng: 0, why: 'random(4) -> the BITE riddle' },
        { talk: 'rd_observer_room_5', picks: ['BITE'], want: 'That is the word', why: 'read the beginnings' },
        { rng: null },
        { varis: 'rd_room5_complete', to: 1 },
        { loc: 'rd_room5_exitdoor', at: R5_DOOR, hop: true, soft: true, why: 'on again' },

        { note: 'ROOM 6: Miss Cheevers. Two reactions out of the notes - cupric sulfate and water' },
        { note: 'for heat, gypsum and water for plaster - and a bronze casting of the key on the' },
        { note: 'wall. The stone door has to be opened as well as the exit: its tile is the only' },
        { note: 'approach to the exit door.' },
        { talk: 'rd_observer_room_6', want: 'test', why: 'she sets it out' },
        { loc: 'rd_bookshelf_old_tall', at: BOOKSHELF, want: 'alchemical notes', why: 'the notes' },
        { has: 'rd_chem_book' },
        { held: 'rd_chem_book', op: 1, want: 'Exothermic', why: 'read them' },
        { note: 'the shelves hand out one of each at a time, so the water is fetched twice: once' },
        { note: 'for the reaction in the door and once for the tin.' },
        { loc: 'rd_shelves_chemicals_2', at: SHELF_GYPSUM, want: 'Gypsum', why: 'gypsum' },
        { loc: 'rd_shelves_chemicals_3', at: SHELF_SULPHATE, want: 'Cupric Sulfate', why: 'cupric sulfate' },
        { loc: 'rd_shelves_chemicals_4', at: SHELF_TIN_ORE, want: 'Powdered Tin Ore', why: 'powdered tin' },
        { loc: 'rd_shelves_chemicals_1', at: SHELF_WATER, want: 'Dihydrogen Monoxide', why: 'water, for the door' },
        { loc: 'rd_large_crate', at: CRATE_SPADE, want: 'metal spade', why: 'the spade' },
        { loc: 'rd_small_crates', at: CRATE_KNIFE, want: 'knife', why: 'and a knife' },

        { note: 'the spade handle has to come off before the blade will go into the door' },
        { useLoc: 'rd_wooden_table_bunsen_burner', at: BURNER, obj: 'rd_metal_spade', want: 'flat metal blade', why: 'burn the handle off' },
        { useLoc: 'rd_stone_door', at: STONE_DOOR, obj: 'rd_metal_spade_no_handle', want: 'doing nothing whatsoever', why: 'put the blade in the hole' },
        { useLoc: 'rd_stone_door', at: STONE_DOOR, obj: 'rd_cupric_sulphate', want: 'Nothing happens at all', why: 'cupric sulfate on the blade' },
        { useLoc: 'rd_stone_door', at: STONE_DOOR, obj: 'rd_dihydrogen_monoxide', want: 'jams solid', why: 'and water on top of it' },
        { loc: 'rd_stone_door', at: STONE_DOOR, hop: true, want: 'way to the corridor is open', why: 'haul on the spade' },
        { varis: 'rd_room6_stone_door', to: 3 },

        { note: 'then the mould: water and gypsum in the tin, pressed against the key on the wall' },
        { loc: 'rd_shelves_chemicals_5', at: SHELF_COPPER_ORE, want: 'Powdered Cupric Ore', why: 'powdered copper' },
        { loc: 'rd_large_crates', at: CRATE_TIN, want: 'metal tin', why: 'the baking tin' },
        { loc: 'rd_shelves_chemicals_1', at: SHELF_WATER, want: 'Dihydrogen Monoxide', why: 'and the second vial of water' },
        { use: ['rd_dihydrogen_monoxide', 'rd_tin'], want: 'pour the vial', why: 'water into the tin' },
        { use: ['rd_gypsum', 'rd_tin_of_crap_empty'], want: 'white paste', why: 'and the gypsum' },
        { has: 'rd_tinfull' },
        { useLoc: 'rd_key_chained', at: KEY_WALL, obj: 'rd_tinfull', want: 'clean impression', why: 'press it against the key' },
        { has: 'rd_keymould' },
        { use: ['rd_tin_ore_powder', 'rd_keymould'], want: 'powdered tin ore', why: 'fill it with tin' },
        { use: ['rd_copper_ore_powder', 'rd_full_keymould_tin'], want: 'impression is full', why: 'and cupric ore' },
        { useLoc: 'rd_wooden_table_bunsen_burner', at: BURNER, obj: 'rd_full_keymould_unheated', want: 'Bronze', why: 'fire the mould' },
        { use: ['rd_knife', 'rd_full_keymould_complete'], want: 'bronze key', why: 'chip the plaster away' },
        { has: 'rd_puzzleroom_key' },
        { note: 'the open door goes on blocking its own tile, and that tile is the only approach to' },
        { note: 'the exit - so op1 on the open door steps the player across it. Without this click' },
        { note: 'the key can never reach the lock, which is how the room used to trap people.' },
        { loc: 'rd_stone_door', at: STONE_DOOR, hop: true, soft: true, why: 'step through the stone door' },
        { useLoc: 'rd_room6_exitdoor', at: R6_DOOR, obj: 'rd_puzzleroom_key', want: 'door at the far side', why: 'unlock the door' },
        { varis: 'rd_room6_complete', to: 1 },
        { loc: 'rd_room6_exitdoor', at: R6_DOOR, hop: true, soft: true, why: 'on again' },

        { note: 'ROOM 7: logic. random(3) = 0 is the starving wolves, answer three.' },
        { rng: 0, why: 'random(3) -> the wolves' },
        {
            talk: 'rd_observer_room_7',
            picks: ['Because there are no wolves - a valley of wolves that never eat has no wolves left in it.'],
            want: 'Most people answer',
            why: 'answer it'
        },
        { rng: null },
        { varis: 'rd_room7_complete', to: 1 },
        { loc: 'rd_room7_exitdoor', at: R7_DOOR, hop: true, soft: true, why: 'and out' },
        { stage: 2 },
        { has: 'coins', n: 3000 }
    ]
};

const p: any = H.makePlayer('rdrun', m.start[0], m.start[1]);
H.tick(2);
p.teleport(m.start[0], m.start[1], m.start[2]);
p.applyDamage = function () {};
H.setVar(p, 'macro_event', 1);
H.maxOut(p);
H.clearInv(p);
H.tick(1);

const res = play(m, p);
const bad = res.filter(r => !r.ok);
console.log('');
if (bad.length) {
    console.log('WHAT WENT WRONG');
    for (const r of bad) console.log('  step ' + r.n + '  ' + r.what + (r.detail ? '  -- ' + r.detail : ''));
}
process.exit(bad.length ? 1 : 0);
