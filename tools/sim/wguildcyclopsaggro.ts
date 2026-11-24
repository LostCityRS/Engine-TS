/**
 * THE WARRIORS' GUILD CYCLOPES: do they notice you, from how far, and do they obey your level?
 *
 * Reported as "cyclops in warriors guild arent aggressive" (DeathPlateau-Bugs#55). They were - a
 * player stood beside one was attacked, eight for eight, on both floors - so this is not a fix for
 * "no aggression" but for the two things about HOW they hunted that were wrong:
 *
 *   huntrange was 3, on npcs that are 2x2 and spread across a large room. Three tiles is close
 *   enough that crossing the middle of the floor untouched is the normal experience, which is what
 *   the report describes. They ask for 5 now.
 *
 *   check_nottoostrong was off, inherited from the 377 cache's shared [aggressive_melee]. Off means
 *   they attack you regardless of your combat level, where Old School stops a monster aggroing once
 *   you are more than double its level.
 *
 * So the whole change is a hunt of their own, wguild_aggressive_cyclops, and three claims:
 * the range went up, the level rule came on, and NOTHING ELSE MOVED. That last one is the reason
 * the hunt is new rather than edited, and section 3 is the only thing standing behind it.
 *
 * A sim npc never hunts on its own - Npc.processNpc only calls huntAll where a real client observes
 * it - so the hunt is driven by hand, the mmaggro.ts pattern.
 *
 *   npx tsx tools/sim/wguildcyclopsaggro.ts
 */
import * as H from './harness.ts';
import { check, R, player } from './a1lib.ts';
import World from '#/engine/World.js';
import { isLineOfSight, isMapBlocked } from '#/engine/GameMap.js';
import type Npc from '#/engine/entity/Npc.js';
import NpcType from '#/cache/config/NpcType.js';
import HuntType from '#/cache/config/HuntType.js';
import { HuntCheckNotTooStrong } from '#/engine/entity/hunt/HuntCheckNotTooStrong.js';
import { HuntVis } from '#/engine/entity/hunt/HuntVis.js';

await H.boot();

const TOP = ['wguild_cyclops_1', 'wguild_cyclops_2', 'wguild_cyclops_3', 'wguild_cyclops_4', 'wguild_cyclops_5', 'wguild_cyclops_6'];
const BASEMENT = [1, 2, 3, 4, 5, 6].map(n => `wguild_cyclops_basement_${n}`);
const ALL = [...TOP, ...BASEMENT];
const HUNT = 'wguild_aggressive_cyclops';

/** Find one live npc of this name, or null. */
function find(name: string): Npc | null {
    const id = NpcType.getId(name);
    for (const npc of World.npcs) {
        if (npc && npc.isActive && npc.type === id) return npc;
    }
    return null;
}

/**
 * A free tile at exactly `d` tiles from the npc's nearest edge, in its line of sight both ways.
 * BOTH WAYS because isLineOfSight is not symmetric - it walks the wall flags outward from the
 * source - and HuntIterator asks it from the PLAYER, so a tile that can only be seen the other way
 * round is a tile the hunt is right to miss.
 */
function tileAt(npc: Npc, d: number): [number, number] | null {
    const sz = NpcType.get(npc.type).size ?? 1;
    const cand: [number, number][] = [];
    for (let o = 0; o < sz; o++) {
        cand.push([npc.x + sz - 1 + d, npc.z + o], [npc.x - d, npc.z + o], [npc.x + o, npc.z + sz - 1 + d], [npc.x + o, npc.z - d]);
    }
    for (const [x, z] of cand) {
        if (isMapBlocked(x, z, npc.level)) continue;
        if (!isLineOfSight(npc.level, npc.x, npc.z, x, z)) continue;
        if (!isLineOfSight(npc.level, x, z, npc.x, npc.z)) continue;
        return [x, z];
    }
    return null;
}

