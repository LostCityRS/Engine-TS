// IN AID OF THE MYREQUE, played through on foot.
//
// Quest 53 of the quest-by-quest pass, and the biggest single thing in the build: 206 burgh_ locs,
// 65 burgh_ npcs and a town to put back together. Unlike In Search of the Myreque this one was
// written FROM the cache rather than from the varbit names, so its shape is the walkthrough's -
// Florin's chest, the cellar rubble, the store roof and wall, Aurel's crate, the bank booth, the
// furnace, the blood tithe, Ivan's walk to Paterdomus, the library, the tomb and the rod.
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_myreque2_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

// The Myreque are in the Hollows until they move into the inn cellar.
const _HOLLOWS_VELIAFHOLLOWS_VELIAF: [number, number, number] = [3507, 9841, 0];
const GATE: [number, number] = [3484, 3244];
const FOOD_CHEST: [number, number] = [3483, 3246];
const LEADER: [number, number, number] = [3491, 3241, 0];
const STORE_LADDER_UP: [number, number] = [3513, 3238];
const STORE_ROOF: [number, number] = [3515, 3240];
const STORE_WALL: [number, number] = [3517, 3238];
const AUREL: [number, number, number] = [3517, 3240, 0];
const BANK_BOOTH: [number, number] = [3494, 3211];
const BANK_WALL: [number, number] = [3491, 3211];
const FURNACE: [number, number] = [3527, 3209];
const GADDERANKS: [number, number, number] = [3515, 3240, 0];
const INN_WALL: [number, number] = [3489, 3231];
const RUBBLE_PILE: [number, number] = [3489, 3227];
const INN_TRAPDOOR: [number, number] = [3490, 3232];
const CELLAR_VELIAF: [number, number, number] = [3491, 9627, 0];
const TEMPLE_KEYHOLE: [number, number] = [3443, 9898];
const TEMPLE_TRAPDOOR: [number, number] = [3441, 9899];
const BOOKCASE_HISTORY: [number, number] = [3407, 9863];
const BOOKCASE_IVANDIS: [number, number] = [3407, 9866];
const TOMB_BOARDS: [number, number] = [3483, 9832];
const TOMB_ENTRANCE: [number, number] = [3484, 9832];
const COFFIN: [number, number] = [3481, 9808];
const WELL: [number, number] = [3482, 3234];

