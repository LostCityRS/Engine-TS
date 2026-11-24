/**
 * THE IRON SPIT'S SECOND MEAL: a raw chompy on the spit, and the skewered chompy on a fire.
 *
 * spit_skewered_chompy has sat in the 377 cache since the build was dumped - a model, a name, an
 * examine, and obj id 7230, which is the id Old School itself gives it - and NOTHING in the repo
 * reached it. So the only route the wiki documents for cooking a chompy did not exist
 * (DeathPlateau-Bugs#77). The same dead end the raw rabbit was in before spit_roast.rs2 was
 * written, found the same way and in the same file.
 *
 * Old School: an iron spit on a raw chompy makes a skewered chompy; the skewered chompy on a FIRE
 * at Cooking 30 makes a cooked chompy, or a ruined one.
 * https://oldschool.runescape.wiki/w/Skewered_chompy
 *
 * TWO THINGS HERE ARE EASY TO GET WRONG AND BOTH ARE CHECKED:
 *
 *   The pair has to work EITHER WAY ROUND. raw_chompy carries an [opheldu,raw_chompy] of its own
 *   for the chompy seasonings, and "use a on b" reaches only one of the two triggers - so a spit
 *   used on a chompy and a chompy used on a spit take different paths through the engine. Section 1
 *   drives both.
 *
 *   It must NOT be cookable on a range. A range has nowhere to rest a spit, which is why the
 *   rabbit has cantcookmessage_range, and a row that forgets it works everywhere in silence.
 *
 *   npx tsx tools/sim/skeweredchompy.ts
 */
import * as H from './harness.ts';
import * as A from './a1lib.ts';
import { check, R, player } from './a1lib.ts';
import ObjType from '#/cache/config/ObjType.js';
import InvType from '#/cache/config/InvType.js';
import DbRowType from '#/cache/config/DbRowType.js';
import DbTableType from '#/cache/config/DbTableType.js';

await H.boot();

// Open floor north of Lumbridge, away from anything that cooks or hunts.
const SPOT: [number, number] = [3221, 3218];

let n = 0;
function cook(cooking: number): any {
    const p: any = player('chomp' + ++n, SPOT[0], SPOT[1], 0);
    H.setVar(p, 'tutorial', 1000);
    p.levels[7] = cooking;
    p.baseLevels[7] = cooking;
    return p;
}

/**
 * What mes() said to this player. NOT what useHeld/useOn return - drive() collects the DIALOGUE a
 * click opens, and every line here is a plain mes(), so the returned array is empty and three
 * "...and it says so" checks passed vacuously until this was pointed at H.mesgs instead.
 */
function mesgsFor(p: any): string {
    return H.mesgs
        .filter(m => m.who === p.username)
        .map(m => m.text)
        .join(' | ');
}

function count(p: any, objName: string): number {
    const inv = p.getInventory(InvType.INV)!;
    const id = ObjType.getId(objName);
    let total = 0;
    for (let i = 0; i < inv.capacity; i++) {
        const o = inv.get(i);
        if (o?.id === id) total += o.count;
    }
    return total;
}

// ---- 1. the spit takes a chompy, either way round --------------------------------------------
console.log('\n1. an iron spit and a raw chompy make a skewered chompy');
for (const [first, second] of [
    ['spit_iron', 'raw_chompy'],
    ['raw_chompy', 'spit_iron']
] as [string, string][]) {
    const p = cook(30);
    H.give(p, 'spit_iron', 1);
    H.give(p, 'raw_chompy', 1);
    H.clearLogs();
    A.useHeld(p, first, second);
    const said = mesgsFor(p);
    check(`  ${first} on ${second}: one skewered chompy`, count(p, 'spit_skewered_chompy'), 1);
    check('    ...the raw chompy is spent', count(p, 'raw_chompy'), 0);
    // THE SPIT IS A TOOL, not an ingredient - one spit does a whole trip's worth, the way the
    // rabbit's does. A case that deleted it would be a quiet tax nobody notices until the fourth
    // chompy.
    check('    ...and the spit is KEPT', count(p, 'spit_iron'), 1);
    check('    ...and it says so', said.includes('You skewer the chompy on the iron spit.'), true);
}

