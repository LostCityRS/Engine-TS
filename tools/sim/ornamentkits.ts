// The sixteen ornament kits, applied and taken back off on the real engine.
//
// The pairing lives on the items as params rather than in a table in the script, which is what
// makes a seventeenth kit a config change - and also what makes a wrong pair invisible: a kit that
// names the wrong result builds, packs and only goes wrong in somebody's hands. So this walks the
// configs for every pairing there is and puts each one through the real use-on, then the real
// Revert, and checks it comes back.
//
// TWO SLOTS, because the infinity robes take EITHER colour kit. Reading only the first is how the
// dark kit would go untested and stay a drop with nothing it fits, which is exactly what the first
// version of this file did.
//
//   npx tsx tools/sim/ornamentkits.ts
import * as H from './harness.ts';
import * as A from './a1lib.ts';
import { check, R, player } from './a1lib.ts';
import ObjType from '#/cache/config/ObjType.js';
import ParamType from '#/cache/config/ParamType.js';
import CategoryType from '#/cache/config/CategoryType.js';

await H.boot();

const P = (id: number, p: string) => (ObjType.get(id) as any).params?.get(ParamType.getId(p)) ?? null;
const name = (id: number) => ObjType.get(id).debugname ?? String(id);

const pairs: { base: number; kit: number; into: number }[] = [];
for (let i = 0; i < ObjType.count; i++) {
    if (!ObjType.get(i)) continue;
    // THREE SLOTS: the infinity robes take either colour kit, the rune scimitar takes one per god.
    for (const [k, v] of [
        ['ornament_kit', 'ornament_into'],
        ['ornament_kit2', 'ornament_into2'],
        ['ornament_kit3', 'ornament_into3']
    ]) {
        const kit = P(i, k),
            into = P(i, v);
        if (kit !== null && into !== null) pairs.push({ base: i, kit, into });
    }
}
const kits = new Set(pairs.map(p => p.kit));
console.log(`${pairs.length} pairings across ${kits.size} kits`);
// NO KIT IS A DEAD ITEM. Counted against the cache rather than a number written here, which went
// stale the moment a seventeenth kit was added: every obj in category ornament_kit has to be the
// kit half of some pairing, or it is a reward that drops with nothing it fits.
const ORNAMENT_KIT = CategoryType.getId('ornament_kit');
const declared: number[] = [];
for (let i = 0; i < ObjType.count; i++) if (ObjType.get(i)?.category === ORNAMENT_KIT) declared.push(i);
const dead = declared.filter(i => !kits.has(i)).map(name);
check(`  all ${declared.length} kits are wired to something`, dead.length ? dead.join(' ') : 'yes', 'yes');

let applied = 0,
    reverted = 0;
const broken: string[] = [];
for (const { base, kit, into } of pairs) {
    const p: any = player(`orn${base}_${kit}`, 3200, 3200);
    H.clearInv(p);
    H.give(p, name(base), 1);
    H.give(p, name(kit), 1);

    A.runProcProtected(p, '[proc,ornament_kit_apply]', [kit, base]);
    if (H.invCount(p, name(into)) === 1 && H.invCount(p, name(base)) === 0 && H.invCount(p, name(kit)) === 0) applied++;
    else broken.push(`${name(base)} + ${name(kit)} did not make ${name(into)}`);

    A.runProcProtected(p, '[proc,ornament_kit_revert]', [into]);
    if (H.invCount(p, name(base)) === 1 && H.invCount(p, name(kit)) === 1 && H.invCount(p, name(into)) === 0) reverted++;
    else broken.push(`${name(into)} did not revert to ${name(base)} + ${name(kit)}`);
    H.despawn(p);
}
check(`  all ${pairs.length} take their kit`, applied, pairs.length);
check(`  and all ${pairs.length} give it back`, reverted, pairs.length);
if (broken.length) console.log('  ' + broken.join('\n  '));

// --------------------------------------- EVERY WAY TO ASK, THROUGH THE CLICK AND NOT THE PROC
//
// Everything above calls ~ornament_kit_revert directly, which proves the proc and says nothing
// about whether a player can reach it. The items declare more than one way to ask and they do not
// all agree on the slot, so this reads the slot off the obj rather than assuming one - which is
// ornament_kit.rs2's own rule: "Every Revert trigger in this file sits on the slot its item's own
// iop declares".
//
//   the 24 kit results   iop4=Revert, this repository's, added with param=ornament_from
//                        iop5=Dismantle, which came in with the item from the OSRS import
//   the 2 Gravediggers   iop5=Revert, because a slayer helmet spends its iop4 on Disassemble
//
// ONLY ONE OF THE FIRST PAIR USED TO WORK. iop5=Dismantle had no trigger, so it fell through to
// drop.rs2's [opheld5,_] and put the item on the floor - and every one of these is tradeable=no,
// so that was a way to lose it outright. opsweep listed all 24 under "answered only by the global
// fallback", which is what that section is for.
//
// H.opheld goes through the handler's own validation, so a slot the obj does not declare throws
// here rather than quietly passing, which is the point of driving it this way.
console.log('EVERY SLOT THAT OFFERS TO TAKE THE KIT OFF ACTUALLY DOES');
{
    /** The words this build uses for "take the kit off". Anything else on the item is not this. */
    const TAKES_IT_OFF = /^(revert|dismantle)$/i;
    const results = [...new Set(pairs.map(x => x.into))];
    let asked = 0;
    let ok = 0;
    const bad: string[] = [];
    for (const into of results) {
        const pair = pairs.find(x => x.into === into)!;
        const iop = ObjType.get(into).iop;
        const slots = iop.map((label, i) => [i + 1, label] as const).filter(([, label]) => label && TAKES_IT_OFF.test(label));
        if (!slots.length) {
            bad.push(`${name(into)} offers no Revert or Dismantle at all`);
            continue;
        }
        for (const [slot, label] of slots) {
            asked++;
            const q: any = player(`orn${slot}_${into}`, 3200, 3200);
            H.clearInv(q);
            H.give(q, name(into), 1);
            A.held(q, name(into), slot);
            const back = H.invCount(q, name(pair.base)) === 1 && H.invCount(q, name(pair.kit)) === 1;
            // The backpack being empty is the half that matters: a drop empties it too.
            const gone = H.invCount(q, name(into)) === 0;
            if (back && gone) ok++;
            else bad.push(`${name(into)} "${label}" on iop${slot} did not come apart in the backpack`);
            H.despawn(q);
        }
    }
    check(`  ${asked} options across ${results.length} items, and every one gives both pieces back`, ok, asked);
    if (bad.length) console.log('    ' + bad.join('\n    '));
    // 24 results with two words for it and 2 Gravediggers with one. A result that loses an option
    // would still pass the check above, so the count is asserted too.
    check('  which is two apiece for the kit results and one for the Gravediggers', asked, 24 * 2 + 2);
}

