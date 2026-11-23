// What is multi-way, what should be, and the csv lines to make it so.
//
//   npx tsx tools/sim/multiway.ts audit              known multi areas vs maps/multiway.csv
//   npx tsx tools/sim/multiway.ts npc <name>...      the zones those npcs spawn in, as csv lines
//   npx tsx tools/sim/multiway.ts square <sq>...     every zone those squares have ground on, as
//                                                    csv lines. 'm39_156' is all four levels;
//                                                    'm36_79:0' is level 0 only.
//
// maps/multiway.csv is a list of ZONES - 8x8 tiles - and GameMap.isMulti looks a tile up by the
// zone it falls in.
//
// WHAT THIS CANNOT TELL YOU. Nothing in the 377 cache says which areas Old School treats as
// multi-way, so the audit half is checked against a written-down list. The npc and square halves
// are derived from the built map and cannot be got wrong; the list cannot be got RIGHT by any
// means available here, which is why it carries its sources in comments and why an area nobody
// has written down is not checked at all.
//
// WHY ZONES WITH NO GROUND ARE SKIPPED. The first version of this audit compared hand-drawn
// rectangles against the csv and reported God Wars as 247/256 - nine zones short. All nine are
// void: m44_82's south-west corner and the strips where the four squares meet have no level-0
// tiles at all, and the csv is right not to list them. A rectangle over a dungeon is always
// bigger than the dungeon, so the question has to be "every zone with ground on it", not "every
// zone in the box" - otherwise the audit reports a gap that cannot be closed and the real gaps
// hide behind it.
import World from '#/engine/World.js';
import * as H from './harness.ts';
import NpcType from '#/cache/config/NpcType.js';
import { CoordGrid } from '#/engine/CoordGrid.js';
import fs from 'fs';

await H.boot();

const CSV = '../content/maps/multiway.csv';
const zoneKey = (level: number, x: number, z: number) => `${level}_${x >> 6}_${z >> 6}_${((x >> 3) << 3) & 63}_${((z >> 3) << 3) & 63}`;

// WHICH ZONES HAVE GROUND, read out of the squares' own .jm2 MAP sections.
//
// NOT GameMap.isZoneAllocated, which was the first thing tried here and is a different question:
// it answers "has a collision zone been allocated", and that is true for all four levels of any
// square the map loaded, ground or not. Asking it made God Wars read 780/1024 - it counted three
// empty upper levels of four squares as missing coverage. A .jm2's MAP section lists exactly the
// tiles that exist, which is the question, and it is the same source the God Wars block in the
// csv was derived from in the first place.
const MAPS = '../content/maps';
const groundCache = new Map<string, Set<string> | null>();

function groundOf(mx: number, mz: number): Set<string> | null {
    const key = `m${mx}_${mz}`;
    if (groundCache.has(key)) return groundCache.get(key)!;
    const path = `${MAPS}/${key}.jm2`;
    if (!fs.existsSync(path)) {
        groundCache.set(key, null);
        return null;
    }
    const tiles = new Set<string>();
    let inMap = false;
    for (const line of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
        if (line.startsWith('====')) {
            inMap = line.includes('MAP');
            continue;
        }
        if (!inMap) continue;
        const m = /^(\d+) (\d+) (\d+):/.exec(line.trim());
        if (m) tiles.add(`${m[1]}_${m[2]}_${m[3]}`);
    }
    groundCache.set(key, tiles);
    return tiles;
}

/** Does this 8x8 zone have any tile at all on this level? */
function zoneHasGround(level: number, x: number, z: number): boolean {
    const tiles = groundOf(x >> 6, z >> 6);
    if (!tiles) return false;
    for (let dx = 0; dx < 8; dx++) {
        for (let dz = 0; dz < 8; dz++) {
            if (tiles.has(`${level}_${(x + dx) & 63}_${(z + dz) & 63}`)) return true;
        }
    }
    return false;
}

/** Every zone maps/multiway.csv already covers. */
function current(): Set<string> {
    const out = new Set<string>();
    for (const line of fs.readFileSync(CSV, 'utf8').split(/\r?\n/)) {
        const t = line.trim();
        if (!t || t.startsWith('//')) continue;
        out.add(t);
    }
    return out;
}

const mode = process.argv[2] ?? 'audit';
const have = current();

