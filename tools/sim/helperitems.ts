// WHAT A LEG OF A QUEST ASKS YOU TO BRING, AND WHETHER THE PANEL SAYS SO.
//
// Reported as "the golem. missing a few steps in helper how to reprogram the golem"
// (DeathPlateau-Bugs#59). Leg 7 of The Golem tells a player to "Use Pestle and mortar on Black
// mushroom" and listed no pestle and mortar, no papyrus and no vial - all three of which the quest
// never hands over, and all three of which were named on a panel the player last saw at the start
// of the quest, six legs earlier.
//
// ExportHelper has always SAID this should not happen: "a knife given at the top of the sim is a
// knife to bring in every leg that asks for it". It was not true. An item landed in the item list
// of whichever leg the sim's `give` line happened to sit in, which for most runs is the first one.
// 122 of these were missing across 50 of the 108 quests.
//
// THIS FILE IS THE DERIVATION, NOT THE EXAMPLE. It reads data/quests.json and asserts the property
// over every leg of every quest, because a check that named The Golem's three items would have been
// green for the other forty-nine.
//
//   npx tsx tools/sim/helperitems.ts
import * as fs from 'node:fs';
import * as path from 'node:path';
import { check, R } from './a1lib.ts';

type Item = { name: string; id: number; n: number; bring: boolean };
type Step = { kind?: string; text?: string; item?: number; gives?: number[] };
type Stage = { from: number; steps: Step[]; items: Item[]; worn: Item[] };
type Quest = { id: string; name: string; stages: Stage[] };

const file = path.join(import.meta.dirname, '..', '..', 'data', 'quests.json');
const quests: Quest[] = (JSON.parse(fs.readFileSync(file, 'utf8')) as { quests: Quest[] }).quests;

console.log(`\n${quests.length} quests, ${quests.reduce((a, q) => a + q.stages.length, 0)} legs\n`);
check('the table is there and has quests in it', quests.length > 50, true);

// ---------------------------------------------------------------- 1. every leg lists what it needs
//
// An item is a BROUGHT one if some leg of its quest lists it with bring=true: that is the exporter's
// record that the sim had to be handed it rather than the quest producing it. A leg whose steps use
// one has to list it, because the panel shows one leg at a time.
console.log('1. EVERY LEG THAT USES A BROUGHT ITEM LISTS IT');
let legsChecked = 0;
const bad: string[] = [];
for (const q of quests) {
    const brought = new Map<number, string>();
    for (const st of q.stages) {
        for (const it of st.items) {
            if (it.bring && it.id >= 0) brought.set(it.id, it.name);
        }
    }
    if (!brought.size) continue;
    for (let i = 0; i < q.stages.length; i++) {
        const st = q.stages[i];
        const listed = new Set(st.items.map(x => x.id));
        legsChecked++;
        for (const step of st.steps) {
            if (step.item === undefined || step.item < 0) continue;
            if (!brought.has(step.item) || listed.has(step.item)) continue;
            bad.push(`${q.id} leg ${i}: "${step.text}" needs ${brought.get(step.item)} and the leg does not list it`);
        }
    }
}
check(`  over ${legsChecked} legs with a shopping list`, bad.slice(0, 8).join('; ') || '(all list what they use)', '(all list what they use)');
check('  there were legs to check', legsChecked > 100, true);

// ---------------------------------------------------------------- 2. and the list does not grow
//
// THE OTHER DIRECTION, because "list more items" is a fix whose failure mode is listing everything.
// The thing to catch is a leg asking a player to go and fetch something the quest hands over.
//
// IT IS A BASELINE AND NOT A ZERO, and the first version of this check was a zero and failed. Five
// items in this build can be EITHER brought or found along the way - a cabbage, a feather, a rope, a
// ball of wool and Karamjan rum - so "some step gives it" and "some leg wants you to bring it" are
// both true of them, legitimately. There are eleven such (quest, leg, item) rows. The number is
// pinned rather than the rows, so a twelfth has to be looked at and explained; adding a brought item
// to a leg that uses it, which is what this change does, adds none of them.
console.log('\n2. AND NOTHING THE QUEST GIVES YOU BECOMES SOMETHING TO FETCH');
const dual: string[] = [];
for (const q of quests) {
    const given = new Set<number>();
    for (const st of q.stages) {
        for (const step of st.steps) {
            for (const g of step.gives ?? []) given.add(g);
        }
    }
    for (let i = 0; i < q.stages.length; i++) {
        for (const it of q.stages[i].items) {
            if (it.bring && given.has(it.id)) dual.push(`${q.id} leg ${i}: ${it.name}`);
        }
    }
}
check('  items that are both brought and found, which is a real thing', dual.length, 11);
check('    and they are the five that can go either way', [...new Set(dual.map(d => d.split(': ')[1]))].sort().join(', '), 'Ball of wool, Cabbage, Feather, Karamjan rum, Rope');

// ---------------------------------------------------------------- 3. The Golem's own leg
//
// Named rather than derived, and only after the derivation above: this is the leg the report was
// about, and seeing it by name in the output is worth one check.
console.log('\n3. AND THE LEG THE REPORT WAS ABOUT');
{
    const golem = quests.find(q => q.id === 'golem');
    check('  The Golem is in the table', !!golem, true);
    const leg = golem?.stages.find(s => s.from === 7);
    check('  it has a leg 7 (the reprogramming)', !!leg, true);
    const names = (leg?.items ?? [])
        .filter(i => i.bring)
        .map(i => i.name)
        .sort();
    // The vial is the one of the three that CANNOT be derived - no step names it, because
    // [opheldu,golem_mushroom] refuses without one and says nothing about the click. It is declared
    // in the manifest for that reason, so this check is what notices if that line is removed.
    check('  and lists all three things you must bring to it', names.join(', '), 'Papyrus, Pestle and mortar, Vial');
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
