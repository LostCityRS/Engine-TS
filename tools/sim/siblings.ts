// A LOC WHOSE TWIN IS ANSWERED AND IT IS NOT.
//
//   npx tsx tools/sim/siblings.ts              print the report, exit 0
//   npx tsx tools/sim/siblings.ts --check      exit 1 on a NEW family
//   npx tsx tools/sim/siblings.ts --baseline   rewrite tools/sim/siblings-baseline.txt
//
// WHY THIS IS NOT opsweep, AND NOT placeddead EITHER. opsweep-baseline.txt lists every option no
// script answers - 1,628 dead loc lines, which is not a list anyone reads, which is how a player
// came to report log_withaxe (#26) after opsweep had already recorded it. placeddead.ts narrows
// that to the options on locs that are PLACED, which is the set a player can reach, and ranks by
// spawn count. That found wheat_tall.
//
// But the thing every real find has in common is not how many there are. It is that the cache
// offers a COMPLETE SET and the content wires part of it:
//
//   log_withaxe        the log with an axe in it, beside the one without
//   wheat_tall         one of four Wheat, the other three picked
//   loc474_22300       a fifth Wheat on Harmony Island, missed on the first pass at wheat_tall
//   draynor_wardrobe   a recoloured copy of spookywardrobe, whole family unwired
//   wild_door          declared with its own open state, neither half wired
//   viking_crate_2     drawn from crate3, which is wired, and it was not
//
// A ranking by spawn count cannot show that, because the dead member and its working twin sit
// wherever their spawn counts put them - loc474_22300 was 460 lines from the wheat_tall I was
// looking at. So this groups every loc by (name, ops) and keeps the families where SOME members
// are answered and some are not. A new one of those is a much stronger signal than a new dead
// option on its own: it means somebody added or edited a set and missed a member of it.
//
// DeathPlateau-Bugs#27. The verdicts on the families that are NOT bugs - an empty banana tree, a
// locked chest, a depleted rock, an unbuilt minigame - are recorded on that issue rather than
// here, because this file holds signatures and the reasoning does not fit in one.
import * as fs from 'fs';
import * as path from 'path';
import * as H from './harness.js';
import { isVisibleOp } from '#/cache/config/OpVisibility.js';
import LocType from '#/cache/config/LocType.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import World from '#/engine/World.js';

const argv = process.argv.slice(2);
const WRITE_BASELINE = argv.includes('--baseline');
const CHECK = argv.includes('--check');
const BASELINE_FILE = path.join('tools', 'sim', 'siblings-baseline.txt');

await H.boot();

/**
 * A specific or category trigger, never the global.
 *
 * Lifted from opsweep.ts, deliberately unchanged: the two tools have to agree on what "answered"
 * means or this one reports families opsweep considers fine. The global fallback is excluded for
 * the same reason it is there - ScriptProvider.getByTrigger falls back to the no-subject script,
 * so counting it would call every option in the game answered.
 */
function claimed(trigger: number, type: number, category: number): boolean {
    if (ScriptProvider.getByTriggerSpecific(trigger, type, -1)) {
        return true;
    }
    return category !== -1 && !!ScriptProvider.getByTriggerSpecific(trigger, -1, category);
}

// Multiloc: a shell's options may be answered on one of its children, or the other way round.
const locFamily = new Map<number, number[]>();
for (let id = 0; id < LocType.count; id++) {
    const kin = (LocType.get(id).multiloc ?? []).filter(i => i >= 0);
    if (!kin.length) {
        continue;
    }
    locFamily.set(id, [id, ...kin]);
    for (const child of kin) {
        locFamily.set(child, [...new Set([...(locFamily.get(child) ?? [child]), id, ...kin])]);
    }
}

// Every placement on the map, bucketed by type id.
const spawns = new Map<number, number>();
for (const zone of (World.gameMap as any).zonemap.zones.values()) {
    for (const loc of zone.getAllLocsUnsafe()) {
        spawns.set(loc.type, (spawns.get(loc.type) ?? 0) + 1);
    }
}

interface Member {
    id: number;
    name: string;
    placed: number;
    deadOps: number[];
    liveOps: number[];
}

const families = new Map<string, Member[]>();
for (let id = 0; id < LocType.count; id++) {
    const type = LocType.get(id);
    if (!type || !type.op || !type.name || type.name === 'null') {
        continue;
    }
    const kin = locFamily.get(id) ?? [id];
    const visible: string[] = [];
    const deadOps: number[] = [];
    const liveOps: number[] = [];
    for (let op = 0; op < type.op.length; op++) {
        const label = type.op[op];
        if (!isVisibleOp(label)) {
            continue;
        }
        visible.push(`op${op + 1}="${label}"`);
        const answered = kin.some(f => {
            const t = LocType.get(f);
            return claimed(ServerTriggerType.OPLOC1 + op, f, t.category) || claimed(ServerTriggerType.APLOC1 + op, f, t.category);
        });
        (answered ? liveOps : deadOps).push(op);
    }
    if (!visible.length) {
        continue;
    }
    // The signature is the name a player reads plus the options they are offered. Two locs with
    // the same name and the same options are the same thing to everybody except the content.
    const sig = `${type.name}\t${visible.join(' ')}`;
    const list = families.get(sig) ?? [];
    list.push({
        id,
        name: type.debugname ?? String(id),
        placed: kin.reduce((n, f) => n + (spawns.get(f) ?? 0), 0),
        deadOps,
        liveOps
    });
    families.set(sig, list);
}

