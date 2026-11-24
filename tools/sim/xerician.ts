// THE XERICIAN ROBES: a cloth that drops and three things to sew out of it.
// Usage: npx tsx tools/sim/xerician.ts   (exit code is the verdict)
//
// The three robes were imported with no source of any kind - a wear gate in tier20.rs2 was the only
// line in the repo that named them (tools/obtainable.py). Old School makes them from Xerician fabric
// with a needle and thread, so that is what this checks, plus the drop that now feeds it.
//
// THE PART WORTH A SIM IS THE WILDERNESS HALF. The same dark wizard stands on both sides of the
// line - three of the five bearded spawns are at the circle west of Edgeville, two are south-east
// of Varrock - so "twice as often in the Wilderness" cannot be a rate on the npc; it is a test on
// where the wizard died, and a single pinned roll proves it: at roll 112 a Wilderness kill drops
// cloth and an identical kill in Varrock does not.
import * as H from './harness.ts';
import * as A from './a1lib.ts';
import { check, R } from './a1lib.ts';
import World from '#/engine/World.js';
import ObjType from '#/cache/config/ObjType.js';
import Component from '#/cache/config/Component.js';
import JavaRandom from '#/util/JavaRandom.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import { getExpByLevel } from '#/engine/entity/Player.js';
import type Player from '#/engine/entity/Player.js';

await H.boot();

const CRAFTING = 12;
const MAGIC = 6;
const DEFENCE = 1;
const WEARPOS_TORSO = 4;

const origND = JavaRandom.nextDouble.bind(JavaRandom);
let pinned: number | null = null;
(JavaRandom as unknown as { nextDouble: () => number }).nextDouble = () => (pinned === null ? origND() : pinned);
/** A nextDouble that makes random(128) come out at exactly `roll`. */
const atRoll = (roll: number) => (roll + 0.5) / 128;

function setLevel(p: Player, stat: number, level: number) {
    p.baseLevels[stat] = level;
    p.levels[stat] = level;
    p.stats[stat] = getExpByLevel(level);
    H.tick(1);
}

// ------------------------------------------------------------------ the cloth
{
    const id = ObjType.getId('xerician_fabric');
    check('the fabric exists', id >= 0, true);
    const t = ObjType.get(id);
    check('examine', t.desc, "An old scrap of cloth, containing remnants of Xeric's forgotten magicks.");
    check('weight', t.weight, 60);
    check('value', t.cost, 3);
    // THE TRADEABLE HALF OF THE SET, as in Old School: the cloth can be sold on, the robes cannot.
    check('the cloth is tradeable', t.tradeable, true);
    for (const robe of ['xerician_hat', 'xerician_robe', 'xerician_top']) {
        check(`  ${robe} exists to be made`, ObjType.getId(robe) >= 0, true);
    }
}

// ------------------------------------------------------------------ the drop, either side of the line
//
// The cloth sits in slots nothing used - both wizard tables stop at 112 - so the roll that pays is
// `>= 128 - slots`: 112 for a bearded wizard in the Wilderness (16 slots), 120 for one anywhere
// else (8), 120 for a young one up there (8) and 124 for a young one elsewhere (4).
const WILD: [number, number] = [2981, 3562]; // the circle west of Edgeville
const TAME: [number, number] = [3225, 3374]; // south-east of Varrock, below the line

