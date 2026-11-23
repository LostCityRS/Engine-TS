// EVERY CHARGED ITEM SPENDS EXACTLY ONE CHARGE PER USE, and nothing skips a link.
//
// Filed as DeathPlateau-Bugs#11: "dueling ring & games of necklace crumbled after only a few
// uses". I could not reproduce it - both items give their full eight - and this is the check that
// makes that answer durable instead of a measurement somebody took once.
//
//   npx tsx tools/sim/jewelcharges.ts
//
// WHAT A CHARGE ACTUALLY IS. There is no charge counter on a player. A charged item is a CHAIN of
// distinct objs joined by param=next_obj_stage, and spending a charge means replacing the item
// with the next link: ring_of_dueling_8 becomes _7, and _1 becomes nothing. So "it crumbled after
// a few uses" has exactly three possible causes, and this file checks all three:
//
//   1. A LINK THAT SKIPS. If _8 pointed at _6, every use would cost two charges. Section 1 walks
//      all 303 next_obj_stage links in the build - potions, kegs, pies, teas, watering cans, the
//      jewellery - and asserts that where the names are numbered, each step goes down by one.
//   2. A SOURCE THAT HANDS OUT A PART-USED ITEM. Section 2 pins what enchanting produces, since
//      a shop or spell giving _1 instead of _8 looks exactly like the reported bug.
//   3. THE SCRIPT SPENDING MORE THAN IT SHOULD. Sections 3 and 4 drive the real teleport until the
//      item is gone and count the uses - once from the inventory (opheld4, "Rub") and once from
//      the worn equipment tab (wearop), because those are two different code paths. The worn one
//      goes through ~worn_replace and is the one a player actually uses; testing only the rub
//      would have left the likely half untested.
//
// THE LOOPS IN SECTION 1 ARE NOT FAULTS. vial_empty -> vial_water -> vial_empty is a vial being
// filled and emptied again, and three other containers do the same. A cycle is only a fault if a
// numbered item is inside it.
import * as H from './harness.js';
import ObjType from '#/cache/config/ObjType.js';
import ParamType from '#/cache/config/ParamType.js';
import InvType from '#/cache/config/InvType.js';
import Component from '#/cache/config/Component.js';
import WearOp from '#/network/game/client/model/WearOp.js';
import WearOpHandler from '#/network/game/client/handler/WearOpHandler.js';
import { check, held, R } from './a1lib.js';

await H.boot();

const NEXT = ParamType.getId('next_obj_stage');
const CHARGES = ParamType.getId('charges');
// A param can hold an id the cache has no row for, so this never assumes ObjType.get returns one.
const name = (id: number): string => {
    const o: any = id >= 0 && id < ObjType.count ? ObjType.get(id) : null;
    return o?.debugname ?? `obj_${id}`;
};

// ---------------------------------------------------------------- 1. the chains
console.log('\n1. EVERY next_obj_stage LINK, AND WHETHER IT STEPS DOWN BY ONE');
const links = new Map<string, string>();
for (let id = 0; id < ObjType.count; id++) {
    const o: any = ObjType.get(id);
    if (!o?.debugname) continue;
    const n = o.params?.get(NEXT);
    if (n === undefined || n === null) continue;
    links.set(o.debugname, name(typeof n === 'number' ? n : Number(n)));
}
check('next_obj_stage links in the build', links.size > 250, true);

// A numbered link must move by exactly ONE, in whichever direction it runs.
//
// next_obj_stage MEANS TWO DIFFERENT THINGS in this build, which is what makes this check less
// obvious than it looks. On jewellery, potions, kegs and watering cans it is "the next one DOWN,
// after a use", so the links descend. On waterskins it is "the next one UP, after a refill" -
// water_sources.rs2 sends skins 3, 2, 1 and 0 through @water_fill and the param is how each one
// becomes fuller. Drinking a waterskin does not use the param at all: desert_heat.rs2 steps it
// down with its own inv_changeslot ladder, 4 to 3 to 2 to 1 to 0.
//
// So the fault to look for is a step of more than one in either direction, not a direction.
const WRAPAROUND = new Set([
    // water_skin4 is full, so the fill ladder stops before it and nothing ever follows this link.
    // It exists only so the top of the ring has a param like every other link. Confirmed by
    // water_sources.rs2, whose case list is 3, 2, 1, 0 - never 4.
    'water_skin4 -> water_skin0'
]);
const numbered = /^(.*?)_?(\d+)$/;
const skipped: string[] = [];
for (const [from, to] of links) {
    const a = numbered.exec(from),
        b = numbered.exec(to);
    if (!a || !b) continue;
    if (a[1] !== b[1]) continue; // different item families - a chain's last link
    if (WRAPAROUND.has(`${from} -> ${to}`)) continue;
    const step = Math.abs(Number(a[2]) - Number(b[2]));
    if (step !== 1) skipped.push(`${from} -> ${to} (moves ${step})`);
}
check('numbered links that move by more than one', skipped, []);