if (mode === 'npc') {
    const names = process.argv.slice(3);
    if (!names.length) throw new Error('name at least one npc');
    const ids = new Map<number, string>();
    for (const n of names) {
        const id = NpcType.getId(n);
        if (id === -1) throw new Error('no such npc: ' + n);
        ids.set(id, n);
    }
    const zones = new Map<string, { who: Set<string>; n: number }>();
    for (const npc of World.npcs) {
        const who = ids.get(npc.type);
        if (!who) continue;
        const k = zoneKey(npc.level, npc.x, npc.z);
        const e = zones.get(k) ?? { who: new Set<string>(), n: 0 };
        e.who.add(who);
        e.n++;
        zones.set(k, e);
    }
    const missing = [...zones.keys()].filter(k => !have.has(k)).sort();
    console.log(`${names.join(', ')}: ${[...zones.values()].reduce((s, e) => s + e.n, 0)} spawns over ${zones.size} zones`);
    console.log(`${zones.size - missing.length} already multi, ${missing.length} not\n`);
    for (const k of missing) console.log(k);
    process.exit(0);
}

/** 'm39_156' or 'm36_79:0' -> the square's x/z and which levels to walk. */
function parseSquare(arg: string): { mx: number; mz: number; levels: number[] } {
    const m = /^m(\d+)_(\d+)(?::(\d))?$/.exec(arg);
    if (!m) throw new Error(`not a map square: ${arg} (want m44_82 or m44_82:0)`);
    return { mx: +m[1], mz: +m[2], levels: m[3] === undefined ? [0, 1, 2, 3] : [+m[3]] };
}

if (mode === 'square') {
    const args = process.argv.slice(3);
    if (!args.length) throw new Error('name at least one map square');
    let emitted = 0;
    let already = 0;
    for (const arg of args) {
        const { mx, mz, levels } = parseSquare(arg);
        for (const level of levels) {
            const lines: string[] = [];
            for (let lx = 0; lx < 64; lx += 8) {
                for (let lz = 0; lz < 64; lz += 8) {
                    const x = (mx << 6) + lx;
                    const z = (mz << 6) + lz;
                    if (!zoneHasGround(level, x, z)) continue;
                    const k = zoneKey(level, x, z);
                    if (have.has(k)) {
                        already++;
                        continue;
                    }
                    lines.push(k);
                }
            }
            if (!lines.length) continue;
            emitted += lines.length;
            for (const l of lines) console.log(l);
        }
    }
    console.error(`\n${emitted} zones with ground and not yet multi; ${already} already in the csv.`);
    process.exit(0);
}

// ---------------------------------------------------------------------------- the audit
//
// Each entry is a place this build means to treat as multi-way, written as boxes of THIS BUILD'S
// coordinates - not Old School's. That distinction is the whole reason the previous version of
// this list was wrong about six of its nine entries: it carried Old School's real-world coords
// for the Dagannoth Kings (2880-2943 x 4352-4415), for Zulrah's shrine (2256-2280 x 3064-3080)
// and for the Corporeal Beast, and this build puts the Kings at m45_69, copies Zulrah out of a
// template at m36_79, and has no Corporeal Beast at all. Three of the six "gaps" were the audit
// looking at empty map, and the csv had been right all along.
//
// 'exact' is whether the box is the area or merely around it. An exact box can be held to "every
// zone with ground on it is multi"; an approximate one cannot, so it reports a proportion and is
// not counted as a gap. "Most sections of Falador" is not a rectangle anyone can write down.
type Box = { level: number; x1: number; z1: number; x2: number; z2: number };
type Area = { name: string; osrs: string; exact: boolean; boxes: Box[] };

/** Whole map squares, which is how most dungeons and every instance template are described. */
const sq = (levels: number[], mx: number, mz: number): Box[] => levels.map(level => ({ level, x1: mx << 6, z1: mz << 6, x2: (mx << 6) + 63, z2: (mz << 6) + 63 }));

