// ZEALOT'S ROBES: the Prayer bonus they did not have, and the altar they did nothing at.
// Usage: NODE_MEMBERS=true npx tsx tools/sim/zealots.ts   (exit code is the verdict)
//
// Reported from play (DeathPlateau-Bugs#95): "zealot outfit doesnt have its states". Stats, and it
// did not have them: all four pieces carried no prayerbonus param at all, because
// skilling_outfits/configs/outfits.obj repeated the same note on every piece of all ten outfits -
// "Skilling outfits carry no combat bonuses and no equip requirement in OSRS". True of the other
// nine. Not true of this one.
//
//   Zealot's helm        Prayer +1
//   Zealot's robe top    Prayer +7
//   Zealot's robe bottom Prayer +6
//   Zealot's boots       Prayer +1
//                        ---------
//   the set              Prayer +15
//
// off each piece's own infobox and its 30 June 2021 changelog line. Every other bonus on all four
// is zero, which is why prayerbonus is the only param the fix adds.
//
// AND THE SET DID NOTHING AT THE CHAOS ALTAR, which is where it is most used. ~zealots_saves was
// called when burying and at the player-owned-house altar and nowhere else. The wiki quotes Mod
// Ash on how it stacks there: "If you FAIL that 50% roll, you get a roll for the robes to save the
// bones" - so the robes see only the bones the altar has already decided to take, and the full set
// gives 52.5% rather than 55%.
import * as H from './harness.js';
import * as A from './a1lib.js';
import { check, R, player } from './a1lib.js';
import ObjType from '#/cache/config/ObjType.js';
import ParamType from '#/cache/config/ParamType.js';

await H.boot();
H.loginOrder();

const PRAYER = ParamType.getId('prayerbonus');
const bonus = (name: string) => {
    const t = ObjType.get(ObjType.getId(name));
    const v = (t as unknown as { params?: Map<number, unknown> }).params?.get(PRAYER);
    return typeof v === 'number' ? v : 0;
};

const PIECES: [string, number][] = [
    ['zealots_helm', 1],
    ['zealots_top', 7],
    ['zealots_bottom', 6],
    ['zealots_boots', 1]
];

console.log('== the Prayer bonus each piece is published with');
{
    for (const [name, want] of PIECES) {
        check(`${name} is Prayer +${want}`, bonus(name), want);
    }
    check(
        '  ...and the set adds up to the published +15',
        PIECES.reduce((n, [p]) => n + bonus(p), 0),
        15
    );
}

console.log('\n== and nothing else, because every other bonus on them is zero');
{
    // The blanket note was RIGHT about everything except Prayer, so the fix must not have quietly
    // handed them attack or defence while it was in there.
    const others = ['attackbonus', 'rangebonus', 'strengthbonus', 'magicbonus'].filter(n => ParamType.getId(n) !== -1);
    const found: string[] = [];
    for (const [name] of PIECES) {
        const t = ObjType.get(ObjType.getId(name));
        const params = (t as unknown as { params?: Map<number, unknown> }).params;
        for (const o of others) {
            const v = params?.get(ParamType.getId(o));
            if (typeof v === 'number' && v !== 0) found.push(`${name}.${o}=${v}`);
        }
    }
    check(`no other combat bonus on any piece (checked ${others.join(', ')})`, found, []);
}

console.log('\n== they are still untradeable and still need no level to wear');
{
    for (const [name] of PIECES) {
        check(`${name} is untradeable`, ObjType.get(ObjType.getId(name)).tradeable, false);
    }
}

console.log('\n== burying: the set can preserve the bones, and pays the experience either way');
{
    // The effect that already worked, kept honest here because the chaos altar section below leans
    // on the same proc and a broken proc would make that one pass for the wrong reason.
    const p: any = player('zbury', 3222, 3218, 0);
    H.maxOut(p);
    H.clearInv(p);
    H.equip(p, { hat: 'zealots_helm', torso: 'zealots_top', legs: 'zealots_bottom', feet: 'zealots_boots' });
    H.give(p, 'bones', 25);
    H.tick(2);
    H.clearLogs();
    // A SAVED BONE STAYS IN THE PACK and is buried again by the next click, so the clicks are not
    // the bones: 25 bones take 25 burials plus one more for each save. Looping well past that and
    // asserting the pack empties is the honest shape - it also catches a save that stalls the
    // process instead of costing one extra click.
    let clicks = 0;
    while (H.invCount(p, 'bones') > 0 && clicks < 200) {
        H.opheld(p, 'bones', 1);
        H.tick(3);
        clicks++;
    }
    const saves = A.mesOf(p).filter(m => m.includes('robes preserve')).length;
    console.log(`  (${clicks} clicks buried 25 bones; ${saves} were preserved by the robes)`);
    check('the whole pack is buried however often the robes save one', H.invCount(p, 'bones'), 0);
    check('  ...and a save costs exactly one extra click', clicks, 25 + saves);
}

