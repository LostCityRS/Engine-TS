// ::wipebank (2026-11-15), against the real handler and the real content.
//
// The command deletes a bank and cannot be undone, so the things worth asserting are the ones
// that stop it happening by accident or to the wrong account:
//
//   1. It is administrator and up. A moderator typing it must get nothing at all - not a refusal
//      that confirms the command exists, and certainly not a wipe.
//   2. It asks first, and answering No leaves every item where it was.
//   3. A bank PIN is not sidestepped by it. ::bank routes through [label,openbank] so a PIN is
//      asked for; a command that empties the bank has to answer the same question, or somebody
//      sitting at a logged-in staff account who cannot OPEN the bank could still empty it.
//   4. It works while the bank window is open, which is when it gets typed. The window is a main
//      modal, so canAccess is false and the command would have answered "finish what you are
//      doing" to somebody looking at the bank they want emptied - hence the closeModal in the
//      handler, asserted here rather than left to be rediscovered.
//   5. The eight tab counts go to zero with the items. A tab is a COUNT of a range of the one
//      list (bank_tabs.rs2), so counts left behind would claim items that are no longer there.
//
// Usage: npx tsx tools/sim/wipebank.ts
import * as H from './harness.js';
import { check, R, player } from './a1lib.js';

import InvType from '#/cache/config/InvType.js';
import ObjType from '#/cache/config/ObjType.js';
import Player from '#/engine/entity/Player.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';

import ClientCheatHandler from '#/network/game/client/handler/ClientCheatHandler.js';
import ClientCheat from '#/network/game/client/model/ClientCheat.js';

await H.boot();
H.loginOrder();

const handler = new ClientCheatHandler();

/** What the client's "::wipebank" does: the cheat packet, nothing else. */
const wipebank = (p: Player, text = 'wipebank') => handler.handle(new ClientCheat(text), p);

const bankOf = (p: Player) => p.getInventory(InvType.getId('bank'))!;
const banked = (p: Player) => {
    const inv = bankOf(p);
    let n = 0;
    for (let slot = 0; slot < inv.capacity; slot++) if (inv.get(slot)) n++;
    return n;
};
const tabCounts = (p: Player) => [1, 2, 3, 4, 5, 6, 7, 8].map(t => H.getVar(p, `banktab_c${t}`));

/**
 * Three real items and one placeholder, filed as two tabs' worth.
 *
 * The placeholder is written straight into the slot as a count-0 stack because that is exactly
 * what one IS (see the placeholder section of bank_bar.rs2) - reaching it through the padlock and
 * a withdrawal would assert the padlock, which bankux.ts already does.
 */
const fill = (p: Player) => {
    const inv = bankOf(p);
    inv.removeAll();
    inv.add(ObjType.getId('feather'), 100);
    inv.add(ObjType.getId('bronze_arrow'), 50);
    inv.add(ObjType.getId('shark'), 3);
    inv.set(3, { id: ObjType.getId('coins'), count: 0 });
    // the first two items are tab 1, the shark and the placeholder are untabbed
    H.setVar(p, 'banktab_c1', 2);
    H.setVar(p, 'banktab', 1);
    H.tick(1);
};

/** Opening the bank the way a click on a booth does: protected, so ~banktab_show may write %banktab. */
const openBank = (p: Player) => {
    const script = ScriptProvider.getByName('[proc,bankpin_open_bank_real]');
    if (!script) throw new Error('no [proc,bankpin_open_bank_real]');
    p.executeScript(ScriptRunner.init(script, p), true);
    H.tick(1);
};

// ============================================================ 1. a moderator does not have it
console.log('A MODERATOR TYPING IT GETS NOTHING');
{
    const p = player('wipemod', 3222, 3222);
    p.staffModLevel = 2;
    fill(p);

    // The handler's own return value says nothing here - it answers true for anything it falls
    // all the way through, a command that does not exist included - so what is asserted is that a
    // moderator cannot tell the two apart, which is the point: a refusal would confirm the
    // command is there to be asked for.
    let from = H.mesgs.length;
    wipebank(p);
    const toldAboutWipebank = H.mesgs.slice(from).filter(m => m.who === p.username);

    from = H.mesgs.length;
    handler.handle(new ClientCheat('nosuchcheatatall'), p);
    const toldAboutNothing = H.mesgs.slice(from).filter(m => m.who === p.username);

    check('  the bank is untouched', banked(p), 4);
    check('  nothing is said about it at all', toldAboutWipebank, []);
    check('  which is what a command that does not exist does too', toldAboutWipebank, toldAboutNothing);
    H.despawn(p);
}

// ============================================================ 2. an empty bank says so
console.log('\nAN ADMINISTRATOR WITH AN EMPTY BANK IS TOLD SO, NOT ASKED TO CONFIRM');
{
    const p = player('wipeempty', 3222, 3222);
    p.staffModLevel = 3;
    bankOf(p).removeAll();

    const from = H.mesgs.length;
    check('  the command is taken', wipebank(p), true);
    check(
        '  it says the bank is already empty',
        H.mesgs.slice(from).map(m => m.text),
        ['Your bank is already empty.']
    );
    check('  and no confirm box was opened', H.choose(p, 'multi2:com_1'), false);
    H.despawn(p);
}