// ---------------------------------------------------------------- a decoration is paint
// Every result must carry its base's bonuses exactly, or a gilded dragon scimitar is a different
// weapon from a dragon scimitar and nobody meant that.
console.log('\nA DECORATION IS PAINT');
const BONUS = ['stabattack', 'slashattack', 'crushattack', 'magicattack', 'rangeattack', 'stabdefence', 'slashdefence', 'crushdefence', 'magicdefence', 'rangedefence', 'strengthbonus', 'prayerbonus'];
let same = 0;
for (const { base, into } of pairs) {
    if (BONUS.every(k => P(base, k) === P(into, k))) same++;
    else console.log(`  ${name(into)} does not match ${name(base)}`);
}
check("  every decorated item has its base item's stats", same, pairs.length);

// ---------------------------------------------------------------- and the wrong kit is refused
console.log('\nTHE WRONG KIT DOES NOTHING');
{
    const base = pairs[0].base;
    const wrongKit = pairs.map(p => p.kit).find(k => k !== pairs[0].kit)!;
    const p: any = player('ornwrong', 3200, 3200);
    H.clearInv(p);
    H.give(p, name(base), 1);
    H.give(p, name(wrongKit), 1);
    A.runProcProtected(p, '[proc,ornament_kit_apply]', [wrongKit, base]);
    check('  nothing is consumed', [H.invCount(p, name(base)), H.invCount(p, name(wrongKit))], [1, 1]);
    check('  and it says so', A.lastMes(p).includes("doesn't fit on that"), true);
    H.despawn(p);
}

// ------------------------------------------------------------ the Gravediggers' OTHER slot
//
// Revert above takes the kit off and leaves a whole slayer helmet. Disassemble takes the HELMET
// apart, and the Gravediggers were the only two slayer helmets where nothing answered it: both
// declare iop4=Disassemble and no [opheld4,...] existed (DeathPlateau-Bugs#27).
//
// WHAT THIS IS REALLY CHECKING IS THAT THE KIT COMES BACK. Wiring it to the plain
// @slayer_helm_split - the obvious one-line copy - would have deleted the helmet, handed over the
// five parts and destroyed the kit without saying so. So the assertion below is the kit, not the
// parts: the parts would pass either way.
console.log('\nAND THE GRAVEDIGGERS COME APART WITHOUT EATING THE KIT');
{
    const PARTS = ['slayer_earmuffs', 'slayer_facemask', 'slayer_nosepeg', 'wallbeast_spike_helmet'];
    for (const [helm, mask] of [
        ['slayer_helm_gravedigger', 'black_mask'],
        ['slayer_helm_gravedigger_i', 'black_mask_i']
    ] as const) {
        const q: any = player(`grave_${helm}`, 3200, 3200);
        H.clearInv(q);
        H.give(q, helm, 1);
        A.held(q, helm, 4);

        check(`  ${helm}: the helmet is gone`, H.invCount(q, helm), 0);
        check('  the kit is handed back', H.invCount(q, 'gravedigger_kit'), 1);
        check(`  the mask is ${mask}`, H.invCount(q, mask), 1);
        for (const part of PARTS) {
            check(`  ...and the ${part}`, H.invCount(q, part), 1);
        }
        H.despawn(q);
    }

    // FIVE FREE, NOT FOUR, and the difference is the kit. @slayer_helm_split asks for four because
    // it hands back five things for one; @slayer_helm_split_coloured asks for five because it hands
    // back six. A gravedigger wired to the four-space path would fit into this inventory and lose
    // the kit on the way, so this is the check that it is on the other one.
    //
    // 23 bones plus the helmet is 24 of the 28 slots, leaving exactly four.
    const q: any = player('gravefull', 3200, 3200);
    H.clearInv(q);
    H.give(q, 'slayer_helm_gravedigger', 1);
    H.give(q, 'bones', 23);
    check('  24 slots used, four free', [H.invCount(q, 'bones'), H.invCount(q, 'slayer_helm_gravedigger')], [23, 1]);
    A.held(q, 'slayer_helm_gravedigger', 4);
    check('  with four free it refuses', H.invCount(q, 'slayer_helm_gravedigger'), 1);
    check('  the kit is not handed out', H.invCount(q, 'gravedigger_kit'), 0);
    check('  and it asks for five', A.lastMes(q).includes('five free inventory spaces'), true);
    H.despawn(q);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
