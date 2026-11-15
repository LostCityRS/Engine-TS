// ::wipebank and ::wipebankother (2026-11-15), against the real handler and the real content.
//
// The commands delete a bank and cannot be undone, so the things worth asserting are the ones
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
// And for ::wipebankother, which is owner-only and reaches an account that is not the typist's:
//
//   6. An administrator - who HAS ::wipebank - does not have it, and is told nothing by it.
//   7. Without the word "confirm" it deletes nothing and reports the size instead. There is no
//      Yes/No box to put the question in, because the box would open on the player whose items
//      are going, so the word is the whole of the confirmation and it has to hold.
//   8. It names the right bank: the target's is emptied and the typist's is untouched, which is
//      the mistake a one-word command like this makes if the pointers are wrong.
//   9. The target's own bank PIN does not stop it - staff acting on an account, not somebody at
//      its keyboard - while their being busy does, rather than the wipe silently not running.
//
// Usage: NODE_MIN_STAFF_LEVEL=2 npx tsx tools/sim/wipebank.ts
import * as H from './harness.js';
import { check, R, player } from './a1lib.js';

import InvType from '#/cache/config/InvType.js';
import ObjType from '#/cache/config/ObjType.js';
import Player from '#/engine/entity/Player.js';
import World from '#/engine/World.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';

import ClientCheatHandler from '#/network/game/client/handler/ClientCheatHandler.js';
import ClientCheat from '#/network/game/client/model/ClientCheat.js';
import { STAFF_WORLD } from '#/network/game/client/handler/ClientCheatCommands.js';

// ::wipebankother carries the STAFF_WORLD flag, and STAFF_WORLD is read from the environment once,
// at import - so a single process can only ever see one world shape, and on an OPEN development
// world the command does not exist to be tested. Same shape as staffrules.ts and securityfixes.ts,
// which ask for NODE_PRODUCTION for the same kind of reason; the nightly's per-sim env table gives
// it this.
if (!STAFF_WORLD) {
    console.error('Run with NODE_MIN_STAFF_LEVEL=2 - ::wipebankother does not exist on an open development world.');
    process.exit(1);
}

await H.boot();
H.loginOrder();

const handler = new ClientCheatHandler();

/** What the client's "::wipebank" does: the cheat packet, nothing else. */
const wipebank = (p: Player, text = 'wipebank') => handler.handle(new ClientCheat(text), p);
/** The same, for "::wipebankother <username> [confirm]". */
const wipeother = (p: Player, rest: string) => handler.handle(new ClientCheat(`wipebankother ${rest}`), p);

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

// ====================================================== 8. ::wipebankother is not an admin's
console.log("\n::wipebankother IS NOT AN ADMINISTRATOR'S, EVEN THOUGH ::wipebank IS");
{
    const admin = player('wipeadmin', 3222, 3222);
    admin.staffModLevel = 3;
    const victim = player('wipevictim', 3224, 3222);
    fill(victim);

    const from = H.mesgs.length;
    wipeother(admin, `${victim.username} confirm`);
    check('  the victim keeps every item', banked(victim), 4);
    check(
        '  the administrator is told nothing',
        H.mesgs.slice(from).filter(m => m.who === admin.username),
        []
    );
    check(
        '  and so is the victim',
        H.mesgs.slice(from).filter(m => m.who === victim.username),
        []
    );
    check('  while ::wipebank, which they DO have, still works on their own', [wipebank(admin, 'wipebank confirm'), banked(admin)], [true, 0]);
    H.despawn(admin, victim);
}

// ====================================================== 9. without the word, nothing is deleted
console.log('\nWITHOUT "confirm" IT REPORTS THE SIZE AND DELETES NOTHING');
{
    const owner = player('wipeowner', 3222, 3222);
    owner.staffModLevel = 5;
    const victim = player('wipevictim2', 3224, 3222);
    fill(victim);

    let from = H.mesgs.length;
    check('  the command is taken', wipeother(owner, victim.username), true);
    check('  not one item is deleted', banked(victim), 4);
    check('  the filing is untouched too', tabCounts(victim), [2, 0, 0, 0, 0, 0, 0, 0]);
    check(
        '  the owner is told the size, and how to go through with it',
        H.mesgs
            .slice(from)
            .filter(m => m.who === owner.username)
            .map(m => m.text),
        [`${victim.displayName}'s bank holds 4 items.`, `Type ::wipebankother ${victim.username} confirm to delete all of it. This cannot be undone.`]
    );
    check(
        '  and the victim is told nothing at all',
        H.mesgs.slice(from).filter(m => m.who === victim.username),
        []
    );

    // A usage line rather than a silent no-op, since "::wipebankother" alone is a plausible typo.
    // Both spellings, because they do not arrive the same way: a trailing space splits into one
    // EMPTY argument rather than none, and an args.length check alone answered that with
    // " is not logged in." - found by this sim, fixed in the handler.
    from = H.mesgs.length;
    check('  with no username it says how to type it', [handler.handle(new ClientCheat('wipebankother'), owner), H.mesgs.slice(from).map(m => m.text)], [false, ['Usage: ::wipebankother <username> [confirm]']]);
    from = H.mesgs.length;
    check('  and a trailing space is the same answer, not a lookup for nobody', [wipeother(owner, ''), H.mesgs.slice(from).map(m => m.text)], [false, ['Usage: ::wipebankother <username> [confirm]']]);
    H.despawn(owner, victim);
}