const KNOWN: Area[] = [
    // --- named on the OSRS multicombat list, and exactly bounded in this build ---
    { name: 'God Wars Dungeon', osrs: 'listed', exact: true, boxes: [...sq([0, 1, 2, 3], 44, 82), ...sq([0, 1, 2, 3], 45, 82), ...sq([0, 1, 2, 3], 44, 83), ...sq([0, 1, 2, 3], 45, 83)] },
    { name: 'Kalphite Lair', osrs: 'listed', exact: true, boxes: sq([0, 2], 54, 148) },
    { name: 'Waterbirth: Kings lair', osrs: 'listed (whole dungeon)', exact: true, boxes: sq([0], 45, 69) },
    // m28_68 is planes 1-3 only, deliberately. The csv's block covers "every plane the
    // dagexp_ladder network actually uses" and area_waterbirth.constant names planes 1, 2 and 3 of
    // this square and never plane 0 - there is ground down there but no ladder reaches it, so it
    // is not part of the dungeon. Asking for it made the maze read 646/710 forever.
    { name: 'Waterbirth: the maze', osrs: 'listed (whole dungeon)', exact: true, boxes: [...sq([1, 2, 3], 28, 68), ...sq([0, 1, 2, 3], 29, 68), ...sq([0, 1, 2, 3], 30, 68)] },
    { name: 'Mole Hole', osrs: 'listed', exact: true, boxes: [...sq([0], 27, 80), ...sq([0], 27, 81)] },
    { name: 'Lighthouse Dungeon', osrs: 'listed', exact: true, boxes: sq([0], 39, 156) },
    // Four squares, derived from where the atoll's own npcs stand - NOT from a box. m45_42 holds
    // jungle snakes too and is Crash Island, so it is not here.
    { name: 'Ape Atoll', osrs: 'listed', exact: true, boxes: [...sq([0], 42, 42), ...sq([0], 43, 42), ...sq([0], 42, 43), ...sq([0], 43, 43)] },
    // The maze under the atoll, which the four squares above do not cover: m42_142 and friends
    // are a separate block in the csv. Plane 0 only - planes 1 and 2 have ground but no spawns,
    // and the dungeon the Marim ladder reaches is the plane 0 maze.
    { name: 'Ape Atoll Dungeon', osrs: 'listed', exact: true, boxes: [...sq([0], 42, 142), ...sq([0], 43, 142), ...sq([0], 42, 143), ...sq([0], 43, 143)] },
    { name: 'Piscatoris Fishing Colony', osrs: 'listed', exact: true, boxes: sq([0], 36, 57) },
    // The WHOLE jungle, on Corey's call (13 October). The OSRS list says "western Kharazi
    // Jungle" and defines no boundary for western, so this is deliberately wider than the
    // wording - see the csv's own comment.
    { name: 'Kharazi Jungle', osrs: "listed (whole, this build's call)", exact: true, boxes: [...sq([0], 43, 45), ...sq([0], 44, 45), ...sq([0], 45, 45)] },
    { name: 'Pest Control island', osrs: 'listed', exact: true, boxes: sq([0], 41, 40) },
    // The sewers are the EASTERN three quarters of m49_154. The western two columns of zones
    // (local x0-15) are the Edgeville Dungeon - Vannaka stands there, with the skeletons and
    // zombies - and that is a different place which Old School does not list as multi. Checking
    // the whole square reported the sewers 48/64 and the missing sixteen were never the sewers.
    { name: 'Varrock Sewers', osrs: 'listed', exact: true, boxes: [{ level: 0, x1: (49 << 6) + 16, z1: 154 << 6, x2: (49 << 6) + 63, z2: (154 << 6) + 63 }] },
    { name: 'The Abyss', osrs: 'listed', exact: true, boxes: sq([0], 47, 75) },
    { name: 'Castle Wars', osrs: 'listed', exact: true, boxes: sq([0, 1, 2, 3], 37, 48) },

    // --- this build's own calls, not Old School's: both are instance templates, and both were
    //     made multi because the fight does not work single-way. See the csv's own comments.
    // The csv marks the four-by-four block the instance is copied from (local 16-47), not the
    // whole square, so that is what is checked - see the csv's own comment on why the walkway is
    // inside it.
    { name: "Zulrah's shrine (template)", osrs: "this build's call", exact: true, boxes: [{ level: 0, x1: (36 << 6) + 16, z1: (79 << 6) + 16, x2: (36 << 6) + 47, z2: (79 << 6) + 47 }] },
    { name: 'Fight Caves (template)', osrs: 'Mor Ul Rek listed', exact: true, boxes: sq([0], 37, 79) },

    // --- named on the OSRS list, but the extent is a judgement call, so these report a
    //     proportion rather than pass or fail ---
    { name: 'Falador (most of it)', osrs: 'listed', exact: false, boxes: [...sq([0, 1, 2, 3], 46, 51), ...sq([0, 1, 2, 3], 46, 52), ...sq([0, 1, 2, 3], 46, 53)] },
    { name: 'Barbarian Village', osrs: 'listed', exact: false, boxes: sq([0], 48, 53) },
    { name: "Wizards' Tower", osrs: 'listed', exact: false, boxes: sq([0, 1, 2], 48, 49) },
    { name: 'Ranging Guild', osrs: 'listed', exact: false, boxes: sq([0, 2], 41, 53) },
    { name: 'White Wolf Mountain', osrs: 'listed', exact: false, boxes: sq([0], 44, 54) },
    { name: 'Al Kharid Palace', osrs: 'listed', exact: false, boxes: [{ level: 0, x1: 3280, z1: 3155, x2: 3312, z2: 3180 }] },
    { name: 'Battlefield (S of W Ardougne)', osrs: 'listed', exact: false, boxes: sq([0], 39, 50) },
    { name: 'Inner Kraken Cove', osrs: 'listed', exact: false, boxes: sq([0], 35, 156) },
    { name: 'Lava Dragon Isle', osrs: 'listed', exact: false, boxes: [{ level: 0, x1: 3161, z1: 3785, x2: 3230, z2: 3840 }] },
    { name: "Rogues' Castle", osrs: 'listed', exact: false, boxes: [{ level: 0, x1: 3260, z1: 3910, x2: 3310, z2: 3950 }] },
    { name: 'Demonic Ruins', osrs: 'listed', exact: false, boxes: [{ level: 0, x1: 3266, z1: 3869, x2: 3304, z2: 3897 }] },
    { name: 'Scorpion Pit', osrs: 'listed', exact: false, boxes: [{ level: 0, x1: 3220, z1: 3780, x2: 3250, z2: 3810 }] }
];