// ============================================================ 3. No means no
console.log('\nIT ASKS FIRST, AND NO LEAVES EVERY ITEM WHERE IT WAS');
{
    const p = player('wipeno', 3222, 3222);
    p.staffModLevel = 3;
    fill(p);

    const texts = H.ifaces.length;
    let from = H.mesgs.length;
    check('  the command is taken', wipebank(p), true);
    check(
        '  and it names the number of items it would delete',
        H.ifaces
            .slice(texts)
            .filter(i => i.who === p.username && i.kind === 'text')
            .map(i => i.text),
        ['Permanently delete all 4 items in your bank?', 'Yes, delete all of it.', 'No, leave it alone.']
    );
    check('  nothing has been deleted yet', banked(p), 4);

    from = H.mesgs.length;
    check('  "No, leave it alone." is answerable', H.choose(p, 'multi2:com_2'), true);
    check('  the bank is still there', banked(p), 4);
    check('  the filing is still there', tabCounts(p), [2, 0, 0, 0, 0, 0, 0, 0]);
    check(
        '  and it says so',
        H.mesgs.slice(from).map(m => m.text),
        ['Your bank has been left alone.']
    );
    H.despawn(p);
}

// ============================================================ 4. Yes wipes the lot
console.log('\nAND YES EMPTIES IT, FILING AND PLACEHOLDERS AND ALL');
{
    const p = player('wipeyes', 3222, 3222);
    p.staffModLevel = 3;
    fill(p);

    check('  the command is taken', wipebank(p), true);
    const from = H.mesgs.length;
    check('  "Yes, delete all of it." is answerable', H.choose(p, 'multi2:com_1'), true);
    check('  not one slot is left occupied', banked(p), 0);
    check('  the placeholder went with the items', bankOf(p).get(3), null);
    check('  every tab count is zero', tabCounts(p), [0, 0, 0, 0, 0, 0, 0, 0]);
    check('  the viewed tab is back to all items', H.getVar(p, 'banktab'), 0);
    check(
        '  and it says how much went',
        H.mesgs.slice(from).map(m => m.text),
        ['Your bank has been wiped: 4 items deleted.']
    );
    H.despawn(p);
}

// ============================================================ 5. ::wipebank confirm skips the box
console.log('\n"::wipebank confirm" SKIPS THE BOX, WHICH IS THE REPEATED-WIPE CASE');
{
    const p = player('wipeconf', 3222, 3222);
    p.staffModLevel = 3;
    fill(p);

    const from = H.mesgs.length;
    check('  the command is taken', wipebank(p, 'wipebank confirm'), true);
    check('  the bank is empty in one go', banked(p), 0);
    check('  nothing was waiting to be answered', H.choose(p, 'multi2:com_1'), false);
    check(
        '  and it still says how much went',
        H.mesgs.slice(from).map(m => m.text),
        ['Your bank has been wiped: 4 items deleted.']
    );
    H.despawn(p);
}

// ============================================================ 6. a bank PIN is not sidestepped
console.log('\nA BANK PIN IS NOT SIDESTEPPED BY IT');
{
    const p = player('wipepin', 3222, 3222);
    p.staffModLevel = 3;
    fill(p);
    H.setVar(p, 'bankpin', 1234);
    H.setVar(p, 'bankpin_verified', 0);

    let from = H.mesgs.length;
    check('  the command is taken', wipebank(p, 'wipebank confirm'), true);
    check('  but nothing is deleted', banked(p), 4);
    check(
        '  and it says what is wanted first',
        H.mesgs.slice(from).map(m => m.text),
        ['Open your bank and enter your bank PIN first.']
    );

    // the same window ::bank is judged in: %bankpin_verified has no scope=perm, so it is this login
    H.setVar(p, 'bankpin_verified', 1);
    from = H.mesgs.length;
    check('  once the PIN has been entered this session it goes through', wipebank(p, 'wipebank confirm'), true);
    check('  and the bank is empty', banked(p), 0);
    check(
        '  with the usual line',
        H.mesgs.slice(from).map(m => m.text),
        ['Your bank has been wiped: 4 items deleted.']
    );
    H.despawn(p);
}

// ============================================================ 7. typed with the bank open
console.log('\nTYPED WITH THE BANK WINDOW OPEN, WHICH IS WHEN IT GETS TYPED');
{
    const p = player('wipeopen', 3222, 3222);
    p.staffModLevel = 3;
    fill(p);
    openBank(p);
    check('  the bank really is open, so canAccess is false', [p.containsModalInterface(), p.canAccess()], [true, false]);

    const from = H.mesgs.length;
    check('  the command is taken anyway', wipebank(p, 'wipebank confirm'), true);
    check('  the window was closed rather than the command refused', p.containsModalInterface(), false);
    check('  the bank is empty', banked(p), 0);
    check(
        '  and "finish what you are doing" was never said',
        H.mesgs.slice(from).map(m => m.text),
        ['Your bank has been wiped: 4 items deleted.']
    );
    H.despawn(p);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
