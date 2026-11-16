// A QUEST IS COMPLETE WHEN THE GAME SAYS IT IS.
//
//   npx tsx tools/sim/questdone.ts
//
// Each quest in data/quests.json carries a `done` value, and ExportHelper drops every leg at or above
// it (`stages.filter(st => st.from < done)`): the panel reads a player at or past `done` as finished
// and shows them nothing. So `done` is the helper's definition of "complete", and if it disagrees with
// the game's own definition the panel either keeps giving steps to somebody who has finished or marks
// somebody finished who has not.
//
// THE GAME'S OWN DEFINITION is the threshold its quest list uses. `~questlist_row(questlist:x, %var,
// ^x_complete, ...)` turns a quest's row green at `%var >= ^x_complete`, so that constant is the
// number this compares against - read out of the content rather than restated here, because a
// restated copy is a second thing to keep in step.
//
// WHY THIS NEEDS A CARE: `done` comes from the sim manifest, where it has meant two different things.
// For most quests the run plays to the end and `done` is both the run's last stage and the quest's
// completion. For a run that stops early, or takes one of two endings, those are different numbers -
// Heroes' Quest stops where a single player must stop, Temple of Ikov plays the Lucien ending - and
// the helper needs the quest's number, not the run's. Four quests had the run's.
import * as fs from 'fs';
import * as path from 'path';

const CONTENT = process.env.BUILD_SRC_DIR ?? '../content';
const TABLE = path.join(import.meta.dirname, '..', '..', 'data', 'quests.json');

/** Every `^name = number` the content declares. */
function constants(dir: string): Map<string, number> {
    const out = new Map<string, number>();
    const walk = (d: string) => {
        for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
            const p = path.join(d, entry.name);
            if (entry.isDirectory()) walk(p);
            else if (entry.name.endsWith('.constant')) {
                for (const line of fs.readFileSync(p, 'ascii').split('\n')) {
                    const m = /^\s*\^([A-Za-z0-9_]+)\s*=\s*(-?\d+)\s*$/.exec(line);
                    if (m && !out.has(m[1])) out.set(m[1], Number(m[2]));
                }
            }
        }
    };
    walk(path.join(dir, 'scripts'));
    return out;
}

/** progress var -> the constant its quest-list row goes green at. */
function thresholds(dir: string): Map<string, string> {
    const out = new Map<string, string>();
    const file = path.join(dir, 'scripts', 'general', 'scripts', 'quests.rs2');
    for (const line of fs.readFileSync(file, 'ascii').split('\n')) {
        const m = /questlist_row\(questlist:[a-z0-9_]+,\s*%([a-z0-9_]+),\s*\^([A-Za-z0-9_]+)/.exec(line);
        if (m) out.set(m[1], m[2]);
    }
    return out;
}

if (!fs.existsSync(path.join(CONTENT, 'scripts'))) {
    console.log(`  FAIL no content at ${CONTENT} - set BUILD_SRC_DIR to the content checkout`);
    process.exit(1);
}

const consts = constants(CONTENT);
const rows = thresholds(CONTENT);
const table = JSON.parse(fs.readFileSync(TABLE, 'utf8')) as {
    quests: { name: string; stageVar?: string; stageIsVarbit?: boolean; done?: number }[];
};

let failed = 0;
let checked = 0;
const skipped: string[] = [];
for (const quest of table.quests) {
    const varName = quest.stageVar;
    if (!varName || quest.stageIsVarbit) {
        skipped.push(quest.name);
        continue;
    }
    const cname = rows.get(varName);
    const want = cname === undefined ? undefined : consts.get(cname);
    if (want === undefined) {
        skipped.push(quest.name);
        continue;
    }
    checked++;
    if (quest.done === want) continue;
    failed++;
    console.log(`  FAIL ${quest.name}: the helper finishes it at ${quest.done}, the game at ${want} (^${cname})`);
}

console.log(`\n  ${checked} quests checked against the game's own completion threshold, ${skipped.length} with no quest-list row to compare`);
console.log(failed ? `${failed} disagree` : 'ALL PASS');
process.exit(failed ? 1 : 0);
