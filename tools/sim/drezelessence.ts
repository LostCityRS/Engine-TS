// DREZEL TAKES PURE ESSENCE TOO, WHICH IS WHAT THE ESSENCE MINE ACTUALLY GIVES.
// Usage: npx tsx tools/sim/drezelessence.ts   (exit code is the verdict)
//
// Priest in Peril ends by carrying fifty essence down to Drezel, counted one per unit from
// ^priestperil_begin_bring_essence (10) to ^priestperil_end_bring_essence (60). drezel.rs2
// accepted `blankrune` - Rune essence - and nothing else.
//
// But skill_mining/scripts/mining.rs2 get_ore_essence reads:
//
//     if (stat_base(mining) >= 30 & map_members = ^true) {
//         inv_add(inv, blankrune_high, 1);        // Pure essence
//     } else {
//         inv_add(inv, ...rock_output..., 1);     // Rune essence
//     }
//
// so on a members world every player with Mining 30 or better mines PURE essence, and Drezel
// would not take it. Priest in Peril has no mining requirement, so the players it blocked are
// the ones most likely to be doing it - and it gates Morytania and the quests behind it.
//
// Old School takes either, and they can be mixed: "50 unnoted rune essence or pure essence ...
// all 50 essence do not have to be of the same type". oldschool.runescape.wiki/w/Priest_in_Peril
// Noted essence it refuses, which drezel.rs2 already did and still does.
//
// DeathPlateau-Bugs#29.
import * as H from './harness.js';
import { check, R, player, useOnNpc } from './a1lib.js';
import ObjType from '#/cache/config/ObjType.js';

await H.boot();

const DREZEL = 'priestperiltrappedmonk2';
const RUNE = ObjType.getId('blankrune');
const PURE = ObjType.getId('blankrune_high');
const RUNE_NOTED = ObjType.getId('cert_blankrune');
const PURE_NOTED = ObjType.getId('cert_blankrune_high');
const BEGIN = 10; // ^priestperil_begin_bring_essence
const INV = 93;

console.log('== the two essences are the same thing to a player bringing fifty');
check('blankrune is Rune essence', ObjType.get(RUNE).name, 'Rune essence');
check('blankrune_high is Pure essence', ObjType.get(PURE).name, 'Pure essence');
check('and both have a noted form', RUNE_NOTED !== -1 && PURE_NOTED !== -1, true);

const drezel = H.npcNear(DREZEL, 3441, 9897, 0);
check('Drezel is where the report was filed from', drezel !== null, true);
if (!drezel) {
    console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
    process.exit(1);
}

/** A player standing beside Drezel, mid-quest, with the essence asked for. */
function bringer(name: string, give: [string, number][], stage = BEGIN) {
    const p: any = player(name, drezel!.x + 1, drezel!.z, 0);
    H.setVar(p, 'priestperil', stage);
    for (const [obj, n] of give) H.give(p, obj, n);
    H.clearLogs();
    return p;
}

console.log('\n== pure essence, which is what mining gives, is taken');
{
    const p = bringer('drezpure', [['blankrune_high', 10]]);
    useOnNpc(p, DREZEL, 'blankrune_high');
    H.tick(6);
    check('the quest counts all ten', H.getVar(p, 'priestperil'), BEGIN + 10);
    check('  and they leave the bag', p.invTotal(INV, PURE), 0);
}

console.log('\n== rune essence still is, which is the regression half');
{
    const p = bringer('drezrune', [['blankrune', 10]]);
    useOnNpc(p, DREZEL, 'blankrune');
    H.tick(6);
    check('the quest counts all ten', H.getVar(p, 'priestperil'), BEGIN + 10);
    check('  and they leave the bag', p.invTotal(INV, RUNE), 0);
}

console.log('\n== and a mixed load, which Old School allows explicitly');
{
    const p = bringer('drezmix', [
        ['blankrune', 6],
        ['blankrune_high', 4]
    ]);
    useOnNpc(p, DREZEL, 'blankrune_high');
    H.tick(6);
    check('all ten are counted whichever kind they are', H.getVar(p, 'priestperil'), BEGIN + 10);
    check('  no rune essence left', p.invTotal(INV, RUNE), 0);
    check('  and no pure essence left', p.invTotal(INV, PURE), 0);
}

console.log('\n== and with more than he needs, the cheaper kind goes first');
{
    // THE MIXED CHECK ABOVE CANNOT SEE THIS. It hands over exactly what is needed, so the whole
    // bag is spent whichever order the loop takes - a mutation that swapped the order passed it.
    // Bringing more than he needs is what pins the choice: 5 wanted, 10 of each carried.
    const p = bringer(
        'drezorder',
        [
            ['blankrune', 10],
            ['blankrune_high', 10]
        ],
        55
    );
    useOnNpc(p, DREZEL, 'blankrune_high');
    H.tick(6);
    check('only the five he still needs are taken', H.getVar(p, 'priestperil'), 60);
    check('  five rune essence went', p.invTotal(INV, RUNE), 5);
    check('  and the pure essence is untouched', p.invTotal(INV, PURE), 10);
}

console.log('\n== noted essence is still refused, both kinds');
for (const [nm, id, obj] of [
    ['rune', RUNE_NOTED, 'cert_blankrune'],
    ['pure', PURE_NOTED, 'cert_blankrune_high']
] as [string, number, string][]) {
    const p = bringer('drezn' + nm, [[obj, 10]]);
    // THE REFUSAL IS DIALOGUE, NOT A MESSAGE. ~chatnpc draws an interface, so mesOf never sees it -
    // the first version of this file checked mesOf and reported two failures it had invented.
    // useOnNpc returns the lines it drove through, which is where ~chatnpc text arrives.
    // JOINED WITH A SPACE, because the client wraps dialogue mid-sentence: the refusal arrives as
    // "...notes saying 'I promise to pay" / "the bearer on demand the listed number of Rune" /
    // "Essence.' How is that supposed to help me?". A substring that crossed the wrap never
    // matched, which is what made this check fail against content that was already correct.
    const said = useOnNpc(p, DREZEL, obj).join(' ');
    H.tick(6);
    check(`noted ${nm} essence is turned down`, said.includes('I promise to pay the bearer'), true);
    check('  the quest does not move', H.getVar(p, 'priestperil'), BEGIN);
    check('  and the notes stay in the bag', p.invTotal(INV, id), 10);
}

console.log('\n== the last one finishes the quest');
{
    const p = bringer('drezlast', [['blankrune_high', 1]], 59);
    const said = useOnNpc(p, DREZEL, 'blankrune_high').join(' ');
    H.tick(6);
    check('the fiftieth essence completes it', H.getVar(p, 'priestperil'), 60);
    check('  and Drezel says so', said.includes('That should do it'), true);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