function killAt(npcName: string, at: [number, number], roll: number, tag: string): string[] {
    const p = A.player(`xf_${tag}`, at[0] + 3, at[1]);
    p.teleport(at[0] + 3, at[1], 0);
    H.tick(1);
    const npc = H.addNpc(npcName, at[0], at[1]);
    H.tick(1);
    const [nx, nz, nl] = [npc.x, npc.z, npc.level];
    const before: string[] = [];
    for (const o of World.gameMap.getZone(nx, nz, nl).getAllObjsUnsafe()) {
        if (Math.abs(o.x - nx) <= 2 && Math.abs(o.z - nz) <= 2) before.push(ObjType.get(o.type).debugname ?? String(o.type));
    }
    npc.heroPoints.addHero(p.hash64, 100);
    npc.applyDamage(npc.levels[3], 0);
    npc.enqueueScript(ServerTriggerType.AI_QUEUE3, 0, 0);
    pinned = atRoll(roll);
    H.tick(10);
    pinned = null;
    const after: string[] = [];
    for (const o of World.gameMap.getZone(nx, nz, nl).getAllObjsUnsafe()) {
        if (Math.abs(o.x - nx) <= 2 && Math.abs(o.z - nz) <= 2) after.push(ObjType.get(o.type).debugname ?? String(o.type));
    }
    for (const was of before) {
        const i = after.indexOf(was);
        if (i !== -1) after.splice(i, 1);
    }
    return after;
}
const dropped = (got: string[]) => got.includes('xerician_fabric');

{
    // ONE ROLL, TWO PLACES. This is the whole claim: 112 pays in the Wilderness and nowhere else.
    check('roll 112, bearded wizard in the Wilderness: cloth', dropped(killAt('bearded_dark_wizard', WILD, 112, 'bw112')), true);
    check('  the same roll south of the line: nothing', dropped(killAt('bearded_dark_wizard', TAME, 112, 'bt112')), false);
    check('  and 120 pays south of the line too', dropped(killAt('bearded_dark_wizard', TAME, 120, 'bt120')), true);
    // The band's bottom edge: 111 is the last roll the old table owned (a fire talisman).
    check('roll 111 is still the table it always was', dropped(killAt('bearded_dark_wizard', WILD, 111, 'bw111')), false);

    // Half the rate for the level-7 wizards, same shape.
    check('roll 120, young wizard in the Wilderness: cloth', dropped(killAt('young_dark_wizard', WILD, 120, 'yw120')), true);
    check('  the same roll south of the line: nothing', dropped(killAt('young_dark_wizard', TAME, 120, 'yt120')), false);
    check('  and 124 pays south of the line too', dropped(killAt('young_dark_wizard', TAME, 124, 'yt124')), true);
    check('roll 119 pays neither', [dropped(killAt('young_dark_wizard', WILD, 119, 'yw119')), dropped(killAt('young_dark_wizard', TAME, 119, 'yt119'))], [false, false]);
}

// ------------------------------------------------------------------ sewing them
const PANEL = 'skillmulti3';
// obj1 hat, obj2 robe, obj3 top; com_8/12/16 are their Make 1 buttons (interface_chat/chat.rs2).
const MAKE1 = { xerician_hat: `${PANEL}:com_8`, xerician_robe: `${PANEL}:com_12`, xerician_top: `${PANEL}:com_16` };
const MAKE5_HAT = `${PANEL}:com_7`;

function sewer(name: string, crafting: number, fabric: number, thread = 1): Player {
    const p = A.player(name, 3222, 3218);
    setLevel(p, CRAFTING, crafting);
    H.give(p, 'needle', 1);
    if (thread > 0) H.give(p, 'thread', thread);
    if (fabric > 0) H.give(p, 'xerician_fabric', fabric);
    return p;
}
/** Use the needle on the cloth, then press a button on the panel. Returns the panel's name. */
function sew(p: Player, button: string | null, ticks = 40): string {
    H.clearLogs();
    H.useHeldOn(p, 'needle', 'xerician_fabric');
    for (let t = 0; t < 8 && (p as unknown as { modalChat: number }).modalChat < 0; t++) H.tick(1);
    const modal = (p as unknown as { modalChat: number }).modalChat;
    const opened = modal >= 0 ? (Component.get(modal).comName ?? `com_${modal}`) : 'none';
    if (modal >= 0 && button) H.choose(p, button);
    for (let t = 0; t < ticks; t++) H.tick(1);
    return opened;
}
const said = (p: Player, s: string) =>
    H.mesgs.some(m => m.who === p.username && m.text.includes(s)) ||
    H.ifaces.some(i => i.who === p.username && i.kind === 'text' && !!i.text && i.text.includes(s));

