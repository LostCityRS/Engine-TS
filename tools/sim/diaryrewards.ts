// THE ELITE ACHIEVEMENT DIARY REWARDS - nine items, thirteen teleports, two passives, and the one
// shop that sells them.
//
//   npx tsx tools/sim/diaryrewards.ts
//
// WHAT IS BEING TESTED AND WHY IT NEEDS A BOOTED WORLD.
//
// The thirteen destinations in content/scripts/general/configs/diary_rewards.constant were picked
// by asking the engine's own collision map which tiles a player can stand on - a question no
// config-side tool can answer, because blocking comes from the map flags AND from every loc
// standing on the tile. So the question is asked again on every run: each arrival has to be
// standable and joined to at least 200 other walkable tiles, and then each item is actually
// clicked and the landing tile compared against the table below. A map import that walls off the
// Ectofuntus fails this file rather than a player finding out.
//
// THE TABLE BELOW IS THE PROMISE, written out independently of the content: the coords are
// compile-time constants in the script (there is no enum to read back, unlike the farm teleport),
// so this file stating them separately is the only thing that can disagree with them.
//
// THE RISKY PARTS, in order of how quietly they could have broken:
//
//   * THE WEAROPS. Eight items carry worn options, and the engine refuses a worn op the obj does
//     not advertise - so a wearop1= missing from the obj, or a [label,wearop1_<obj>] whose name is
//     one character off, is a dead click and nothing says so. Every one is driven through the real
//     WearOpHandler here, with the item in its real worn slot.
//   * FALADOR SHIELD 4's DAILY, which is a count plus the day it belongs to. The interesting cases
//     are not "does it restore prayer" but "does the second one still work", "does the third get
//     refused", "does a click at full prayer cost a charge" (it must not) and "does the count
//     actually reset when the day rolls over" - which is tested by moving the stored day, because
//     waiting until midnight is not a test.
//   * VARROCK ARMOUR 4's 10%, which is a dice roll, so it is measured over 4000 rolls rather than
//     asserted once, and the no-armour case has to come out at exactly zero.
//   * THE SHOP. Nine new rows paid for out of a varp. Each one is bought one point short (refused)
//     and then at the price (bought), because an off-by-one in a price is invisible otherwise.
//
// AND ONE FIX THAT CAME OUT OF WRITING IT: Explorer's ring 4 carried iop1=Wear, imported from the
// OSRS cache, and the only thing in this build that handles a Wear click is [opheld2,_]. The ring
// the vote shop has been selling could not be put on. Wear is iop2 now, on all four rings.
import * as H from './harness.js';
import Component from '#/cache/config/Component.js';
import InvType from '#/cache/config/InvType.js';
import ObjType from '#/cache/config/ObjType.js';
import Player from '#/engine/entity/Player.js';
import Npc from '#/engine/entity/Npc.js';
import WearOp from '#/network/game/client/model/WearOp.js';
import WearOpHandler from '#/network/game/client/handler/WearOpHandler.js';
import InvButton from '#/network/game/client/model/InvButton.js';
import InvButtonHandler from '#/network/game/client/handler/InvButtonHandler.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import { ProtectedActivePlayer } from '#/engine/script/ScriptPointer.js';
import { canTravel, isFlagged, isZoneAllocated } from '#/engine/GameMap.js';
import { CollisionFlag, CollisionType } from '#/engine/routefinder/index.js';
import { PlayerStat } from '#/engine/entity/PlayerStat.js';

await H.boot();
H.loginOrder();

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

const WORN_COM = Component.getId('wornitems:worn');
const wearHandler = new WearOpHandler();
const invButtonHandler = new InvButtonHandler();
const MIN_REACH = 200;
const WILDY_MAX = 30; // ^diary_tele_wildy_max
const CLERK: [number, number] = [3091, 3492];
const EDGEVILLE: [number, number] = [3094, 3495];

/** ^wearpos_* from content/scripts/player/configs/equip.constant. */
const SLOT = { hat: 0, back: 1, front: 2, rhand: 3, torso: 4, lhand: 5, legs: 7, hands: 9, feet: 10, ring: 12 };

/** `reach` is how many walkable tiles the arrival joins. 200 is the floor the measured arrivals
 * were picked to clear; two of Corey's named coords are deliberately smaller and carry their real
 * size, because the guard exists to catch a one-tile island and not to forbid a room. */
type Dest = { name: string; level: number; x: number; z: number; reach?: number };
type Op = { op: number; label: string; dest: Dest };
type Item = { obj: string; slot: number; ops: Op[] };