// ====================================================== 10. the right bank, and only that one
console.log("\nWITH IT, THE TARGET'S BANK GOES AND THE TYPIST'S DOES NOT");
{
    const owner = player('wipeowner2', 3222, 3222);
    owner.staffModLevel = 5;
    const victim = player('wipevictim3', 3224, 3222);
    fill(owner);
    fill(victim);

    const from = H.mesgs.length;
    check('  the command is taken', wipeother(owner, `${victim.username} confirm`), true);
    check('  the target has nothing left', banked(victim), 0);
    check('  every tab count of theirs is zero', tabCounts(victim), [0, 0, 0, 0, 0, 0, 0, 0]);
    check('  their viewed tab is back to all items', H.getVar(victim, 'banktab'), 0);
    check('  and the OWNER still has all four of their own', banked(owner), 4);
    check('  with their own filing intact', tabCounts(owner), [2, 0, 0, 0, 0, 0, 0, 0]);
    check(
        '  the owner is told whose bank went and how much',
        H.mesgs
            .slice(from)
            .filter(m => m.who === owner.username)
            .map(m => m.text),
        [`Wiped ${victim.displayName}'s bank: 4 items deleted.`]
    );
    check(
        '  and the player is told, rather than left to file a bug report',
        H.mesgs
            .slice(from)
            .filter(m => m.who === victim.username)
            .map(m => m.text),
        ['Your bank has been emptied by a staff member.']
    );
    H.despawn(owner, victim);
}

// ====================================================== 11. the two names it can be given
console.log('\nA NAME THAT IS NOT ONLINE, AND A BANK THAT IS ALREADY EMPTY');
{
    const owner = player('wipeowner3', 3222, 3222);
    owner.staffModLevel = 5;
    const victim = player('wipevictim4', 3224, 3222);
    bankOf(victim).removeAll();

    let from = H.mesgs.length;
    check('  an offline name is refused by name', [wipeother(owner, 'nosuchguy confirm'), H.mesgs.slice(from).map(m => m.text)], [false, ['nosuchguy is not logged in.']]);

    from = H.mesgs.length;
    check('  an empty bank says so instead of reporting a wipe of nothing', [wipeother(owner, `${victim.username} confirm`), H.mesgs.slice(from).map(m => m.text)], [false, [`${victim.displayName}'s bank is already empty.`]]);
    H.despawn(owner, victim);
}

// ====================================================== 12. their PIN, and their being busy
console.log('\nTHEIR BANK PIN DOES NOT STOP IT; THEIR BEING BUSY DOES');
{
    const owner = player('wipeowner4', 3222, 3222);
    owner.staffModLevel = 5;
    const victim = player('wipevictim5', 3224, 3222);
    fill(victim);
    H.setVar(victim, 'bankpin', 1234);
    H.setVar(victim, 'bankpin_verified', 0);

    // Busy in a way closeModal cannot clear - an open interface is closed by the handler on
    // purpose (case 7), so the blocking case has to be a delay.
    victim.delayed = true;
    victim.delayedUntil = World.currentTick + 5;

    let from = H.mesgs.length;
    check('  a delayed target is refused, rather than the wipe silently not running', [wipeother(owner, `${victim.username} confirm`), banked(victim), H.mesgs.slice(from).map(m => m.text)], [false, 4, [`${victim.username} is busy right now.`]]);

    victim.delayed = false;
    victim.delayedUntil = -1;

    from = H.mesgs.length;
    check('  once they are free it goes through, PIN and all', [wipeother(owner, `${victim.username} confirm`), banked(victim)], [true, 0]);
    check('  their PIN is still set - it was never asked for, not cleared', H.getVar(victim, 'bankpin'), 1234);
    check(
        '  and both of them are told',
        H.mesgs.slice(from).map(m => m.text),
        [`Wiped ${victim.displayName}'s bank: 4 items deleted.`, 'Your bank has been emptied by a staff member.']
    );
    H.despawn(owner, victim);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