{
    const p = sewer('xf_panel', 22, 5);
    const opened = sew(p, MAKE1.xerician_top);
    check('the needle on the cloth opens the make panel', opened, PANEL);
    check('  a top takes five cloths', [H.invCount(p, 'xerician_top'), H.invCount(p, 'xerician_fabric')], [1, 0]);
    check('  and pays 110 Crafting', p.stats[CRAFTING] - getExpByLevel(22), 1100);
}
{
    const p = sewer('xf_hat', 14, 3);
    sew(p, MAKE1.xerician_hat);
    check('a hat takes three cloths at 14 Crafting', [H.invCount(p, 'xerician_hat'), H.invCount(p, 'xerician_fabric')], [1, 0]);
    check('  and pays 66', p.stats[CRAFTING] - getExpByLevel(14), 660);
}
{
    const p = sewer('xf_robe', 17, 4);
    sew(p, MAKE1.xerician_robe);
    check('a robe takes four cloths at 17 Crafting', [H.invCount(p, 'xerician_robe'), H.invCount(p, 'xerician_fabric')], [1, 0]);
    check('  and pays 88', p.stats[CRAFTING] - getExpByLevel(17), 880);
}
{
    const p = sewer('xf_lowlevel', 13, 3);
    sew(p, MAKE1.xerician_hat);
    check('13 Crafting cannot sew a hat', H.invCount(p, 'xerician_hat'), 0);
    check('  and is told the level', said(p, 'Crafting level of 14'), true);
    check('  and keeps the cloth', H.invCount(p, 'xerician_fabric'), 3);
}
{
    const p = sewer('xf_short', 22, 4); // a top wants five
    sew(p, MAKE1.xerician_top);
    check('four cloths cannot make a top', H.invCount(p, 'xerician_top'), 0);
    check('  and the count is named', said(p, '5 pieces of Xerician fabric'), true);
}
{
    const p = sewer('xf_nothread', 22, 5, 0);
    sew(p, MAKE1.xerician_top);
    check('no thread, no robe', H.invCount(p, 'xerician_top'), 0);
    check('  and is told why', said(p, 'need some thread'), true);
    check('  and keeps the cloth', H.invCount(p, 'xerician_fabric'), 5);
}
{
    // A REEL LASTS FIVE SEWINGS, which is this build's rule for a needle and thread rather than one
    // invented here - leather/leather.rs2 counts the same %thread_used and prints the same line.
    const p = sewer('xf_reel', 14, 15, 1);
    sew(p, MAKE5_HAT, 60);
    check('Make 5 sews five hats', H.invCount(p, 'xerician_hat'), 5);
    check('  for fifteen cloths', H.invCount(p, 'xerician_fabric'), 0);
    check('  and uses up exactly one reel', H.invCount(p, 'thread'), 0);
    check('  saying so', said(p, 'use up one of your reels'), true);
}
{
    // AND THE POINT OF ALL OF IT: a robe that was sewn can be worn. The gate was the only thing in
    // the repo that mentioned these before today.
    const p = sewer('xf_wear', 22, 5);
    sew(p, MAKE1.xerician_top);
    setLevel(p, MAGIC, 20);
    setLevel(p, DEFENCE, 10);
    H.opheld(p, 'xerician_top', 2);
    H.tick(2);
    check('20 Magic and 10 Defence wears the top', H.wornName(p, WEARPOS_TORSO), 'xerician_top');

    const q = sewer('xf_wearlow', 22, 5);
    sew(q, MAKE1.xerician_top);
    setLevel(q, MAGIC, 19);
    setLevel(q, DEFENCE, 10);
    H.opheld(q, 'xerician_top', 2);
    H.tick(2);
    check('19 Magic does not', H.wornName(q, WEARPOS_TORSO), null);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
