// THE FURNACE'S SILVER CASTING PANEL: seven slots, and two of them used to lie.
//
// The Lightning Rod and the Demonic Sigil were pinned to the need-a-mould side regardless of what
// the player was carrying - if_sethide(make_X, true) unconditionally - on the grounds that their
// quests were not in this build. Both are: Creature of Fenkenstrain hands out
// fenk_lightning_mould and Shadow of the Storm hands out agrith_sigil_mould. So a player who had
// done those quests opened the panel with the mould in their bag and was told to go and find one.
//
// WHY A SIM AND NOT JUST THE BATTERY. windows_battery.py now refuses a slot that ignores an
// obtainable mould, which is the wiring. This is the other half: that the button behind the slot
// casts the thing, charges a bar for it, and refuses without taking one. A slot can be wired to a
// handler that does nothing at all and read perfectly in the generated file.
//
// THE SIGIL IS SUPPOSED TO REFUSE AT A FURNACE. It is cast in Uzer's four-hundred-year-old kiln,
// not a furnace, so the honest behaviour is a slot that appears and then sends you to the kiln -
// which is what the quest's own refusal does. Both halves are checked, because "it refuses" would
// also be true of a slot that is simply broken.
//
//   npx tsx tools/sim/silvercasting.ts
import * as H from './harness.ts';
import { check, R, player } from './a1lib.ts';
import { PlayerStatMap } from '#/engine/entity/PlayerStat.js';
import { CoordGrid } from '#/engine/CoordGrid.js';
import VarBitType from '#/cache/config/VarBitType.js';

await H.boot();

const CRAFT = PlayerStatMap.get('CRAFTING')!;
const KILN = CoordGrid.unpackCoord(CoordGrid.packCoord(0, 54 * 64 + 11, 48 * 64 + 51)); // ^agrith_kiln_coord
let seq = 0;

type Opts = { at?: [number, number]; questVar?: [string, number]; bars?: number };
/** Open the panel with a mould in the bag, click the slot once, and report what moved. */
function cast(mould: string, slot: string, level: number, o: Opts = {}) {
    const [x, z] = o.at ?? [3222, 3218];
    const p: any = player('sc' + seq++, x, z, 0);
    p.setLevel(CRAFT, level);
    if (o.questVar) H.setVar(p, o.questVar[0], o.questVar[1]);
    H.give(p, mould, 1);
    H.give(p, 'silver_bar', o.bars ?? 2);
    H.runProc(p, '[proc,silver_casting_open]');
    H.invButton(p, 'silver_casting:' + slot, 1, 0);
    H.tick(8);
    return {
        barsGone: (o.bars ?? 2) - H.invCount(p, 'silver_bar'),
        got: (obj: string) => H.invCount(p, obj),
        // THE VARBIT, NOT THE VARP. %agrith_quest and %agrith_kiln are bitfields packed into
        // one player var, so reading the var gave 4194364 for a stage of 60 with the kiln bit
        // set above it - a number that is right and looks like a failure.
        bit: (varbit: string) => p.getVarBit(VarBitType.getId(varbit))
    };
}

// ------------------------------------------------------------------ 1. the five that take a bar
console.log('\nFIVE SLOTS TAKE A SILVER BAR AND GIVE THE ITEM');
for (const [mould, slot, level, obj, what] of [
    ['holy_symbol_mould', 'slot_holy_symbol', 16, 'nostringstar', 'holy symbol'],
    ['unholy_symbol_mould', 'slot_unholy_symbol', 17, 'nostringsnake', 'unholy symbol'],
    ['sickle_mould', 'slot_silver_sickle', 18, 'silver_sickle', 'silver sickle'],
    ['tiara_mould', 'slot_tiara', 23, 'tiara', 'tiara'],
    ['fenk_lightning_mould', 'slot_lightning_rod', 20, 'fenk_conductor', 'lightning conductor']
] as [string, string, number, string, string][]) {
    const r = cast(mould, slot, level);
    check(`${what} is cast`, r.got(obj), 1);
    check('  ...for one silver bar', r.barsGone, 1);
}

