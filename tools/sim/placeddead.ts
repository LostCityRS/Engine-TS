// Which of opsweep's dead LOC options sit on locs a player can actually walk up to?
//
//   npx tsx tools/sim/placeddead.ts            the locs
//   npx tsx tools/sim/placeddead.ts --objs     the objs
//
// opsweep-baseline.txt lists 1,628 dead loc options. Most are on locs that are never placed on
// the map at all - content nobody can reach, which is a different problem and not an urgent one.
// This filters that list down to the ones with spawns, which is the set a player can click: 580
// options across 516 locs on the build this was written against.
//
// It found wheat_tall, whose op2="Pick" did nothing in the Lumbridge field (see wheatpick.ts).
// log_withaxe, which a player DID report as tracker issue 26, was on the same list.
//
// Hand-run, so no computed process.exit: sims.yml only takes files whose exit code is a verdict.
import * as H from './harness.js';
import LocType from '#/cache/config/LocType.js';
import World from '#/engine/World.js';
import Environment from '#/util/Environment.js';
import fs from 'fs';
import path from 'path';

const OBJS = process.argv.includes('--objs');

await H.boot();

// ------------------------------------------------------------------ objs: can a player get one?
//
// THE OBJ SIDE NEEDS ITS OWN FILTER AND IT IS NOT PLACEMENT. A loc is reachable when the map puts
// one down; an obj is reachable when a player can OBTAIN one - a shop row, a drop table, a quest
// reward, a recipe. Without that test this tool hands back a confident list of items nobody can
// hold: the twelve Achievement Diary sets were imported four tiers deep and only the elite tier is
// sold, so tiers 1-3 carry live-looking teleport options on items that do not exist in play.
//
// USED, NOT DECLARED, which is the whole trick. A .obj file is where an item is DEFINED, and being
// defined says nothing about obtainability - that is exactly what the diary tiers have. So the
// reference set is built from everything EXCEPT the .obj configs, and an obj counts as reachable
// only if something that hands items out names it.
function obtainable(): Set<string> {
    const words = new Set<string>();
    const root = path.join(Environment.BUILD_SRC_DIR, 'scripts');
    const walk = (dir: string): void => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) {
                if (e.name !== '_unpack') walk(full);
            } else if (!e.name.endsWith('.obj')) {
                const text = fs.readFileSync(full, 'utf8');
                for (const w of text.match(/[A-Za-z_][A-Za-z0-9_]{2,}/g) ?? []) words.add(w);
            }
        }
    };
    walk(root);
    return words;
}

if (OBJS) {
    const used = obtainable();
    const dead = new Map<string, string[]>();
    for (const line of fs.readFileSync('tools/sim/opsweep-baseline.txt', 'utf8').split('\n')) {
        const m = line.match(/^dead obj\s+(\S+)\s+(iop\d="[^"]*")/);
        if (!m) continue;
        dead.set(m[1], [...(dead.get(m[1]) ?? []), m[2]]);
    }
    const reachable = [...dead].filter(([o]) => used.has(o));
    const lines = [...dead.values()].reduce((s2, v) => s2 + v.length, 0);
    const kept = reachable.reduce((s2, [, v]) => s2 + v.length, 0);
    console.log(`dead obj held-op lines        : ${lines} across ${dead.size} objs`);
    console.log(`...on objs a player can OBTAIN: ${kept} across ${reachable.length} objs`);
    console.log(`...on objs nothing hands out  : ${lines - kept}   <- unobtainable config\n`);
    for (const [o, ops] of reachable.sort((a, b) => a[0].localeCompare(b[0]))) {
        console.log(`  ${o.padEnd(32)} ${ops.join(' ')}`);
    }
    process.exit(0);
}

// every placement on the map, bucketed by type id
const spawns = new Map<number, { x: number; z: number; level: number }[]>();
for (const zone of (World.gameMap as any).zonemap.zones.values()) {
    for (const loc of zone.getAllLocsUnsafe()) {
        const list = spawns.get(loc.type) ?? [];
        list.push({ x: loc.x, z: loc.z, level: loc.level });
        spawns.set(loc.type, list);
    }
}

const lines = fs.readFileSync('tools/sim/opsweep-baseline.txt', 'utf8').split('\n');
type Row = { name: string; ops: string[]; n: number; where: { x: number; z: number; level: number } };
const byName = new Map<string, Row>();
let deadLocLines = 0;

for (const line of lines) {
    const m = line.match(/^dead loc\s+(\S+)\s+(op\d="[^"]*")/);
    if (!m) continue;
    deadLocLines++;
    const id = LocType.getId(m[1]);
    if (id === -1) continue;
    const placed = spawns.get(id);
    if (!placed || placed.length === 0) continue;
    const row = byName.get(m[1]) ?? { name: m[1], ops: [], n: placed.length, where: placed[0] };
    row.ops.push(m[2]);
    byName.set(m[1], row);
}

const rows = [...byName.values()].sort((a, b) => b.n - a.n);
const totalOps = rows.reduce((s, r) => s + r.ops.length, 0);
console.log(`dead loc lines in the baseline : ${deadLocLines}`);
console.log(`...on locs that are PLACED     : ${totalOps} options across ${rows.length} locs`);
console.log(`...on locs never placed at all : ${deadLocLines - totalOps}\n`);
console.log('placed, dead, by number of spawns:');
for (const r of rows.slice(0, 30)) {
    const w = r.where;
    console.log(`  ${String(r.n).padStart(4)}x  ${r.name.padEnd(34)} ${r.ops.join(' ')}   first at ${w.x},${w.z}${w.level ? ' level ' + w.level : ''}`);
}
process.exit(0);