const m: Manifest = {
    quest: 'IN AID OF THE MYREQUE',
    source: 'oldschool.runescape.wiki/w/In_Aid_of_the_Myreque',
    stageVar: 'myreque_2_quest',
    done: 110, // ^m2_complete
    start: [3507, 9841, 0],
    steps: [
        { note: 'requirements: In Search of the Myreque, 25 Agility, 25 Crafting, 15 Mining and 7' },
        { note: 'Magic. None of the four skills was being checked before this pass.' },
        { setvar: 'routequest', to: 8, why: '^route_complete' },
        { setvar: 'druidspirit', to: 110, why: '^druidspirit_complete, for the swamp' },
        { setvar: 'priestperil', to: 60, why: '^priestperil_complete, for the temple' },
        { note: 'THE ITEM LIST DOES NOT FIT IN AN INVENTORY. Eleven planks, forty-four nails, ten' },
        { note: 'axes, ten fish, four tinderboxes, five coal, two buckets, two lots of clay, a spade,' },
        { note: 'a pickaxe, a hammer, swamp paste, a silver bar, a mithril bar, a sapphire and a rope' },
        { note: 'is sixty-two slots of twenty-eight, which is why the walkthrough has you bank in' },
        { note: 'Burgh de Rott halfway through - so this run is handed each thing where it is used.' },

        { note: 'wiki step 1: Veliaf, in the Myreque hideout under the Hollows' },
        { talk: 'route_veliaf_hurtz', picks: ["Why hasn't anyone helped them?"], want: 'Burgh de Rott', why: 'he sets the quest' },
        { stage: 10 },

        { note: 'wiki step 2: Florin, at the gate. He stands three tiles inside his own gate and the' },
        { note: 'gate is a wall, so from the swamp road there is no tile adjacent to him - the' },
        { note: 'conversation is on the gate itself.' },
        { give: 'bread', n: 3 },
        { setpos: [3484, 3246, 0], why: 'down the swamp road to the village gate' },
        { loc: 'burgh_fencegate_r', at: GATE, want: 'something to eat in the chest', why: 'Florin, through the gate' },
        { note: 'and the chest, which is placed, open, at 3483,3246 with a table beside it' },
        { useLoc: 'burgh_quest_food_chest_open', at: FOOD_CHEST, obj: 'bread', want: 'the gate opens', why: 'feed Florin' },
        { stage: 12 },
        { loc: 'burgh_fencegate_r', at: GATE, why: 'in' },

        { note: 'wiki step 2b: the village leader. The walkthrough calls her Razvan; this cache calls' },
        { note: 'her Elisabeta and gives her the only Trade option in the village, so she is the one.' },
        { setpos: LEADER, why: 'to the leader' },
        { talk: 'burgh_vilager_leader', want: 'cannot light a fire', why: 'what is wrong with the town' },
        { stage: 20 },

        { note: 'wiki step 4: the general store roof, up the ladder on its south wall' },
        { give: 'woodplank', n: 3 },
        { give: 'nails', n: 44 },
        { give: 'hammer' },
        { setpos: [3513, 3237, 0], why: 'east to the general store' },
        { loc: 'burgh_ladder_generalstore_up', at: STORE_LADDER_UP, why: 'up to the roof' },
        { level: 2 },
        { loc: 'burgh_general_store_roof_multiloc', at: STORE_ROOF, want: 'It is a roof', why: '3 planks and 12 nails' },
        { loc: 'burgh_ladder_generalstore_down', at: [3513, 3238], why: 'down again' },
        { level: 0 },

        { note: 'and the wall east of the ladder' },
        { give: 'woodplank', n: 3 },
        { loc: 'burgh_general_store_wall_multiloc', at: STORE_WALL, want: 'wall again', why: '3 planks and 12 nails' },

        { note: 'wiki step 4b: Aurel, and the crate. Ten bronze axes, three tinderboxes and ten of' },
        { note: 'whichever food he rolls for - the roll happens before he hands the crate over, which' },
        { note: 'is what the walkthrough’s re-roll re-rolls.' },
        { setpos: AUREL, why: 'to Aurel' },
        { note: 'which food he asks for is a roll, so it is pinned for the length of the ask:' },
        { note: 'random(2) = 0 is add(0, 1), which is ^m2_food_mackerel' },
        { rng: 0, why: 'the food roll' },
        { talk: 'burgh_general_store_owner', picks: ['I will fetch all that.'], want: 'raw mackerel', why: 'ask for the crate' },
        { rng: null, why: 'everything after this has dice of its own' },
        { has: 'burgh_generalstore_crate' },
        { note: 'the crate takes as many as you are holding per click, so it is three clicks' },
        { give: 'bronze_axe', n: 10 },
        { give: 'tinderbox', n: 3 },
        { give: 'raw_mackerel', n: 10 },
        { use: ['bronze_axe', 'burgh_generalstore_crate'], want: 'in the crate', why: 'ten axes' },
        { use: ['tinderbox', 'burgh_generalstore_crate'], want: 'in the crate', why: 'three tinderboxes' },
        { use: ['raw_mackerel', 'burgh_generalstore_crate'], want: 'last of it', why: 'ten mackerel' },
        { talk: 'burgh_general_store_owner', want: 'shop has stock', why: 'hand the crate over' },
        { hasnt: 'burgh_generalstore_crate' },

        { note: 'wiki step 5: the bank booth and the wall behind it, and the man who will not stand' },
        { note: 'behind either of them until both are up' },
        { give: 'woodplank', n: 5 },
        { give: 'swamppaste' },
        { setpos: [3494, 3212, 0], why: 'west to the bank' },
        { loc: 'burgh_bank_booth_multiloc', at: BANK_BOOTH, want: 'stands up on its own', why: '2 planks, 8 nails and swamp paste' },
        { loc: 'burgh_bank_wall_multiloc', at: BANK_WALL, want: 'wall again', why: '3 planks and 12 nails' },

        { note: 'wiki step 6: the furnace in the south-east corner - mend it, load it, light it' },
        { give: 'softclay' },
        { give: 'bucket_water' },
        { give: 'coal', n: 5 },
        { give: 'tinderbox' },
        { setpos: [3527, 3210, 0], why: 'east to the furnace' },
        { loc: 'burgh_furnace_multiloc', at: FURNACE, want: 'It will hold', why: 'clay and water' },
        { loc: 'burgh_furnace_multiloc', at: FURNACE, want: 'load the furnace', why: 'five coal' },
        { loc: 'burgh_furnace_multiloc', at: FURNACE, want: 'smoke coming out', why: 'a tinderbox' },

        { note: 'and back to the leader, which is when the people who take a cut of this town notice' },
        { note: 'that there is a cut to take' },
        { setpos: LEADER, why: 'back to the leader' },
        { talk: 'burgh_vilager_leader', want: 'done all of it', why: 'report the town' },
        { stage: 40 },

        { note: 'wiki step 7: Gadderanks. This was four lines of narration and twelve points of' },
        { note: 'self-damage; the cache was holding burgh_gadderanks_attackable, two Vampyre Juvinates' },
        { note: 'with statblocks and a burgh_gadderanks_wounded with a fall-over animation, and using' },
        { note: 'none of the three.' },
        { setpos: GADDERANKS, why: 'to the barrel outside the store' },
        { talk: 'burgh_gadderanks_multinpc', want: 'regret being memorable', why: 'the tithe' },
        { note: 'he and the two juvinates are spawned after a p_delay(4) that the talk step clicks' },
        { note: 'straight through, and a click landing inside a p_delay can take the rest of the' },
        { note: 'script with it - so about one run in three the three of them are never added at' },
        { note: 'all. Waiting it out is not enough on its own; the tithe is asked for again, which' },
        { note: 'is harmless while the stage is still 40 and re-runs ~m2_tithe_fight if the first' },
        { note: 'one was lost.' },
        { wait: 10, why: 'the three of them are spawned on a delay' },
        { talk: 'burgh_gadderanks_multinpc', tries: 2, soft: true, why: 'ask again if the spawn was lost' },
        { wait: 10, why: 'and again' },
        { note: 'AND THE FIGHT IS USUALLY OVER BEFORE THIS STEP LOOKS. drive() keeps clicking for' },
        { note: 'up to 600 ticks and a damage-immune sim player with maxed stats retaliates the' },
        { note: 'whole time, so the talk above commonly ends with burgh_gadderanks_wounded already' },
        { note: 'lying in the mud and burgh_gadderanks_attackable gone. This step then reported' },
        { note: '"none of burgh_gadderanks_attackable is spawned anywhere near", which reads as a' },
        { note: 'spawn that never happened - and the quest stopped at 40 of 110 over a fight it' },
        { note: 'had already won. Only an `untilvar` lets the fight step see that it is already' },
        { note: 'done, and nothing moves until the wounded talk, so the proof is the body: soft' },
        { note: 'here, and the nearnpc below is the hard assertion. A Gadderanks who was never' },
        { note: 'spawned fails that one, so nothing is let through.' },
        { fight: 'burgh_gadderanks_attackable', r: 12, tries: 4, soft: true, why: 'Gadderanks, if he is still standing' },
        { nearnpc: 'burgh_gadderanks_wounded', why: 'he falls over rather than dying' },
        { talk: 'burgh_gadderanks_wounded', want: 'Vanstrom Klause', why: 'what he has to say' },
        { stage: 50 },

        { note: 'and the Gadderhammer, which Aurel hands over and which nothing was handing over' },
        { setpos: AUREL, why: 'back to Aurel' },
        { talk: 'burgh_general_store_owner', want: 'falling wall', why: 'the hammer' },
        { has: 'gadderanks_warhammer' },

        { note: 'wiki step 3, which this build does after the fight rather than before it: the inn’s' },
        { note: 'back wall, off the trapdoor. A pickaxe breaks it, a spade fills a bucket a stage at a' },
        { note: 'time, and the bucket is emptied on the pile south-west of the bar.' },
        { give: 'spade' },
        { give: 'bronze_pickaxe' },
        { give: 'bucket_empty' },
        { note: 'the rubble is INSIDE the inn and 3489,3230 is outside its back wall - the first pass' },
        { note: 'clicked the spade at it from the street and got three silent passes, because the' },
        { note: 'wall line along z=3230 sets BLOCK_NORTH and shape 10 reaches by rectangle.' },
        { setpos: [3491, 3232, 0], why: 'in through the inn' },
        { useLoc: 'burgh_inn_colapsed_wall_multiloc', at: INN_WALL, obj: 'spade', want: 'into the bucket', why: 'one spadeful' },
        { useLoc: 'burgh_inn_colapsed_wall_multiloc', at: INN_WALL, obj: 'spade', want: 'nearly full', why: 'two' },
        { useLoc: 'burgh_inn_colapsed_wall_multiloc', at: INN_WALL, obj: 'spade', want: 'will not take any more', why: 'three' },
        { has: 'burgh_rubble_bucket_3' },
        { note: 'and back out over the broken back wall, which is the only gap in it' },
        { loc: 'burgh_inn_climb_over', at: [3491, 3230], why: 'over the wall' },
        { setpos: [3489, 3226, 0], why: 'round to the pile' },
        { useLoc: 'burgh_outside_rubble_pile', at: RUBBLE_PILE, obj: 'burgh_rubble_bucket_3', want: 'last of it', why: 'three loads at once' },

        { note: 'and the trapdoor under it, which is where the Myreque move in' },
        { setpos: [3491, 3232, 0], why: 'back into the inn' },
        { loc: 'burgh_inn_trapdoor_multiloc', at: INN_TRAPDOOR, want: 'dry stone cellar', why: 'open it' },
        { stage: 60 },
        { loc: 'burgh_inn_trapdoor_multiloc', at: INN_TRAPDOOR, why: 'down' },

        { note: 'wiki step 8: Veliaf in the cellar, and the boy who wants to be a priest' },
        { setpos: CELLAR_VELIAF, why: 'across the cellar' },
        { note: '"Who is Ivan?" is a line he says for you, not an option - there is no menu here' },
        { talk: 'burgh_rescue_veliaf_hurtz_talk', want: 'Ivan Strom', why: 'the escort' },
        { stage: 72 },

        { note: 'the armour is optional and the food is not, which is the wiki’s own split - this' },
        { note: 'used to refuse to set off without all three pieces of armour.' },
        { note: 'he is put by the ladder, which is five tiles from Veliaf, and useNpc does not walk' },
        { setpos: [3491, 9631, 0], why: 'across to the ladder, where Veliaf says he is' },
        { note: 'his thank-you is a chatnpc this step does not capture, so what proves the food went' },
        { note: 'in is the next step: he will not set off at all until he is carrying some' },
        { useNpc: 'burgh_ivan_strom_temple_ambush', obj: 'bread', why: 'something to eat' },
        { talk: 'burgh_ivan_strom_temple_ambush', picks: ["Then let's go."], want: 'Out the back and north', why: 'set off' },

        { note: 'wiki step 8b: north through Mort Myre to Ulizius’s gate, where two of them are' },
        { note: 'waiting on the Paterdomus side' },
        { note: 'Ulizius\u2019s gate at the top of Mort Myre is Nature Spirit\u2019s loc and not this' },
        { note: 'quest\u2019s, so the run steps past it rather than through it - and Ivan\u2019s own timer' },
        { note: 'brings him to whoever he is following when the swamp gets between the two of them,' },
        { note: 'which is what the walk relies on over four map squares with a gate in them.' },
        { setpos: [3446, 3460, 0], why: 'through the gate onto the Paterdomus side' },
        { wait: 8, why: 'his timer brings him across and the ambush is in that box' },
        { wait: 6, why: 'the ambush is sprung by his timer' },
        { fight: ['burgh_ivan_temple_vampire_juve_1', 'burgh_ivan_temple_vampire_juve_2'], r: 14, tries: 4, why: 'the two at the gate' },
        { talk: 'burgh_ivan_strom_temple_ambush', want: 'seen two of them die', why: 'the ambush is behind you' },
        { stage: 74 },

        { note: 'wiki step 8c: Drezel, who keeps the boy and hands over a key he has had for eleven' },
        { note: 'years and never used' },
        { setpos: [3440, 9887, 0], why: 'into the temple catacombs' },
        { talk: 'priestperiltrappedmonk2', want: 'Temple Library', why: 'the library key' },
        { stage: 80 },
        { has: 'burgh_key' },

        { note: 'wiki step 9: the keyhole in a wall with no door in it' },
        { setpos: [3443, 9897, 0], why: 'to the keyhole' },
        { loc: 'burgh_library_keyhole', at: TEMPLE_KEYHOLE, want: 'trapdoor has opened', why: 'the key' },
        { note: 'the trapdoor opens two tiles west of the keyhole and is not reachable from it' },
        { setpos: [3441, 9898, 0], why: 'round to the trapdoor' },
        { loc: 'burgh_temple_trapdoor_multiloc', at: TEMPLE_TRAPDOOR, why: 'down into the library' },
        { level: 2 },
        { loc: 'burgh_library_bookcase_history', at: BOOKCASE_HISTORY, want: 'seven warrior priests', why: 'the histories' },
        { has: 'burgh_book_sevenwarriors' },
        { loc: 'burgh_library_bookcase_ivandis', at: BOOKCASE_IVANDIS, want: 'Ivandis Seergaze', why: 'the seventh name' },
        { stage: 90 },

        { note: 'wiki step 10: the boards in the Hollows, two hundred years of nails' },
        { setpos: [3483, 9833, 0], why: 'back to the Hollows' },
        { useLoc: 'burgh_ivandis_tombdoor_board_multiloc', at: TOMB_BOARDS, obj: 'hammer', want: 'boards come off', why: 'prise them off' },
        { stage: 100 },
        { loc: 'burgh_ivandis_tomb_entrance', at: TOMB_ENTRANCE, why: 'in' },
        { level: 2 },
        { loc: 'burgh_ancient_coffin', at: COFFIN, want: 'fragment comes away', why: 'the plaster' },
        { has: 'burgh_plaster_inscription_ivandis' },

        { note: 'and Veliaf reads it, which is where the rod starts' },
        { setpos: CELLAR_VELIAF, why: 'back to the cellar' },
        { talk: 'burgh_rescue_veliaf_hurtz_talk', want: 'Take clay to the lid', why: 'the recipe' },
        { stage: 102 },

        { note: 'wiki step 10b: soft clay against the carving' },
        { setpos: [3481, 9809, 2], why: 'back into the tomb' },
        { give: 'softclay' },
        { useLoc: 'burgh_ancient_coffin', at: COFFIN, obj: 'softclay', want: 'whole shape of it', why: 'the mould' },
        { stage: 104 },
        { has: 'burgh_rod_clay' },

        { note: 'cast at a furnace: a silver bar opens the Silver Casting panel and the rod has been' },
        { note: 'the fifth slot on it the whole time' },
        { give: 'silver_bar' },
        { give: 'mithril_bar' },
        { give: 'sapphire' },
        { setpos: [3527, 3210, 0], why: 'back to the Burgh de Rott furnace' },
        { useLoc: 'burgh_furnace_multiloc', at: FURNACE, obj: 'silver_bar', why: 'open the casting panel' },
        { press: 'silver_casting:slot_silvthrill_rod', why: 'the rod' },
        { stage: 106 },
        { has: 'burgh_rod_command1' },

        { note: 'Lvl-1 Enchant on the sapphire in the head of it, which is a convertobj row in' },
        { note: 'magic_spells.dbrow and the reason this quest asks for 7 Magic' },
        { note: 'the spell is cast off the spellbook, which this runner cannot press, so the' },
        { note: 'conversion is asserted by handing over the enchanted rod instead' },
        { give: 'burgh_rod_command2' },

        { note: 'wiki step 10c: the well, on a rope' },
        { give: 'rope' },
        { setpos: [3482, 3233, 0], why: 'to the well' },
        { useLoc: 'burgh_well', at: WELL, obj: 'burgh_rod_command2', want: 'colour of the water', why: 'charge it' },
        { stage: 108 },
        { has: 'burgh_rod_command_final_10' },

        { note: 'wiki step 11: and Veliaf, who does not let go of it for a moment' },
        { setpos: CELLAR_VELIAF, why: 'back to the cellar' },
        { talk: 'burgh_rescue_veliaf_hurtz_talk', want: 'Sixty years', why: 'hand it over' },
        { wait: 4, why: 'the completion is queued' },
        { stage: 110 },
        { has: 'burgh_rod_command_final_10' }
    ]
};

const p: any = H.makePlayer('myreque2run', m.start[0], m.start[1]);
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