// AREAS DELIBERATELY NOT IN THE LIST ABOVE, so the next person does not have to find out twice:
//
//   Barrows (crypts and tunnels)  Not on the OSRS multicombat list. The Barrows page, the
//                                 strategy page and the list itself say nothing either way, so
//                                 there is no source to mark it from - and marking the brothers'
//                                 crypts multi on a hunch would change a fight nobody reported.
//   Slayer Tower (any floor)      Same: absent from the list, and no page states a combat type.
//   Corporeal Beast lair          Not in this build at all - m39_68 has no map. The old audit
//                                 carried a box for it and reported it as a gap on every run.
//   Forgotten Cemetery (ankou)    The OSRS list names the Graveyard of Shadows, not this
//                                 graveyard, and the build's ankou stand at m46_58. Left single.
//   Emir's Arena / Duel Arena     Listed by OSRS, but as "Emir's Arena" - the modern rebuild.
//                                 This is a 377 server and the question is a decision about PvP
//                                 furniture rather than a boss fight, so it is Corey's to make.
//   Stronghold of Security,       On the OSRS list; none of them exist in this build.
//   Barbarian Assault, Fight
//   Pits, Woodcutting Guild,
//   Hosidius, Jatizso, Neitiznot,
//   Jormungand's Prison

function zonesOf(a: Area): string[] {
    const out = new Set<string>();
    for (const b of a.boxes) {
        for (let x = b.x1; x <= b.x2; x += 8) {
            for (let z = b.z1; z <= b.z2; z += 8) {
                if (!zoneHasGround(b.level, x, z)) continue;
                out.add(zoneKey(b.level, x, z));
            }
        }
    }
    return [...out];
}

console.log(`maps/multiway.csv covers ${have.size} zones\n`);
let gaps = 0;
let unbuilt = 0;

for (const strict of [true, false]) {
    console.log(strict ? 'EXACTLY BOUNDED - every zone with ground on it should be multi' : '\nAPPROXIMATELY BOUNDED - the box is around the area, so a proportion is the answer');
    for (const a of KNOWN.filter(a => a.exact === strict)) {
        const uniq = zonesOf(a);
        if (!uniq.length) {
            unbuilt++;
            console.log(`  ${a.name.padEnd(30)} not in this build (no map)`);
            continue;
        }
        const missing = uniq.filter(k => !have.has(k));
        let state: string;
        if (missing.length === 0) state = `all multi (${uniq.length} zones)`;
        else if (missing.length === uniq.length) state = `NONE MULTI (${uniq.length} zones)`;
        else state = `${uniq.length - missing.length}/${uniq.length} zones multi`;
        if (strict && missing.length) gaps++;
        console.log(`  ${a.name.padEnd(30)} ${state}   [${a.osrs}]`);
    }
}

