// THE VOTE MODEL AND THE VOTE SHOP, plus a regression pass over the shops that already existed.
//
//   npx tsx tools/sim/voteshop.ts
//
// TWO THINGS ARE BEING TESTED AND THE SECOND ONE IS THE RISKY ONE.
//
// The first is new: a vote ticket is a tradeable item, redeeming one turns it into a bound vote
// point, and the Vote clerk at the Edgeville bank sells Explorer's ring 4 for points.
//
// The second is that the 42 shops that already existed still work. Paying for something out of a
// varp instead of out of the inventory meant four lines in shop.rs2 stopped reading %shop_currency
// directly and started going through ~shop_wallet_*, and that file is the till for every shop in
// the game. So a coin shop and an obj-currency shop (Grace, who takes Marks of Grace) are driven
// here too - buy, sell, not-enough, no-space - and if the abstraction got any of it wrong this
// fails rather than a player finding out.
//
// THE BUG THIS WAS WRITTEN FOR, before it could happen: ~buy_item lets a purchase through with a
// full inventory when the price comes to exactly what you are carrying, because the coin stack is
// about to empty and free its slot. A varp balance frees nothing, so that exemption had to be made
// wallet-specific - otherwise a player with exactly the price in points and 28 full slots buys a ring with
// nowhere to put it.
import * as H from './harness.js';
import { drive } from './a1lib.js';
import Component from '#/cache/config/Component.js';
import InvType from '#/cache/config/InvType.js';
import NpcType from '#/cache/config/NpcType.js';
import ObjType from '#/cache/config/ObjType.js';
import ParamType from '#/cache/config/ParamType.js';
import Player from '#/engine/entity/Player.js';
import Npc from '#/engine/entity/Npc.js';
import ScriptState from '#/engine/script/ScriptState.js';
import InvButton from '#/network/game/client/model/InvButton.js';
import InvButtonHandler from '#/network/game/client/handler/InvButtonHandler.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import { ProtectedActivePlayer } from '#/engine/script/ScriptPointer.js';
import World from '#/engine/World.js';
import { CoordGrid } from '#/engine/CoordGrid.js';
import { isFlagged, isZoneAllocated } from '#/engine/GameMap.js';
import { CollisionFlag } from '#/engine/routefinder/index.js';
import Environment from '#/util/Environment.js';
import fs from 'fs';

await H.boot();
H.loginOrder();

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

const CLERK: [number, number] = [3091, 3492];
// READ OFF THE OBJ, not repeated here. The price is ^vote_price_explorers_ring written into
// explorers_ring_4's cost= (general/configs/diary_rewards.obj), and a copy of the number in the sim
// is a copy that goes stale: this was 50 and the shop's price moved to 200 without it. Everything
// below is arithmetic on the price, so reading it keeps the sim honest at any price.
const RING_PRICE = ObjType.get(ObjType.getId('explorers_ring_4')).cost;
const invButtonHandler = new InvButtonHandler();

let bucket = 1;
function player(name: string, x = 3094, z = 3495): Player {
    const p = H.makePlayer(name, x, z, bucket++);
    H.tick(2);
    H.maxOut(p);
    H.clearInv(p);
    H.setVar(p, 'vote_points', 0);
    return p;
}
const settle = (q: Player, n = 15) => {
    for (let t = 0; t < n; t++) {
        if (!q.delayed && !q.activeScript) return;
        H.tick(1);
    }
};
const mesFor = (q: Player) => H.mesgs.filter(m => m.who === q.username).map(m => m.text);
const said = (q: Player, fragment: string) => mesFor(q).some(t => t.includes(fragment));
const points = (q: Player) => H.getVar(q, 'vote_points');
const count = (q: Player, objName: string) => H.invCount(q, objName);

/** H.runProc runs a proc UNPROTECTED, and ~vote_grant_tickets writes %vote_tickets_pending, which
 * the engine refuses without protected access. In the game it is only ever reached from a click
 * handler that already holds it; this is that, for a direct call. */
