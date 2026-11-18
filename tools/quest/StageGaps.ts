// EVERY PROGRESS VALUE THE CONTENT CAN WRITE THAT THE QUEST HELPER HAS NO LEG FOR.
//
// A leg in data/quests.json exists only where a sim's playthrough REACHED that progress value:
// `{ stage: N }` in a manifest asserts the var equals N, it does not set it. So any value the
// content can write that no sim route crosses has no row, and a player sitting there is shown the
// last leg at or below it - one they have already finished. That is what the helper does by
// design: QuestHelperPlugin.stageNow takes the last leg whose `from` is at or below the value.
//
// It does not crash. DeathPlateau-Client's section 15b draws all four overlays on 3,132 legless
// values without a throw. It misinforms, which is the report on DeathPlateau-Bugs#3 - "very
// inaccurate. Wrong info & skips steps".
//
// WHY A RATCHET AND NOT A CHECK. Not every legless value is a bug, and the reasons are not
// mechanical:
//
//   - above-done   the value is past the quest's `done`, and completion is `questValue >= done`,
//                  so the quest already reads as finished. Nothing to show.
//   - benign       the fallback leg is already the right instruction. A fork usually leaves the
//                  player talking to the SAME npc, and the previous leg generally names them.
//   - transient    the value exists for a few ticks inside a locked cutscene - p_delay, if_close,
//                  a queue that completes the quest - with nothing the player can click.
//   - blocked      the value is on a branch no single-player manifest route can reach, so no
//                  marker can be added without a second playthrough.
//   - unassertable the value is a real resting state, but the stretch leading out of it has no
//                  player decision in it, so there is no point a manifest can break off at.
//   - real         a genuine gap. These get a `{ stage: N }` marker and leave the baseline.
//
// Judging which needs reading the quest, so the verdicts are DATA - one line each in
// stagegaps-baseline.txt, with the reason written down. This tool holds the line from there: a
// build that makes a NEW value legless fails, and one that fixes a known one says so without
// failing. The same shape as tools/sim/opsweep.ts.
//
//   npx tsx tools/quest/StageGaps.ts              print the report, exit 0
//   npx tsx tools/quest/StageGaps.ts --check      exit 1 on anything NEW
//   npx tsx tools/quest/StageGaps.ts --baseline   rewrite the baseline, keeping known verdicts
//
// Reads the committed table and the content scripts. No cache, no world: about a second.
import * as fs from 'fs';
import * as path from 'path';

const argv = process.argv.slice(2);
const CHECK = argv.includes('--check');
const WRITE_BASELINE = argv.includes('--baseline');
const BASELINE_FILE = path.join('tools', 'quest', 'stagegaps-baseline.txt');
const TABLE_FILE = path.join('data', 'quests.json');
const CONTENT = process.env.BUILD_SRC_DIR ?? '../content';

const CATEGORIES = ['above-done', 'benign', 'transient', 'blocked', 'unassertable', 'unclassified'];

interface Row {
    quest: string;
    value: number;
    shown: number | null;
    sites: string[];
}

// ------------------------------------------------------------------------------------- the content
if (!fs.existsSync(CONTENT)) {
    console.log(`no content at ${CONTENT} - set BUILD_SRC_DIR to the content checkout`);
    process.exit(1);
}

/** Every file under a directory with one of these extensions. */
function walk(dir: string, exts: string[], out: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walk(full, exts, out);
        } else if (exts.some(e => entry.name.endsWith(e))) {
            out.push(full);
        }
    }
    return out;
}

const SCRIPTS = path.join(CONTENT, 'scripts');
const constants = new Map<string, number>();
for (const file of walk(SCRIPTS, ['.constant'])) {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
        const m = /^\s*\^(\w+)\s*=\s*(-?\d+)\s*$/.exec(line);
        if (m) constants.set(m[1], parseInt(m[2]));
    }
}

// Every assignment to a player var anywhere in the content, by var name. `%var = ^const;` and
// `%var = 7;` only: a write whose right-hand side is an expression or another var cannot be
// resolved to a number here and is not counted, which is why this is a ratchet and not a proof.
const writes = new Map<string, { value: number; where: string }[]>();
const ASSIGN = /%(\w+)\s*=\s*(\^\w+|-?\d+)\s*;/g;
for (const file of walk(SCRIPTS, ['.rs2'])) {
    const rel = path.relative(CONTENT, file);
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trimStart().startsWith('//')) continue;
        for (const m of lines[i].matchAll(ASSIGN)) {
            const raw = m[2];
            const value = raw.startsWith('^') ? constants.get(raw.slice(1)) : parseInt(raw);
            if (value === undefined || Number.isNaN(value)) continue;
            if (!writes.has(m[1])) writes.set(m[1], []);
            writes.get(m[1])!.push({ value, where: `${rel}:${i + 1}` });
        }
    }
}

// --------------------------------------------------------------------------------------- the table
const table = JSON.parse(fs.readFileSync(TABLE_FILE, 'utf8')) as {
    quests: { name: string; stageVar: string; done: number; stages: { from: number }[] }[];
};

const rows: Row[] = [];
for (const quest of table.quests) {
    const legs = new Set(quest.stages.map(s => s.from));
    const seen = new Map<number, string[]>();
    for (const w of writes.get(quest.stageVar) ?? []) {
        if (!seen.has(w.value)) seen.set(w.value, []);
        seen.get(w.value)!.push(w.where);
    }
    for (const value of [...seen.keys()].sort((a, b) => a - b)) {
        if (legs.has(value) || value === quest.done) continue;
        const below = [...legs].filter(l => l <= value).sort((a, b) => b - a)[0];
        rows.push({
            quest: quest.name,
            value,
            shown: below === undefined ? null : below,
            sites: [...new Set(seen.get(value)!)].sort()
        });
    }
}
rows.sort((a, b) => a.quest.localeCompare(b.quest) || a.value - b.value);

