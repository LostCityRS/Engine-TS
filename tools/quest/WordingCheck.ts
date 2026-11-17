// The quest helper's table, read the way a PLAYER reads it.
//
//   npx tsx tools/quest/WordingCheck.ts [quests.json]
//
// WHAT THIS IS FOR. Every row in data/quests.json is a sentence a person reads while standing in
// the game with the quest open, and the sentences are GENERATED - out of sim prose written for
// another developer, and out of debugnames out of the server's own source. Each rule below is a
// shape that reached the panel and read as a machine talking:
//
//   "Go to the walk back north out of the swamp."   a journey described as if it were a place
//   "Go to and the east room."                      a fragment joined to the step before it
//   "Use an item on Cauldron."                      true, and no use to someone at the cauldron
//   "Talk to agrith reen alkharid."                 a handle out of the content, lowercased
//   "plaguesheep 1."                                a step with no verb at all
//
// WHY A CHECK AND NOT A TEST OF THE EXPORTER. The exporter's rules are regular expressions over
// English, and the interesting input is not what I would think to write down - it is the 5,322
// rows that 106 sims actually produce. So this reads the shipped table and asserts the shapes
// that cannot be right, which is a test over the real corpus rather than over my memory of it.
// A rule that fires names the quest and the row, because the fix is nearly always in the sim's
// prose rather than here.
import * as fs from 'fs';
import * as path from 'path';

const file = process.argv[2] ?? path.join(import.meta.dirname, '..', '..', 'data', 'quests.json');
const table = JSON.parse(fs.readFileSync(file, 'utf8')) as {
    quests: {
        name: string;
        stages: { steps: { text: string; kind: string; why?: string; id?: number; also?: number[] }[]; items: { name: string; bring: boolean }[] }[];
    }[];
};

interface Row {
    quest: string;
    text: string;
    kind: string;
    why?: string;
    /** The step's own npc id, and the others it would take: a crowd the player cannot tell apart. */
    id?: number;
    also?: number[];
}

const rows: Row[] = [];
for (const quest of table.quests) {
    for (const stage of quest.stages) {
        for (const step of stage.steps) {
            rows.push({
                quest: quest.name,
                text: step.text,
                kind: step.kind,
                why: step.why,
                id: step.id,
                also: step.also
            });
        }
    }
}

/** A handle like `fever_multi_cannon`, but not a filename like `gnome_glider.rs2`. */
const HANDLE = /\b[a-z][a-z0-9]*_[a-z0-9_]+\b(?!\.[a-z0-9]{2,4}\b)/;