function runProtected(q: Player, name: string, args: unknown[] = []): void {
    const script = ScriptProvider.getByName(name);
    if (!script) throw new Error('no such script: ' + name);
    const was = q.protect;
    q.protect = true;
    const state = ScriptRunner.init(script, q, null, args as never[]);
    for (const ptr of ProtectedActivePlayer) state.pointerAdd(ptr);
    ScriptRunner.execute(state);
    q.protect = was;
}

/** Answer a p_choice menu with its option `pick` (1-based). */
function pickMenu(q: Player, pick: number): boolean {
    for (let t = 0; t < 6; t++) {
        const s = q.activeScript;
        if (s && s.execution === ScriptState.PAUSEBUTTON) {
            const names = q.resumeButtons.map((id: number) => Component.get(id).comName ?? '');
            const open = q.modalChat === -1 ? '' : (Component.get(q.modalChat).comName ?? '');
            const iface = names.find((n: string) => n.startsWith(open + ':'))?.split(':')[0];
            return iface ? H.choose(q, `${iface}:com_${pick}`) : false;
        }
        H.tick(1);
    }
    return false;
}
/** Answer a p_countdialog with `n`, exactly as ResumePCountDialogHandler does. */
function answerCount(q: Player, n: number): boolean {
    for (let t = 0; t < 6; t++) {
        const s = q.activeScript;
        if (s && s.execution === ScriptState.COUNTDIALOG) {
            s.lastInt = n;
            q.executeScript(s, true, true);
            return true;
        }
        H.tick(1);
    }
    return false;
}

/** The option text the server last wrote into the open chat menu, option 1 first. */
function chatOptions(q: Player): string[] {
    const open = q.modalChat === -1 ? '' : (Component.get(q.modalChat).comName ?? '');
    const iface = open.split(':')[0];
    const out: string[] = [];
    for (const e of H.ifaces) {
        if (e.kind !== 'text' || e.who !== q.username) continue;
        const m = new RegExp(`^${iface}:com_(\\d+)$`).exec(Component.get(e.com)?.comName ?? '');
        if (m && +m[1] >= 1) out[+m[1] - 1] = e.text ?? '';
    }
    return out.filter(t => t !== undefined && t !== '');
}

/** What a client sends when you click option `op` on slot `slot` of an interface's inv strip. */
function invButton(q: Player, comName: string, slot: number, op = 1): boolean {
    const com = Component.getId(comName);
    const listener = q.invListeners.find(l => l.com === com);
    const obj = listener ? (q.getInventoryFromListener(listener)?.get(slot)?.id ?? -1) : -1;
    return invButtonHandler.handle(new InvButton(op, obj, slot, com), q);
}
/** Walk to a shopkeeper and click Trade; true once the shop interface is open. */
function openShop(q: Player, npc: Npc): boolean {
    H.opNpc(q, npc, 3);
    for (let t = 0; t < 25; t++) {
        H.tick(1);
        if (q.modalMain === Component.getId('shop_template')) return true;
    }
    return false;
}
// ============================================================ 0. the spawn facing
// FIRST, BEFORE ANYTHING HAPPENS TO ANYBODY. An npc faces whoever last interacted with it, so a
// resting facing can only be asked of a world nothing has been done in yet - ask it after the
// dialogue tests below and you measure the last player who said hello.
console.log('== the Vote clerk faces east, and only he does');
{
    H.tick(2); // ai_spawn runs on an npc's first turn
    const [x, z] = CLERK;
    const npc = H.npcNear('vote_clerk', x, z);
    const t = NpcType.get(NpcType.getId('vote_clerk'));
    check('param=spawn_face is east', t.params.get(ParamType.getId('spawn_face')), 1);
    // faceAngleX/Z are what a client is told when it first sees him (World.processInfo), in fine
    // coords - two per tile, plus the npc's size.
    check('and he is looking at the tile to his east', [npc?.faceAngleX, npc?.faceAngleZ], [CoordGrid.fine(x + 1, 1), CoordGrid.fine(z, 1)]);
    // AND IT IS OPT-IN: an npc that asks for no facing is left exactly as it was, which is south.
    // Not the -1 the field starts at - PathingEntity.unfocus writes the tile one step SOUTH of the
    // npc, and that is what every npc in the game has always carried. So the banker four tiles away
    // proves two things at once: [ai_spawn,_] gaining a line changed nothing for the other 16,000
    // npcs, and east really is a different direction from the default rather than a no-op that
    // happened to pass.
    const banker = H.npcNear('banker1', 3096, 3489)!;
    check('a banker four tiles away still faces south', [banker.faceAngleX, banker.faceAngleZ], [CoordGrid.fine(banker.x, 1), CoordGrid.fine(banker.z - 1, 1)]);
}