// ---------------------------------------------------------------- what the content says it does
const D = {
    monastery: { name: 'Ardougne monastery', level: 0, x: 2606, z: 3222 },
    ardfarm: { name: 'Ardougne farm', level: 0, x: 2668, z: 3374 },
    nardah: { name: 'Nardah', level: 0, x: 3427, z: 2914 },
    kalphite: { name: 'Kalphite cave', level: 0, x: 3227, z: 3106 },
    rellekka: { name: 'Rellekka', level: 0, x: 2658, z: 3658 },
    seers: { name: "Seers' Village", level: 0, x: 2726, z: 3488 },
    // THE SLIME CAVERN, not the Ectofuntus above it: a three-tile strip with gloop on both sides
    // and the cavern stairs on the next tile. Collision cannot follow a stair, so the flood fill
    // stops at 3 - which is why the number is written down rather than compared to the floor.
    ecto: { name: 'Ectofuntus slime cavern', level: 0, x: 3683, z: 9888, reach: 3 },
    burgh: { name: 'Burgh de Rott', level: 0, x: 3485, z: 3239 },
    gemmine: { name: 'Shilo gem mine', level: 0, x: 2826, z: 2998 },
    // Duradel's room, which is 37 tiles. Being put down beside him is the point of the option.
    duradel: { name: 'Duradel', level: 1, x: 2869, z: 2980, reach: 37 },
    fountain: { name: 'Fountain of Rune', level: 0, x: 3370, z: 3894 }
} satisfies Record<string, Dest>;

// Price, worn slot, and every option: the held op number, the label the item advertises, and where
// it goes. The worn option that mirrors held op N is always wearop N-2, which is the convention
// the content follows and which this file checks rather than assumes.
const ITEMS: Item[] = [
    {
        obj: 'ardougne_cloak_4',
        slot: SLOT.back,
        ops: [
            { op: 3, label: 'Monastery Teleport', dest: D.monastery },
            { op: 4, label: 'Farm Teleport', dest: D.ardfarm }
        ]
    },
    {
        obj: 'desert_amulet_4',
        slot: SLOT.front,
        ops: [
            { op: 3, label: 'Nardah', dest: D.nardah },
            { op: 4, label: 'Kalphite cave', dest: D.kalphite }
        ]
    },
    { obj: 'fremennik_sea_boots_4', slot: SLOT.feet, ops: [{ op: 3, label: 'Teleport', dest: D.rellekka }] },
    { obj: 'kandarin_headgear_4', slot: SLOT.hat, ops: [{ op: 3, label: 'Teleport', dest: D.seers }] },
    {
        obj: 'karamja_gloves_4',
        slot: SLOT.hands,
        ops: [
            { op: 3, label: 'Gem Mine', dest: D.gemmine },
            { op: 4, label: 'Slayer Master', dest: D.duradel }
        ]
    },
    {
        obj: 'morytania_legs_4',
        slot: SLOT.legs,
        ops: [
            { op: 3, label: 'Ecto Teleport', dest: D.ecto },
            { op: 4, label: 'Burgh Teleport', dest: D.burgh }
        ]
    },
    { obj: 'wilderness_sword_4', slot: SLOT.rhand, ops: [{ op: 3, label: 'Teleport', dest: D.fountain }] }
];
// The two that are not teleports, and the ring that was already wired. All nine are priced and
// sold; only these seven above teleport.
const FALADOR = { obj: 'falador_shield_4', slot: SLOT.lhand };
const VARROCK = { obj: 'varrock_armour_4', slot: SLOT.torso };
// THE NINE THAT ARE SOLD. No prices here: the price of each is one number in
// vote/configs/vote.constant, written into the obj's cost= (general/configs/diary_rewards.obj), and
// a second copy of it in a sim is a copy that goes stale. This file HELD such a copy and it did:
// the Wilderness sword and the Morytania legs swapped prices and the sim failed on its own table
// rather than on anything about the game. What is worth asserting is that every tier-4 item has a
// price at all while its lower tiers have none, and that the shelf's order matches whatever the
// prices currently are - both below, both true at any price.
const PRICED: string[] = [...ITEMS.map(i => i.obj), FALADOR.obj, VARROCK.obj];

