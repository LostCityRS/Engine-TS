// DOES APE ATOLL ATTACK YOU, AND DOES THE GREEGREE STOP IT?
//
// Every npc on the island and in Zooknock's tunnel was missing a huntmode, so nothing ever
// attacked anybody: the monkey guards watched the player walk past and the archers on the
// walkways never loosed an arrow. The fix is a hunt of the quest's own, shaped on the cache's
// aggressive pair with one addition borrowed from the God Wars dungeon -
// check_invparam=worn,mm_transmog_npc,<1 - so a player wearing a greegree is invisible to the
// monkeys and anyone else is not.
//
// That is two claims and this checks both, because getting only the first would turn the island
// hostile to the very disguise the quest exists to give you.
//
// AND THE SECOND CLAIM USED TO EXCLUDE THE NPCS THAT BROKE IT. The "leaves a monkey alone" loop
// below carried `if (name.includes('zombie') || name.includes('skeleton')) continue;` - so the
// three undead this file had already gone to the trouble of finding in Zooknock's tunnel were
// hunted as a human and then skipped as a monkey. They were on huntmode=aggressive_melee, the
// SHARED hunt, which has no greegree guard, and this file was green because it did not ask. The
// three jungle natives on the surface were on it too and were never in the list at all. Reported
// from play as "other monsters besides monkey attack you when in greegree form", from 2739,2726 -
// a jungle snake one tile away. DeathPlateau-Bugs#46.
//
// So the skip is gone, the jungle three are in the list, and section 1 no longer takes a list's
// word for it: it walks every npc actually spawned on the island and under it and asks each one's
// own huntmode whether it reads the greegree. A hostile placed on Ape Atoll on the shared hunt
// fails there, named, whether or not anybody remembered to add it below.
//
// A sim npc never hunts on its own: Npc.processNpc only calls huntAll when a real client is
// observing it, and a harness player observes nothing. So the hunt is driven by hand, the way
// questrun's `wakehunt` step does it.
//
//   npx tsx tools/sim/mmaggro.ts
import * as H from './harness.ts';
import { check, R, player } from './a1lib.ts';
import World from '#/engine/World.js';
import { isLineOfSight, isMapBlocked } from '#/engine/GameMap.js';
import type Npc from '#/engine/entity/Npc.js';
import NpcType from '#/cache/config/NpcType.js';
import HuntType from '#/cache/config/HuntType.js';
import ParamType from '#/cache/config/ParamType.js';
import ObjType from '#/cache/config/ObjType.js';
import InvType from '#/cache/config/InvType.js';

await H.boot();

/**
 * A tile to stand on beside an npc: free floor, and in its line of sight. BOTH of those matter,
 * because the hunts here are check_vis=lineofsight - the cache's aggressive pair and mm.hunt both -
 * so a player dropped on the far side of a wall is a player the npc is right to ignore. The old
 * "x + size, z" was neither test, and mm_zombie_monkey_large happens to stand with that tile inside
 * the tunnel wall, which came out as "it does not attack a human standing beside it".
 */
function beside(npc: Npc): [number, number] | null {
    const sz = NpcType.get(npc.type).size ?? 1;
    const ring: [number, number][] = [];
    for (let d = 0; d < sz + 1; d++) {
        ring.push([npc.x + sz, npc.z + d], [npc.x - 1, npc.z + d], [npc.x + d, npc.z + sz], [npc.x + d, npc.z - 1]);
    }
    for (const [x, z] of ring) {
        if (isMapBlocked(x, z, npc.level)) continue;
        // BOTH WAYS ROUND, because isLineOfSight is not symmetric: it walks the wall flags from
        // the source outwards, and a wall on the far side of a tile boundary stops one direction
        // and not the other. HuntIterator asks it from the PLAYER to the npc
        // (ScriptIterators.ts), so that is the direction that decides, and asking only the other
        // one picked a tile the hunt could not see out of - which is how mm_zombie_monkey_large
        // came out as an npc that does not attack a human standing right beside it.
        if (!isLineOfSight(npc.level, npc.x, npc.z, x, z)) continue;
        if (!isLineOfSight(npc.level, x, z, npc.x, npc.z)) continue;
        return [x, z];
    }
    return null;
}