// ============================================================ 1. the ticket
console.log('== the vote ticket');
{
    const t = ObjType.get(ObjType.getId('vote_ticket'));
    check('stackable', t.stackable, true);
    check('tradeable', t.tradeable, true);
    check('cost is 0, so a faucet is worth nothing even if the param is lost', t.cost, 0);
    check('iop1', t.iop[0], 'Redeem');
    const param = ParamType.getId('shop_will_not_buy');
    check('shop_will_not_buy is set', t.params.get(param), 1);
}

console.log('== redeeming');
{
    // One ticket needs no question: it cannot be a mistake.
    const p = player('redeem1');
    H.give(p, 'vote_ticket', 1);
    H.clearLogs();
    H.opheld(p, 'vote_ticket', 1);
    settle(p);
    check('one ticket redeems with no menu', [count(p, 'vote_ticket'), points(p)], [0, 1]);
    check('and says so', said(p, 'You redeem a vote ticket.'), true);
    check('and reads back the balance', said(p, '1 vote point.'), true);
}
{
    const p = player('redeemsome');
    H.give(p, 'vote_ticket', 40);
    H.clearLogs();
    H.opheld(p, 'vote_ticket', 1);
    H.tick(1);
    check('a stack asks first, and names the number', chatOptions(p), ['Redeem one ticket.', 'Redeem all 40 tickets.', 'Redeem X.', 'Cancel.']);
    pickMenu(p, 1);
    settle(p);
    check('"one" takes one', [count(p, 'vote_ticket'), points(p)], [39, 1]);

    H.clearLogs();
    H.opheld(p, 'vote_ticket', 1);
    pickMenu(p, 4);
    settle(p);
    check('"cancel" takes none', [count(p, 'vote_ticket'), points(p)], [39, 1]);
    check('and says so', said(p, 'You decide to keep your tickets.'), true);

    H.clearLogs();
    H.opheld(p, 'vote_ticket', 1);
    pickMenu(p, 2);
    settle(p);
    check('"all" takes the lot', [count(p, 'vote_ticket'), points(p)], [0, 40]);
    check('and reads back the balance', said(p, '40 vote points.'), true);
}
console.log('== Redeem X');
{
    // The chatbox amount prompt, driven the way ResumePCountDialogHandler drives it.
    const p = player('redeemx');
    H.give(p, 'vote_ticket', 40);
    H.clearLogs();
    H.opheld(p, 'vote_ticket', 1);
    H.tick(1);
    check('the menu offers four options now', chatOptions(p), ['Redeem one ticket.', 'Redeem all 40 tickets.', 'Redeem X.', 'Cancel.']);
    pickMenu(p, 3);
    check('and asks for a number', answerCount(p, 12), true);
    settle(p);
    check('twelve of forty', [count(p, 'vote_ticket'), points(p)], [28, 12]);

    // Nothing, which is how a player backs out of the prompt.
    H.clearLogs();
    H.opheld(p, 'vote_ticket', 1);
    pickMenu(p, 3);
    answerCount(p, 0);
    settle(p);
    check('zero takes none', [count(p, 'vote_ticket'), points(p)], [28, 12]);
    check('and says so', said(p, 'You decide to keep your tickets.'), true);

    // MORE THAN YOU HOLD IS A REQUEST, NOT A PROMISE. Clamped to the pack, as the bank does.
    H.clearLogs();
    H.opheld(p, 'vote_ticket', 1);
    pickMenu(p, 3);
    answerCount(p, 999);
    settle(p);
    check('999 takes the 28 that are there', [count(p, 'vote_ticket'), points(p)], [0, 40]);

    // THE PROMPT IS A SECOND SUSPEND, and a longer one than a menu click - the player is typing. A
    // figure typed about a stack that has since been banked must not pay out.
    const q = player('rugx');
    H.give(q, 'vote_ticket', 10);
    H.clearLogs();
    H.opheld(q, 'vote_ticket', 1);
    pickMenu(q, 3);
    q.invDel(InvType.INV, ObjType.getId('vote_ticket'), 10);
    answerCount(q, 10);
    settle(q);
    check('an emptied pack pays nothing', [count(q, 'vote_ticket'), points(q)], [0, 0]);
    check('and says why', said(q, "You don't have any vote tickets."), true);
}
{
    // THE MENU SUSPENDS THE SCRIPT, so the stack it asked about is not necessarily the stack it
    // acts on. Redeem-all re-reads it; if it trusted the number from before the pause, a player who
    // banked their tickets mid-menu would be paid for tickets they no longer had.
    const p = player('rug');
    H.give(p, 'vote_ticket', 10);
    H.opheld(p, 'vote_ticket', 1);
    H.tick(1);
    p.invDel(InvType.INV, ObjType.getId('vote_ticket'), 7);
    pickMenu(p, 2);
    settle(p);
    check('redeem-all pays for the tickets actually held', [count(p, 'vote_ticket'), points(p)], [0, 3]);
}