// AND EVERY SPENDING CHAIN MUST RUN OUT. A descending chain that came back round to a number it
// had already been would be infinite - a free teleport, or a potion that never empties.
//
// THE WALK STOPS WHEN THE CHAIN LEAVES THE FAMILY, which is the part worth saying. A potion ends
// at its container: 4dose -> 3 -> 2 -> 1 -> vial_empty, and vial_empty -> vial_water ->
// vial_empty is the vial being filled and emptied for ever, correctly. Following the link out of
// the family reported every potion in the game as an endless loop; the potion has run out by
// then, and what the glass does afterwards is not this check's business.
const endless: string[] = [];
const sameFamilyDown = (from: string): string | null => {
    const to = links.get(from);
    if (!to) return null;
    const a = numbered.exec(from),
        b = numbered.exec(to);
    if (!a || !b || a[1] !== b[1]) return null; // left the family: the chain has ended
    if (Number(b[2]) >= Number(a[2])) return null; // ascending: a refill, not a spend
    return to;
};
for (const from of links.keys()) {
    if (!sameFamilyDown(from)) continue;
    let cur = from;
    const seen = new Set<string>([from]);
    for (let i = 0; i < 40; i++) {
        const nx = sameFamilyDown(cur);
        if (!nx) break; // ran out: correct
        if (seen.has(nx)) {
            endless.push(`${from} spends into a loop at ${nx}`);
            break;
        }
        seen.add(nx);
        cur = nx;
    }
}
check('spending chains that never run out', endless, []);

// ---------------------------------------------------------------- 2. what a fresh one is
console.log('\n2. WHAT A FRESH ONE IS WHEN YOU MAKE IT');
// A part-used item from the source is indistinguishable from a chain that overspends, and it is
// the one explanation for #11 I could not rule out from the content alone - ring_of_dueling_1 IS
// a mummy drop, legitimately.
for (const [stem, charges] of [
    ['ring_of_dueling', 8],
    ['necklace_of_minigames', 8]
] as [string, number][]) {
    const head = `${stem}_${charges}`;
    const bottom = `${stem}_1`;
    // NOTHING POINTS AT THE HEAD. If a source handed out a part-used one, or a link pointed back
    // up into the chain, the item would start below full and look exactly like the reported bug.
    check(`  ${head} is the top of its chain, nothing steps into it`, [...links.values()].includes(head), false);
    check(`  ${head} says it has ${charges} charges`, (ObjType.get(ObjType.getId(head)) as any).params?.get(CHARGES), charges);
    // AND THE BOTTOM CRUMBLES rather than wrapping round to full, which would make it infinite.
    check(`  ${bottom} has no next stage, so it crumbles`, links.has(bottom), false);
}

// ---------------------------------------------------------------- 3 & 4. spend them for real
const p: any = H.makePlayer('jewelcharges', 3360, 3270);
H.tick(2);
H.maxOut(p);
H.clearInv(p);
H.tick(2);
p.closeModal();

function topHeld(stem: string, hi: number): string | null {
    for (let c = hi; c >= 1; c--) if (H.invCount(p, `${stem}_${c}`) > 0) return `${stem}_${c}`;
    return null;
}
function rubUntilGone(stem: string, hi: number, dest: string): number {
    H.clearInv(p);
    H.tick(1);
    H.give(p, `${stem}_${hi}`, 1);
    H.tick(1);
    let uses = 0;
    for (let round = 0; round < hi + 4; round++) {
        const before = topHeld(stem, hi);
        if (!before) break;
        H.clearLogs();
        held(p, before, 4, [dest]);
        for (let k = 0; k < 8; k++) H.tick(1);
        const after = topHeld(stem, hi);
        if (after === before) break; // stuck: counted as a failure by the check below
        uses++;
        if (!after) break;
    }
    return uses;
}

const WORN_COM = Component.getId('wornitems:worn');
const wearHandler = new WearOpHandler();
function wornAt(slot: number): string | null {
    const o = p.getInventory(InvType.WORN)!.get(slot);
    return o ? name(o.id) : null;
}
function wearUntilGone(stem: string, hi: number, slotName: string, slot: number, op: number): number {
    H.clearInv(p);
    H.tick(1);
    H.equip(p, { [slotName]: `${stem}_${hi}` });
    H.tick(2);
    let uses = 0;
    for (let round = 0; round < hi + 4; round++) {
        const before = wornAt(slot);
        if (!before || !before.startsWith(stem)) break;
        H.clearLogs();
        wearHandler.handle(new WearOp(op, ObjType.getId(before), slot, WORN_COM), p);
        for (let k = 0; k < 8; k++) H.tick(1);
        const after = wornAt(slot);
        if (after === before) break;
        uses++;
        if (!after || !after.startsWith(stem)) break;
    }
    return uses;
}

console.log('\n3. RUBBED FROM THE INVENTORY, until it crumbles');
check('ring of dueling: uses from a fresh ring', rubUntilGone('ring_of_dueling', 8, 'Al Kharid Duel Arena'), 8);
check('games necklace: uses from a fresh necklace', rubUntilGone('necklace_of_minigames', 8, 'Barbarian Outpost'), 8);

console.log('\n4. AND FROM THE WORN EQUIPMENT TAB, which is a different code path');
check('ring of dueling on the finger', wearUntilGone('ring_of_dueling', 8, 'ring', 12, 1), 8);
check('games necklace round the neck', wearUntilGone('necklace_of_minigames', 8, 'front', 2, 1), 8);

console.log(`\n${R.ok} ok${R.bad ? `, ${R.bad} FAIL` : ''}`);
if (R.bad) console.log(`FAILED: ${R.bad} of ${R.ok + R.bad}`);
process.exit(R.bad ? 1 : 0);