/**
 * A free tile at exactly `d` from the npc's SOUTH-WEST TILE, in line of sight both ways.
 *
 * WHICH IS WHAT huntrange MEANS, and it is not the same as "d tiles clear of the npc". HuntIterator
 * compares CoordGrid.distanceToSW(npc, player) against huntrange, and an npc's coordinate is its
 * south-west tile with its size ignored - so for a 2x2 cyclops, huntrange 5 reaches five tiles from
 * that corner, which is only FOUR tiles clear of its body to the north and east. Measuring from the
 * body instead is how section 5 first read "huntrange=5 does not reach 5 tiles": the player was six
 * from the corner and the engine was right to ignore them.
 */
function coordTile(npc: Npc, d: number): [number, number] | null {
    const cand: [number, number][] = [
        [npc.x + d, npc.z],
        [npc.x - d, npc.z],
        [npc.x, npc.z + d],
        [npc.x, npc.z - d],
        [npc.x + d, npc.z + d],
        [npc.x - d, npc.z - d]
    ];
    for (const [x, z] of cand) {
        if (isMapBlocked(x, z, npc.level)) continue;
        if (Math.max(Math.abs(x - npc.x), Math.abs(z - npc.z)) !== d) continue;
        if (!isLineOfSight(npc.level, x, z, npc.x, npc.z)) continue;
        if (!isLineOfSight(npc.level, npc.x, npc.z, x, z)) continue;
        return [x, z];
    }
    return null;
}

/**
 * Drive this npc's hunt by hand and say whether it took this player, holding the player at exactly
 * `d` tiles from it throughout.
 *
 * THE DISTANCE IS PINNED, NOT THE TILE, and that distinction is the whole of this helper. These
 * cyclopes have wanderrange=3 and no moverestrict, so they walk while the loop runs: a tile chosen
 * 5 away and then held is 8 away four ticks later, and the check reports "it does not notice a
 * player five tiles off" about a player who is not five tiles off. That is exactly how section 5
 * first failed - the npc had drifted from 2850,3543 while the player stood at a tile picked for
 * where it used to be. Recomputing every tick is what makes "from five tiles" a claim about five
 * tiles. Same trap mmaggro.ts hit and for the same reason.
 */
function hunts(npc: any, p: any, d: number, from: 'edge' | 'coord' = 'edge', ticks = 8): boolean {
    for (let t = 0; t < ticks; t++) {
        const tile = from === 'coord' ? coordTile(npc, d) : tileAt(npc, d);
        if (tile && (p.x !== tile[0] || p.z !== tile[1] || p.level !== npc.level)) {
            p.teleport(tile[0], tile[1], npc.level);
            // AND A TICK TO LAND IT: HuntIterator reads each zone's player list, and a teleport
            // moves coordinates and nothing else until the player is processed, so a hunt run in
            // the same tick looks for them in the zone they just left.
            H.tick(1);
        }
        if (npc.huntMode !== -1 && npc.isValid()) {
            const hunt = HuntType.get(npc.huntMode);
            if (hunt) {
                npc.huntAll(hunt);
                npc.huntClock++;
            }
        }
        H.tick(1);
        if (npc.target && npc.target.username === p.username) return true;
    }
    return false;
}

let n = 0;
const probes: any[] = [];

/**
 * PUT THE NPC BACK AS IT WAS BEFORE EVERY MEASUREMENT, and get the last probe out of its way.
 *
 * Two pieces of state leak between checks that share an npc, and both of them were caught here
 * rather than guessed at. [aggressive_melee] and this hunt both set find_keephunting=off, which
 * sets huntMode to -1 the moment a target is taken, and the hunt loop below is gated on huntMode
 * being set - so the SECOND check against the same cyclops never ran its hunt at all and came back
 * "it does not notice you". And check_notcombat_self=%npc_lastcombat stops an npc hunting for eight
 * ticks after it last fought, which the previous check's swing had just set.
 *
 * resetDefaults() restores huntMode, huntrange and the interaction; the ten ticks outlast the
 * combat guard; and the old probes go to the far corner of the map so they cannot be re-taken.
 * Without this the results depended on the order the checks happened to run in - "attacks from 4
 * tiles" passed and "attacks from 5" failed, on the same npc, in the same section.
 */
function freshen(npc: any): void {
    for (const old of probes) old.teleport(1, 1, 0);
    H.tick(1);
    npc.resetDefaults();
    H.tick(10);
}