console.log('== being given tickets (the seam vote redeeming will call)');
{
    // ~vote_grant_tickets must not be able to come back short. A vote is credited from outside the
    // game, so the one thing it cannot do is depend on the player having a free slot.
    const p = player('granted');
    runProtected(p, '[proc,vote_grant_tickets]', [3]);
    check('with room: straight into the pack', [count(p, 'vote_ticket'), H.getVar(p, 'vote_tickets_pending')], [3, 0]);

    // A full pack that already holds tickets still takes more, because they stack.
    H.fillInv(p);
    check('the pack is full', p.getInventory(InvType.INV)!.freeSlotCount, 0);
    runProtected(p, '[proc,vote_grant_tickets]', [5]);
    check('full pack, tickets already in it: stacks on', [count(p, 'vote_ticket'), H.getVar(p, 'vote_tickets_pending')], [8, 0]);

    // A full pack with no ticket stack to join: held, not lost.
    const q = player('nopocket');
    H.fillInv(q);
    runProtected(q, '[proc,vote_grant_tickets]', [4]);
    check('full pack, no stack to join: held for later', [count(q, 'vote_ticket'), H.getVar(q, 'vote_tickets_pending')], [0, 4]);
    check('and told where they are', said(q, 'Vote clerk at the Edgeville bank is holding them'), true);

    // ...and the clerk hands them over. Room first, then the collection.
    H.clearInv(q);
    const npc = H.npcNear('vote_clerk', CLERK[0], CLERK[1])!;
    H.opNpc(q, npc, 1);
    const lines = drive(q, ['Maybe later']);
    check('the clerk hands over what he was holding', [count(q, 'vote_ticket'), H.getVar(q, 'vote_tickets_pending')], [4, 0]);
    check(
        'and says so',
        lines.some(l => l.includes('holding 4 vote tickets for you')),
        true
    );

    // A player who comes back with a full pack keeps the credit rather than losing it.
    runProtected(q, '[proc,vote_grant_tickets]', [2]);
    check('credited again while full is not possible here (they stack)', H.getVar(q, 'vote_tickets_pending'), 0);
    const r = player('stillfull');
    runProtected(r, '[proc,vote_grant_tickets]', [1]);
    H.clearInv(r);
    H.fillInv(r);
    runProtected(r, '[proc,vote_grant_tickets]', [6]);
    check('held while full', H.getVar(r, 'vote_tickets_pending'), 6);
    H.opNpc(r, npc, 1);
    drive(r, ['Maybe later']);
    check('and still held after a visit with no room', H.getVar(r, 'vote_tickets_pending'), 6);
    check('and the clerk says why', H.invCount(r, 'vote_ticket'), 0);
}