// ---- 2. and the skewered chompy cooks on a fire ----------------------------------------------
console.log('\n2. the skewered chompy cooks, on a fire');
{
    const p = cook(99);
    H.give(p, 'spit_skewered_chompy', 1);
    A.addLoc('fireplace', SPOT[0] + 1, SPOT[1], 0);
    H.tick(1);
    H.clearLogs();
    A.useOn(p, SPOT[0] + 1, SPOT[1], 'fireplace', 'spit_skewered_chompy');
    H.tick(8);
    const said = mesgsFor(p);
    check('  a cooked chompy comes off it', count(p, 'cooked_chompy'), 1);
    check('    ...the skewered one is spent', count(p, 'spit_skewered_chompy'), 0);
    check('    ...and it says so', said.includes('You roast the chompy over the fire'), true);
}

// ---- 3. not below 30, and not on a range -----------------------------------------------------
console.log('\n3. the two refusals');
{
    const p = cook(29);
    H.give(p, 'spit_skewered_chompy', 1);
    A.addLoc('fireplace', SPOT[0] + 1, SPOT[1] + 4, 0);
    H.tick(1);
    H.clearLogs();
    A.useOn(p, SPOT[0] + 1, SPOT[1] + 4, 'fireplace', 'spit_skewered_chompy');
    H.tick(5);
    check('  Cooking 29 cooks nothing', count(p, 'cooked_chompy'), 0);
    check('    ...and the skewered chompy survives the refusal', count(p, 'spit_skewered_chompy'), 1);
}
{
    // A RANGE HAS NOWHERE TO REST A SPIT. The rabbit's row says so and this one must too; without
    // cantcookmessage_range the engine cooks it on a range and nothing notices.
    const p = cook(99);
    H.give(p, 'spit_skewered_chompy', 1);
    A.addLoc('range', SPOT[0] + 1, SPOT[1] + 8, 0);
    H.tick(1);
    H.clearLogs();
    A.useOn(p, SPOT[0] + 1, SPOT[1] + 8, 'range', 'spit_skewered_chompy');
    H.tick(8);
    check('  a range refuses it even at Cooking 99', count(p, 'cooked_chompy'), 0);
    check('    ...and the skewered chompy is not consumed by the refusal', count(p, 'spit_skewered_chompy'), 1);
}

