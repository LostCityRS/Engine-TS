// Who is aggressive on Ape Atoll, and does the greegree stop them?
import * as H from './harness.js';
import World from '#/engine/World.js';
import NpcType from '#/cache/config/NpcType.js';
import HuntType from '#/cache/config/HuntType.js';

await H.boot();

// Ape Atoll proper is roughly x 2690..2810, z 2690..2810 (map squares 42_42, 42_43, 43_42, 43_43).
const seen = new Map<string, { n: number; hunt: string; huntrange: number; vis: number; size: number; near: string }>();
for (const npc of World.npcs) {
    if (!npc) continue;
    const { x, z, level } = npc;
    if (level !== 0) continue;
    if (x < 2690 || x > 2810 || z < 2690 || z > 2810) continue;
    const t = NpcType.get(npc.type);
    const hunt = t.huntmode >= 0 ? (HuntType.get(t.huntmode).debugname ?? String(t.huntmode)) : '(none)';
    const key = `${t.debugname}|${hunt}`;
    const e = seen.get(key);
    const d = Math.max(Math.abs(x - 2739), Math.abs(z - 2726));
    if (e) {
        e.n++;
        if (d < Number(e.near.split('@')[1])) e.near = `${x},${z}@${d}`;
    } else {
        seen.set(key, { n: 1, hunt, huntrange: t.huntrange, vis: t.vislevel, size: t.size, near: `${x},${z}@${d}` });
    }
}
const rows = [...seen.entries()].sort((a, b) => Number(a[1].near.split('@')[1]) - Number(b[1].near.split('@')[1]));
console.log(`${rows.length} npc type/hunt pairs on Ape Atoll (level 0, 2690..2810)\n`);
console.log('  n  dist  npc                                  huntmode                      hr  lvl');
for (const [key, v] of rows) {
    const [nm] = key.split('|');
    console.log(`${String(v.n).padStart(3)}  ${v.near.split('@')[1].padStart(4)}  ${nm.padEnd(36)} ${v.hunt.padEnd(28)} ${String(v.huntrange).padStart(2)}  ${String(v.vis).padStart(3)}`);
}

// Ardougne Zoo neighbourhood too, and the dungeon under the atoll.
for (const [label, x0, x1, z0, z1] of [['ARDOUGNE ZOO area (2560..2623, 3240..3327)', 2560, 2623, 3240, 3327] as const, ['APE ATOLL DUNGEON (z+6400)', 2690, 2810, 9090, 9210] as const]) {
    const m = new Map<string, number>();
    for (const npc of World.npcs) {
        if (!npc) continue;
        if (npc.x < x0 || npc.x > x1 || npc.z < z0 || npc.z > z1) continue;
        const t = NpcType.get(npc.type);
        const hunt = t.huntmode >= 0 ? (HuntType.get(t.huntmode).debugname ?? String(t.huntmode)) : '(none)';
        const k = `${t.debugname!.padEnd(36)} ${hunt.padEnd(28)} L${npc.level} ${npc.x},${npc.z}`;
        m.set(k, (m.get(k) ?? 0) + 1);
    }
    console.log(`\n${label}: ${m.size} rows`);
    for (const [k, n] of [...m].sort()) console.log(`${String(n).padStart(3)}  ${k}`);
}
process.exit(0);