/** A fresh player at the given combat stats. */
function probe(att: number, x: number, z: number, level: number): any {
    const p: any = player('cyc' + ++n, x, z, level);
    probes.push(p);
    H.setVar(p, 'tutorial', 1000);
    for (const stat of [0, 1, 2, 3]) {
        // attack, defence, strength, hitpoints
        p.levels[stat] = att;
        p.baseLevels[stat] = att;
    }
    p.combatLevel = p.getCombatLevel();
    return p;
}

// ---- 1. the config says what it should, on every one of the twelve -------------------------
console.log('\n1. twelve cyclops forms, one hunt, one range');
const HUNT_ID = HuntType.getId(HUNT);
check(`${HUNT} exists as a hunt`, HUNT_ID >= 0, true);
for (const name of ALL) {
    const t = NpcType.get(NpcType.getId(name));
    check(`  ${name.padEnd(28)} huntmode=${HUNT} huntrange=5`, t.huntmode === HUNT_ID && t.huntrange === 5, true);
}

// ---- 2. and the hunt itself carries the level rule -----------------------------------------
console.log("\n2. the hunt obeys Old School's double-your-level rule");
{
    const h = HuntType.get(HUNT_ID);
    check('check_nottoostrong is outside_wilderness, not off', h.checkNotTooStrong, HuntCheckNotTooStrong.OUTSIDE_WILDERNESS);
    // THE REST MUST MATCH [aggressive_melee]. The point of a new hunt is one changed field; a
    // second difference that crept in would change how the cyclopes fight and nobody would know.
    const base = HuntType.get(HuntType.getId('aggressive_melee'));
    check("  ...and is otherwise the cache's aggressive_melee: same visibility", h.checkVis, base.checkVis);
    check('  ...same find_newmode', h.findNewMode, base.findNewMode);
    check('  ...same find_keephunting', h.findKeepHunting, base.findKeepHunting);
    check('  ...same type', h.type, base.type);
    check('  ...and lineofsight, which is what makes standing behind a wall safe', h.checkVis, HuntVis.LINEOFSIGHT);
}

// ---- 3. AND THE SHARED HUNT DID NOT MOVE ---------------------------------------------------
// This is the whole reason the hunt is new. [aggressive_melee] is a 377 cache entry; turning
// check_nottoostrong on there would have changed the aggression of every npc using it, on the
// strength of one report about cyclopes. If a later hand does that instead, this fails.
console.log('\n3. and 48+ other npcs were left exactly as they were');
{
    const shared = HuntType.getId('aggressive_melee');
    check('aggressive_melee still has check_nottoostrong=off', HuntType.get(shared).checkNotTooStrong, HuntCheckNotTooStrong.OFF);
    let users = 0;
    for (let id = 0; id < NpcType.count; id++) {
        const t = NpcType.get(id);
        if (t && t.huntmode === shared) users++;
    }
    console.log(`      (${users} npcs still hunt on aggressive_melee)`);
    check('  ...and it is still shared by a crowd, so editing it was never an option', users >= 40, true);
}

// ---- 4. they attack, which is the report ---------------------------------------------------
console.log('\n4. a cyclops attacks a player standing beside it');
for (const name of ALL) {
    const npc = find(name);
    if (!npc) {
        check(`  ${name.padEnd(28)} has a spawn`, false, true);
        continue;
    }
    const tile = tileAt(npc, 1);
    if (!tile) {
        check(`  ${name.padEnd(28)} has a standable tile beside it`, false, true);
        continue;
    }
    freshen(npc);
    const p = probe(1, tile[0], tile[1], npc.level);
    check(`  ${name.padEnd(28)} L${npc.level} ${npc.x},${npc.z} attacks`, hunts(npc, p, 1), true);
}

