// THE PICKAXES ON THE HAUNTED MINE FLOOR ARE NOT PICKAXES.
//
// Fifteen npcs named "Bronze pickaxe" lie on two levels of the mine, hidden from the minimap, each
// with one option: Take. Nothing in the content answered it, so the only thing fifteen pieces of
// bait did was say "Nothing interesting happens."
//
// WHAT IS WORTH TESTING is almost entirely one thing, and it is not the dialogue:
//
//   npc_changetype, NOT npc_changetype_keepall. Npc.changeType only copies the new type's stats
//   when reset is true, and keepall passes reset=false - so a pickaxe woken the wrong way keeps the
//   BAIT's stats, and the bait declares none, which means the engine's 1/1/1/1 defaults. The
//   difference between the right call and the wrong one is a level 50 monster with 40 hitpoints and
//   a level 50 monster that dies to the first hit, and nothing about the configs tells them apart.
//   Rellekka's rock crabs learned this the hard way (area_relleka/scripts/rock_crabs.rs2); this
//   checks it rather than trusting the comment.
//
// After that: that it wakes at all, goes for the hand that picked it up, lies back down when left
// alone, drops the iron pickaxe the wiki says it always drops, and comes back as bait.
import * as H from './harness.ts';
import { check, R, player } from './a1lib.ts';
import NpcType from '#/cache/config/NpcType.js';
import ObjType from '#/cache/config/ObjType.js';
import SeqType from '#/cache/config/SeqType.js';
import { NpcStat } from '#/engine/entity/NpcStat.js';
import Npc from '#/engine/entity/Npc.js';
import Player from '#/engine/entity/Player.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import World from '#/engine/World.js';

await H.boot();

const BAIT = NpcType.getId('possessed_pickaxe_stationary');
const AWAKE = NpcType.getId('possessed_pickaxe');
/** The two chambers they lie in: m42_69 and m43_71, both on level 0 of their underground square. */
const CHAMBERS: [number, number][] = [
    [2713, 4438],
    [2769, 4591]
];

function baitNear(x: number, z: number): Npc {
    const npc = H.npcNear('possessed_pickaxe_stationary', x, z);
    if (!npc) {
        throw new Error(`no bait pickaxe near ${x},${z}`);
    }
    return npc;
}

/** Click Take on a lying pickaxe from a tile beside it. */
function take(p: Player, npc: Npc): void {
    if (!H.standBeside(p, npc)) {
        throw new Error(`nowhere to stand beside ${npc.x},${npc.z},${npc.level}`);
    }
    H.opNpc(p, npc, 1);
    H.tick(3);
}

console.log('WHAT IS LYING THERE');
{
    const bait = NpcType.get(BAIT);
    const awake = NpcType.get(AWAKE);
    check('  the bait is called a bronze pickaxe', bait.name, 'Bronze pickaxe');
    check('  its only option is Take', [bait.op?.[0], bait.op?.[1], bait.op?.[2], bait.op?.[3], bait.op?.[4]], ['Take', null, null, null, null]);
    check('  it is off the minimap', !!(bait as unknown as { minimap: boolean }).minimap, false);
    check('  and has no combat level drawn', bait.vislevel, 0);
    check('  what it becomes is level 50', awake.vislevel, 50);
    check('  with Attack on op2 and no Take', [awake.op?.[0], awake.op?.[1]], [null, 'Attack']);
    // The two halves share a model, which is why the rise reads as one thing standing up.
    check('  and they are drawn with the same model', awake.models?.[0], bait.models?.[0]);
    check('  Take has a script now', !!ScriptProvider.getByName('[opnpc1,possessed_pickaxe_stationary]'), true);
    check('  it has a lie-down timer', !!ScriptProvider.getByName('[ai_timer,possessed_pickaxe]'), true);
    check('  and a death script of its own', !!ScriptProvider.getByName('[ai_queue3,possessed_pickaxe]'), true);

    let n = 0;
    for (const npc of World.npcs) {
        if (npc && npc.type === BAIT) {
            n++;
        }
    }
    check('  the map lays fifteen of them', n, 15);
    // A pickaxe lying on the floor does not go for a walk. Both types declared no wanderrange and
    // took the engine's default of five, which is the same drift the ghost guards had.
    check('  and none of them crawls about', bait.wanderrange, 0);
    check('  what it becomes carries the lie-down clock on its type', awake.timer, 50);
    for (const [x, z] of CHAMBERS) {
        const near = baitNear(x, z);
        check(`  with some around ${x},${z}`, Math.max(Math.abs(near.x - x), Math.abs(near.z - z)) < 40, true);
    }
}