// ------------------------------------------------------------------ 2. and refuse without paying
//
// A refusal that still takes the bar is worse than no slot at all, so every one of these asks
// that nothing moved rather than only that nothing was made.
console.log('\nBELOW THE LEVEL: no item, and no bar taken either');
for (const [mould, slot, level, obj, what] of [
    ['holy_symbol_mould', 'slot_holy_symbol', 15, 'nostringstar', 'holy symbol at 15 (needs 16)'],
    ['tiara_mould', 'slot_tiara', 22, 'tiara', 'tiara at 22 (needs 23)'],
    ['fenk_lightning_mould', 'slot_lightning_rod', 19, 'fenk_conductor', 'conductor at 19 (needs 20)']
] as [string, string, number, string, string][]) {
    const r = cast(mould, slot, level);
    check(what, r.got(obj), 0);
    check('  ...and the bar is still in the bag', r.barsGone, 0);
}

// ------------------------------------------------------------------ 3. the sigil, both ways round
console.log("\nTHE SIGIL IS CAST AT UZER'S KILN, NOT AT A FURNACE");
const away = cast('agrith_sigil_mould', 'slot_demonic_sigil', 30, { questVar: ['agrith_quest_varp', 50] });
check('away from the kiln it is refused', away.got('agrith_sigil'), 0);
check('  ...and keeps the bar, so the trip costs nothing', away.barsGone, 0);

// AND IT WORKS WHERE IT SHOULD, which is the half that tells a wired slot from a dead one.
//
// CASTING DOES NOT HAND OVER THE SIGIL, which is what this check first asserted and was wrong
// about: the bar goes into the kiln, the kiln is lit, the quest moves to ^agrith_sigil (60), and
// the sigil is collected by looking in the kiln afterwards - which is where the mould is spent and
// the 500 Crafting is paid. So what the click has to do here is light it and charge the bar.
const atKiln = cast('agrith_sigil_mould', 'slot_demonic_sigil', 30, {
    at: [KILN.x, KILN.z],
    questVar: ['agrith_quest_varp', 50] // ^agrith_mould: the stage that has the mould and not the sigil
});
check('at the kiln the same click moves the quest on', atKiln.bit('agrith_quest'), 60);
check('  ...and lights the kiln', atKiln.bit('agrith_kiln'), 1);
check('  ...and charges the silver bar', atKiln.barsGone, 1);
check('  ...without handing the sigil over, which the kiln does later', atKiln.got('agrith_sigil'), 0);

// ------------------------------------------------------------------ 4. no mould, no cast
//
// The need-a-mould side is the honest answer for a player who has not got one, and it has to stay
// the answer: the fix here was making the slot READ the bag, not making it always open.
console.log('\nWITHOUT THE MOULD, THE SLOT GIVES NOTHING');
for (const [slot, obj, what] of [
    ['slot_lightning_rod', 'fenk_conductor', 'lightning rod'],
    ['slot_demonic_sigil', 'agrith_sigil', 'demonic sigil'],
    ['slot_holy_symbol', 'nostringstar', 'holy symbol']
] as [string, string, string][]) {
    // a mould for a DIFFERENT slot, so the panel opens the same way and only this slot is unheld
    // AT THE KILN for the sigil row: away from it the distance check refuses first, so a missing
    // mould check would have hidden behind it and this would have passed either way.
    const r = cast('sickle_mould', slot, 99, {
        questVar: ['agrith_quest_varp', 50],
        at: slot === 'slot_demonic_sigil' ? [KILN.x, KILN.z] : undefined
    });
    check(`${what} cannot be cast without its mould`, r.got(obj), 0);
    check('  ...and no bar is taken', r.barsGone, 0);
}

console.log(R.bad ? `FAILED: ${R.bad} of ${R.ok + R.bad}` : `${R.ok} ok`);
process.exit(R.bad ? 1 : 0);
