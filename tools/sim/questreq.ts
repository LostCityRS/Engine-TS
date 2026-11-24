// WHAT THE QUEST JOURNAL NOW SAYS A QUEST STILL NEEDS, for every quest, on a real player.
//
// ~quest_requirements_text reads quest_requirement.dbrow and colours each line green or red
// against the player in front of it. This runs it for all 109 quests twice - once on a brand new
// character, who should be told about nearly everything, and once on a maxed one, who should be
// told about nothing except the prose lines nothing can check.
//
//   npx tsx tools/sim/questreq.ts [name]
import * as H from './harness.ts';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import DbTableType from '#/cache/config/DbTableType.js';
import DbRowType from '#/cache/config/DbRowType.js';

await H.boot();

const only = process.argv[2];

function requirementsFor(p: any, name: string): string {
    const script = ScriptProvider.getByName('[proc,quest_requirements_text]');
    if (!script) throw new Error('no [proc,quest_requirements_text] - did the build run?');
    // ARGS GO THROUGH init, NOT ONTO THE STACK BY HAND. Pushing the name myself left the proc's
    // own parameter unset, so db_find looked up the empty string, found nothing and returned ""
    // for all 109 quests - which looks exactly like a content bug and is not one.
    const state = ScriptRunner.init(script, p, null, [name]);
    ScriptRunner.execute(state);
    const strings = (state as any).stringStack as string[];
    const top = (state as any).ssp as number;
    return top > 0 ? strings[top - 1] : '';
}

// every quest the table knows, by the name the journal is handed
const names: string[] = [];
for (let id = 0; id < DbRowType.count; id++) {
    const row = DbRowType.get(id);
    if (!row || !row.debugname?.startsWith('quest_req_')) continue;
    const table = DbTableType.getId('quest_requirement');
    if (row.tableId !== table) continue;
    // column 1 is `name`, the quest list's own label - see quest_requirement.dbtable
    const v = row.columnValues?.[1]?.[0];
    if (typeof v === 'string') names.push(v);
}
names.sort();

// makePlayer wants a tile: these two never move, so Lumbridge will do for both.
const fresh = H.makePlayer('reqfresh', 3222, 3218);
const maxed = H.makePlayer('reqmaxed', 3222, 3218);
H.maxOut(maxed);

let shown = 0;
let silent = 0;
let colourless = 0;
for (const name of names) {
    if (only && name !== only) continue;
    const a = requirementsFor(fresh, name);
    const b = requirementsFor(maxed, name);
    if (a.length > 0) shown++;
    else silent++;
    if (a.length > 0 && !a.includes('@red@') && !a.includes('@gre@')) colourless++;
    if (only || a.length > 0) {
        console.log(`\n=== ${name}`);
        console.log(`  new player : ${a.replace(/\|/g, '\n               ') || '(nothing)'}`);
        console.log(`  maxed      : ${b.replace(/\|/g, '\n               ') || '(nothing)'}`);
    }
}
console.log(`\n${names.length} quests in the table`);
console.log(`  ${shown} tell a brand new player something is missing`);
console.log(`  ${silent} say nothing to a brand new player (no requirements at all)`);
console.log(`  ${colourless} printed a block with no coloured line in it - should be 0`);
process.exit(0);
