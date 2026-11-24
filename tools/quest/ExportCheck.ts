// IS data/quests.json WHAT THE EXPORTER WRITES NOW?
//
//   npx tsx tools/quest/ExportCheck.ts
//
// That file is GENERATED, by tools/quest/ExportHelper.ts, out of the sim manifests in tools/sim
// and the packed content. It is also COMMITTED, because the client ships a copy of it as the
// fallback its quest helper reads. So it can go stale in a way nothing else in this repository
// can: the sources move, the generated file does not, and everything still compiles and passes.
//
// WHAT WENT WRONG THE DAY THIS WAS WRITTEN. Four PRs that each regenerate the table merged in
// sequence - #110, #122, #124 and #128. Each was exported against the tree as it stood when it
// was WRITTEN, so what landed on 377-wip was whichever one merged last. Two quests were wrong by
// then: MONKEY MADNESS was two steps short, because #119 added two steps to its manifest and
// merged without a re-export, and HEROES' QUEST (Phoenix side) was two items short, because #128
// created that row before #122 taught the exporter to list brought items. Engine CI was green
// through all of it. The CLIENT's run_helpertabletest.py caught it, from the far side, after the
// fact - and that is a strange place for the engine's own generated file to be checked.
//
// WHY A WHOLE EXPORT RATHER THAN A STAMP. A hash of the inputs would be cheaper and would answer
// the wrong question: the inputs include every manifest, the exporter, and every name in the
// packed cache, so the only honest test of "is this file current" is to write it again and look.
// It takes a second or two once the cache is packed.
//
// WHAT A FAILURE MEANS, AND WHAT IT DOES NOT. It does not mean anybody did anything wrong - a
// stale table is the normal consequence of two correct PRs landing in either order. The fix is
// always the same and never a judgement: run the exporter, commit the result. So this prints the
// command rather than describing the problem.
//
// IT CAN GO RED ON A CONTENT MERGE, which is deliberate and worth knowing. The exporter reads
// loc, npc and obj names out of the packed cache, so renaming a loc in DeathPlateau-Content makes
// the engine's committed table stale without a single engine commit. That is a true statement
// about the file and the reason this check exists; it is also why the failure text says which
// content commit it was measured against.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';

import Environment from '#/util/Environment.js';

const COMMITTED = path.join(import.meta.dirname, '..', '..', 'data', 'quests.json');
const fresh = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'questexport-')), 'fresh.json');

if (!fs.existsSync(COMMITTED)) {
    console.log(`no committed table at ${COMMITTED}`);
    process.exit(1);
}

// A SUBPROCESS, NOT AN IMPORT. ExportHelper is a script: it boots nothing, but it runs its work at
// the top level and writes to argv[2] on the way out. Importing it would run that work as a side
// effect of the import and give no way to point it somewhere else.
console.log('exporting a fresh table to compare against...');
execFileSync(process.execPath, [path.join(import.meta.dirname, '..', '..', 'node_modules', 'tsx', 'dist', 'cli.mjs'), path.join(import.meta.dirname, 'ExportHelper.ts'), fresh], {
    cwd: path.join(import.meta.dirname, '..', '..'),
    stdio: ['ignore', 'inherit', 'inherit'],
    env: process.env
});

const a = fs.readFileSync(COMMITTED, 'utf8');
const b = fs.readFileSync(fresh, 'utf8');
if (a === b) {
    console.log('\nok   data/quests.json is what the exporter writes now');
    process.exit(0);
}

// WHICH QUESTS, because "the file differs" is unactionable and the whole file is 1.6MB. Counting
// steps and items per quest is what made today's two differences legible in about a minute.
type Leg = { steps?: unknown[]; items?: unknown[] };
type Quest = { name?: string; quest?: string; stages?: Leg[]; legs?: Leg[] };
const read = (text: string): Map<string, [number, number]> => {
    const parsed = JSON.parse(text) as Quest[] | { quests?: Quest[] };
    const quests: Quest[] = Array.isArray(parsed) ? parsed : (parsed.quests ?? []);
    const out = new Map<string, [number, number]>();
    for (const q of quests) {
        const legs = q.stages ?? q.legs ?? [];
        let steps = 0;
        let items = 0;
        for (const leg of legs) {
            steps += (leg.steps ?? []).length;
            items += (leg.items ?? []).length;
        }
        out.set(String(q.name ?? q.quest ?? '?'), [steps, items]);
    }
    return out;
};

const was = read(a);
const now = read(b);
console.log('\nFAIL data/quests.json is NOT what the exporter writes now.\n');
const names = [...new Set([...was.keys(), ...now.keys()])].sort();
let named = 0;
for (const name of names) {
    const x = was.get(name);
    const y = now.get(name);
    if (x && y && x[0] === y[0] && x[1] === y[1]) {
        continue;
    }
    named++;
    if (!x) {
        console.log(`  ${name}: not in the committed table at all`);
    } else if (!y) {
        console.log(`  ${name}: in the committed table and no longer exported`);
    } else {
        console.log(`  ${name}: steps ${x[0]} -> ${y[0]}, items ${x[1]} -> ${y[1]}`);
    }
}
// A REWORDING CHANGES NO COUNT. #124 moved 290 step texts and not one step count, so a difference
// with nothing above it is real and is simply not visible per quest.
if (named === 0) {
    console.log('  no quest changed its step or item count, so this is a wording or label change');
    console.log('  (290 steps were reworded by #124 without moving a single count)');
}
console.log(`\n  committed: ${a.length} bytes      fresh: ${b.length} bytes`);
console.log(`  content read from: ${Environment.BUILD_SRC_DIR}`);
console.log('\nThe fix is never a judgement - run the exporter and commit what it writes:');
console.log('\n    npx tsx tools/quest/ExportHelper.ts\n');
console.log('Then the client ships a copy of it, so refresh that too:');
console.log('    cp data/quests.json ../DeathPlateau-Client/src/main/resources/deathplateau/quests.json\n');
process.exit(1);
