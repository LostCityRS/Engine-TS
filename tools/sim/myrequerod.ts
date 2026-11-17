// THE ROD OF IVANDIS. In Aid of the Myreque is named for it in everything but the title - "the
// ability to make the Rod of Ivandis" is the reward the guide lists - and the quest ended with a
// plaster fragment instead. The 377 cache had every piece: the clay mould, the silvthrill rod, the
// enchanted rod, ten charge states, the well, and a slot on the furnace's own Silver Casting panel
// that had been waiting for a mould nobody handed out.
//
// This drives the chain through the real triggers: clay on the coffin lid, the panel at a furnace,
// Lvl-1 Enchant on the stone, the rod down the well, and Veliaf.
//
//   npx tsx tools/sim/myrequerod.ts
import * as H from './harness.js';
import Player from '#/engine/entity/Player.js';
import World from '#/engine/World.js';
import LocType from '#/cache/config/LocType.js';
import ObjType from '#/cache/config/ObjType.js';
import InvType from '#/cache/config/InvType.js';
import NpcType from '#/cache/config/NpcType.js';
import VarBitType from '#/cache/config/VarBitType.js';
import Component from '#/cache/config/Component.js';
import ScriptState from '#/engine/script/ScriptState.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import { Interaction } from '#/engine/entity/Interaction.js';
import { findPathToLoc } from '#/engine/GameMap.js';

await H.boot();

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};
const v = (p: Player, n: string) => (VarBitType.getByName(n) ? H.getVarBit(p, n) : H.getVar(p, n));
const set = (p: Player, n: string, val: number) => (VarBitType.getByName(n) ? H.setVarBit(p, n, val) : H.setVar(p, n, val));

function settle(p: Player, picks: number[] = [], max = 250) {
    let idle = 0;
    for (let g = 0; g < max; g++) {
        const s = p.activeScript;
        if (s && s.execution === ScriptState.PAUSEBUTTON) {
            idle = 0;
            const names = p.resumeButtons.map((id: number) => Component.get(id).comName ?? '');
            const open = p.modalChat === -1 ? '' : (Component.get(p.modalChat).comName ?? '');
            const multi = open.startsWith('multi') ? names.find((n: string) => n.startsWith(open + ':')) : null;
            if (multi) {
                const pick = picks.shift();
                if (pick === undefined) throw new Error('unexpected menu: ' + names.join(','));
                H.choose(p, `${multi.split(':')[0]}:com_${pick}`);
                continue;
            }
            p.executeScript(s, true, true);
            continue;
        }
        H.tick(1);
        if (!p.activeScript && !p.target && !p.delayed && p.queue.head() === null) {
            if (++idle >= 3) break;
        } else idle = 0;
    }
    if (picks.length) throw new Error('menus not reached: ' + picks.join(','));
    p.closeModal();
}

// WHERE THE TWO LOCS ARE, read off the map files rather than hunted for: Ivandis's coffin is on
// mapsquare 54,153 at 3481,9808 plane 2, and the well under Paterdomus is on 54,50 at 3482,3234.
// A first version of this swept every mapsquare in the world looking for them and ran the engine
// out of heap - five million zone lookups to find two tiles whose ids are in pack/loc.pack.
const COFFIN: [number, number, number] = [3481, 9808, 2];
const WELL: [number, number, number] = [3482, 3234, 0];
const placed = (x: number, z: number, lvl: number, name: string) => World.getLoc(x, z, lvl, LocType.getId(name)) !== null;

const p: any = H.makePlayer('myrequerod', 3222, 3218);
H.tick(1);
H.maxOut(p);
H.clearInv(p);
H.tick(2);
p.closeModal();

function slotOf(objName: string) {
    const id = ObjType.getId(objName);
    const inv = p.getInventory(InvType.INV)!;
    for (let i = 0; i < inv.capacity; i++) if (inv.get(i)?.id === id) return i;
    throw new Error('not carrying ' + objName);
}
const useOnLoc = (obj: string, x: number, z: number, lvl: number, name: string, picks: number[] = []) => {
    p.teleport(x, z + 1, lvl);
    H.tick(1);
    const loc = World.getLoc(x, z, lvl, LocType.getId(name));
    if (!loc) throw new Error(`no ${name} at ${x},${z},${lvl}`);
    p.clearPendingAction();
    p.lastUseItem = ObjType.getId(obj);
    p.lastUseSlot = slotOf(obj);
    p.queueWaypoints(findPathToLoc(lvl, p.x, p.z, loc.x, loc.z, p.width, loc.width, loc.length, loc.angle, loc.shape, LocType.get(loc.type).forceapproach));
    p.setInteraction(Interaction.ENGINE, loc, ServerTriggerType.APLOCU);
    settle(p, picks);
};

// ------------------------------------------------------------------ the pieces exist
console.log('');
console.log('WHAT THE CACHE HAD ALL ALONG');
for (const n of ['burgh_rod_clay', 'burgh_rod_command1', 'burgh_rod_command2', 'burgh_rod_command_final_10', 'burgh_rod_command_final_1']) {
    check(n + ' is an obj', ObjType.getId(n) !== -1, true);
}
check(
    'the Rod of Ivandis has ten charge states',
    [...Array(10).keys()].every(i => ObjType.getId('burgh_rod_command_final_' + (i + 1)) !== -1),
    true
);
check('the coffin is placed where the map says', placed(...COFFIN, 'burgh_ancient_coffin'), true);
check('and the well under Paterdomus', placed(...WELL, 'burgh_well'), true);