let bucket = 1;
function player(name: string, x = EDGEVILLE[0], z = EDGEVILLE[1]): Player {
    const p = H.makePlayer(name, x, z, bucket++);
    H.tick(2);
    H.maxOut(p);
    H.clearInv(p);
    H.setVar(p, 'vote_points', 0);
    return p;
}
/** A teleport is p_delay(2) and then the jump, so a position read too early is the old one. */
function settle(q: Player, n = 20) {
    for (let t = 0; t < n; t++) {
        if (!q.delayed && !q.activeScript) return;
        H.tick(1);
    }
}
const mesFor = (q: Player) => H.mesgs.filter(m => m.who === q.username).map(m => m.text);
const said = (q: Player, fragment: string) => mesFor(q).some(t => t.includes(fragment));
const at = (q: Player) => `${q.level},${q.x},${q.z}`;
const atDest = (d: Dest) => `${d.level},${d.x},${d.z}`;
const wildy = (z: number) => Math.floor((z - 3520) / 8) + 1;

/** What a client sends for worn option `op` on an item sitting in its real worn slot. */
function wearop(q: Player, item: { obj: string; slot: number }, op: number): boolean {
    return wearHandler.handle(new WearOp(op, ObjType.getId(item.obj), item.slot, WORN_COM), q);
}
/** What a client sends when you click option `op` on slot `slot` of an interface's inv strip. */
function invButton(q: Player, comName: string, slot: number, op = 1): boolean {
    const com = Component.getId(comName);
    const listener = q.invListeners.find(l => l.com === com);
    const obj = listener ? (q.getInventoryFromListener(listener)?.get(slot)?.id ?? -1) : -1;
    return invButtonHandler.handle(new InvButton(op, obj, slot, com), q);
}
function openShop(q: Player, npc: Npc): boolean {
    H.opNpc(q, npc, 3);
    for (let t = 0; t < 25; t++) {
        H.tick(1);
        if (q.modalMain === Component.getId('shop_template')) return true;
    }
    return false;
}
/** H.runProc runs a proc unprotected; ~varrock_armour_extra adds to the inventory, which the
 * engine refuses without protected access. In the game it is only ever reached from a click that
 * already holds it. */
function runProtected(q: Player, name: string, args: unknown[] = []): number[] {
    const script = ScriptProvider.getByName(name);
    if (!script) throw new Error('no such script: ' + name);
    const was = q.protect;
    q.protect = true;
    const state = ScriptRunner.init(script, q, null, args as never[]);
    for (const ptr of ProtectedActivePlayer) state.pointerAdd(ptr);
    ScriptRunner.execute(state);
    q.protect = was;
    return (state as unknown as { intStack: number[]; isp: number }).intStack.slice(0, (state as unknown as { isp: number }).isp);
}
function reach(level: number, x: number, z: number, cap = MIN_REACH): number {
    if (!isZoneAllocated(level, x, z) || isFlagged(x, z, level, CollisionFlag.WALK_BLOCKED)) return 0;
    const seen = new Set([`${x},${z}`]);
    const q: [number, number][] = [[x, z]];
    while (q.length && seen.size < cap) {
        const [cx, cz] = q.pop()!;
        for (const [dx, dz] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1]
        ]) {
            const k = `${cx + dx},${cz + dz}`;
            if (!seen.has(k) && canTravel(level, cx, cz, dx, dz, 1, 0, CollisionType.NORMAL)) {
                seen.add(k);
                q.push([cx + dx, cz + dz]);
            }
        }
    }
    return seen.size;
}

// ============================================================ 1. only the elite tier is wired
console.log('== only tier 4 is priced, wired and for sale');
{
    const wrongPrice: string[] = [];
    const tradeable: string[] = [];
    const ring = ObjType.get(ObjType.getId('explorers_ring_4')).cost;
    for (const obj of PRICED) {
        const t = ObjType.get(ObjType.getId(obj));
        // A PRICE AT ALL, and not dearer than the ring. 0 is the real failure - cost= is what the
        // shop charges, so an unpriced tier-4 item is a free one - and the ring is deliberately the
        // dearest thing on the shelf, so anything above it means a number went in the wrong place.
        if (t.cost <= 0 || t.cost > ring) wrongPrice.push(`${obj} costs ${t.cost}, with the ring at ${ring}`);
        if (t.tradeable) tradeable.push(obj);
    }
    console.log(
        '  prices: ' +
            PRICED.map(o => `${o} ${ObjType.get(ObjType.getId(o)).cost}`)
                .sort()
                .join(', ')
    );
    check('every tier-4 item is priced, and none above the ring', wrongPrice, []);
    check('and none of them is tradeable, so a bought one stays bought', tradeable, []);

    // THE LOWER TIERS. Corey: "do only the level 4 items, not their lower tiers." Priced at 0 and
    // carrying no worn option is what "not wired" looks like from here, and a price of 0 is also
    // the thing that would make one free if it ever reached a shelf.
    const lower: string[] = [];
    for (const obj of PRICED) {
        for (const tier of [1, 2, 3]) {
            const name = obj.replace(/_4$/, `_${tier}`);
            const id = ObjType.getId(name);
            if (id === -1) continue;
            const t = ObjType.get(id);
            if (t.cost !== 0) lower.push(`${name} costs ${t.cost}`);
            if (t.wearop.some(w => w)) lower.push(`${name} has a worn option`);
        }
    }
    check('tiers 1-3 are unpriced and unwired', lower, []);

    // The three sets deliberately left out, each for a reason in diary_rewards.constant.
    const excluded = ['western_banner_4', 'rada_blessing_4'].filter(n => ObjType.get(ObjType.getId(n)).cost !== 0);
    check('the banner and the blessing are not for sale', excluded, []);
}