// ---- 4. the burn curve is tuna's, pinned against tuna -----------------------------------
// WHY THIS IS A CONFIG PIN AND NOT A MEASURED RATE, said plainly because the first two versions of
// this section were both worthless.
//
// "Some burnt" was flaky: at Cooking 30 a 20-item batch burns about one, so a run burning none is
// ordinary and the check failed for nothing. Replacing it with "the chompy's cooked/burnt split
// equals tuna's" then read 20/0 against 20/0 - true, and true because NEITHER burned in that run,
// so it would have passed against any curve at all. That is a check green over exactly what it was
// written to catch, and swapping one for the other is not progress.
//
// So the claim is pinned where it is actually made: the row's own successchance, against the row it
// was copied from. Tuna unlocks at the same Cooking 30 for the same 100 xp, so it is the one row in
// the table carrying both of this one's numbers, and "the chompy burns like tuna" is a statement
// about two pairs of integers. Section 2 and the 99 check below are what prove the row is reached.
console.log("\n4. the burn curve is tuna's, and so are the level and the experience");
{
    const TABLE = DbTableType.getId('cooking_generic');
    // BY NAME, not by a counted position in the .dbtable - a column inserted above
    // successchance would silently move every index after it and this section would then be
    // comparing two different fields and calling them equal.
    const names = DbTableType.get(TABLE).columnNames;
    const col = (name: string) => {
        const i = names.indexOf(name);
        if (i === -1) throw new Error(`cooking_generic has no column "${name}": ${JSON.stringify(names)}`);
        return i;
    };
    const field = (row: string, name: string) => DbRowType.get(DbRowType.getId(row)).getValue(col(name), 0);

    const CHOMPY = 'cooking_generic_skewered_chompy';
    const TUNA = 'cooking_generic_tuna';

    // BOTH THE RELATIVE AND THE ABSOLUTE, and the pair is the point.
    //
    // The relative check alone was not enough, and a mutation proved it rather than a hunch:
    // nudging successchance from 58,372 to 58,300 was caught by nothing, because tuna's row carries
    // the literal SAME two numbers and the edit moved both rows at once - so "the chompy matches
    // tuna" stayed true of two rows that had both moved. A relative pin cannot see a change to its
    // own reference.
    //
    // So the wiki's figures are written out here as well. The relative check says WHY these numbers
    // are these numbers; the absolute one says what they are, and between them a change to either
    // row has to come through this file.
    const WIKI: Record<string, string> = {
        successchance: '[58,372]',
        levelrequired: '[30]',
        experience: '[1000]' // 100 xp, and the table is in tenths
    };
    for (const what of ['successchance', 'levelrequired', 'experience']) {
        const mine = JSON.stringify(field(CHOMPY, what));
        const theirs = JSON.stringify(field(TUNA, what));
        check(`  ${what.padEnd(13)} is tuna's: ${mine}`, mine, theirs);
        check(`    ...and is still ${WIKI[what]}, which tuna moving would not tell us`, mine, WIKI[what]);
    }
    // getValue hands back the column's whole value LIST, so a single-valued field arrives as
    // [id] and comparing it to the id itself fails while printing the right number next to it.
    const one = (row: string, name: string) => (field(row, name) as (number | string)[])[0];
    check('  and the raw item is the skewered chompy', one(CHOMPY, 'uncooked'), ObjType.getId('spit_skewered_chompy'));
    check('  cooked into cooked_chompy', one(CHOMPY, 'cooked'), ObjType.getId('cooked_chompy'));
    check('  burnt into ruined_chompy', one(CHOMPY, 'burnt'), ObjType.getId('ruined_chompy'));

    // AND AT 99 IT CANNOT BURN, which is arithmetic rather than dice and so is worth asserting:
    // STAT_RANDOM works out floor(low*(99-L)/98) + floor(high*(L-1)/98) + 1, which at level 99 is
    // high + 1 = 373 against a roll of 0..255. This is the one place in the file a wrong `high`
    // would show up behaviourally.
    const p = cook(99);
    const N = 20;
    H.give(p, 'spit_skewered_chompy', N);
    A.addLoc('fireplace', SPOT[0] + 1, SPOT[1] + 12, 0);
    H.tick(1);
    for (let i = 0; i < N + 5; i++) {
        A.useOn(p, SPOT[0] + 1, SPOT[1] + 12, 'fireplace', 'spit_skewered_chompy');
        H.tick(6);
        if (count(p, 'spit_skewered_chompy') === 0) break;
    }
    const good = count(p, 'cooked_chompy');
    const bad = count(p, 'ruined_chompy');
    console.log(`      (at Cooking 99: ${good} cooked, ${bad} ruined, of ${N})`);
    check('  at Cooking 99 all twenty cook', good, N);
    check('    ...and none burn, which high=372 makes certain', bad, 0);
    check('    ...and none are left in the bag', count(p, 'spit_skewered_chompy'), 0);
}

// ---- 5. and there is still only ONE cooked chompy in the game ---------------------------------
// The cache holds a second pair - chompy_cooked "Roasted chompy bird." and chompy_burned - beside
// the Big Chompy quest's cooked_chompy and ruined_chompy. The wiki's names for the skewered
// chompy's results are Cooked chompy and Ruined chompy, which are these two, and they are the pair
// the quest already hands out. Pointing the new row at the other pair would have put two different
// cooked chompies in players' banks.
console.log('\n5. it cooks into the chompy the quest already uses, not a second one');
{
    check("cooked_chompy is the quest's own", ObjType.get(ObjType.getId('cooked_chompy')).name, 'Cooked chompy');
    check('ruined_chompy is its burnt half', ObjType.get(ObjType.getId('ruined_chompy')).name, 'Ruined chompy');
    check('and spit_skewered_chompy is obj 7230, the id Old School uses', ObjType.getId('spit_skewered_chompy'), 7230);
}

console.log(R.bad ? `\nFAILED: ${R.bad} of ${R.ok + R.bad}` : `\n${R.ok} ok`);
process.exit(R.bad ? 1 : 0);
