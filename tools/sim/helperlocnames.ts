// NO QUEST-HELPER STEP MAY SHOW A PLAYER AN INTERNAL NAME.
//
// 295 of them did, across 30 quests: "Use Burgh Inn Trapdoor Multiloc.", "Activate Desert Treasure
// Oblix1.", "Use 4to7.", "Pull Deal Multi Lever." - and for eight locs with no debugname either,
// "Use Iron sheet on Loc 14933." Measured and filed as DeathPlateau-Bugs#79.
//
// EVERY ONE WAS A MULTILOC SHELL, which is the finding that made it fixable rather than a wording
// exercise. The issue was filed guessing the opposite - that 82 of the 144 locs were plain ones
// with no name anywhere, needing 82 names invented. There are none: all 144 are shells, and all 144
// have at least one named child. So the fix uses the name the cache already gives the thing standing
// on the tile, and chooses no words at all.
//
// THIS FILE IS THE STANDING CHECK the issue asked for, and it could not exist before the fix: it
// would have been red 295 times, which was the point - there was no guard on this, and that is why
// 295 accumulated.
//
//   npx tsx tools/sim/helperlocnames.ts
import * as H from './harness.ts';
import { check, R } from './a1lib.ts';
import LocType from '#/cache/config/LocType.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

await H.boot();

type Step = { kind?: string; text?: string; target?: string; id?: number; label?: string };
type Quest = { id: string; name: string; stages: { steps: Step[] }[] };
const quests: Quest[] = (JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '..', '..', 'data', 'quests.json'), 'utf8')) as { quests: Quest[] }).quests;

/** The exporter's own titling, which is what a fallback name looks like in the panel. */
const titled = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const realName = (t: unknown): string | null => {
    const n = (t as { name?: string } | undefined)?.name;
    return n && n !== 'null' ? String(n) : null;
};

// ONLY kind === 'loc'. The first version of this file took every step with a target and asked
// LocType about its id - and an npc id and a loc id are different numbering, so LocType.get() on
// Lady Servil's id returns some unrelated loc, usually a nameless one. That made this file report
// that Ghosts Ahoy points at a loc with no name anywhere and that "Lady Servil" is an internal
// name. Both were nonsense about the wrong population; the step's own `kind` is what says which
// table its id belongs to.
const locSteps: { q: string; step: Step }[] = [];
for (const q of quests) {
    for (const st of q.stages) {
        for (const s of st.steps) {
            if (s.kind === 'loc' && s.target && s.id !== undefined && s.id >= 0 && s.text) locSteps.push({ q: q.name, step: s });
        }
    }
}
console.log(`\n${locSteps.length} steps name a loc the player has to click\n`);
check('there are loc steps to check at all', locSteps.length > 1000, true);
check('  and every one of their ids is in the loc table', locSteps.filter(x => !LocType.get(x.step.id!)).length, 0);

// ---------------------------------------------------------------- 1. nothing falls back
//
// A step with NO LABEL is the fault's signature: the exporter resolved no name, so defaultText
// titled the internal handle and that string went to the player. Every one of the 295 looked
// exactly like this.
console.log("1. NO STEP FELL BACK TO ITS TARGET'S INTERNAL NAME");
{
    const unlabelled = locSteps.filter(x => !x.step.label);
    check(
        '  every target step carries a resolved name',
        unlabelled
            .slice(0, 6)
            .map(x => `${x.q}: "${x.step.text}"`)
            .join('; ') || '(all named)',
        '(all named)'
    );

    // AND NOT JUST "IT HAS A LABEL": a label equal to the titled handle would satisfy the check
    // above and read exactly as badly.
    const titledHandle = locSteps.filter(x => x.step.label === titled(x.step.target!) && !realName(LocType.get(x.step.id!)));
    check(
        '  and none of those names IS the titled handle',
        titledHandle
            .slice(0, 6)
            .map(x => `${x.q}: ${x.step.label}`)
            .join('; ') || '(none)',
        '(none)'
    );
}

// ---------------------------------------------------------------- 2. the shells resolve
//
// DERIVED OVER THE CACHE, not over a list of 144. Any loc a step points at must have a name of its
// own or a named child - so a quest written tomorrow against a new shell fails here.
console.log('\n2. EVERY LOC A STEP POINTS AT HAS A NAME SOMEWHERE IN THE CACHE');
{
    const nameless: string[] = [];
    const shells = new Map<string, string[]>();
    for (const { step } of locSteps) {
        const t = LocType.get(step.id!);
        if (realName(t)) continue;
        const kids = ((t as unknown as { multiloc?: number[] })?.multiloc ?? []).filter(k => k >= 0);
        const kidNames = [...new Set(kids.map(k => realName(LocType.get(k))).filter(Boolean))] as string[];
        if (!kidNames.length) nameless.push(`${step.target} (${kids.length} children)`);
        else shells.set(step.target!, kidNames);
    }
    check('  no step points at a loc with no name anywhere', [...new Set(nameless)].slice(0, 6).join('; ') || '(none)', '(none)');
    check(`  and ${shells.size} of them are shells resolved through a child`, shells.size > 100, true);

    // THE CHOICES, PRINTED. multiloc[0] is the state the varbit selects before the quest touches
    // anything - a Damaged wall before it is repaired - and where a shell's children disagree that
    // choice is a judgement. Printing them is what makes the handful that read oddly findable
    // instead of buried in 800KB of JSON.
    const disagree = [...shells].filter(([, n]) => n.length > 1).sort();
    console.log(`\n       ${disagree.length} shells whose children do not all share one name:`);
    for (const [handle, names] of disagree) console.log(`         ${handle.padEnd(38)} ${names.join(' / ')}`);
}

// ---------------------------------------------------------------- 3. the eight worst, by name
//
// Named rather than derived, and only after the derivation above: these eight had no debugname
// either, so the panel showed a raw cache id. They are the ones worth seeing in the output.
console.log('\n3. AND THE EIGHT THAT SHOWED A RAW CACHE ID NOW READ AS THINGS');
for (const [handle, want] of [
    ['loc_12610', 'Banana tree'],
    ['loc_14933', 'Broken wall'],
    ['loc_14954', 'Metal Press'],
    ['loc_14955', 'Firebox']
] as const) {
    const step = locSteps.find(x => x.step.target === handle);
    // "(no label)" and not "(no step)": under a mutation the step is still there, it just has no
    // resolved name - and a failure line that says the step is missing sends the reader looking
    // for the wrong thing.
    check(`  ${handle.padEnd(10)} reads as "${want}"`, step === undefined ? '(no step at all)' : (step.step.label ?? '(no label)'), want);
    check('    and its text says so', step?.step.text?.includes(want) ?? false, true);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