// ============================================================ 2. the options exist on both sides
console.log('== every option the items advertise has a script, and vice versa');
{
    const missingIop: string[] = [];
    const missingWearop: string[] = [];
    const missingScript: string[] = [];
    const all: { obj: string; slot: number; ops: { op: number; label: string }[] }[] = [
        ...ITEMS,
        {
            ...FALADOR,
            ops: [
                { op: 3, label: 'Recharge-prayer' },
                { op: 4, label: 'Check' }
            ]
        }
    ];
    for (const item of all) {
        const t = ObjType.get(ObjType.getId(item.obj));
        for (const { op, label } of item.ops) {
            if (t.iop[op - 1] !== label) missingIop.push(`${item.obj} iop${op} is ${JSON.stringify(t.iop[op - 1])}, not ${JSON.stringify(label)}`);
            if (t.wearop[op - 3] !== label) missingWearop.push(`${item.obj} wearop${op - 2} is ${JSON.stringify(t.wearop[op - 3])}, not ${JSON.stringify(label)}`);
            if (!H.hasScript(`[opheld${op},${item.obj}]`)) missingScript.push(`[opheld${op},${item.obj}]`);
            if (!H.hasScript(`[label,wearop${op - 2}_${item.obj}]`)) missingScript.push(`[label,wearop${op - 2}_${item.obj}]`);
        }
        // Nothing may advertise a worn option it has no script for - that is a dead click.
        for (let i = 0; i < t.wearop.length; i++) {
            if (t.wearop[i] && !H.hasScript(`[label,wearop${i + 1}_${item.obj}]`)) missingScript.push(`[label,wearop${i + 1}_${item.obj}]`);
        }
    }
    check('held options match the labels', missingIop, []);
    check('worn options match them too', missingWearop, []);
    check('and every one has a handler', missingScript, []);

    // Varrock armour has no option at all - it is the only passive-only item of the nine, and a
    // stray op on it would be a dead click.
    const varrock = ObjType.get(ObjType.getId(VARROCK.obj));
    // Drop is ObjType's own default on iop5 and belongs to every item in the game.
    check('Varrock armour advertises nothing but Wear and Drop', [varrock.iop.filter(o => o), varrock.wearop.filter(o => o)], [['Wear', 'Drop'], []]);
}

// ============================================================ 3. the arrivals are real tiles
console.log('== every arrival is standable and part of somewhere');
{
    const island: string[] = [];
    for (const d of Object.values(D)) {
        const want = (d as Dest).reach ?? MIN_REACH;
        // Cap the fill at the number being asserted, so a 37-tile room is measured exactly rather
        // than being asked to prove it is not 200.
        const r = reach(d.level, d.x, d.z, want);
        if (r < want) island.push(`${d.name} (${d.x},${d.z}) reaches only ${r}, not ${want}`);
    }
    check('every destination joins the walkable area it is recorded as joining', island, []);
    // AND THE TWO SMALL ONES ARE EXACTLY THAT SMALL, which is what stops "reach" being a place to
    // hide a bad arrival: if the slime strip ever grows a way out, or Duradel's room is knocked
    // through, this says so rather than passing because the number only has to be met.
    check('the slime strip is three tiles and no more', reach(D.ecto.level, D.ecto.x, D.ecto.z, 50), 3);
    check("and Duradel's room is 37", reach(D.duradel.level, D.duradel.x, D.duradel.z, 200), 37);
    check('and the Fountain of Rune really is deep Wilderness', wildy(D.fountain.z) > WILDY_MAX, true);
}

