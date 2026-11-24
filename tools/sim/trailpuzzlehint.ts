// THE PUZZLE BOX'S HINT BUTTON, WHICH HAD NEVER DONE ANYTHING.
//
// com_3 of trail_puzzle is the Hint button and had no [if_button] trigger at all - on the three
// clue boxes or on Monkey Madness's hangar panel, which opens the same interface. Clicking it
// answered "no if_button trigger for trail_puzzle:com_3" (DeathPlateau-Bugs#35).
//
// It now shows the completed picture in the grid itself, because the cache ships no
// solved-picture panel to open. That means a SECOND board - trail_puzzlehint, filled in order and
// never shuffled - transmitted to the same component the live board uses.
//
// WHICH CREATES THE ONE RISK WORTH TESTING. [opheld5,_trail_puzzle_piece] moves pieces by their
// SLOT in trail_puzzleinv, and it has no idea which board is on screen: a click while the answer
// is up would move a piece of the player's board chosen by its position in the solved one. That
// is what section 3 is for, and it is the check to keep if any of these has to go.
//
// Transmits are not observable from here - the harness records no inv_transmit - so this asserts
// the state and the behaviour: what the hint board holds, that the flag toggles, and above all
// that the player's board cannot be moved while the answer is showing.
//
//   npx tsx tools/sim/trailpuzzlehint.ts
import * as H from './harness.ts';
import { check, R, player } from './a1lib.ts';
import InvType from '#/cache/config/InvType.js';
import ObjType from '#/cache/config/ObjType.js';
import VarPlayerType from '#/cache/config/VarPlayerType.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';

await H.boot();

const BOX = 'trail_clue_hard_riddle014_puzzlebox';
const LIVE = InvType.getId('trail_puzzleinv');
const HINT = InvType.getId('trail_puzzlehint');
const FLAG = VarPlayerType.getId('trail_puzzle_hint');

const board = (p: any, inv: number): string[] =>
    Array.from({ length: 25 }, (_, i) => {
        const o = p.invGetSlot(inv, i);
        return o ? (ObjType.get(o.id).debugname ?? String(o.id)) : '-';
    });
const solved = Array.from({ length: 24 }, (_, i) => `trail_slidingpuzzleb${String(i + 1).padStart(2, '0')}`).concat('-');

/**
 * Click a piece on the board. H.opheld cannot do this one: it looks the obj up in the player's
 * MAIN inventory to find a slot, and the puzzle's pieces live in trail_puzzleinv, a dummy inv
 * bound to a component. So the two things the handler reads - last_item and last_slot - are set
 * here and the opheld5 trigger run, which is the one place in this directory that re-implements a
 * handler's lookup on purpose rather than by habit. No closeModal, because clicking a piece in the
 * real client does not shut the window.
 */
function clickPiece(p: any, slot: number): void {
    const o = p.invGetSlot(LIVE, slot);
    if (!o) throw new Error('slot ' + slot + ' is the empty square');
    const obj = ObjType.get(o.id);
    p.lastItem = o.id;
    p.lastSlot = slot;
    const script = ScriptProvider.getByTrigger(ServerTriggerType.OPHELD5, obj.id, obj.category);
    if (!script) throw new Error('no opheld5 trigger for a puzzle piece');
    p.executeScript(ScriptRunner.init(script, p), true);
}

function open(): any {
    const p: any = player('pz' + Math.random().toString(36).slice(2, 7), 3222, 3218, 0);
    H.give(p, BOX, 1);
    H.opheld(p, BOX, 1);
    H.tick(2);
    return p;
}

// ------------------------------------------------------------------ 1. the hint board
console.log('\nTHE HINT BOARD IS THE SOLVED PICTURE');
const p = open();
check('opening the box leaves the hint off', p.getVar(FLAG), 0);
check('  ...and the live board is shuffled, not solved', board(p, LIVE).join() !== solved.join(), true);
H.ifButton(p, 'trail_puzzle:com_3');
H.tick(1);
check('Hint turns on', p.getVar(FLAG), 1);
check('  ...and the hint board is in order, 24 pieces with slot 24 empty', board(p, HINT).join(), solved.join());

// ------------------------------------------------------------------ 2. and it is a toggle
console.log('\nIT TOGGLES, rather than vanishing on a timer');
H.ifButton(p, 'trail_puzzle:com_3');
H.tick(1);
check('a second click turns it off', p.getVar(FLAG), 0);
H.ifButton(p, 'trail_puzzle:com_3');
H.tick(1);
check('  ...and a third turns it back on', p.getVar(FLAG), 1);

// ------------------------------------------------------------------ 3. the board cannot be moved
//
// The whole reason the guard exists. With the answer on screen, clicking a piece must put the
// player's board back and move NOTHING - not move a piece chosen by the wrong board's layout.
console.log('\nA PIECE CLICK WHILE THE ANSWER IS UP MOVES NOTHING');
const before = board(p, LIVE).join();
// any occupied slot: with the answer up, this is a piece the player cannot currently see
clickPiece(
    p,
    board(p, LIVE).findIndex(x => x !== '-')
);
H.tick(2);
check('the live board is untouched', board(p, LIVE).join(), before);
check('  ...and the hint is put away, so the player is not stuck', p.getVar(FLAG), 0);

// AND A PIECE CLICK STILL WORKS NORMALLY once the answer is down - otherwise the guard could be
// refusing every click and this would all still pass.
console.log('\nAND THE PUZZLE STILL PLAYS');
{
    const q = open();
    const start = board(q, LIVE);
    // find a piece adjacent to the empty slot and click it
    const empty = start.indexOf('-');
    const neighbours = [empty - 1, empty + 1, empty - 5, empty + 5].filter(n => n >= 0 && n < 25 && (n % 5 === empty % 5 || Math.floor(n / 5) === Math.floor(empty / 5)));
    const pick = neighbours.find(n => start[n] !== '-')!;
    clickPiece(q, pick);
    H.tick(2);
    const after = board(q, LIVE);
    check('clicking the piece beside the gap moves it', after.join() !== start.join(), true);
    check('  ...into the gap', after[empty], start[pick]);
}

// ------------------------------------------------------------------ 4. reopening is clean
console.log('\nREOPENING NEVER SHOWS THE ANSWER');
{
    const q = open();
    H.ifButton(q, 'trail_puzzle:com_3');
    H.tick(1);
    check('hint on', q.getVar(FLAG), 1);
    H.opheld(q, BOX, 1); // open it again with the hint still up
    H.tick(2);
    check('  ...is cleared by opening the box again', q.getVar(FLAG), 0);
}

console.log(R.bad ? `FAILED: ${R.bad} of ${R.ok + R.bad}` : `${R.ok} ok`);
process.exit(R.bad ? 1 : 0);
