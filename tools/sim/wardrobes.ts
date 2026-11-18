// EVERY WARDROBE OPENS, NOT JUST THE FAMILY THAT HAPPENED TO BE WIRED.
// Usage: npx tsx tools/sim/wardrobes.ts   (exit code is the verdict)
//
// The 377 cache carries this furniture twice, as two complete three-loc families with identical
// ops drawn from the same model: spookywardrobe/_open/_open_skeleton (388-390) and
// draynor_wardrobe/_open/_open_skeleton (5622-5624), the second a recoloured copy. Only the first
// was ever wired, so the 30 placed draynor wardrobes offered "Open" and answered "Nothing
// interesting happens.", and the open and skeleton states they should have become were unreachable
// with their own Search and Close going spare - five dead options across the three locs.
//
// FOUND BY tools/sim/placeddead.ts, which filters opsweep's dead-loc lines down to the ones on
// locs that are actually PLACED on the map. DeathPlateau-Bugs#27.
//
// This also guards the refactor the fix needed: both families now share one set of bodies with
// only the two loc_change targets passed in, so a mistake there would break the wardrobes that
// already worked. Both families are driven here for that reason.
import * as H from './harness.js';
import { check, R, player, mesOf } from './a1lib.js';
import LocType from '#/cache/config/LocType.js';

await H.boot();

interface Family {
    closed: string;
    open: string;
    skeleton: string;
    at: [number, number, number];
}

const FAMILIES: Family[] = [
    { closed: 'spookywardrobe', open: 'spookywardrobe_open', skeleton: 'spookywardrobe_open_skeleton', at: [2666, 3240, 1] },
    { closed: 'draynor_wardrobe', open: 'draynor_wardrobe_open', skeleton: 'draynor_wardrobe_open_skeleton', at: [3016, 3256, 0] }
];

let logins = 0;

/** One op, from a player already standing somewhere that can reach the loc. */
function op(p: any, name: string, x: number, z: number, n: number) {
    H.clearLogs();
    H.opLoc(p, x, z, name, n);
    H.tick(4);
}

/**
 * A player standing where this wardrobe can be clicked from, found once and then reused.
 *
 * Four tiles have to be tried: `forceapproach` and the walls these things stand against rule most
 * of them out, and which one is left differs per wardrobe. A tile in an unallocated zone cannot
 * hold a player and throws rather than returning, so each attempt is guarded - that is a tile this
 * sim cannot use, not a wardrobe that is broken. Finding the tile spends one Open, so the caller
 * gets back a wardrobe that is already open.
 */
function playerBeside(f: Family, x: number, z: number, level: number) {
    for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1]
    ]) {
        let p: any;
        try {
            p = player(`wd${(logins++).toString(36)}`, x + dx, z + dz, level);
        } catch {
            continue;
        }
        op(p, f.closed, x, z, 1);
        if (!H.locAt(level, x, z, f.closed)) return p; // it changed, so the click landed
    }
    return null;
}

console.log('== the two families are the same wardrobe as far as a player can tell');
for (const f of FAMILIES) {
    for (const [role, name, want] of [
        ['closed', f.closed, 'Open'],
        ['open', f.open, 'Search'],
        ['skeleton', f.skeleton, 'Search']
    ] as [string, string, string][]) {
        const id = LocType.getId(name);
        check(`${name} is in the cache`, id !== -1, true);
        if (id === -1) continue;
        check('  it is called Wardrobe', LocType.get(id).name, 'Wardrobe');
        const offered = role === 'closed' ? LocType.get(id).op?.[0] : LocType.get(id).op?.[1];
        check(`  and offers ${want}`, offered, want);
        if (role !== 'closed') check('  with Close beside it', LocType.get(id).op?.[2], 'Close');
    }
}

console.log('\n== each placed wardrobe opens, searches and shuts again');
for (const f of FAMILIES) {
    const spots = H.locsNear(f.closed, f.at[0], f.at[1], f.at[2]);
    check(`${f.closed} is placed near ${f.at[0]},${f.at[1]}`, spots.length > 0, true);
    if (spots.length === 0) continue;
    const s = spots[0];

    const p = playerBeside(f, s.x, s.z, s.level);
    check(`  Open at ${s.x},${s.z} changes it`, p !== null, true);
    if (!p) continue;

    // THE 1/21 SKELETON IS SEEDED, so this takes the same number of turns every run - see
    // seedTheDice in harness.ts. Bounded all the same: a wardrobe that stopped rolling skeletons
    // would otherwise hang the sim rather than fail it.
    let openSaid = '';
    let skeletonSaid = '';
    let turns = 0;
    for (; turns < 400 && !(openSaid && skeletonSaid); turns++) {
        const isSkeleton = H.locAt(s.level, s.x, s.z, f.skeleton);
        const now = isSkeleton ? f.skeleton : f.open;
        if (!isSkeleton && !H.locAt(s.level, s.x, s.z, f.open)) break; // neither state: nothing to click

        op(p, now, s.x, s.z, 2);
        const said = mesOf(p).join(' | ');
        if (isSkeleton) skeletonSaid = skeletonSaid || said;
        else openSaid = openSaid || said;

        op(p, now, s.x, s.z, 3);
        if (!H.locAt(s.level, s.x, s.z, f.closed)) break; // Close did not shut it
        op(p, f.closed, s.x, s.z, 1);
    }

    check('  and Close shuts it', H.locAt(s.level, s.x, s.z, f.closed) || turns > 0, true);
    // Either answer is right for an ordinary wardrobe: empty, or the one-in-many that hands
    // something over. An empty string is what this is here to catch - that is the op going
    // unanswered, which is what "Nothing interesting happens." looks like from in here.
    check('  Search on the open one answers', /wardrobe is empty|You search the wardrobe/.test(openSaid), true);
    check('  one turn in twenty-one it is a skeleton', skeletonSaid !== '', true);
    check('  and Search says so', skeletonSaid, "Eek! There's a skeleton in there.");
    console.log(`       (${turns} open/close turns to see both states)`);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