// ============================================================ 4. the teleports
console.log('== thirteen teleports, held and worn');
{
    const heldWrong: string[] = [];
    const wornWrong: string[] = [];
    const refused: string[] = [];
    for (const item of ITEMS) {
        for (const { op, dest } of item.ops) {
            // held
            const p = player(`held_${item.obj}_${op}`);
            H.give(p, item.obj, 1);
            H.opheld(p, item.obj, op);
            settle(p);
            if (at(p) !== atDest(dest)) heldWrong.push(`${item.obj} op${op} landed at ${at(p)}, not ${atDest(dest)} (${dest.name})`);
            H.despawn(p);

            // worn, through the real handler
            const q = player(`worn_${item.obj}_${op}`);
            H.equip(q, { [Object.keys(SLOT).find(k => SLOT[k as keyof typeof SLOT] === item.slot)!]: item.obj });
            if (!wearop(q, item, op - 2)) refused.push(`${item.obj} wearop${op - 2}`);
            settle(q);
            if (at(q) !== atDest(dest)) wornWrong.push(`${item.obj} wearop${op - 2} landed at ${at(q)}, not ${atDest(dest)} (${dest.name})`);
            H.despawn(q);
        }
    }
    check('every held option lands on its tile', heldWrong, []);
    check('no worn option is refused by the engine', refused, []);
    check('and every worn option lands on the same tile', wornWrong, []);
}

console.log('== the Wilderness ceiling');
{
    // wilderness_zones.dbrow: the main rectangle starts at z 3520 and every 8 tiles is a level, so
    // level = (z - 3520)/8 + 1. 3764 is level 31, 3596 is level 10.
    const DEEP: [number, number] = [3100, 3764];
    const SHALLOW: [number, number] = [3100, 3596];
    const q = player('pker');
    H.give(q, 'morytania_legs_4', 1);
    q.teleport(DEEP[0], DEEP[1], 0);
    H.clearLogs();
    H.opheld(q, 'morytania_legs_4', 3);
    settle(q);
    check(`blocked above level ${WILDY_MAX}`, `${q.x},${q.z}`, `${DEEP[0]},${DEEP[1]}`);
    check('and told why, in the same words a glory uses', said(q, 'mysterious force'), true);
    q.teleport(SHALLOW[0], SHALLOW[1], 0);
    H.clearLogs();
    H.opheld(q, 'morytania_legs_4', 3);
    settle(q);
    check(`works below level ${WILDY_MAX}`, at(q), atDest(D.ecto));

    // THE ONE-WAY DOOR. The ceiling is on where you teleport FROM, so the Wilderness sword will
    // take a player from safety into level 36 and will not bring them back out.
    const s = player('fountain');
    H.give(s, 'wilderness_sword_4', 1);
    H.opheld(s, 'wilderness_sword_4', 3);
    settle(s);
    check('the sword goes in', at(s), atDest(D.fountain));
    H.clearLogs();
    H.opheld(s, 'wilderness_sword_4', 3);
    settle(s);
    check('and will not take you back out from where it put you', at(s), atDest(D.fountain));
    check('for the usual reason', said(s, 'mysterious force'), true);
}