interface Gap {
    sig: string;
    placedDead: number;
    dead: Member[];
    live: Member[];
}

const gaps: Gap[] = [];
for (const [sig, members] of families) {
    if (members.length < 2) {
        continue;
    }
    const dead = members.filter(m => m.deadOps.length > 0);
    const live = members.filter(m => m.deadOps.length === 0);
    if (!dead.length || !live.length) {
        continue;
    }
    const placedDead = dead.reduce((n, m) => n + m.placed, 0);
    // A family whose dead members are nowhere on the map is unreachable content, which is
    // opsweep's business and not this tool's: nobody can click it.
    if (placedDead === 0) {
        continue;
    }
    gaps.push({ sig, placedDead, dead, live });
}
gaps.sort((a, b) => b.placedDead - a.placedDead || a.sig.localeCompare(b.sig));

/** One stable line per family, so the file can be committed and diffed. */
function signature(g: Gap): string {
    const [name, ops] = g.sig.split('\t');
    const deadNames = g.dead
        .map(m => m.name)
        .sort()
        .join(',');
    return `family  ${name} | ${ops} | dead: ${deadNames}`;
}

if (WRITE_BASELINE) {
    const out = [
        '# Families where some members are answered and some are not, by (name, ops).',
        '# Rewritten with: npx tsx tools/sim/siblings.ts --baseline',
        '#',
        '# A line here is a family somebody has looked at. The verdicts - which are bugs and which',
        '# are an empty banana tree, a locked chest, a depleted rock or an unbuilt minigame - are on',
        '# DeathPlateau-Bugs#27, because the reasoning does not fit on one line.',
        '#',
        `# ${gaps.length} families, ${gaps.reduce((n, g) => n + g.placedDead, 0)} placed spawns on their dead members.`,
        '#',
        ...gaps.map(signature)
    ];
    fs.writeFileSync(BASELINE_FILE, out.join('\n') + '\n');
    console.log(`baseline written: ${BASELINE_FILE} (${gaps.length} families)`);
    process.exit(0);
}

console.log(`${gaps.length} families where some members are answered and some are not, ` + `${gaps.reduce((n, g) => n + g.placedDead, 0)} placed spawns on the dead ones`);

if (!CHECK) {
    console.log('');
    for (const g of gaps.slice(0, 30)) {
        const [name, ops] = g.sig.split('\t');
        console.log(`${String(g.placedDead).padStart(5)} placed dead  ${name.padEnd(22)} ${ops}`);
        console.log(
            `        dead: ${g.dead
                .map(m => `${m.name}(${m.placed})`)
                .slice(0, 5)
                .join(', ')}`
        );
        console.log(
            `      WIRED : ${g.live
                .map(m => `${m.name}(${m.placed})`)
                .slice(0, 5)
                .join(', ')}`
        );
    }
    if (gaps.length > 30) {
        console.log(`\n... and ${gaps.length - 30} more - run with --baseline to write them all out`);
    }
    process.exit(0);
}

if (!fs.existsSync(BASELINE_FILE)) {
    console.log(`\nno baseline at ${BASELINE_FILE} - run with --baseline first`);
    process.exit(1);
}

const known = new Set(
    fs
        .readFileSync(BASELINE_FILE, 'utf8')
        .split('\n')
        .filter(l => l.startsWith('family'))
        .map(l => l.trim())
);
const now = gaps.map(g => signature(g));
const added = now.filter(l => !known.has(l));
const fixed = [...known].filter(l => !now.includes(l));

console.log('');
if (added.length) {
    console.log(`${added.length} NEW family(s) with a member nobody answers:`);
    for (const l of added) {
        console.log(`  ${l}`);
    }
    console.log('');
    console.log('Each is a set where the content wires some members and misses others, which is the');
    console.log('shape of every real find on DeathPlateau-Bugs#27. Wire the missing one, or bank it');
    console.log('with --baseline and say on that issue why it is not a bug.');
}
for (const l of fixed.slice(0, 10)) {
    console.log(`  fixed: ${l}`);
}
if (fixed.length > 10) {
    console.log(`   ... and ${fixed.length - 10} more fixed - rerun with --baseline to bank them`);
}
console.log(`\nAGAINST THE BASELINE: ${added.length} new, ${fixed.length} fixed`);
process.exit(added.length ? 1 : 0);
