// THERE ARE TWO MASTER FARMERS, and they stand in the two markets.
//
//   npx tsx tools/sim/masterfarmer.ts
//
// A Master Farmer is the best Thieving target in the game - seeds, including the ones nothing else
// drops - so where they stand is a balance decision and not decoration. The original game puts them in
// the Draynor and Ardougne markets: crowded, guarded places you have to walk to.
//
// A third one was standing in open field south of the Varrock stone circle (tracker issue 13, reported
// by a player). It was not placed on purpose: the whole map square arrived in one import - 8,305 lines
// and 40 npc spawns, as part of adding One Small Favour - and that spawn came with it. Nothing in the
// content referred to it, there was no farming patch within ten tiles of it, and it was a THIRD farmer
// rather than a moved one, both market spawns being present and correct.
//
// WHY THIS CHECKS BY NAME AND NOT BY HANDLE. The stray was `master_farmer_2`, a legitimate 377 npc type
// whose only spawn was that one; `master_farmer_1` is the type in both markets. A check written against
// those two handles would have passed the day somebody imported a square holding a third type, which is
// exactly how this one arrived. So it asks the cache for everything NAMED "Master Farmer" and counts
// what the world actually spawned.
import * as H from './harness.js';
import World from '#/engine/World.js';
import NpcType from '#/cache/config/NpcType.js';

await H.boot();

/** Where a Master Farmer belongs, and how far it may have wandered from that tile by the time we look. */
const MARKETS = [
    { what: 'Ardougne market', x: 2636, z: 3364 },
    { what: 'Draynor market', x: 3080, z: 3250 }
];
const ROAM = 12;

const found: { x: number; z: number; level: number; type: string }[] = [];
for (const npc of World.npcs) {
    if (!npc || !npc.isActive) continue;
    const type = NpcType.get(npc.type);
    if (type?.name !== 'Master Farmer') continue;
    found.push({ x: npc.x, z: npc.z, level: npc.level, type: type.debugname ?? String(npc.type) });
}

let failed = 0;
const check = (what: string, ok: boolean, detail = '') => {
    if (!ok) failed++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : `  ${detail}`}`);
};

const where = (f: (typeof found)[number]) => `${f.type} at ${f.x},${f.z} L${f.level}`;

check(`the world holds ${MARKETS.length} Master Farmers`, found.length === MARKETS.length, `found ${found.length}: ${found.map(where).join(' | ')}`);

for (const market of MARKETS) {
    const near = found.filter(f => f.level === 0 && Math.max(Math.abs(f.x - market.x), Math.abs(f.z - market.z)) <= ROAM);
    check(`one is in the ${market.what}`, near.length === 1, near.length === 0 ? 'none within ' + ROAM + ' tiles' : `${near.length}: ${near.map(where).join(' | ')}`);
}

// And none of them anywhere else, named individually so a failure says where to look.
const strays = found.filter(f => !MARKETS.some(m => f.level === 0 && Math.max(Math.abs(f.x - m.x), Math.abs(f.z - m.z)) <= ROAM));
check('none stands anywhere else', strays.length === 0, strays.map(where).join(' | '));

console.log(failed ? `\n${failed} FAIL` : '\nALL PASS');
process.exit(failed ? 1 : 0);