// ------------------------------------------------------------------ and now ask the engine
//
// EVERYTHING ABOVE COMPARES THE CSV WITH ITSELF. The boxes are hand-written and the coverage
// test reads the same file the engine reads, so a clean audit proves the text is consistent and
// nothing more. This asks the other question: take the monsters these areas exist for, find
// where they actually stand on the built map, and ask World.gameMap.isMulti - the engine call
// that content and the combat code go through - whether that tile is multi-way. If a line in the
// csv is misspelled, in the wrong square, or addressed to an instance instead of its template,
// the audit above still passes and this fails.
// 'squares' narrows the check where an npc record is shared between places. mm_jungle_snake
// stands on Ape Atoll AND on Crash Island, and only one of those is multi-way, so without the
// filter this reports nine failures that are the correct answer.
//
// THESE POSITIONS ARE NOT THE SAME EVERY BOOT. An npc with a wander radius is placed at a random
// tile in range when the world starts, so this check samples rather than proves. For the four
// whole-square areas that is not a risk and it was measured rather than assumed: every tile
// within maxrange of every one of their spawns is multi - 0 of 7,100 reachable tiles single-way
// across lava_dragon, mole_giant, horror_dagannoth_medium and dagcave_melee_boss. Kharazi is the
// one that needed the filter, for the reason given on its line.
const LIVE: { area: string; npcs: string[]; squares?: string[] }[] = [
    { area: 'Mole Hole', npcs: ['mole_giant', 'mole_baby_01', 'mole_baby_02', 'mole_baby_03'] },
    { area: 'Lighthouse Dungeon', npcs: ['horror_dagannoth_medium', 'horror_dagannoth_medium_darker', 'horror_dagannoth_medium_lighter', 'horror_dagannoth_jr1', 'horror_dagannoth_jr2', 'horror_dagannoth_jr3'] },
    { area: 'Ape Atoll', npcs: ['mm_jungle_spider', 'mm_jungle_scorpion', 'mm_jungle_snake'], squares: ['m42_42', 'm43_42', 'm42_43', 'm43_43'] },
    // Scoped to the four underground squares because mm_warehouse_spider is shared: it stands in
    // the maze AND on the atoll surface, so without the filter this entry would be answering for
    // the island as well as the dungeon.
    { area: 'Ape Atoll Dungeon', npcs: ['mm_skeleton', 'mm_zombie_monkey_small', 'mm_zombie_monkey_large', 'mm_zombie_monkey_large_guard', 'mm_warehouse_spider'], squares: ['m42_142', 'm43_142', 'm42_143', 'm43_143'] },
    // Scoped to the jungle for a second reason: jungle_savage has wanderrange=38 (maxrange 40),
    // the widest in the cache, so a savage spawned near the jungle's east edge is routinely
    // placed out past x2943 and onto the Karamja coast. That is not a gap - a multi-way area is a
    // PLACE, and a monster that walks out of it is in single-way ground, which is how Old School
    // behaves too. Without this filter the check failed on 3 runs in 5 and the csv was right
    // every time. Widening the csv to chase the savage would have marked coast multi on the
    // strength of one npc's wander radius.
    { area: 'Kharazi Jungle', npcs: ['jungle_wolf', 'jungle_savage', 'oomlie_bird'], squares: ['m43_45', 'm44_45', 'm45_45'] },
    { area: 'Dagannoth Kings', npcs: ['dagcave_melee_boss', 'dagcave_magic_boss', 'dagcave_ranged_boss'] },
    { area: 'Lava Dragon Isle', npcs: ['lava_dragon'] }
];

console.log('\nAND WHAT THE ENGINE SAYS, at the coords those monsters actually stand on');
let liveFails = 0;
for (const l of LIVE) {
    const ids = new Set<number>();
    for (const n of l.npcs) {
        const id = NpcType.getId(n);
        if (id === -1) throw new Error('no such npc: ' + n);
        ids.add(id);
    }
    let on = 0;
    let off = 0;
    const examples: string[] = [];
    const only = l.squares ? new Set(l.squares) : null;
    for (const npc of World.npcs) {
        if (!ids.has(npc.type)) continue;
        if (only && !only.has(`m${npc.x >> 6}_${npc.z >> 6}`)) continue;
        if (World.gameMap.isMulti(CoordGrid.packCoord(npc.level, npc.x, npc.z))) on++;
        else {
            off++;
            if (examples.length < 3) examples.push(`${npc.level},${npc.x},${npc.z}`);
        }
    }
    if (off) liveFails++;
    const total = on + off;
    console.log(`  ${l.area.padEnd(30)} ${off === 0 ? `all ${total} spawns on multi ground` : `${off} of ${total} NOT multi (${examples.join('; ')})`}`);
}

console.log(`\n${gaps} exactly bounded ${gaps === 1 ? 'area has' : 'areas have'} a gap; ${unbuilt} not in this build; ${liveFails} ${liveFails === 1 ? 'area fails' : 'areas fail'} the engine's own answer.`);
console.log('The approximate half is informational: a box drawn around a town is bigger than the');
console.log('part of the town Old School marks, so less than 100% there is not by itself a fault.');
console.log('And this list is written down rather than read out of the cache - a place that is not');
console.log('in it is not checked at all, so a clean run here does not mean the build has no gaps.');
process.exit(gaps || liveFails ? 1 : 0);