// ============================================================ 2. the clerk
console.log('== the Vote clerk');
{
    const [x, z] = CLERK;
    check('his tile is allocated and standable', isZoneAllocated(0, x, z) && !isFlagged(x, z, 0, CollisionFlag.WALK_BLOCKED), true);
    const npc = H.npcNear('vote_clerk', x, z);
    check('he is spawned where the map says', npc ? `${npc.x},${npc.z}` : 'nowhere', `${x},${z}`);
    const t = NpcType.get(NpcType.getId('vote_clerk'));
    check('he does not wander', t.wanderrange, 0);
    check('op3 is Trade', t.op?.[2] ?? null, 'Trade');
}
{
    // drive() clicks through the "click here to continue" pages a ~chatnpc puts up - those carry no
    // resume BUTTON, so a loop waiting for one waits forever - and answers the menu by option text.
    const p = player('talker');
    const npc = H.npcNear('vote_clerk', CLERK[0], CLERK[1])!;
    H.opNpc(p, npc, 1);
    const lines = drive(p, ['Maybe later']);
    check(
        'with no points he says so',
        lines.some(l => l.includes('You have no vote points')),
        true
    );

    H.setVar(p, 'vote_points', 7);
    H.opNpc(p, npc, 1);
    const lines2 = drive(p, ["Let's see the rewards"]);
    check(
        'with points he reads the balance',
        lines2.some(l => l.includes('7 vote points to spend')),
        true
    );
    check('and "see the rewards" opens the shop', p.modalMain, Component.getId('shop_template'));
}

// ============================================================ 3. buying the ring
console.log('== vote points on the Player Statistics tab');
{
    // A vote point is a varp, so there is no stack in the inventory to look at and a player who has
    // spent every ticket has nothing left to click. The quest tab's Player Statistics page is where
    // it can always be read.
    const p = player('statstab');
    H.setVar(p, 'vote_points', 1234);
    const com = Component.getId('questtab_pstats:votepoints');
    check('the row exists on the page', com !== -1, true);
    check('and has a label beside it', Component.getId('questtab_pstats:votepoints_label') !== -1, true);
    H.clearLogs();
    runProtected(p, '[proc,questtab_select]', [3]); // ^questtab_pstats
    H.tick(1);
    const written = H.ifaces.filter(e => e.kind === 'text' && e.who === p.username && e.com === com).map(e => e.text ?? '');
    check(
        'opening the page writes the balance',
        written.some(t => t.includes('1,234')),
        true
    );

    // ...and it tracks the varp rather than being written once.
    H.setVar(p, 'vote_points', 0);
    H.clearLogs();
    runProtected(p, '[proc,questtab_select]', [3]);
    H.tick(1);
    const again = H.ifaces.filter(e => e.kind === 'text' && e.who === p.username && e.com === com).map(e => e.text ?? '');
    check(
        'and re-reads it on the next open',
        again.some(t => t.includes('0')),
        true
    );

    // FIFTEEN ROWS NOW, and the page is 211px inside (BODY_TOP 46 .. BODY_BOTTOM 257) - so the
    // pitch had to come down from 15 to 14 to fit the new one. Read off the generated interface,
    // because Component carries no x/y: the client takes a child's position from its parent's list.
    // If a sixteenth row is ever wanted, this is the check that says it does not fit.
    const iff = fs.readFileSync(`${Environment.BUILD_SRC_DIR}/scripts/questtab/interfaces/questtab_pstats.if`, 'ascii');
    const rowGeom = (name: string): [number, number] => {
        const block = new RegExp(`\\[${name}\\]([^[]*)`).exec(iff)?.[1] ?? '';
        return [Number(/^y=(\d+)$/m.exec(block)?.[1]), Number(/^height=(\d+)$/m.exec(block)?.[1])];
    };
    const [firstY] = rowGeom('mode_label');
    const [lastY, lastH] = rowGeom('bank');
    check('the first row starts just inside the box', firstY, 47);
    check('and the fifteenth ends on its bottom edge', lastY + lastH, 257);
    check('vote points sits between Slayer points and Bank value', [rowGeom('slpoints')[0], rowGeom('votepoints')[0], lastY], [215, 229, 243]);
}