// ------------------------------------------------------------------ the mould
console.log('');
console.log('THE MOULD, OFF THE COFFIN LID');
set(p, 'myreque_2_quest', 100); // ^m2_tomb: the tomb open, the fragment in hand
H.give(p, 'softclay', 2);
useOnLoc('softclay', ...COFFIN, 'burgh_ancient_coffin');
check('before Veliaf has read the fragment, the carving is just a carving', [H.invCount(p, 'burgh_rod_clay'), v(p, 'myreque_2_quest')], [0, 100]);
set(p, 'myreque_2_quest', 102); // ^m2_recipe: he has read it
useOnLoc('softclay', ...COFFIN, 'burgh_ancient_coffin');
check('clay against the carving takes the mould, and the quest moves on', [H.invCount(p, 'burgh_rod_clay'), H.invCount(p, 'softclay'), v(p, 'myreque_2_quest')], [1, 1, 104]);
useOnLoc('softclay', ...COFFIN, 'burgh_ancient_coffin');
check('  and it will not give a second one', H.invCount(p, 'burgh_rod_clay'), 1);

// ------------------------------------------------------------------ the casting
console.log('');
console.log('THE SILVER CASTING PANEL, WHICH HAS HAD A SLOT FOR THIS ALL ALONG');
check(
    'the panel has the rod slot and both its layers',
    ['silver_casting:slot_silvthrill_rod', 'silver_casting:make_silvthrill_rod', 'silver_casting:need_silvthrill_rod'].every(n => Component.getId(n) !== -1),
    true
);
// the panel's own button, as the client sends it: a slot on a crafting panel is an inv, so its
// Make 1 is an inv_button and not an if_button
const press = (comName: string, picks: number[] = []) => {
    H.invButton(p, comName, 1);
    settle(p, picks);
};
H.give(p, 'silver_bar', 1);
press('silver_casting:slot_silvthrill_rod');
check('with no mithril and no sapphire it refuses', H.invCount(p, 'burgh_rod_command1'), 0);
H.give(p, 'mithril_bar', 1);
H.give(p, 'sapphire', 1);
press('silver_casting:slot_silvthrill_rod');
check('silver, mithril and a sapphire make the silvthrill rod', [H.invCount(p, 'burgh_rod_command1'), H.invCount(p, 'silver_bar'), H.invCount(p, 'mithril_bar'), H.invCount(p, 'sapphire'), v(p, 'myreque_2_quest')], [1, 0, 0, 0, 106]);

// ------------------------------------------------------------------ the enchant
console.log('');
console.log('LVL-1 ENCHANT ON THE STONE');
H.give(p, 'waterrune', 5);
H.give(p, 'cosmicrune', 5);
H.castOnHeld(p, 'burgh_rod_command1', 'magic:enchant_lvl1');
settle(p);
check('the spell turns the silvthrill rod into the enchanted one', [H.invCount(p, 'burgh_rod_command1'), H.invCount(p, 'burgh_rod_command2')], [0, 1]);

// ------------------------------------------------------------------ the well
console.log('');
console.log('AND DOWN THE WELL');
useOnLoc('burgh_rod_command2', ...WELL, 'burgh_well');
check('without a rope it stays in your hand', H.invCount(p, 'burgh_rod_command2'), 1);
H.give(p, 'rope', 1);
useOnLoc('burgh_rod_command2', ...WELL, 'burgh_well');
check('on a rope it comes up as the Rod of Ivandis, fully charged', [H.invCount(p, 'burgh_rod_command2'), H.invCount(p, 'burgh_rod_command_final_10'), v(p, 'myreque_2_quest')], [0, 1, 108]);

// ------------------------------------------------------------------ Veliaf
console.log('');
console.log('VELIAF');
const veliaf = [...World.npcs].find(n => n && n.isActive && NpcType.get(n.type).debugname === 'burgh_rescue_veliaf_hurtz_talk');
check('Veliaf is in the cellar', veliaf !== undefined, true);
if (veliaf) {
    // HE WANDERS, AND A TELEPORT DOES NOT CARE WHAT IS IN THE WAY. This used to read his tile
    // once, teleport to x+1 and hand-roll the interaction from there - and over 120 ticks he
    // stands on nineteen different tiles, so x+1 is whatever happened to be east of him at the
    // moment of reading. Landing on the far side of the cellar wall answers "I can't reach
    // that!", the conversation never starts, and the check reports the quest stuck at 108 as
    // though the content had refused the rod. It had not: driven from a tile he can actually be
    // reached from, he finishes the quest every time (tracker issue 21).
    //
    // So: H.standBeside picks a side the route finder agrees is a side, re-reading where he is
    // NOW, and H.opNpc sends the op the way a player's client would - routing from the current
    // position and following him if he moves off again. A few goes, because he can step away
    // between choosing the tile and arriving on it.
    for (let a = 0; a < 5 && v(p, 'myreque_2_quest') < 110; a++) {
        if (!H.standBeside(p, veliaf)) {
            H.tick(5);
            continue;
        }
        H.tick(1);
        try {
            H.opNpc(p, veliaf, 1);
        } catch {
            // his menu has no talk option this tick; let him settle and try again
        }
        settle(p);
    }
    check('he takes the rod, looks at it, and hands it straight back: quest complete', [v(p, 'myreque_2_quest'), H.invCount(p, 'burgh_rod_command_final_10')], [110, 1]);
}

console.log('');
console.log(`${R.ok} ok, ${R.bad} failed`);
process.exit(R.bad ? 1 : 0);