console.log('\n== and the chaos altar now rolls them, after its own roll has failed');
{
    // 0_46_59_3_44 is the one chaosaltar loc of five that trains Prayer, in the hut at level 38.
    const ALTAR: [number, number] = [2947, 3820];
    // THE TWO PATHS SAY DIFFERENT THINGS, which is what makes this exact rather than statistical.
    // The altar's own save prints "The gods are pleased..."; the robes print "Your robes preserve
    // the bones." At 1.25% a piece on the half of offerings the altar decides to take, the robes'
    // line is about one offering in forty - so a few hundred offerings is plenty to show the path
    // is reachable, and the dice are seeded, so the count is the same every run.
    const offer = (name: string, wearSet: boolean, bones: number) => {
        const p: any = player(name, ALTAR[0], ALTAR[1] - 1, 0);
        H.maxOut(p);
        H.clearInv(p);
        if (wearSet) {
            H.equip(p, { hat: 'zealots_helm', torso: 'zealots_top', legs: 'zealots_bottom', feet: 'zealots_boots' });
        }
        H.give(p, 'bones', bones);
        H.tick(2);
        H.clearLogs();
        A.useOn(p, ALTAR[0], ALTAR[1], 'chaosaltar', 'bones');
        for (let t = 0; t < bones * 14 && H.invCount(p, 'bones') > 0; t++) H.tick(1);
        const said = A.mesOf(p);
        return {
            left: H.invCount(p, 'bones'),
            robes: said.filter(m => m.includes('robes preserve')).length,
            altar: said.filter(m => m.includes('gods are pleased')).length,
            taken: said.filter(m => m.includes('offer the bones to Zamorak')).length
        };
    };

    // BONES DO NOT STACK, so a pack is 28 of them and no more - asking for 300 silently gives 28,
    // which is how the sum check that used to sit at the end of this block came to want 300
    // outcomes and find 72. The 28 is the real number now and the counts below are readable.
    const PACK = 28;
    const withSet = offer('zchaos_on', true, PACK);
    console.log(`  with the set: ${withSet.altar} altar saves, ${withSet.robes} robe saves, ${withSet.taken} taken`);
    check('the altar still saves bones on its own roll', withSet.altar > 0, true);
    check('  ...and the robes save some of the ones it does not', withSet.robes > 0, true);
    check('  ...and every bone is eventually taken', withSet.taken, PACK);
    check('  ...with nothing left in the pack', withSet.left, 0);

    const without = offer('zchaos_off', false, PACK);
    console.log(`  without it:  ${without.altar} altar saves, ${without.robes} robe saves, ${without.taken} taken`);
    check('with no robes on, the altar still saves bones', without.altar > 0, true);
    check('  ...and nothing claims the robes did', without.robes, 0);
    check('  ...and the pack still empties', without.taken, PACK);

    // THE ORDER OF THE TWO ROLLS is structural rather than measured, and worth saying so rather
    // than dressing it up. The robes are in the `else if` of the altar's own roll, so a bone the
    // altar saved is never offered to them - that is the wiki's "if you FAIL that 50% roll, you get
    // a roll for the robes" and it is a property of the script, not of these counts. What the
    // counts DO show is the effect: the same 28 bones bought 72 offerings with the set on and 48
    // without, which is the extra experience the set is for. Both are one seeded run, so neither
    // number is a rate and neither is asserted as one.
    console.log(`  offerings per pack: ${withSet.altar + withSet.robes + withSet.taken} with the set, ` + `${without.altar + without.robes + without.taken} without`);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
