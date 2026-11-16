// FIGHT ARENA, played through on foot.
//
// Quest 81 of the quest-by-quest pass. General Khazard has taken Lady Servil's husband and son to
// fight in his arena, and the way in is a guard's uniform out of a chest and a bottle of something
// the guard on the cells should not be drinking.
//
// The three fights and the cutscenes between them are driven by the content, not the manifest: the
// ogre's death chains into Justin, then Khazard, then the cells; the scorpion's into Bouncer. So
// each fight is followed by a `say` with nothing to pick, which is drive() clicking through what
// the quest says next.
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_arena_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const LADY: [number, number, number] = [2569, 3198, 0];
const CHEST: [number, number] = [2613, 3189];
const CHEST_STAND: [number, number, number] = [2613, 3190, 0];
const DRUNK_GUARD: [number, number, number] = [2615, 3143, 0];
const BARMAN: [number, number, number] = [2566, 3140, 0];
const JEREMY_DOOR: [number, number] = [2617, 3167];
const JEREMY_STAND: [number, number, number] = [2618, 3167, 0];
const HENGRAD: [number, number, number] = [2598, 3143, 0];

const m: Manifest = {
    quest: 'FIGHT ARENA',
    source: 'oldschool.runescape.wiki/w/Fight_Arena',
    stageVar: 'arenaquest',
    // ^arena_complete. The quest is over at 14; 15 is ^arena_complete_defeated_genkhazard, the
    // extra state for killing the general afterwards, which this run goes on to do. `done` is what
    // the helper reads as finished, and quests.rs2 turns the quest-list row green at 14.
    done: 14,
    start: LADY,
    steps: [
        { note: 'no quest requirements. Items: five coins for a Khali brew, and the ability to beat' },
        { note: 'a level 63 ogre, a level 44 scorpion, Bouncer at 137 and Khazard at 142.' },
        { give: 'coins', n: 100 },

        { note: 'wiki step 1: Lady Servil, west of the Ardougne monastery, with a broken cart' },
        { setpos: LADY, why: 'to Lady Servil' },
        { talk: 'lady_servil', picks: ['Can I help you?'], want: 'waiting here for you', why: 'Khazard took her family' },
        { stage: 1 },

        { note: 'wiki step 2: a guard’s uniform is in the chest in the north-east house' },
        { setpos: CHEST_STAND, why: 'to the house in the north-east corner' },
        { loc: 'arena_guard_chest_shut', at: CHEST, soft: true, why: 'open the chest' },
        { loc: 'arena_guard_chest_open', at: CHEST, want: 'helmet and armour', why: 'and search it' },
        { stage: 2 },
        { has: 'khazard_platemail' },
        { has: 'khazard_helmet' },
        { held: 'khazard_platemail', op: 2, why: 'wear the armour' },
        { held: 'khazard_helmet', op: 2, why: 'and the helmet' },
        { worn: 'khazard_platemail' },
        { worn: 'khazard_helmet' },

        { note: 'wiki step 3: the guard on the southern cells wants a decent drink' },
        { setpos: DRUNK_GUARD, why: 'into the prison, to the guard by the staircase' },
        { talk: 'arena_guard2', want: 'decent drink', why: 'and he says so' },
        { stage: 3 },

        { note: 'wiki step 4: five coins at the bar in the west buys a Khali brew' },
        { setpos: BARMAN, why: 'to the Khazard bar' },
        { talk: 'khazard_barman', picks: ["I'd like a Khali brew please."], want: 'five gold coins', why: 'buy the brew' },
        { has: 'khali_brew' },

        { note: 'wiki step 5: too much Khali brew and he hands over the keys' },
        { setpos: DRUNK_GUARD, why: 'back to the guard' },
        { talk: 'arena_guard2', want: 'take the keysch', why: 'give him the brew' },
        { stage: 5 },
        { has: 'khazard_cellkeys' },

        { note: 'wiki step 7: Jeremy is in the north-eastern cell, and he runs for the arena' },
        { setpos: JEREMY_STAND, why: "to Jeremy's cell" },
        { useLoc: 'arena_jeremydoor', at: JEREMY_DOOR, obj: 'khazard_cellkeys', hop: true, soft: true, why: 'unlock the cell' },
        { stage: 6 },

        { note: 'wiki fight 1: the ogre, with his father in the arena' },
        { fight: 'arena_ogre', untilvar: 'arenaquest', to: 8, tries: 6, r: 24, why: 'kill the ogre' },
        { stage: 8 },
        { say: [], why: 'Justin, then Khazard, then the cells' },
        { stage: 9 },

        { note: 'wiki fight 2: Hengrad is the cellmate, and talking to him brings the guard' },
        { setpos: HENGRAD, why: 'to the cell' },
        { talk: 'hengrad', want: 'Good luck friend', why: 'he has been here since he was a child' },
        { say: [], why: 'the lead guard walks you back to the arena' },
        { note: 'fights 2 and 3 are ONE step, because killing the scorpion chains straight into' },
        { note: 'Khazard sending for his puppy and the cage opening - the stage goes 9 to 10 to 11' },
        { note: 'without the player clicking anything in between, so the step takes whichever of the' },
        { note: 'two is in front of it and stops when Bouncer is down.' },
        { fight: ['arena_scorpion', 'arena_bouncer'], untilvar: 'arenaquest', to: 11, tries: 10, r: 24, why: 'the scorpion, then Bouncer' },
        { stage: 11 },
        { say: [], why: 'he keeps his promise and then attacks' },

        { note: 'wiki fight 4 (optional): Khazard himself. ^arena_freed_servils (12) is not asserted' },
        { note: 'because he attacks the moment he has said the Servils may go and the fight can be' },
        { note: 'over before the next step looks - 13 is the only stable value here.' },
        { fight: 'general_khazard', untilvar: 'arenaquest', to: 13, tries: 8, r: 24, why: 'kill General Khazard' },
        { stage: 13 },

        { note: 'and back to Lady Servil' },
        { setpos: LADY, why: 'to Lady Servil' },
        { talk: 'lady_servil', want: 'truly grateful', why: 'her family are home' },
        { stage: 15 },
        { has: 'coins', n: 1095 }
    ]
};

const p: any = H.makePlayer('arenarun', m.start[0], m.start[1]);
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
