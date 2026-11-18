// STEALING FROM A STALL WHOSE OWNER IS STANDING THERE.
//
//   npx tsx tools/sim/stallsafespot.ts
//
// "the baker moves too much and is hard to steal from his stall" - and underneath that was
// something worse than the wandering: NO tile worked. ~stealing_check_for_owner asked only whether
// the owner had line of sight, and lineofsight from a tile to itself is trivially true, so a
// player standing under the owner was seen exactly as well as one standing in the open. Every tile
// within five of the stall was covered. The only thing that ever let a steal through was the owner
// wandering out of range, which is why the baker - who wandered two tiles - felt worse than the
// silk merchant, who never moves.
//
// Old School's answer is a tile: the wiki's thieving guide says to "stand under the baker", and an
// npc does not block a player, so his square is there to be stood on. That is what this pins.
import * as H from './harness.js';
import World from '#/engine/World.js';
import Npc from '#/engine/entity/Npc.js';
import NpcType from '#/cache/config/NpcType.js';
import DbRowType from '#/cache/config/DbRowType.js';
import { check, R, player } from './a1lib.js';
import { PlayerStatMap } from '#/engine/entity/PlayerStat.js';

await H.boot();

const STALLS: [string, string][] = [
    ['stealing_bakery_stall', 'baker_merchant'],
    ['stealing_silk_stall', 'silk_merchant'],
    ['stealing_gem_stall', 'gem_merchant'],
    ['stealing_spice_stall', 'spice_merchant'],
    ['stealing_silver_stall', 'silver_merchant'],
    ['stealing_tea_stall', 'tea_seller']
];

const p = player('stallspot', 2654, 3310);
const findOwner = (name: string): Npc | undefined => {
    const type = NpcType.getId(name);
    return [...World.npcs].find(n => n && n.type === type);
};
/** Does the owner catch a player standing on `at`? The owner is pinned so the answer is the tile's. */
function caught(owner: Npc, row: number, at: [number, number]): boolean {
    const home: [number, number] = [owner.x, owner.z];
    p.teleport(at[0], at[1], owner.level);
    H.tick(1);
    owner.x = home[0];
    owner.z = home[1];
    H.clearLogs();
    return H.runProc(p, '[proc,stealing_check_for_owner]', [row])[0] === 1;
}

console.log('\n================ THE OWNER CANNOT SEE INSIDE HIS OWN SQUARE');
for (const [rowName, ownerName] of STALLS) {
    const row = DbRowType.getId(rowName);
    const owner = findOwner(ownerName);
    if (row === -1 || !owner) {
        check(`${rowName}: owner is in the world`, false, true);
        continue;
    }
    check(`${ownerName}: standing under him is not seen`, caught(owner, row, [owner.x, owner.z]), false);
}

console.log('\n================ AND STILL CATCHES A PLAYER STANDING IN THE OPEN');
{
    // The safespot is one tile, not an exemption. Beside him, in plain view, he still shouts -
    // otherwise this change would have quietly turned every owned stall into a free one.
    const owner = findOwner('baker_merchant')!;
    const row = DbRowType.getId('stealing_bakery_stall');
    check('one tile west of the baker is still seen', caught(owner, row, [owner.x - 1, owner.z]), true);
    check('one tile north is still seen', caught(owner, row, [owner.x, owner.z + 1]), true);
}

console.log('\n================ AND THE BAKER STAYS WHERE HE IS');
{
    // His square is only a safespot if it is the same square tomorrow. He wandered two tiles,
    // which took the tile with him; the silk, gem and silver merchants were already wanderrange 0.
    const owner = findOwner('baker_merchant')!;
    // startX/startZ, not wherever he happens to be standing: the first draft compared against his
    // position when the sim first looked at him, which under the old wanderrange was a tile he had
    // wandered to rather than the one he belongs on.
    const home = `${owner.startX},${owner.startZ}`;
    const seen = new Set<string>();
    for (let t = 0; t < 400; t++) {
        seen.add(`${owner.x},${owner.z}`);
        H.tick(1);
    }
    console.log(`  400 ticks, tiles stood on: ${[...seen].join(' ')}`);
    check('the baker never leaves his spawn tile', [...seen], [home]);
    check('...and the cache says so too', NpcType.get(owner.type).wanderrange, 0);
}

console.log('\n================ AND THE WHOLE THING WORKS FROM THAT TILE');
{
    // The checks above are the proc in isolation. This is the player's actual question: stand
    // under the baker, click the stall, get a cake.
    const owner = findOwner('baker_merchant')!;
    const STALL: [number, number] = [2655, 3311];
    const thief = player('stallthief', owner.startX, owner.startZ);
    const TH = PlayerStatMap.get('THIEVING')!;
    thief.baseLevels[TH] = 99;
    thief.levels[TH] = 99;
    H.clearInv(thief);

    let stole = 0;
    let ownerShouts = 0;
    let guardShouts = 0;
    for (let i = 0; i < 12; i++) {
        thief.teleport(owner.startX, owner.startZ, owner.level);
        H.tick(1);
        H.clearLogs();
        H.opLoc(thief, STALL[0], STALL[1], 'bakers_stall_stealing', 2);
        H.tick(10);
        const loot = H.invCount(thief, 'cake') + H.invCount(thief, 'bread') + H.invCount(thief, 'chocolate_slice');
        if (loot > 0) {
            stole++;
            H.clearInv(thief);
        }
        // WHO shouted matters. The owner is what this change is about; a guard is a different
        // mechanic entirely - they patrol, and one wandering into view is allowed to catch you.
        for (const sy of H.says.filter(x => x.text.includes('hands off'))) {
            if (sy.who === 'baker_merchant') ownerShouts++;
            else guardShouts++;
        }
        H.tick(12); // let the stall come back
    }
    console.log(`  12 attempts from under the baker: ${stole} stole, owner shouted ${ownerShouts}, a patrolling guard ${guardShouts}`);
    check('the owner never catches a player standing under him', ownerShouts, 0);
    // Not "all twelve": the stall needs a moment to come back, and a guard on patrol is entitled
    // to walk into view. Before the fix this was 0 of 40.
    check('and most attempts get the loot', stole >= 4, true);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