// ============================================================ 5. Falador shield 4
console.log("== Falador shield 4's two recharges a day");
{
    const p = player('prayer');
    H.give(p, FALADOR.obj, 1);
    // Drain the CURRENT level only - setLevel would move the base too, and a shield that refills
    // to 1 of 1 restores nothing.
    const drain = () => {
        p.levels[PlayerStat.PRAYER] = 1;
    };
    const prayer = () => p.levels[PlayerStat.PRAYER];
    const base = p.baseLevels[PlayerStat.PRAYER];

    drain();
    H.clearLogs();
    H.opheld(p, FALADOR.obj, 3);
    settle(p);
    check('the first recharge fills Prayer', prayer(), base);
    check('and says how many are left', said(p, '1 charge left today.'), true);

    drain();
    H.clearLogs();
    H.opheld(p, FALADOR.obj, 3);
    settle(p);
    check('the second one works too', prayer(), base);
    check('and reads zero', said(p, '0 charges left today.'), true);

    drain();
    H.clearLogs();
    H.opheld(p, FALADOR.obj, 3);
    settle(p);
    check('the third is refused', prayer(), 1);
    check('and says when it comes back', [said(p, 'no charges left today'), said(p, 'midnight, UTC')], [true, true]);

    // Check, which is the other reason the shield has two options.
    H.clearLogs();
    H.opheld(p, FALADOR.obj, 4);
    settle(p);
    check('Check agrees', said(p, '0 charges left today.'), true);

    // THE DAY ROLLOVER, tested by moving the stored day rather than by waiting for midnight.
    H.setVar(p, 'falador_shield_day', H.getVar(p, 'falador_shield_day') - 1);
    H.clearLogs();
    H.opheld(p, FALADOR.obj, 4);
    settle(p);
    check("yesterday's count does not carry over", said(p, '2 charges left today.'), true);
    check('and the stored day was brought up to date', H.getVar(p, 'falador_shield_used'), 0);

    // A CLICK AT FULL PRAYER IS FREE, which is Old School's rule and the only sensible one.
    p.levels[PlayerStat.PRAYER] = base;
    H.clearLogs();
    H.opheld(p, FALADOR.obj, 3);
    settle(p);
    check('a click at full Prayer spends nothing', [said(p, 'no need to recharge'), H.getVar(p, 'falador_shield_used')], [true, 0]);

    // And the worn options are the same two labels.
    drain();
    H.equip(p, { lhand: FALADOR.obj });
    H.clearLogs();
    check('the worn Recharge-prayer is accepted', wearop(p, FALADOR, 1), true);
    settle(p);
    check('and restores from the Worn Equipment tab', prayer(), base);
    H.clearLogs();
    check('the worn Check is accepted', wearop(p, FALADOR, 2), true);
    settle(p);
    check('and reports', said(p, '1 charge left today.'), true);
}

// ============================================================ 6. Varrock armour 4
console.log("== Varrock armour 4's second ore");
{
    const ROLLS = 4000;
    const COPPER = 'copper_ore';
    // The proc is handed its experience by the caller (mining.rs2 passes the rock's own), so this
    // number is only a marker: what is being checked is that whatever came in is paid out once per
    // extra ore and never when there is no extra ore.
    const XP = 175;

    const p = player('miner');
    const roll = (): number => {
        H.clearInv(p);
        runProtected(p, '[proc,varrock_armour_extra]', [ObjType.getId(COPPER), XP]);
        return H.invCount(p, COPPER);
    };

    // Without the armour: never, not rarely.
    let got = 0;
    for (let i = 0; i < 500; i++) got += roll();
    check('no armour, no extra ore in 500 rolls', got, 0);

    // THE ARMOUR IN THE BACKPACK IS NOT ARMOUR. This is the one place the diary rewards differ
    // from each other: the teleports work carried, an armour effect does not.
    H.clearInv(p);
    H.give(p, VARROCK.obj, 1);
    got = 0;
    for (let i = 0; i < 500; i++) {
        runProtected(p, '[proc,varrock_armour_extra]', [ObjType.getId(COPPER), XP]);
        got += H.invCount(p, COPPER);
        H.clearInv(p);
        H.give(p, VARROCK.obj, 1);
    }
    check('carried but not worn: still nothing', got, 0);

    // Worn: 10%, measured.
    H.clearInv(p);
    H.equip(p, { torso: VARROCK.obj });
    const xpBefore = p.stats[PlayerStat.MINING];
    let extra = 0;
    for (let i = 0; i < ROLLS; i++) extra += roll();
    const rate = (extra / ROLLS) * 100;
    check(`worn: ${extra} extra ores in ${ROLLS} rolls, which is ${rate.toFixed(1)}%`, rate > 7 && rate < 13, true);
    // Old School pays experience for the second ore as well, and that is what makes the armour a
    // Mining boost rather than a loot boost.
    const xpGained = p.stats[PlayerStat.MINING] - xpBefore;
    check('and every extra ore paid its own experience', xpGained, extra * XP);
    check('and said so', said(p, 'Varrock armour allows you to mine an extra ore'), true);

    // AND THROUGH A REAL ROCK, because the rolls above prove the proc and not the call site. The
    // interesting failure is wiring the call into the wrong branch of mining.rs2, where it would
    // run on a gem roll, or never - and nothing in the proc can tell you that. So: stand in the
    // Al Kharid mine with the armour on and swing at the iron until 150 ores have come out, then
    // count how many of them doubled and check the two messages read in the right order.
    {
        const ROCKS: [string, number, number][] = [
            ['ironrock1', 3287, 3015],
            ['ironrock2', 3285, 3017]
        ];
        const ORES = 150;
        const q = player('e2e', 3286, 3016);
        H.equip(q, { rhand: 'rune_pickaxe', torso: VARROCK.obj });
        H.clearLogs();
        let mined = 0;
        let doubled = 0;
        for (let t = 0; t < 3000 && mined < ORES; t++) {
            if (!q.activeScript && !q.delayed) {
                for (const [name, x, z] of ROCKS) {
                    try {
                        if (H.opLoc(q, x, z, name, 1)) break;
                    } catch {
                        // depleted into its spent variant - try the other rock
                    }
                }
            }
            H.tick(1);
            if (H.invCount(q, 'iron_ore') > 20) H.clearInv(q);
            const m = mesFor(q);
            mined = m.filter(x => x.includes('You manage to mine some')).length;
            doubled = m.filter(x => x.includes('Varrock armour allows you')).length;
        }
        check(`${ORES} ores came out of a real rock`, mined >= ORES, true);
        const rate = (doubled / mined) * 100;
        check(`and ${doubled} of them doubled, which is ${rate.toFixed(1)}%`, doubled > 0 && rate > 3 && rate < 20, true);
        // THE ORDER. The extra ore is announced after the one that earned it, which is why the call
        // sits below the mes() in mining.rs2 rather than beside the xp.
        const m = mesFor(q);
        const outOfOrder = m.map((x, i) => (x.includes('Varrock armour allows you') && !(m[i - 1] ?? '').includes('You manage to mine some') ? i : -1)).filter(i => i >= 0);
        check('and never before it', outOfOrder, []);
        H.despawn(q);
    }

    // A full inventory loses the extra ore rather than the xp-without-ore it would otherwise be.
    H.clearInv(p);
    H.fillInv(p);
    const xpFull = p.stats[PlayerStat.MINING];
    for (let i = 0; i < 200; i++) runProtected(p, '[proc,varrock_armour_extra]', [ObjType.getId(COPPER), XP]);
    check('a full inventory pays no experience either', p.stats[PlayerStat.MINING], xpFull);
}