// ---- 5. from the tiles the old huntrange could not reach -----------------------------
// huntrange was 3 and is 5, measured from the cyclops' south-west tile (see coordTile). So the two
// tiles the change buys are 4 and 5 from that corner, and those are the ones tested: a sim that
// only checked "beside it" would have passed just as well before the change as after.
console.log('\n5. from four and five tiles - the two the old huntrange of 3 could not reach');
{
    const npc = find('wguild_cyclops_1');
    if (!npc) {
        check('wguild_cyclops_1 has a spawn', false, true);
    } else {
        for (const d of [4, 5]) {
            if (!coordTile(npc, d)) {
                check(`  a tile exactly ${d} from its corner exists`, false, true);
                continue;
            }
            freshen(npc);
            const t = coordTile(npc, d)!;
            const p = probe(1, t[0], t[1], npc.level);
            check(`  ${d} tiles from its corner: attacks`, hunts(npc, p, d, 'coord'), true);
        }
        // AND NOT FROM ANYWHERE. 5 is a range, not "always": with no upper bound this section would
        // pass against huntrange=64 as happily as against 5.
        if (coordTile(npc, 6)) {
            freshen(npc);
            const far = coordTile(npc, 6)!;
            const p = probe(1, far[0], far[1], npc.level);
            check('  6 tiles from its corner, one past the range: ignores', hunts(npc, p, 6, 'coord'), false);
        } else {
            check('  a tile 6 from its corner exists to be ignored from', false, true);
        }
    }
}

// ---- 6. and a player twice their level walks past ------------------------------------------
// The second half of the change, and the half that is the OPPOSITE direction to the report, so it
// is spelled out: a maxed player is above double a level 56 cyclops and below double a level 106
// one, and the two must now behave differently. Before this they behaved identically.
console.log('\n6. the level rule, both sides of it');
{
    const top = find('wguild_cyclops_1'); // vislevel 56, so the cutoff is combat 112
    const low = find('wguild_cyclops_basement_1'); // vislevel 106, cutoff 212 - nobody reaches it
    if (!top || !low) {
        check('both a level 56 and a level 106 cyclops have spawns', false, true);
    } else {
        check('  the level 56 one is still level 56', NpcType.get(top.type).vislevel, 56);
        check('  the basement one is level 106', NpcType.get(low.type).vislevel, 106);

        freshen(top);
        const t1 = tileAt(top, 1)!;
        const maxed = probe(99, t1[0], t1[1], top.level);
        console.log(`      (the maxed probe is combat ${maxed.combatLevel}; 56 x 2 = 112, 106 x 2 = 212)`);
        check('  a maxed player is over double 56', maxed.combatLevel > 112, true);
        check('  ...and under double 106', maxed.combatLevel < 212, true);
        check('  so the level 56 cyclops ignores a maxed player', hunts(top, maxed, 1), false);

        freshen(low);
        const t2 = tileAt(low, 1)!;
        const maxed2 = probe(99, t2[0], t2[1], low.level);
        check('  and the level 106 one in the basement still attacks them', hunts(low, maxed2, 1), true);

        // AND THE PLAYER THE REPORT IS ABOUT IS STILL ATTACKED. The guild takes 130 Attack +
        // Strength to enter, so "nobody up there is under the cutoff" is a fair worry about this
        // half of the change: a 70-in-everything player is well under combat 112 and the top floor
        // still wants them.
        //
        // ON A DIFFERENT LEVEL 56, not the one above. freshen() puts an npc back, but an npc that
        // has just been in real combat with the maxed probe is not the same starting position as
        // one that has not, and under a mutated build this check failed for that reason rather than
        // its own - a mutant failing the wrong check is a mutant that taught me nothing.
        // wguild_cyclops_3 is the same vislevel 56 and has not been touched since section 4.
        const other = find('wguild_cyclops_3');
        if (!other) {
            check('  a second level 56 cyclops has a spawn', false, true);
        } else {
            check('  ...and it is also level 56', NpcType.get(other.type).vislevel, 56);
            freshen(other);
            const t3 = tileAt(other, 1)!;
            const mid = probe(70, t3[0], t3[1], other.level);
            console.log(`      (a 70-in-everything player is combat ${mid.combatLevel})`);
            check('  a 70-stat player (combat under 112) is still attacked on the top floor', hunts(other, mid, 1), true);
        }
    }
}

console.log(R.bad ? `\nFAILED: ${R.bad} of ${R.ok + R.bad}` : `\n${R.ok} ok`);
process.exit(R.bad ? 1 : 0);