const RULES: { name: string; wrong: (row: Row) => boolean }[] = [
    { name: 'a server handle instead of a name', wrong: r => HANDLE.test(r.text) },
    { name: 'a stranded "Go to"', wrong: r => /^Go to (?:and|to|the walk|the way|all the way)\b/i.test(r.text) },
    { name: 'no full stop', wrong: r => !/[.!?]$/.test(r.text) },
    { name: 'does not open on a capital', wrong: r => !/^[A-Z"']/.test(r.text) },
    { name: 'an unnamed item', wrong: r => /\ban item\b/.test(r.text) },
    { name: 'empty', wrong: r => !r.text.trim() },
    { name: 'double spacing', wrong: r => /\s\s/.test(r.text) },
    // A step you can click has a verb in front of it; the ones that did not were a debugname on
    // its own. Walks and notes are prose and say what they say.
    // A note under an instruction is a label - which helmet, which attempt - and the manifests
    // write them as running commentary, so they arrive as the next sentence of a story.
    { name: 'an explanation that opens on a conjunction', wrong: r => /^(?:And|Then|But|So|Also)\b/.test(r.why ?? '') },
    // A walk that names nowhere tells a player nothing; it takes the name of what it leads to.
    { name: 'a walk with nothing in it', wrong: r => r.kind === 'walk' && r.text === 'Travel here.' },
    // A FAMILY IS OTHER npcs, and the client walks it after failing on the step's own id, so its
    // own id in there is dead weight and a repeat is a wasted comparison every frame. A family on
    // a step with no id of its own is a family of strangers: nothing would ever match the step
    // itself, so the marker could only ever point at somebody else.
    { name: "a family holding the step's own id", wrong: r => (r.also ?? []).includes(r.id ?? -1) },
    { name: 'a family with the same id twice', wrong: r => new Set(r.also ?? []).size !== (r.also ?? []).length },
    { name: 'a family on a step with no id', wrong: r => (r.also ?? []).length > 0 && (r.id ?? -1) < 0 },
    { name: 'an empty family, which is no family', wrong: r => Array.isArray(r.also) && r.also.length === 0 },
    {
        name: 'no verb in front of the target',
        wrong: r => r.kind !== 'walk' && r.kind !== 'note' && !/^[A-Z][a-zA-Z-]* /.test(r.text)
    },
    // A CHARACTER THE CLIENT'S FONT CANNOT DRAW. PixFont keeps one glyph per character in arrays
    // of 256 indexed by the character itself, so anything above 255 is an
    // ArrayIndexOutOfBoundsException the moment the helper measures or draws the row - and a
    // plugin cannot catch that: five frames later the client has turned it off, and a player who
    // switches it back on lands on the same step and loses it again. 32 rows across 16 quests
    // shipped with a typographic apostrophe in them, because the sims' prose is written with
    // them; The Knight's Sword had one in its first leg. The exporter folds them to ASCII on the
    // way out, and this is the check that says so rather than hoping.
    {
        name: 'a character the client font cannot draw',
        wrong: r => /[^\x20-\x7E]/.test(r.text) || /[^\x20-\x7E]/.test(r.why ?? '')
    }
];

let failed = 0;
for (const rule of RULES) {
    const hits = rows.filter(rule.wrong);
    if (!hits.length) {
        console.log(`  ok   no row has ${rule.name} (${rows.length} read)`);
        continue;
    }
    failed += hits.length;
    console.log(`  FAIL ${hits.length} rows have ${rule.name}:`);
    for (const hit of hits.slice(0, 8)) console.log(`         ${hit.quest} | ${hit.text}`);
    if (hits.length > 8) console.log(`         ... and ${hits.length - 8} more`);
}

// A STEP THE SIM HANDS OVER IS STILL A STEP THE PLAYER HAS TO DO. A manifest gives itself an item it
// cannot get legitimately in a run (`give: 'knights_portrait'`), and the exporter used to drop that
// as part of the shopping list, so the helper said "bring a Portrait" and never said where it comes
// from. These are the quests known to have such a step; each must still tell the player to do it.
const MUST_TELL: { quest: string; what: string; text: RegExp }[] = [
    { quest: "THE KNIGHT'S SWORD", what: "the portrait comes out of Sir Vyvin's cupboard", text: /cupboard/i },
    // Found by sweeping every `give` in every manifest against the quest's own scripts: these two
    // hand over something the player MAKES, so the helper listed the finished thing and never said
    // what it is made from. The cats need a house, which no sim has, and the bowl is two gold bars.
    { quest: 'THE GREAT BRAIN ROBBERY', what: 'the wooden cats are carved from planks and fur', text: /carve/i },
    { quest: "LEGENDS' QUEST", what: 'the gold bowl is forged from gold bars', text: /forge/i }
];
for (const need of MUST_TELL) {
    const quest = table.quests.find(q => q.name === need.quest);
    const said = quest?.stages.some(stage => stage.steps.some(step => need.text.test(step.text)));
    if (said) {
        console.log(`  ok   ${need.quest} tells the player ${need.what}`);
        continue;
    }
    failed++;
    console.log(`  FAIL ${need.quest} never tells the player ${need.what}`);
}

// A TIER THE QUEST DOES NOT ASK FOR IS NOT A REQUIREMENT. A sim hands itself whatever tool makes its run
// reliable, and the helper reads that as "bring this", so a quest that needs any pickaxe came out as
// "bring a Rune pickaxe". Each quest here asks for the lowest tier, so a higher one showing up in its
// bring list is the sim's choice leaking into the table.
const MUST_NOT_BRING: { quest: string; item: RegExp; why: string }[] = [{ quest: "THE KNIGHT'S SWORD", item: /^Rune pickaxe$/i, why: 'the blurite only needs a pickaxe and 10 Mining' }];
for (const rule of MUST_NOT_BRING) {
    const quest = table.quests.find(q => q.name === rule.quest);
    const asked = quest?.stages.flatMap(stage => stage.items).filter(item => item.bring && rule.item.test(item.name)) ?? [];
    if (!asked.length) {
        console.log(`  ok   ${rule.quest} does not ask the player to bring ${rule.item.source}`);
        continue;
    }
    failed += asked.length;
    console.log(`  FAIL ${rule.quest} asks the player to bring ${asked[0].name} (${rule.why})`);
}

// The table is only worth reading if it has the quests in it: an empty file passes every rule
// above and would make this check a decoration.
if (rows.length < 1000) {
    console.log(`  FAIL only ${rows.length} rows in ${file}, which is not the quest table`);
    failed++;
}

console.log(failed ? `\n${failed} rows read as a machine talking` : '\nALL PASS');
process.exit(failed ? 1 : 0);