// ============================================================ 7. Wilderness sword 4
console.log('== the Wilderness sword always cuts a web');
{
    // m47_60, local 22,12: a web in level 42 Wilderness, which is as good a place as any to test
    // one, since nothing about a web cares where it is.
    const WEB: [number, number] = [3030, 3852];
    const attempt = (q: Player): boolean => {
        H.clearLogs();
        H.opLoc(q, WEB[0], WEB[1], 'bigweb_slashable', 1);
        for (let t = 0; t < 15; t++) {
            H.tick(1);
            if (said(q, 'slash the web apart') || said(q, 'fail to cut through it')) break;
        }
        const cut = said(q, 'slash the web apart');
        if (cut) H.tick(102); // loc_change(bigweb_slashed, 100)
        return cut;
    };

    const p = player('webber', WEB[0], WEB[1] - 2);
    check('carrying nothing: not a web cutter', runProtected(p, '[proc,wilderness_sword_carried]'), [0]);
    H.give(p, 'wilderness_sword_4', 1);
    check('carried: yes - Old School says worn OR in the inventory', runProtected(p, '[proc,wilderness_sword_carried]'), [1]);
    H.clearInv(p);
    H.equip(p, { rhand: 'wilderness_sword_4' });
    check('worn: yes', runProtected(p, '[proc,wilderness_sword_carried]'), [1]);

    let cuts = 0;
    for (let i = 0; i < 12; i++) if (attempt(p)) cuts++;
    check('twelve swings with the sword, twelve webs', cuts, 12);

    // And the coin flip is still a coin flip for everybody else. A knife is a web cutter
    // (~can_slash_with names it) and nothing else about it is special.
    const q = player('knifer', WEB[0], WEB[1] - 2);
    H.give(q, 'knife', 1);
    let failed = 0;
    for (let i = 0; i < 15 && failed === 0; i++) if (!attempt(q)) failed++;
    check('without it, a web still refuses sometimes', failed, 1);
}

