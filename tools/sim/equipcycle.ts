// EVERY EQUIPPABLE ITEM, PUT ON AND TAKEN OFF, AND COUNTED - the general form of the one check
// that caught a real duplication.
//
//   npx tsx tools/sim/equipcycle.ts
//   npx tsx tools/sim/equipcycle.ts --cycles 5 --filter ikov
//
// WHY THIS EXISTS. ikovbootsdupe.ts takes ONE pair of boots through twenty on-off cycles and counts
// what comes back, because the Boots of Lightness gave you a second pair every time you took them
// off. That bug was found by the fuzzer's item-conservation watcher, which is to say BY LUCK: the
// bots happened to wear the boots enough times in one audit window for the totals to move. Nothing
// aimed at it.
//
// The header of ikovbootsdupe.ts records four static sweeps for a second instance, all of which came
// back clean, and says why none of them could have worked: the property that mattered was "this proc
// runs more than once for one logical action", which no amount of call-site counting or grepping can
// see. The conclusion there was that the conservation watcher is the general protection. This file
// is that conclusion done deliberately instead of by chance - the same count, over every item that
// can be worn, so the next one of these is found on purpose.
//
// WHAT IS AND IS NOT ASSERTED. The invariant is ONE ITEM IN, ONE ITEM OUT: whatever the player is
// holding, worn and pocketed together, must still be exactly one item after each wear and after each
// remove. Deliberately NOT "the same obj comes back", because a legitimate swap changes the id - the
// boots are two objs for one pair on purpose, since the worn pair weighs -10lb and the pocketed pair
// 12oz and the lava bridge refuses anyone whose weight is not already negative. Counting instead of
// naming is what lets one rule cover both the honest swaps and the dishonest ones.
//
// It catches loss as well as duplication. A remove that deletes the worn item and adds nothing back
// leaves zero, and zero fails the same assertion two counts fails it. Both are item bugs; only the
// sign differs.
//
// THE POPULATION IS READ FROM THE CACHE, NOT COUNTED IN THE CONTENT. A grep for `wearpos` across the
// .obj files answers 3,400, which is wrong three times over: it counts the wearpos2 and wearpos3
// lines of one obj, and the noted twin of every notable item, neither of which a player can wear.
// What the built cache actually holds is 1,519 objs with a wearpos, of which 1,426 carry a Wear,
// Wield or Equip option - 998 Wear, 423 Wield, 5 Equip - and those 1,426 are what this cycles.
//
// The other 93 have somewhere to go and no way to get there: a wearpos and no wear option at all.
// Most look deliberate or vestigial (readbook_dummy, wearable_stool_white, the strung lyres whose
// only option is Play), but ikov_staffofarmardyl, rockpick and throwingrope are quest items, and
// whether any of them is meant to be wearable is a content question rather than something to guess
// here. --unwearable lists them and asserts nothing.
//
// CALIBRATED AGAINST THE BUG IT GENERALISES, which is the only reason to believe it asserts
// anything. A sim that checks nothing and a sim that passes look identical from the outside, so this
// one was run against both sides of the boots fix:
//
//   cache built from content BEFORE the fix   2 FAIL - ikov_bootsoflightness and
//                                             ikov_bootsoflightnessworn, each naming cycle 1 and
//                                             "2 items (inv:ikov_bootsoflightnessx1 x2)"
//   cache built from content AFTER the fix    25 ok, 0 FAIL
//
// It found the historical bug without being told where to look, and went green on the fix. That
// happened by accident the first time - the cache on the box still held pre-fix scripts because the
// pack build is incremental and a 3.1s rebuild had not recompiled them - which is a warning worth
// keeping: TO TRUST A RUN OF THIS, CLEAR THE GENERATED PACKS FIRST, the way deploy.sh and the
// content workflow both do (rm -f pack/script.pack ... && touch pack/interface.pack), or the scripts
// under test may not be the scripts on disk. A full pack is ~20s against ~3s for an incremental one,
// so the timing says which one happened.
//
// WHAT THE FIRST FULL RUN SAID: 1,406 ok, 0 FAIL, 21 untested of 1,427. There is no second
// duplication among the items a player can wear, and that is now a swept result rather than four
// hand searches that happened to come back clean. The 21 untested are items that would not go on at
// all for a maxed player with an empty inventory - bandos_platebody, gilded_dhide_body,
// dragon_sq_shield_g, dragon_scimitar_or, the two dragonfire shields and the like - which is its own
// small question (a wear option that refuses a player with every stat and no requirement left to
// fail) and is left as a question rather than answered here.
//
// UNTESTED IS REPORTED, NOT HIDDEN. An item that will not go on - a requirement maxOut cannot meet,
// a handler that wants a quest varp or a place - is counted as untested and the denominator is
// printed, the way corpses.ts prints "4 ok, 0 FAIL, 3 untested of 7". A probe that quietly skips its
// subject and exits 0 is the trap quest_garden_run fell into, aborting at step 6 while reporting 4
// of 5 passing with 83 checks unrun.
import InvType from '#/cache/config/InvType.js';
import ObjType from '#/cache/config/ObjType.js';