/**
 * Drive the npc's own hunt by hand for a few ticks and say whether it took the player.
 *
 * AND KEEP THE PLAYER BESIDE IT, which is the claim being made. These npcs have no moverestrict
 * and they wander while this loop runs: a tile chosen beside the npc goes stale inside the four
 * ticks between choosing it and the first hunt, and the tunnel's corners break the line of sight
 * the hunt needs long before the five tiles of huntrange run out. mm_zombie_monkey_large was the
 * one that wandered far enough often enough to be reported as an npc that does not attack - a
 * probe put a player next to the SAME npc at the SAME moment and it took the target on the first
 * tick. Pinned the way templetrek pins its escort, for the same reason.
 */
function hunts(npc: any, p: any, ticks = 10): boolean {
    for (let t = 0; t < ticks; t++) {
        const tile = beside(npc);
        if (tile && (Math.max(Math.abs(npc.x - p.x), Math.abs(npc.z - p.z)) > 1 || !isLineOfSight(npc.level, npc.x, npc.z, p.x, p.z))) {
            p.teleport(tile[0], tile[1], npc.level);
            // AND A TICK TO LAND IT. HuntIterator walks the ZONES around the npc and reads each
            // one's getAllPlayersSafe list; a teleport moves the player's coordinates and nothing
            // else until the player is processed, so a hunt run in the same tick looks for them in
            // the zone they just left.
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
        const target = npc.target ?? null;
        if (target && target.username === p.username) return true;
    }
    return false;
}

// ---------------------------------------------------------------- 1. the guard, and who carries it
//
// DERIVED FROM THE MAP, not from a list. Everything below this section works from names somebody
// typed, and DeathPlateau-Bugs#46 is exactly what that misses: four hostiles nobody had typed.
// This walks the npcs the world actually spawned on Ape Atoll and in the dungeon under it and
// asks each one's own huntmode whether it reads the greegree, so the next hostile placed there on
// the shared hunt fails here by name.
console.log('\n1. EVERY HOSTILE ON THE ISLAND READS THE GREEGREE');

const WORN = InvType.WORN;
const TRANSMOG = ParamType.getId('mm_transmog_npc');
check('the worn inv and the mm_transmog_npc param both resolve', WORN !== -1 && TRANSMOG !== -1, true);

/** Does this hunt refuse to take a target who is WEARING something with param=mm_transmog_npc? */
function readsGreegree(h: HuntType): boolean {
    return h.checkInv === WORN && h.checkObjParam === TRANSMOG && h.checkInvCondition === '<' && h.checkInvVal === 1;
}

// THE TWO HUNTS DIFFER BY THAT ONE LINE AND NOTHING ELSE, and this is pinned so that "the island
// leaves a monkey alone" cannot later be achieved by softening the hunt instead - dropping
// check_vis, or putting check_nottoostrong back on, would make every check below pass while
// changing what the island does to a human.
for (const [mine, shared] of [
    ['mm_aggressive_melee', 'aggressive_melee'],
    ['mm_aggressive_ranged', 'aggressive_ranged']
] as const) {
    const a = HuntType.getByName(mine);
    const b = HuntType.getByName(shared);
    if (!a || !b) {
        check(`  ${mine} and ${shared} both exist`, false, true);
        continue;
    }
    check(`  ${mine.padEnd(22)} reads the greegree`, readsGreegree(a), true);
    check(`  ${shared.padEnd(22)} does not (so the swap is the fix)`, readsGreegree(b), false);
    const differs: string[] = [];
    for (const k of ['type', 'checkVis', 'checkNotTooStrong', 'checkNotBusy', 'findKeepHunting', 'findNewMode', 'nobodyNear', 'checkNotCombat', 'checkNotCombatSelf', 'checkAfk', 'rate', 'checkCategory', 'checkNpc', 'checkObj', 'checkLoc'] as const) {
        if ((a as unknown as Record<string, unknown>)[k] !== (b as unknown as Record<string, unknown>)[k]) differs.push(k);
    }
    check(`  and is otherwise ${shared} line for line`, differs.join(',') || '(identical)', '(identical)');
}

// The island and the dungeon under it. The dungeon sits at the same x with z+6400, which is where
// the mm_dungeon zone triggers put it (0_42_142_* and up).
const ISLAND: [string, number, number, number, number][] = [
    ['surface', 2690, 2810, 2690, 2810],
    ['dungeon', 2690, 2810, 9090, 9210]
];
let hostiles = 0;
for (const [where, x0, x1, z0, z1] of ISLAND) {
    const bad = new Map<string, string>();
    const good = new Set<string>();
    for (const npc of World.npcs) {
        if (!npc || !npc.isActive) continue;
        if (npc.x < x0 || npc.x > x1 || npc.z < z0 || npc.z > z1) continue;
        const t = NpcType.get(npc.type) as unknown as { huntmode: number; debugname?: string };
        if (t.huntmode === -1) continue; // a bird or a bystander: nothing to guard
        hostiles++;
        const hunt = HuntType.get(t.huntmode);
        const nm = t.debugname ?? String(npc.type);
        if (readsGreegree(hunt)) good.add(nm);
        else bad.set(nm, `${hunt.debugname} at ${npc.x},${npc.z}`);
    }
    check(`  ${where}: all ${good.size + bad.size} hostile types read it`, [...bad.entries()].map(([n, w]) => `${n} (${w})`).join('; ') || '(all)', '(all)');
    console.log(`         ${where}: ${[...good].sort().join(', ')}`);
}
check('there were hostiles there to check at all', hostiles > 0, true);

// ---------------------------------------------------------------- the island's guards
console.log('\nAPE ATOLL, TO A HUMAN');
// THE NPC ITSELF, NOT WHERE IT WAS. This list used to hold coordinates read once, and the two
// loops below then looked the npc up again within two tiles of them and stood the player beside
// the REMEMBERED tile. Three of the seven that actually spawn - mm_zombie_monkey_small,
// mm_zombie_monkey_large and mm_skeleton, the ones in Zooknock's tunnel - have no moverestrict,
// so they wander while the first loop works through the list ahead of them. By their turn the
// player was being put down beside a tile the npc had left, outside its huntrange of 5, and the
// check reported "it does not attack a human standing beside it" about a human who was not. That
// is the whole of this sim's one-in-three: the four mm_ archers and guards are moverestrict=nomove
// and never missed. Worse than the failure, a wander of more than two tiles made the radius-2
// lookup return nothing and the npc was skipped in silence.
const guards: [string, Npc][] = [];
for (const name of [
    'mm_monkey_guard',
    'mm_monkey_archer',
    'mm_posted_archer',
    'mm_ravine_archer',
    'mm_religious_guard',
    'mm_oipuis',
    'mm_ouhai',
    'mm_uodai',
    'mm_uyoro',
    'mm_zombie_monkey_small',
    'mm_zombie_monkey_large',
    // THE FOUR THIS FILE DID NOT KNOW ABOUT, three on the surface and one more under it. They are
    // here for the monkey loop, not for the human one: all four already attacked a human perfectly
    // well. See DeathPlateau-Bugs#46.
    'mm_zombie_monkey_large_guard',
    'mm_jungle_snake',
    'mm_jungle_spider',
    'mm_jungle_scorpion',
    'mm_skeleton'
]) {
    const id = NpcType.getId(name);
    let found: any = null;
    for (const npc of World.npcs) {
        if (npc && npc.isActive && npc.type === id) {
            found = npc;
            break;
        }
    }
    if (!found) {
        // NOT A FAILURE, A GAP THAT IS NAMED. Five of Marim's monkeys have no static spawn at all -
        // mm_monkey_guard and the four named ninja monkeys Oipuis, Ouhai, Uodai and Uyoro - so
        // there is nothing of them on the island to make aggressive. Their configs are complete
        // and their spawn coordinates are not in the cache; OSRS's are in the wiki's LocLine rows.
        // Printed rather than asserted so this suite stays green on what it can actually test.
        console.log(`  --   ${name.padEnd(28)} has no static spawn anywhere, so nothing to hunt with`);
        continue;
    }
    guards.push([name, found]);
    const type = NpcType.get(id);
    check(`${name.padEnd(28)} has a huntmode`, (type as unknown as { huntmode: number }).huntmode !== -1, true);
}

// ---------------------------------------------------------------- it attacks a human
//
// ONE NAME PER NPC, AND TWELVE CHARACTERS OF IT. These players were named
// 'human_' + name.slice(3, 14), and mm_zombie_monkey_small and mm_zombie_monkey_large both slice
// to 'zombie_monk' - so both asked for 'human_zombie_monk', which is seventeen characters of a
// twelve-character username and the same seventeen twice. The second login was simply refused,
// and the check reported an npc that would not attack a human standing beside it about a human
// who was never there: p.isActive false, and nothing in the output said so. A running index is
// all the name has to carry.
let who = 0;
console.log('\n2. AND IT COMES FOR A HUMAN WHO WALKS PAST');
for (const [name, npc] of guards) {
    // beside it, not inside it and not through a wall - and read off where it is NOW, which is
    // the point of holding the npc rather than a coordinate
    const tile = beside(npc);
    if (!tile) {
        check(`    ${name.padEnd(28)} (no free tile in its line of sight to stand on)`, false, true);
        continue;
    }
    const p: any = player('hunted' + ++who, tile[0], tile[1], npc.level);
    H.setVar(p, 'tutorial', 1000);
    H.tick(2);
    const took = hunts(npc, p, 12);
    check(`    ${name.padEnd(28)} attacks a human standing beside it`, took, true);
    if (!took) {
        // Named rather than left to be guessed at. The last thing this reported as an npc that
        // would not attack was a player who had never logged in, and "it did not hunt me" looks
        // identical either way.
        console.log(
            `         it was at ${npc.x},${npc.z} L${npc.level} huntMode=${npc.huntMode} huntrange=${npc.huntrange}` +
                `, the player at ${p.x},${p.z} L${p.level} distance ${Math.max(Math.abs(npc.x - p.x), Math.abs(npc.z - p.z))}` +
                `, los both ways ${isLineOfSight(npc.level, npc.x, npc.z, p.x, p.z) && isLineOfSight(npc.level, p.x, p.z, npc.x, npc.z)}` +
                `, the player is logged in ${p.isActive && p.isValid()}, tick ${World.currentTick}`
        );
    }
    H.despawn(p);
}

// ---------------------------------------------------------------- and ignores a monkey
console.log('\n3. AND LEAVES A MONKEY ALONE');
const greegree = 'mm_monkey_greegree_for_normal_monkey';
let worn = 0;
for (const [name, npc] of guards) {
    // EVERY ONE OF THEM, which is the whole of DeathPlateau-Bugs#46. This loop used to skip any
    // name containing 'zombie' or 'skeleton' - the three undead the loop above had just proved
    // hostile - and the skip is why a file called mmaggro.ts could be green while four of the
    // island's hostiles ignored the greegree. Nothing about an undead monkey makes the disguise
    // not apply: the OSRS wiki's Skeleton (Ape Atoll) page says they are "aggressive to all
    // players who are not using a greegree", in those words.
    const tile = beside(npc);
    if (!tile) continue;
    const p: any = player('monkey' + ++who, tile[0], tile[1], npc.level);
    H.setVar(p, 'tutorial', 1000);
    H.equip(p, { rhand: greegree }); // the quest makes you wield it, and worn is what the hunt reads
    H.tick(2);
    const on = (() => {
        const inv = p.getInventory(InvType.WORN);
        if (!inv) return false;
        for (let i = 0; i < inv.capacity; i++) {
            const o = inv.get(i);
            if (o && ObjType.get(o.id).debugname === greegree) return true;
        }
        return false;
    })();
    if (!on) {
        check(`    ${name.padEnd(28)} (could not wield the greegree)`, false, true);
        H.despawn(p);
        continue;
    }
    worn++;
    const took = hunts(npc, p, 12);
    check(`    ${name.padEnd(28)} ignores a player wearing a greegree`, took, false);
    H.despawn(p);

    // THE CONTROL, ON THE SAME TILE, because "it did not attack me" is also what a hunt that was
    // never able to fire looks like - out of range, no line of sight, or the npc still inside the
    // eight ticks of %npc_lastcombat that the loop above left on it (check_notcombat_self, mm.hunt).
    // Any of those would let the greegree take credit for somebody else's silence. A bare player
    // standing where the monkey stood, hunted straight after, is the thing that makes the line
    // above mean the greegree.
    H.tick(10);
    const bare: any = player('control' + ++who, tile[0], tile[1], npc.level);
    H.setVar(bare, 'tutorial', 1000);
    H.tick(2);
    check('      and that same tile without one is hunted', hunts(npc, bare, 12), true);
    H.despawn(bare);
}
check('the greegree was actually worn for those', worn > 0, true);

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