console.log('== the shop');
{
    const npc = H.npcNear('vote_clerk', CLERK[0], CLERK[1])!;
    const p = player('buyer');
    check('the shop opens on Trade', openShop(p, npc), true);
    H.clearLogs();
    invButton(p, 'shop_template:inv', 0, 1);
    H.tick(1);
    check('the price is quoted in vote points', said(p, `currently costs ${RING_PRICE} vote points.`), true);

    // Nothing at all.
    H.clearLogs();
    invButton(p, 'shop_template:inv', 0, 2);
    settle(p);
    check('with no points: refused', [count(p, 'explorers_ring_4'), points(p)], [0, 0]);
    check('and told which currency', said(p, "You don't have enough vote points."), true);

    // One short.
    H.setVar(p, 'vote_points', RING_PRICE - 1);
    H.clearLogs();
    invButton(p, 'shop_template:inv', 0, 2);
    settle(p);
    check('one point short: refused', [count(p, 'explorers_ring_4'), points(p)], [0, RING_PRICE - 1]);

    // Exactly enough.
    H.setVar(p, 'vote_points', RING_PRICE);
    H.clearLogs();
    invButton(p, 'shop_template:inv', 0, 2);
    settle(p);
    check('exactly enough: bought, and the points are gone', [count(p, 'explorers_ring_4'), points(p)], [1, 0]);
}
console.log('== the shelf cannot run out');
{
    // THE BUG THIS SIM FOUND BY ACCIDENT, when the shop was one ring in one shared slot. A purchase
    // leaves the slot holding the obj at count 0 rather than nulling it, and restocking it hit two
    // faults at once: a stockrate of 0 makes World's `tick % stockrate == 0` a NaN comparison that
    // is never true, and restocking a NON-STACKABLE item called inv.add, which hunts for a null
    // slot and skips that placeholder. So the first buyer took the only ring the world would ever
    // have. Grace's nine recolour kits had both faults too.
    //
    // The engine side is fixed, and the shelf now also carries the Death token shop's idiom - a
    // thousand a row at rate 1, which is how this engine spells "unlimited" - so the limit is the
    // player's points and never a race between two buyers in the same tick.
    const t = InvType.get(InvType.getId('vote_shop'));
    check('every row holds a thousand', Array.from((t as unknown as { stockcount: number[] }).stockcount ?? []).slice(0, 1), [1000]);
    check('and tops itself up every tick', Array.from((t as unknown as { stockrate: number[] }).stockrate ?? []).slice(0, 1), [1]);
    check('and the shelf always stacks, which is what lets it', !!(t as unknown as { stackall: boolean }).stackall, true);

    const shop = World.getInventory(InvType.getId('vote_shop'))!;
    const ring = ObjType.getId('explorers_ring_4');
    const held = shop.getItemCount(ring);
    check('the purchases above came off the shelf', held < 1000, true);
    H.tick(1000 - held + 2);
    check('and it fills back to a thousand', shop.getItemCount(ring), 1000);
}
{
    // THE EXEMPTION THAT HAD TO BE MADE WALLET-SPECIFIC. Exactly the price, and not one free slot.
    // A coin shop lets this through because the coins are about to vacate a slot; a varp balance
    // vacates nothing, so this must refuse AND must not charge.
    const npc = H.npcNear('vote_clerk', CLERK[0], CLERK[1])!;
    const p = player('nospace');
    H.setVar(p, 'vote_points', RING_PRICE);
    H.fillInv(p);
    check('the shop opens', openShop(p, npc), true);
    H.clearLogs();
    invButton(p, 'shop_template:inv', 0, 2);
    settle(p);
    check('full inventory, exact points: refused', count(p, 'explorers_ring_4'), 0);
    check('and NOT charged', points(p), RING_PRICE);
    check('and told why', mesFor(p), ["You don't have enough inventory space."]);
}
{
    // A points shop buys nothing. Not the ring back, not a dagger, not anything.
    const npc = H.npcNear('vote_clerk', CLERK[0], CLERK[1])!;
    const p = player('seller');
    H.give(p, 'bronze_dagger', 1);
    check('the shop opens', openShop(p, npc), true);
    H.clearLogs();
    invButton(p, 'shop_template_side:inv', 0, 2);
    settle(p);
    check('it will not buy a dagger', count(p, 'bronze_dagger'), 1);
    check('and says why', said(p, "This shop only takes vote points. It isn't buying."), true);
    check('and no points were minted', points(p), 0);
}