// ============================================================ 8. the shop
console.log('== the Vote clerk sells all ten, and only sells');
{
    const t = InvType.get(InvType.getId('vote_shop'));
    const stock = (t as unknown as { stockobj: number[]; stockcount: number[]; stockrate: number[] }).stockobj ?? [];
    const names = Array.from(stock)
        .filter(o => o > 0)
        .map(o => ObjType.get(o).debugname ?? '?');
    check('ten rows', names.length, 10);
    // THE RING FIRST, THEN THE NINE - asserted as a set and an order, not as a written-out list.
    // The list was here and it pinned the prices a second time: swapping two of them failed this
    // check while the shelf was in fact correctly sorted.
    check('the ring leads the shelf', names[0], 'explorers_ring_4');
    check('  ...and the nine sold items are each there exactly once', names.slice(1).sort(), [...PRICED].sort());
    // The shelf's order is only readable if it matches the prices, so it is checked against them
    // rather than against a list written out by hand twice.
    const costs = names.slice(1).map(n => ObjType.get(ObjType.getId(n)).cost);
    check(
        'and that order really is descending by price',
        costs,
        [...costs].sort((a, b) => b - a)
    );
    const counts = Array.from((t as unknown as { stockcount: number[] }).stockcount ?? []).slice(0, 10);
    const rates = Array.from((t as unknown as { stockrate: number[] }).stockrate ?? []).slice(0, 10);
    check(
        'every row is unlimited: a thousand at rate 1',
        [new Set(counts), new Set(rates)].map(s => [...s]),
        [[1000], [1]]
    );
    check('and the shelf stacks, which is what lets a thousand rings sit in one slot', !!(t as unknown as { stackall: boolean }).stackall, true);
    check('sixteen slots, so the next reward is a line and not a resize', t.size, 16);
}
{
    const npc = H.npcNear('vote_clerk', CLERK[0], CLERK[1])!;
    const short: string[] = [];
    const bought: string[] = [];
    const leftover: string[] = [];
    const shelf = (InvType.get(InvType.getId('vote_shop')) as unknown as { stockobj: number[] }).stockobj;
    for (let row = 1; row <= PRICED.length; row++) {
        const obj = ObjType.get(shelf[row]).debugname ?? '?';
        const want = ObjType.get(ObjType.getId(obj)).cost;
        const p = player(`buy_${obj}`);
        if (!openShop(p, npc)) throw new Error('the shop did not open');

        H.setVar(p, 'vote_points', want - 1);
        invButton(p, 'shop_template:inv', row, 2);
        settle(p);
        if (H.invCount(p, obj) !== 0) short.push(`${obj} sold for ${want - 1}`);

        H.setVar(p, 'vote_points', want);
        invButton(p, 'shop_template:inv', row, 2);
        settle(p);
        if (H.invCount(p, obj) !== 1) bought.push(`${obj} would not sell for ${want}`);
        if (H.getVar(p, 'vote_points') !== 0) leftover.push(`${obj} left ${H.getVar(p, 'vote_points')} points behind`);
        H.despawn(p);
    }
    check('one point short buys nothing, on any row', short, []);
    check('exactly the price buys it, on every row', bought, []);
    check('and the price is what came out of the wallet', leftover, []);
}
{
    // A POINTS SHOP BUYS NOTHING. ~can_sell_obj refuses every sale at a wallet shop, which is what
    // stops a bought reward from being turned back into points - and what stops the whole set
    // being bought, sold back, and bought again.
    const npc = H.npcNear('vote_clerk', CLERK[0], CLERK[1])!;
    const p = player('seller');
    H.give(p, VARROCK.obj, 1);
    if (!openShop(p, npc)) throw new Error('the shop did not open');
    H.clearLogs();
    invButton(p, 'shop_template_side:inv', 0, 2);
    settle(p);
    check('the clerk will not buy a reward back', [H.invCount(p, VARROCK.obj), H.getVar(p, 'vote_points')], [1, 0]);
    check('and says which currency it takes', said(p, 'only takes vote points'), true);
}

// ============================================================ 9. the ring could not be worn
console.log("== Explorer's ring 4, which carried Wear on an op nothing handles");
{
    const t = ObjType.get(ObjType.getId('explorers_ring_4'));
    check('Wear is iop2, where [opheld2,_] can see it', [t.iop[0], t.iop[1]], ['Check', 'Wear']);
    const p = player('ringbearer');
    H.give(p, 'explorers_ring_4', 1);
    H.opheld(p, 'explorers_ring_4', 2);
    settle(p);
    const worn = p.getInventory(InvType.WORN)!.get(SLOT.ring);
    check('and the ring goes on', worn?.id, ObjType.getId('explorers_ring_4'));
    // Which is what makes its worn farm teleport reachable at all.
    check('so its worn Farm Teleport is reachable', wearHandler.handle(new WearOp(1, ObjType.getId('explorers_ring_4'), SLOT.ring, WORN_COM), p), true);
}

console.log('');
console.log(`${R.ok} passed, ${R.bad} failed`);
process.exit(R.bad ? 1 : 0);
