/**
 * WHAT THE ARCHERY SHOPS SELL, against Old School's own stock tables.
 *
 * Reported as "lowe at varrock sells bolts it shouldn't. check other range shops too"
 * (DeathPlateau-Bugs#51). Lowe's shop held eight GEM-TIPPED bolt rows - jade, red topaz, sapphire,
 * emerald, ruby, diamond, dragon, onyx - and Old School's Lowe sells none of them. Jade bolts are
 * not even tradeable there.
 *
 * THEY WERE NOT A MISTAKE, THEY WERE A STOPGAP THAT OUTLIVED ITS REASON. The comment beside the
 * Ranging Guild's crossbow block says it outright: "sold here until they can be smithed and
 * fletched". That condition has since been met - Smithing makes every *_bolts_unf and Fletching
 * cuts every gem tip and attaches it - and nobody went back to the shops. Section 3 is the check
 * that the condition really is met, because if it were not, this fix made eight items unobtainable.
 *
 * THE SWEEP THE REPORT ASKED FOR FOUND ONE MORE DIVERGENCE AND TWO THINGS THAT LOOK LIKE ONE AND
 * ARE NOT, which is why this file is shaped per shop rather than as one rule:
 *
 *   archeryshop (Lowe's)          8 gem-tipped bolts  -> removed, Old School sells none
 *   archeryshop2 (Hickton's)      bronze bolts, crossbow  -> correct, both in the wiki's table
 *   gnomeshop_gulluck             bronze bolts, crossbow, PEARL BOLTS -> ALL correct (section 4)
 *   lathastrainingstore (Armoury) bronze bolts, crossbow  -> correct
 *   lletyaarcheryshop1 (Lletya)   bronze bolts, crossbow  -> correct
 *   ranging_guild_bowshop         7 crossbows + 6 metal bolts -> not in Old School (section 5)
 *   rangingguild_trade_tickets    barb bolttips x30       -> correct, the Ticket Exchange sells them
 *
 *   npx tsx tools/sim/rangedshops.ts
 */
import * as H from './harness.ts';
import { check, R } from './a1lib.ts';
import InvType from '#/cache/config/InvType.js';
import ObjType from '#/cache/config/ObjType.js';
import DbRowType from '#/cache/config/DbRowType.js';

await H.boot();

/**
 * The obj names a shop stocks, in slot order.
 *
 * 65535 IS AN EMPTY SLOT, not an obj, and it is what a GAP in the stockN numbering packs down to.
 * This function used to guard against 0 and then crash on 65535 - ObjType.get(65535) is undefined -
 * which took the whole sim down mid-run and reported nothing at all, so a mutation that left a gap
 * looked like a sim that produced no output rather than a failure. Counted rather than ignored:
 * emptySlots() is checked on its own, because across all 318 shops in the build exactly zero have
 * one, so an empty slot is a config error and not padding.
 */
const EMPTY_SLOT = 65535;

function stock(shopName: string): string[] {
    const inv = InvType.get(InvType.getId(shopName));
    const out: string[] = [];
    for (const id of inv.stockobj ?? []) {
        if (id === undefined || id === 0 || id === EMPTY_SLOT) continue;
        const t = ObjType.get(id);
        out.push(t ? (t.debugname ?? String(id)) : `<<unresolvable obj ${id}>>`);
    }
    return out;
}

function emptySlots(shopName: string): number {
    const inv = InvType.get(InvType.getId(shopName));
    return [...(inv.stockobj ?? [])].filter(id => id === EMPTY_SLOT).length;
}

/** What a shop stocks of a named obj, by slot: [count, restock]. */
function slot(shopName: string, objName: string): [number, number] | null {
    const inv = InvType.get(InvType.getId(shopName));
    const want = ObjType.getId(objName);
    const ids = inv.stockobj ?? [];
    for (let i = 0; i < ids.length; i++) {
        if (ids[i] === want) return [inv.stockcount?.[i] ?? 0, inv.stockrate?.[i] ?? -1];
    }
    return null;
}

// The eight that were at Lowe's. Pearl is deliberately NOT here - see section 4.
const LOWE_GEMS = ['jade_bolts', 'topaz_bolts', 'sapphire_bolts', 'emerald_bolts', 'ruby_bolts', 'diamond_bolts', 'dragon_bolts', 'onyx_bolts'];

// ---- 1. Lowe's sells no gem-tipped bolts, which is the report ---------------------------------
console.log("\n1. Lowe's sells no gem-tipped bolts");
{
    const lowe = stock('archeryshop');
    const held = lowe.filter(o => LOWE_GEMS.includes(o) || o === 'opal_bolts' || o === 'pearl_bolt');
    check(`  none of the ten gem bolts are in the shop${held.length ? ': ' + held.join(', ') : ''}`, held.length, 0);
    // AND NOT BY EMPTYING THE SHOP. Section 2 is what stops the above passing by deletion.
    check('  and the shop still has stock at all', lowe.length > 10, true);
}