// ============================================================ 4. no shop will buy a ticket
console.log('== the general store and the vote ticket');
{
    // Five shops in this build are allstock=yes and will buy any tradeable item at cost=. A vote
    // ticket has to be tradeable, so without param=shop_will_not_buy voting would be a gp faucet.
    const store = H.npcNear('generalassistant1', 3212, 3247)!;
    const p = player('faucet', 3212, 3248);
    H.give(p, 'vote_ticket', 5);
    check('the general store opens', openShop(p, store), true);
    H.clearLogs();
    invButton(p, 'shop_template_side:inv', 0, 2);
    settle(p);
    check('it will not buy vote tickets', H.invCount(p, 'vote_ticket'), 5);
    check('and says so', said(p, "You can't sell this item to a shop."), true);
}

// ============================================================ 5. the shops that already existed
console.log('== coin shops still work');
{
    const store = H.npcNear('generalassistant1', 3212, 3247)!;
    const p = player('coins', 3212, 3248);
    check('the general store opens', openShop(p, store), true);
    H.clearLogs();
    invButton(p, 'shop_template:inv', 0, 1);
    H.tick(1);
    check('a price is still quoted in coins', said(p, 'coins.'), true);

    H.clearLogs();
    invButton(p, 'shop_template:inv', 0, 2);
    settle(p);
    check('with no coins: refused', said(p, "You don't have enough coins."), true);

    H.give(p, 'coins', 10000);
    H.clearLogs();
    invButton(p, 'shop_template:inv', 0, 2);
    settle(p);
    check('with coins: something was bought', H.invCount(p, 'coins') < 10000, true);

    // Selling still pays coins out.
    H.clearLogs();
    const coinsBefore = H.invCount(p, 'coins');
    H.give(p, 'bronze_dagger', 1);
    const daggerSlot = (() => {
        const inv = p.getInventory(InvType.INV)!;
        for (let i = 0; i < inv.capacity; i++) if (inv.get(i)?.id === ObjType.getId('bronze_dagger')) return i;
        return -1;
    })();
    invButton(p, 'shop_template_side:inv', daggerSlot, 2);
    settle(p);
    check('selling a dagger pays coins', H.invCount(p, 'coins') > coinsBefore, true);
}
console.log('== Grace still takes Marks of Grace');
{
    // The other wallet that is not coins: an obj currency, on a shop with shop_delta 0 and a
    // per-mille multiplier - the closest existing thing to the vote shop.
    const grace = H.npcNear('grace', 3053, 4969, 1)!;
    const p = player('marks');
    p.teleport(3054, 4969, 1);
    H.tick(2);
    check('Grace is there', grace ? `${grace.x},${grace.z}` : 'nowhere', '3053,4969');
    check('her shop opens', openShop(p, grace), true);
    H.clearLogs();
    invButton(p, 'shop_template:inv', 0, 1);
    H.tick(1);
    check('a kit is priced in marks of grace', said(p, 'mark of grace.'), true);

    H.clearLogs();
    invButton(p, 'shop_template:inv', 0, 2);
    settle(p);
    check('with no marks: refused', said(p, "You don't have enough mark of grace."), true);

    H.give(p, 'mark_of_grace', 50);
    H.clearLogs();
    invButton(p, 'shop_template:inv', 0, 2);
    settle(p);
    check('with 50 marks: a kit, and the marks are gone', [H.invCount(p, 'mark_of_grace'), H.invCount(p, 'graceful_kit_draynor')], [0, 1]);
}