import * as H from './harness.js';

await H.boot();

const args = process.argv.slice(2);
const flagNum = (flag: string, dflt: number): number => {
    const i = args.indexOf(flag);
    if (i === -1) return dflt;
    const v = parseInt(args[i + 1], 10);
    return Number.isFinite(v) ? v : dflt;
};
const flagStr = (flag: string): string | null => {
    const i = args.indexOf(flag);
    return i === -1 ? null : args[i + 1];
};

const CYCLES = flagNum('--cycles', 3);
const FILTER = flagStr('--filter');
const LIMIT = flagNum('--limit', 0);
const LIST_UNWEARABLE = args.includes('--unwearable');

const WEARISH = /^(wear|wield|equip)$/i;

type Player = {
    getInventory(t: number): { capacity: number; get(i: number): { id: number; count: number } | null } | null;
    invDelSlot(inv: number, slot: number): void;
    delayed: boolean;
};

const p = H.makePlayer('equipcycle', 3222, 3218) as unknown as Player;
H.tick(2);
H.maxOut(p as never);

/** Everything the player holds, worn and pocketed together: a total and a readable breakdown. */
function held(): { total: number; sig: string } {
    let total = 0;
    const parts: string[] = [];
    for (const invName of ['inv', 'worn']) {
        const inv = p.getInventory(InvType.getId(invName));
        if (!inv) continue;
        for (let i = 0; i < inv.capacity; i++) {
            const item = inv.get(i);
            if (!item) continue;
            total += item.count;
            parts.push(`${invName}:${ObjType.get(item.id)?.debugname ?? item.id}x${item.count}`);
        }
    }
    return { total, sig: parts.join(' ') };
}

/** Back to holding nothing at all, worn included - clearInv only empties the backpack. */
function stripBare(): void {
    for (const invName of ['inv', 'worn']) {
        const invId = InvType.getId(invName);
        const inv = p.getInventory(invId);
        if (!inv) continue;
        for (let i = 0; i < inv.capacity; i++) {
            if (inv.get(i)) p.invDelSlot(invId, i);
        }
    }
}

/** The first occupied slot of the worn tab, or -1: where Remove has to be clicked. */
function firstWornSlot(): number {
    const worn = p.getInventory(InvType.getId('worn'));
    if (!worn) return -1;
    for (let i = 0; i < worn.capacity; i++) {
        if (worn.get(i)) return i;
    }
    return -1;
}

type Candidate = { id: number; name: string; op: number };
const candidates: Candidate[] = [];
const unwearable: string[] = [];