// ---- 2. and Lowe's keeps what Old School does give it -----------------------------------------
// THE HALF THAT MUST NOT MOVE. The report said Lowe sells bolts it should not, and the bolts it
// actually sells - bronze - are correct: the wiki's stock table has Bronze bolts 1,500 and
// Crossbow 2. Deleting those while clearing out the gem rows is the obvious way to overshoot this
// fix, so it is named here.
console.log("\n2. Lowe's keeps the bronze bolts and the crossbow, which the wiki does give it");
{
    const lowe = stock('archeryshop');
    check('  bronze bolts (wiki: 1,500)', slot('archeryshop', 'bolt')?.[0], 1500);
    check('  a crossbow (wiki: 2)', slot('archeryshop', 'crossbow')?.[0], 2);
    for (const o of ['bronze_arrow', 'iron_arrow', 'steel_arrow', 'shortbow', 'longbow', 'maple_longbow']) {
        check(`  ${o}`, lowe.includes(o), true);
    }
    // AND NO HOLE WHERE A ROW USED TO BE. Removing a stockN line without renumbering the ones after
    // it packs a gap down to an empty slot (obj 65535, count 0) that a player's shop window shows
    // as a blank square. Exactly zero of the build's 318 stocked shops have one, so this is a
    // config error rather than padding - and it is the mistake this very fix could have made.
    for (const shop of ['archeryshop', 'archeryshop2', 'gnomeshop_gulluck', 'lathastrainingstore', 'lletyaarcheryshop1', 'ranging_guild_bowshop']) {
        check(`  ${shop.padEnd(22)} has no empty stock slot`, emptySlots(shop), 0);
    }
}

// ---- 3. the stopgap's own condition really has been met ---------------------------------------
console.log('\n3. all eight are fletchable, which is why the shop rows were able to go');
for (const gem of LOWE_GEMS) {
    const row = 'fletching_' + gem.replace('_bolts', '_bolts');
    check(`  ${gem.padEnd(16)} has a Fletching row`, DbRowType.getId(row) >= 0, true);
}

// ---- 4. AND GULLUCK'S PEARL BOLTS ARE NOT THE SAME BUG --------------------------------------
// THE ONE THIS SWEEP NEARLY BROKE. "No shop sells gem-tipped bolts" is a tempting rule and it is
// wrong: Gulluck and Sons in the Grand Tree really does sell Pearl bolts in Old School - 1 in
// stock, 15 minute restock - and ours matches that exactly. A tidy-up that took every gem bolt out
// of every archery shop would have removed a correct row, so the correct row is asserted.
// https://oldschool.runescape.wiki/w/Pearl_bolts
console.log('\n4. Gulluck and Sons keeps its pearl bolts, because Old School sells them there');
{
    check('  pearl bolts are still stocked', slot('gnomeshop_gulluck', 'pearl_bolt') !== null, true);
    check('  1 in stock, as the wiki gives', slot('gnomeshop_gulluck', 'pearl_bolt')?.[0], 1);
    check('  and its bronze bolts too (wiki: 150)', slot('gnomeshop_gulluck', 'bolt')?.[0], 150);
}

// ---- 5. the Ranging Guild's crossbow block, pinned rather than removed -----------------------
// THE SWEEP'S OTHER FINDING, and deliberately left in place. No shop in the Ranging Guild sells a
// crossbow or a metal bolt in Old School - its four shops are armour, bows and arrows, javelins and
// thrownaxes, and the ticket exchange - so these thirteen rows are the same expired stopgap as
// Lowe's eight. Taking them out changes where every crossbow in the game comes from, which is an
// economy decision rather than a bug fix, and the Ranging Guild is not what was reported.
//
// So the list is ASSERTED: it cannot grow, it cannot shrink by accident, and when the decision is
// made this check is the thing that says what the decision was about.
console.log('\n5. the Ranging Guild still sells the crossbow line, which is filed for a decision');
{
    const KNOWN = ['bronze_crossbow', 'blurite_crossbow', 'iron_crossbow', 'steel_crossbow', 'mithril_crossbow', 'adamant_crossbow', 'rune_crossbow', 'blurite_bolts', 'iron_bolts', 'steel_bolts', 'mithril_bolts', 'adamant_bolts', 'runite_bolts'];
    const held = stock('ranging_guild_bowshop').filter(o => /crossbow|_bolts$/.test(o));
    check(`exactly these ${KNOWN.length} rows, no more and no fewer`, held.join(', '), KNOWN.join(', '));
}

// ---- 6. and the four shops the sweep cleared stay cleared ------------------------------------
// Checked against the wiki's stock tables and correct as they stand. Named so that "check the other
// range shops too" has an answer in the repository rather than only in an issue comment.
console.log('\n6. the four that were already right');
for (const [shop, bolts, bow] of [
    ['archeryshop2', 200, 2],
    ['lathastrainingstore', 200, 2],
    ['lletyaarcheryshop1', 1500, 5],
    ['gnomeshop_gulluck', 150, 2]
] as [string, number, number][]) {
    check(`  ${shop.padEnd(22)} bronze bolts ${bolts}, crossbow ${bow}`, `${slot(shop, 'bolt')?.[0]}/${slot(shop, 'crossbow')?.[0]}`, `${bolts}/${bow}`);
    const gems = stock(shop).filter(o => LOWE_GEMS.includes(o));
    check(`    ...and no gem-tipped bolts${gems.length ? ': ' + gems.join(', ') : ''}`, gems.length, 0);
}

console.log(R.bad ? `\nFAILED: ${R.bad} of ${R.ok + R.bad}` : `\n${R.ok} ok`);
process.exit(R.bad ? 1 : 0);
