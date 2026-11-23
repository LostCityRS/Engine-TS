// DO THE APE ATOLL ARCHERS SHOOT, AND DOES THE GREEGREE STILL STOP THEM?
//
// mm_monkey_archer, mm_posted_archer and mm_ravine_archer aimed and never fired. They had the
// hunt (mm_aggressive_ranged) and huntrange=8, so the hunt found the player and set APPLAYER2
// mode - and then nothing, because the trigger for that mode is per category and they carried no
// category at all. Mode set, nothing ever ran (DeathPlateau-Bugs#37, #43).
//
// attackrange was 0 as well, which is the half a one-tile test cannot see: the AP trigger is gated
// on inApproachDistance(attackrange, target), and with moverestrict=nomove an archer cannot close
// the gap either. So the distance checks below are the point of this file - an archer that only
// works from an adjacent tile is still broken, and a first probe of mine passed from 1 tile while
// being no evidence at all.
//
// AND THE GREEGREE HALF, because making the island hostile must not make it hostile to the disguise
// the quest exists to hand you. mm_aggressive_ranged carries check_invparam=worn,mm_transmog_npc,<1
// for exactly that, and it is checked here for the same reason mmaggro.ts checks it for the guards.
//
// A sim npc never hunts on its own - Npc.processNpc only calls huntAll when a real client observes
// it - so the hunt is driven by hand, as mmaggro.ts does.
//
//   npx tsx tools/sim/mmarchers.ts
import * as H from './harness.ts';
import { check, R, player } from './a1lib.ts';
import World from '#/engine/World.js';
import { isLineOfSight, isMapBlocked } from '#/engine/GameMap.js';
import NpcType from '#/cache/config/NpcType.js';
import HuntType from '#/cache/config/HuntType.js';
import { PlayerStatMap } from '#/engine/entity/PlayerStat.js';
import type Npc from '#/engine/entity/Npc.js';

await H.boot();

const HP = PlayerStatMap.get('HITPOINTS')!;
const ARCHERS = ['mm_monkey_archer', 'mm_posted_archer', 'mm_ravine_archer'];
let seq = 0;

function find(name: string): Npc | null {
    const id = NpcType.getId(name);
    if (id === -1) throw new Error('no such npc: ' + name);
    for (const npc of World.npcs) if (npc && npc.isActive && npc.type === id) return npc;
    return null;
}

/** A tile at exactly this distance with line of sight both ways, or null. */
function tileAt(npc: Npc, d: number): [number, number] | null {
    const ring: [number, number][] = [];
    for (const s of [-d, d]) {
        ring.push([npc.x + s, npc.z], [npc.x, npc.z + s], [npc.x + s, npc.z + s], [npc.x + s, npc.z - s]);
    }
    for (const [x, z] of ring) {
        if (isMapBlocked(x, z, npc.level)) continue;
        // BOTH WAYS, because isLineOfSight is not symmetric - the lesson mmaggro.ts records.
        if (!isLineOfSight(npc.level, npc.x, npc.z, x, z)) continue;
        if (!isLineOfSight(npc.level, x, z, npc.x, npc.z)) continue;
        return [x, z];
    }
    return null;
}

/** Stand there, drive the hunt, and report the damage taken within `ticks`. */
function shotAt(npc: Npc, tile: [number, number], greegree = false, ticks = 40): number {
    const p: any = player('arch' + seq++, tile[0], tile[1], npc.level);
    p.setLevel(HP, 99);
    if (greegree) H.equip(p, { rhand: 'mm_monkey_greegree_for_normal_gorilla' });
    const hp0 = p.levels[3];
    H.tick(1);
    for (let t = 0; t < ticks; t++) {
        if (npc.huntMode !== -1 && npc.isValid()) {
            npc.huntAll(HuntType.get(npc.huntMode));
            npc.huntClock++;
        }
        H.tick(1);
        if (p.levels[3] < hp0) return hp0 - p.levels[3];
    }
    return 0;
}

// ------------------------------------------------------------------ 1. the config
console.log('\nWHAT THE THREE ARCHERS CARRY');
for (const name of ARCHERS) {
    const t: any = NpcType.get(NpcType.getId(name));
    check(`${name.padEnd(20)} has an attackrange`, t.attackrange, 8);
    check('  ...and a category, so APPLAYER2 has somewhere to go', t.category !== -1, true);
}

// ------------------------------------------------------------------ 2. they shoot, AT RANGE
//
// The published figures: Ranged 110, max hit 20, every offensive bonus 0. The level had been
// filed into param=rangeattack, which this engine reads as the equipment attack bonus, so the
// archer had a 110 bonus on no ranged level - near-zero damage and far too accurate at once.
console.log('\nTHEY SHOOT, AND FROM A DISTANCE - which is the half attackrange=0 broke');
for (const name of ARCHERS) {
    const npc = find(name);
    if (!npc) {
        console.log(`  --   ${name} has no static spawn, so nothing to shoot with`);
        continue;
    }
    // The FARTHEST tile inside attackrange that can see it. An archer that only fires from an
    // adjacent square would pass a 1-tile test and still be the reported bug.
    let far: [number, number] | null = null;
    let farD = 0;
    for (let d = 8; d >= 3; d--) {
        const t = tileAt(npc, d);
        if (t) {
            far = t;
            farD = d;
            break;
        }
    }
    if (!far) {
        console.log(`  --   ${name}: no tile 3-8 away with line of sight, so range is untestable here`);
        continue;
    }
    const dmg = shotAt(npc, far);
    check(`${name.padEnd(20)} hits from ${farD} tiles`, dmg > 0, true);
    check('  ...for no more than its published max hit of 20', dmg <= 20, true);
}

// ------------------------------------------------------------------ 3. and not from outside it
console.log('\nOUTSIDE attackrange, NOTHING - a bow is not unlimited');
{
    const npc = find('mm_posted_archer')!;
    const out = tileAt(npc, 12);
    if (out) {
        check('12 tiles away is not shot at', shotAt(npc, out, false, 25), 0);
    } else {
        console.log('  --   no clear tile 12 away; skipped rather than asserted on a wall');
    }
}

// ------------------------------------------------------------------ 4. the disguise still works
console.log('\nAND A GREEGREE IS STILL A DISGUISE');
for (const name of ARCHERS) {
    const npc = find(name);
    if (!npc) continue;
    let t: [number, number] | null = null;
    for (let d = 8; d >= 3 && !t; d--) t = tileAt(npc, d);
    if (!t) continue;
    check(`${name.padEnd(20)} ignores a monkey`, shotAt(npc, t, true, 25), 0);
}

console.log(R.bad ? `FAILED: ${R.bad} of ${R.ok + R.bad}` : `${R.ok} ok`);
process.exit(R.bad ? 1 : 0);
