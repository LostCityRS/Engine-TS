/**
 * NARDOK'S BONE WEAPONS, and the gate in front of it.
 *
 * He was added on 2026-11-24 because Wanted!'s third clue - "A spear, and it is made of BONE.
 * Nobody sells those. Somebody down a hole carved it." - sent a player looking for a bone weapon
 * shop this build did not have. It had the weapons and nobody selling them.
 *
 * WHAT IS WORTH CHECKING HERE, and it is not "does a shop open". It is that the SHELF is Old
 * School's - ten spears and five daggers and nothing else - and that the quest gate refuses in a
 * way the player can read. A shop that silently does nothing to somebody who has not done The Lost
 * Tribe is indistinguishable from a broken npc, which is the failure this whole file exists after.
 */
import * as H from './harness.js';
import { check, R, player } from './a1lib.js';
import InvType from '#/cache/config/InvType.js';
import NpcType from '#/cache/config/NpcType.js';
import ObjType from '#/cache/config/ObjType.js';
import VarPlayerType from '#/cache/config/VarPlayerType.js';
import World from '#/engine/World.js';

await H.boot();

const LOST_TRIBE_COMPLETE = 11;
const shopVarp = VarPlayerType.getId('shop');
const nardokShop = InvType.getId('nardok_shop');

console.log('HE IS IN THE WORLD, where the mine is');
const id = NpcType.getId('nardok');
check('nardok is a real npc type', id !== -1, true);
const nardok = World.npcs.find((n: any) => n && n.isActive && n.type === id)!;
check('and one is standing in the Dorgesh-Kaan mine', nardok !== undefined, true);
check(`  at 3313,9630 (${nardok?.x},${nardok?.z})`, [nardok?.x, nardok?.z], [3313, 9630]);
const t = NpcType.get(id);
check('  his first option is Talk-to', t.op?.[0], 'Talk-to');
check('  his third is Trade', t.op?.[2], 'Trade');
// NOT ATTACKABLE, and that is deliberate rather than an oversight: the miners and guards either
// side of him fight, and a shopkeeper in a city of his own people does not.
check('  and nothing on his menu is Attack', (t.op ?? []).includes('Attack'), false);

console.log('\nTHE SHELF IS OLD SCHOOL’S, ten spears and five daggers');
const inv = InvType.get(nardokShop);
const stock = Array.from(inv.stockobj ?? []).filter(o => o > 0);
check('two rows and no more', stock.length, 2);
check('  the spear leads it', ObjType.get(stock[0]).debugname, 'cave_goblin_bone_spear');
check('  then the dagger', ObjType.get(stock[1]).debugname, 'bone_dagger');
const counts = Array.from(inv.stockcount ?? []).slice(0, 2);
check('  ten of the one, five of the other', [...counts], [10, 5]);
// The prices are the objs' own and are asserted here because the shop multiplies them: a changed
// cost would quietly move what a player pays without touching this file.
check('  spear costs 600', ObjType.get(stock[0]).cost, 600);
check('  dagger costs 2000', ObjType.get(stock[1]).cost, 2000);
// A club and bolts exist in this build and he sells NEITHER, exactly as in Old School - a shop
// that stocks everything sharing a word in its name is how a drop stops being worth getting.
check('  and the bone club is not on it', stock.map(o => ObjType.get(o).debugname).includes('cave_goblin_bone_club'), false);

// WHAT THIS PAIR DOES AND DOES NOT PROVE. The two sections below are only worth anything
// together: on its own "the shop does not open" would pass just as happily if op3 never dispatched
// at all, which is the shape of a check that is green over nothing. The section AFTER it opens the
// same shelf through the same op on the same npc, so the op is known to work and the refusal is
// known to be the script choosing to refuse.
//
// His words are NOT asserted, and that is a harness limit rather than a decision: ~chatnpc opens a
// dialogue interface instead of writing a mes() line, and neither mesSince nor modalMain sees it
// from here. That he says "You are not one of us" rather than failing in silence is read from
// nardok.rs2, not measured - so if that line is ever deleted, this file will not notice.
console.log('\nWITHOUT THE LOST TRIBE HE SAYS SO, rather than doing nothing');
{
    const p = player('nardok_no', nardok.x - 1, nardok.z);
    H.setVarBit(p, 'lost_tribe_quest', 0);
    H.tick(1);
    H.opNpc(p, nardok, 3);
    H.tick(6);
    check('  the shop does not open', p.vars[shopVarp] === nardokShop, false);
}

console.log('\nWITH IT, the counter opens');
{
    const p = player('nardok_yes', nardok.x - 1, nardok.z);
    H.setVarBit(p, 'lost_tribe_quest', LOST_TRIBE_COMPLETE);
    H.tick(1);
    H.opNpc(p, nardok, 3);
    H.tick(6);
    check('  Trade opens Nardok’s shelf', p.vars[shopVarp], nardokShop);
}

console.log('\nAND PAST COMPLETION STILL WORKS, which `=` would have broken');
{
    // The wanted_tiffy.rs2 lesson: a quest varp can sit ABOVE its completion value once post-quest
    // content writes to it, and an exact test would refuse exactly the players who had done most.
    const p = player('nardok_past', nardok.x - 1, nardok.z);
    H.setVarBit(p, 'lost_tribe_quest', LOST_TRIBE_COMPLETE + 3);
    H.tick(1);
    H.opNpc(p, nardok, 3);
    H.tick(6);
    check('  somebody past the end of the quest can still buy', p.vars[shopVarp], nardokShop);
}

console.log(R.bad ? `FAILED: ${R.bad} of ${R.ok + R.bad}` : `${R.ok} ok`);
process.exit(R.bad ? 1 : 0);