console.log('== restocking puts the item back in its OWN slot');
{
    // The other half of the engine fix, on a shop that has nothing to do with votes. Before it,
    // inv.add restocked a non-stackable item into whatever slot further down the grid happened to
    // be free, so a bought-out general store slowly shuffled its own shelves. generalshop1 has ten
    // stock lines and spare slots, so the old code "worked" here and only drifted - which is why
    // nobody noticed until a one-slot shop made it fatal.
    const t = InvType.getId('generalshop1');
    const it = InvType.get(t);
    const shop = World.getInventory(t)!;
    const id = it.stockobj![0];
    const target = it.stockcount![0];
    shop.remove(id, target, 0);
    check('slot 0 bought out, placeholder left', [shop.get(0)?.id, shop.get(0)?.count], [id, 0]);
    H.tick(it.stockrate![0] * 2 + 2);
    check('it refills slot 0, not some other slot', [shop.get(0)?.id, (shop.get(0)?.count ?? 0) > 0], [id, true]);
    check('and the shop holds no second pile of it', [...Array(shop.capacity).keys()].filter(i => shop.get(i)?.id === id).length, 1);
    // ...and it stops at the stocked amount rather than climbing forever.
    H.tick(it.stockrate![0] * (target + 4));
    check('and tops out at the stocked amount', shop.getItemCount(id), target);
}

// ======================================================================= the seed box (23 November)
//
// THE ONE ROW HERE THAT IS NOT A DIARY REWARD, and it is on the shelf for the same reason they are:
// nothing in the game produced one. Every handler needed to USE a seed box has been in
// storage_items/scripts/storage_items.rs2 since it was imported - Fill, Empty, Check, Open - and no
// source for one existed anywhere (tools/obtainable.py). In Old School it comes from Tithe Farm,
// which this build does not have.
//
// IT GOES LAST ON PURPOSE. Written in the middle of the file, between the ring's purchases and the
// "shelf cannot run out" block, it failed that block: the shelf restocks a row by one every tick,
// so the dozen ticks this block spends buying a box were enough for the ring row to climb back to a
// thousand, and `the purchases above came off the shelf` reads the ring's count. Nothing here is
// wrong with the shop - the check just has to see the shelf before anything else ticks the world.
console.log('== the seed box');
{
    // The price is read off the obj exactly as the ring's is: ^vote_price_seed_box is written into
    // its cost=, and a copy of the number here is a copy that goes stale - which is what happened
    // to the ring when its price moved from 50 to 200.
    const BOX_PRICE = ObjType.get(ObjType.getId('seed_box')).cost;
    const npc = H.npcNear('vote_clerk', CLERK[0], CLERK[1])!;
    const p = player('boxbuyer');
    check('the box is the eleventh row', ObjType.get(World.getInventory(InvType.getId('vote_shop'))!.get(10)!.id).debugname, 'seed_box');
    check('and costs the floor of the band', BOX_PRICE, 40);
    check('which is no dearer than the cheapest diary piece', BOX_PRICE <= ObjType.get(ObjType.getId('kandarin_headgear_4')).cost, true);
    check('the shop opens on Trade', openShop(p, npc), true);
    H.clearLogs();
    invButton(p, 'shop_template:inv', 10, 1);
    H.tick(1);
    check('the price is quoted in vote points', said(p, `currently costs ${BOX_PRICE} vote points.`), true);

    H.setVar(p, 'vote_points', BOX_PRICE - 1);
    H.clearLogs();
    invButton(p, 'shop_template:inv', 10, 2);
    settle(p);
    check('one point short: refused', [count(p, 'seed_box'), points(p)], [0, BOX_PRICE - 1]);

    H.setVar(p, 'vote_points', BOX_PRICE);
    H.clearLogs();
    invButton(p, 'shop_template:inv', 10, 2);
    settle(p);
    check('exactly enough: bought, and the points are gone', [count(p, 'seed_box'), points(p)], [1, 0]);
    // AND IT IS A USABLE ONE: the box that comes off the shelf answers the Fill handler that has
    // been waiting for it, and cannot be sold on to anyone.
    check('the box that arrives is the one with the handlers', ObjType.get(ObjType.getId('seed_box')).iop[0], 'Fill');
    check('and stays on the account that bought it', ObjType.get(ObjType.getId('seed_box')).tradeable, false);
}

console.log('');
console.log(`${R.ok} passed, ${R.bad} failed`);
process.exit(R.bad ? 1 : 0);