for (let id = 0; id < ObjType.count; id++) {
    const o = ObjType.get(id);
    if (!o || o.wearpos < 0) continue;
    if (o.certlink !== -1) continue; // the noted twin of a notable item: not a thing anyone wears
    if (!o.debugname) continue;
    let op = -1;
    for (let i = 0; i < 5; i++) {
        const label = o.iop[i];
        if (label && WEARISH.test(label)) {
            op = i + 1;
            break;
        }
    }
    if (op === -1) {
        unwearable.push(`${o.debugname} wearpos=${o.wearpos} iop=${JSON.stringify(o.iop)}`);
        continue;
    }
    if (FILTER && !o.debugname.includes(FILTER)) continue;
    candidates.push({ id, name: o.debugname, op });
}

if (LIST_UNWEARABLE) {
    console.log(`-- ${unwearable.length} objs have a wearpos and no Wear, Wield or Equip option`);
    console.log('   (a content question, not a verdict: this section asserts nothing)');
    for (const u of unwearable) console.log('   ' + u);
    console.log('');
}

const work = LIMIT > 0 ? candidates.slice(0, LIMIT) : candidates;

let ok = 0;
let bad = 0;
const untested: string[] = [];
const failures: string[] = [];

console.log(`-- ${work.length} wearable objs, ${CYCLES} wear-and-remove cycles each, counting after every step`);
console.log('');

for (const c of work) {
    stripBare();
    H.tick(1);
    H.give(p as never, c.name, 1);
    H.tick(1);

    const start = held();
    if (start.total !== 1) {
        untested.push(`${c.name} - could not be given cleanly (holding ${start.sig || 'nothing'})`);
        continue;
    }

    let wentOn = false;
    let firstWrong = '';

    for (let cycle = 1; cycle <= CYCLES; cycle++) {
        // ON - the click a player makes in the backpack, through the obj's own Wear/Wield iop.
        try {
            H.opheld(p as never, c.name, c.op);
        } catch (e) {
            if (cycle === 1) untested.push(`${c.name} - iop${c.op} ${(e as Error).message}`);
            break;
        }
        H.tick(2);

        const afterOn = held();
        if (afterOn.total !== 1 && !firstWrong) {
            firstWrong = `cycle ${cycle} after wearing: ${afterOn.total} items (${afterOn.sig})`;
        }

        const wornSlot = firstWornSlot();
        if (wornSlot === -1) {
            if (cycle === 1) untested.push(`${c.name} - would not go on (holding ${afterOn.sig})`);
            break;
        }
        wentOn = true;

        // OFF - Remove on the worn tab, which is the worn component's own op1.
        try {
            H.invButton(p as never, 'wornitems:worn', 1, wornSlot);
        } catch (e) {
            untested.push(`${c.name} - Remove failed: ${(e as Error).message}`);
            break;
        }
        H.tick(2);

        const afterOff = held();
        if (afterOff.total !== 1 && !firstWrong) {
            firstWrong = `cycle ${cycle} after removing: ${afterOff.total} items (${afterOff.sig})`;
        }
    }

    if (!wentOn) continue;

    const end = held();
    if (end.total === 1 && !firstWrong) {
        ok++;
    } else {
        bad++;
        const detail = firstWrong || `ended holding ${end.total} (${end.sig})`;
        failures.push(`${c.name} (iop${c.op}) - ${detail}`);
        console.log(`  FAIL ${c.name} - ${detail}`);
    }
}

console.log('');
if (failures.length) {
    console.log('-- items whose count did not come back the same');
    for (const f of failures) console.log('   ' + f);
    console.log('');
}
if (untested.length) {
    console.log(`-- ${untested.length} never got as far as a cycle, so they are untested rather than passing`);
    for (const u of untested.slice(0, 40)) console.log('   ' + u);
    if (untested.length > 40) console.log(`   ... and ${untested.length - 40} more`);
    console.log('');
}

console.log(`${ok} ok, ${bad} FAIL, ${untested.length} untested of ${work.length} wearable objs`);
process.exit(bad ? 1 : 0);