console.log('\nPICKING ONE UP');
{
    const p = player('pick_wake', CHAMBERS[0][0], CHAMBERS[0][1]);
    const npc = baitNear(CHAMBERS[0][0], CHAMBERS[0][1]);
    H.clearLogs();
    take(p, npc);
    check('  it is not a pickaxe any more', npc.type, AWAKE);
    check('  it stood up', H.npcAnims.some(a => a.seq === SeqType.getId('pickaxe_summon')), true);
    // THE WHOLE POINT. 40 is possessed_pickaxe's own hitpoints; 1 is what the bait's absent stats
    // would have given it through npc_changetype_keepall.
    check('  and it has the stats of what it became, not of the bait', npc.levels[NpcStat.HITPOINTS], 40);
    check('  not the engine default a keepall would have left', npc.levels[NpcStat.HITPOINTS] === 1, false);
    check('  it is coming for the player who picked it up', npc.target === p, true);
}

console.log('\nLEFT ALONE, IT LIES BACK DOWN');
{
    const p = player('pick_rest', CHAMBERS[1][0], CHAMBERS[1][1]);
    const npc = baitNear(CHAMBERS[1][0], CHAMBERS[1][1]);
    take(p, npc);
    check('  awake', npc.type, AWAKE);
    // Out of its reach, and then past the 50-tick rest with no combat stamped on it.
    p.teleport(CHAMBERS[1][0] + 20, CHAMBERS[1][1] + 20, 0);
    H.tick(120);
    check('  and after two minutes of being ignored it is bait again', npc.type, BAIT);
    check('  off the minimap with it', !!(NpcType.get(npc.type) as unknown as { minimap: boolean }).minimap, false);
    // ...and still pick-up-able, which is the whole of "they will not reanimate unless clicked on".
    const q = player('pick_again', CHAMBERS[1][0], CHAMBERS[1][1]);
    take(q, npc);
    check('  a second click wakes it again', npc.type, AWAKE);
}

console.log('\nKILLING ONE LEAVES THE PICKAXE IT WAS PRETENDING TO BE');
{
    const p = player('pick_kill', CHAMBERS[0][0], CHAMBERS[0][1]);
    H.maxOut(p);
    H.equip(p, { rhand: 'dragon_scimitar' });
    const npc = baitNear(CHAMBERS[0][0], CHAMBERS[0][1]);
    take(p, npc);
    const at = { x: npc.x, z: npc.z };
    H.attackNpc(p, npc);
    let dead = false;
    for (let t = 0; t < 120 && !dead; t++) {
        H.tick(1);
        dead = npc.levels[NpcStat.HITPOINTS] === 0 || !npc.isActive || npc.type === BAIT;
    }
    check('  it dies', dead, true);
    H.tick(3);
    const id = ObjType.getId('iron_pickaxe');
    let found = 0;
    for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
            const o = World.getObj(at.x + dx, at.z + dz, 0, id, p.hash64) ?? World.getObj(at.x + dx, at.z + dz, 0, id, -1n);
            if (o) {
                found += o.count;
            }
        }
    }
    // "Iron pickaxe, 1, Always" - oldschool.runescape.wiki/w/Possessed_pickaxe, Haunted Mine drops.
    check('  and leaves exactly one iron pickaxe', found, 1);
    H.tick(60);
    check('  and comes back as bait, not as a monster', npc.type, BAIT);
}

console.log(`\n${R.ok} ok, ${R.bad} failed`);
process.exit(R.bad ? 1 : 0);