const key = (r: { quest: string; value: number }) => `${r.quest}\t${r.value}`;

// ------------------------------------------------------------------------------------ the baseline
interface Known {
    category: string;
    reason: string;
}
const known = new Map<string, Known>();
if (fs.existsSync(BASELINE_FILE)) {
    let lineNo = 0;
    for (const line of fs.readFileSync(BASELINE_FILE, 'utf8').split('\n')) {
        lineNo++;
        if (!line.trim() || line.startsWith('#')) continue;
        const parts = line.split('|').map(s => s.trim());
        if (parts.length < 4) {
            console.log(`${BASELINE_FILE}:${lineNo}: not four fields - ${line}`);
            process.exit(1);
        }
        const [quest, value, category, ...rest] = parts;
        if (!CATEGORIES.includes(category)) {
            console.log(`${BASELINE_FILE}:${lineNo}: unknown category "${category}"`);
            process.exit(1);
        }
        known.set(`${quest}\t${parseInt(value)}`, { category, reason: rest.join(' | ') });
    }
}

if (WRITE_BASELINE) {
    const width = Math.max(...rows.map(r => r.quest.length), 10);
    const out = [
        '# Every progress value the content can write that the quest helper has no leg for, and the',
        '# verdict on each. Rewritten with: npx tsx tools/quest/StageGaps.ts --baseline',
        '#',
        '# quest | value | category | why it needs no leg',
        '#',
        `# ${CATEGORIES.filter(c => c !== 'unclassified').join(', ')} - and unclassified, which`,
        '# --baseline writes for a value nobody has judged yet. Read the quest and give it a verdict,',
        '# or fix it with a `{ stage: N }` marker in its manifest and let it leave this file.',
        '#'
    ];
    let unclassified = 0;
    for (const r of rows) {
        const was = known.get(key(r));
        if (!was) unclassified++;
        const category = was?.category ?? 'unclassified';
        const reason = was?.reason ?? 'NOT YET JUDGED - read the quest';
        out.push(`${r.quest.padEnd(width)} | ${String(r.value).padStart(3)} | ${category.padEnd(12)} | ${reason}`);
    }
    fs.writeFileSync(BASELINE_FILE, out.join('\n') + '\n');
    console.log(`baseline written: ${BASELINE_FILE} (${rows.length} values)`);
    if (unclassified) console.log(`  ${unclassified} of them unclassified - give each a verdict`);
    process.exit(0);
}

// -------------------------------------------------------------------------------------- the report
const added = rows.filter(r => !known.has(key(r)));
const fixed = [...known.keys()].filter(k => !rows.some(r => key(r) === k));
const byCategory = new Map<string, number>();
for (const r of rows) {
    // `new` and `unclassified` are different things and were counted as one: a value with no
    // baseline line at all is NEW and is the thing --check fails on, while `unclassified` is a
    // line somebody added without a verdict. Reporting the first as the second said "1 value in
    // the baseline is still unclassified" about a value that was not in the baseline.
    const c = known.get(key(r))?.category ?? 'not in the baseline';
    byCategory.set(c, (byCategory.get(c) ?? 0) + 1);
}

console.log(`${rows.length} legless values the content can write, across ${new Set(rows.map(r => r.quest)).size} quests`);
for (const c of [...CATEGORIES, 'not in the baseline']) {
    if (byCategory.has(c)) console.log(`  ${String(byCategory.get(c)).padStart(3)}  ${c}`);
}

if (!CHECK) {
    console.log('');
    for (const r of rows) {
        const was = known.get(key(r));
        console.log(`${r.quest} ${r.value}  shown instead: leg ${r.shown ?? 'none'}  [${was?.category ?? 'UNCLASSIFIED'}]`);
        console.log(`    ${was?.reason ?? 'not in the baseline'}`);
        console.log(`    set at ${r.sites.slice(0, 2).join('; ')}`);
    }
    process.exit(0);
}

if (!fs.existsSync(BASELINE_FILE)) {
    console.log(`\nno baseline at ${BASELINE_FILE} - run with --baseline first`);
    process.exit(1);
}

console.log('');
if (added.length) {
    console.log(`${added.length} NEW legless value(s) - a player sitting here is shown a leg they have finished:`);
    for (const r of added) {
        console.log(`  ${r.quest} ${r.value}  shown instead: leg ${r.shown ?? 'none'}`);
        console.log(`      set at ${r.sites.slice(0, 2).join('; ')}`);
    }
    console.log('');
    console.log("Each wants ONE of: a `{ stage: N }` marker in that quest's manifest, or a line in");
    console.log(`${BASELINE_FILE} saying why it needs no leg.`);
}
for (const k of fixed.slice(0, 10)) {
    console.log(`  fixed: ${k.replace('\t', ' ')} - has a leg now, or is no longer written`);
}
if (fixed.length > 10) console.log(`   ... and ${fixed.length - 10} more fixed`);

const unclassified = byCategory.get('unclassified') ?? 0;
if (unclassified) console.log(`\n${unclassified} value(s) in the baseline are still unclassified`);
console.log(`\n${added.length} new, ${fixed.length} fixed`);
process.exit(added.length ? 1 : 0);
