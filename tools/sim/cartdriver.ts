// THE TOURIST TRAP'S MINE CART DRIVER, AND THE LINE HE CONTRADICTED HIMSELF WITH.
//
// Reported as "the tourist trap. chat options are off at the mine cart at end of quest"
// (DeathPlateau-Bugs#58). Once the driver has agreed to smuggle you out - the whole point of the
// "Nice cart." / "Prison riot in ten minutes" chain - talking to him answered
//
//     Mine cart driver: Hurry up, get in the cart or I'll go without you!
//     Mine cart driver: Don't trouble me, can't you see I'm busy?
//
// on one click, because the branch that says the first line fell straight through the if block into
// the catch-all at the bottom of the trigger.
//
// THE CHAIN IS WALKED, NOT ASSUMED. Section 1 takes the real eight-option path to that state - the
// one the OSRS wiki's walkthrough names, starting at "Nice cart." and ending at "You can't leave me
// here, I'll get killed!" - so this file reaches the reported state the way a player does rather
// than setting a bit and hoping that is the same thing. Every pick is matched by its own TEXT, so a
// reordered menu picks the same line rather than the same slot.
//
//   npx tsx tools/sim/cartdriver.ts
import * as H from './harness.ts';
import { check, R, player, talk } from './a1lib.ts';

await H.boot();

const DRIVER = 'mining_cart_driver';
// desertrescue.constant: the stage, and two bit positions inside %desertrescue_map_mechanisms.
// Bits in a varp rather than varbits of their own, which is why these are shifts and not names.
const ANA_ON_CART = 25; // ^desertrescue_ana_on_mining_cart
const ESCAPED = 26; // ^desertrescue_escaped
const SAVED_ANA = 27; // ^desertrescue_saved_ana, the stage after the cart ride
const ANA_MINING_CART = 15; // ^desertrescue_ana_mining_cart
const READY_RESCUE = 16; // ^desertrescue_ready_rescue

/** Everything the driver said this click - npc lines and mesbox text alike. */
const said = (p: any) => [...H.mesgs.filter(m => m.who === p.username).map(m => m.text), ...H.ifaces.filter(i => i.who === p.username && i.kind === 'text').map(i => i.text ?? '')].join(' | ');
const ready = (p: any) => (H.getVar(p, 'desertrescue_map_mechanisms') & (1 << READY_RESCUE)) !== 0;

let who = 0;
function fresh(stage: number, bits: number[]): any {
    const p: any = player('cart' + ++who, 3286, 3021, 0);
    H.setVar(p, 'tutorial', 1000);
    H.setVar(p, 'desertrescue', stage);
    let mask = 0;
    for (const b of bits) mask |= 1 << b;
    H.setVar(p, 'desertrescue_map_mechanisms', mask);
    H.tick(2);
    H.clearLogs();
    return p;
}

// ---------------------------------------------------------------- 1. the chain a player takes
console.log('\n1. THE CHAIN THE WIKI NAMES, FROM "Nice cart." TO "I\'ll get killed!"');
{
    const p = fresh(ANA_ON_CART, [ANA_MINING_CART]);
    check('  he is not ready to take anybody yet', ready(p), false);
    talk(p, DRIVER, ['Nice cart.', 'One wagon wheel', 'One good turn deserves another', 'Fired... no, shot perhaps', 'In for a penny', "Well, you see, it's like this", 'Prison riot in ten minutes', "You can't leave me here"]);
    H.tick(2);
    check('  it ends with him telling you to jump in', /jump in the cart/.test(said(p)), true);
    // The bit is the quest's own record that he agreed, and the reported bug sits behind it.
    check('  and the quest records that he agreed', ready(p), true);
    H.despawn(p);
}

// ---------------------------------------------------------------- 2. and then he says ONE thing
console.log('\n2. AND THEN TALKING TO HIM SAYS ONE THING, NOT TWO');
for (const [what, stage] of [
    ['with Ana on the cart', ANA_ON_CART],
    ['and after the escape', ESCAPED]
] as const) {
    const p = fresh(stage, [ANA_MINING_CART, READY_RESCUE]);
    talk(p, DRIVER, []);
    H.tick(2);
    const s = said(p);
    check(`  ${what.padEnd(21)}: he tells you to hurry up`, /Hurry up, get in the cart/.test(s), true);
    // THE WHOLE OF THE BUG. This line is the catch-all at the bottom of [opnpc1,mining_cart_driver],
    // and reaching it means the if block above it did not return.
    check(`  ${' '.repeat(21)}  and does NOT also brush you off`, /Don't trouble me/.test(s), false);
    H.despawn(p);
}

// ---------------------------------------------------------------- 3. the branches either side of it
//
// So the `return` cannot be "fixed" by gutting the block it returns from: the two other ways out of
// that if, and the catch-all itself, all still answer what they answered before.
console.log('\n3. AND THE BRANCHES EITHER SIDE OF IT ARE UNCHANGED');
{
    const p = fresh(ANA_ON_CART, [ANA_MINING_CART]);
    talk(p, DRIVER, ['Pssst...', 'Pssssssssttt!!!', 'Oh, okay, sorry.']);
    H.tick(2);
    check('  not yet agreed: the options are still offered', /completely ignores you/.test(said(p)), true);
    check('    and he does not brush you off on top of it', /Don't trouble me/.test(said(p)), false);
    H.despawn(p);
}
{
    // Neither bit set at the cart stage: he is loading, and that branch already returned.
    const q = fresh(ANA_ON_CART, []);
    talk(q, DRIVER, []);
    H.tick(2);
    check('  nothing set yet: he is busy loading', /busy loading the cart up/.test(said(q)), true);
    check('    and nothing else', /Don't trouble me|Hurry up/.test(said(q)), false);
    H.despawn(q);
}
{
    // Past the quest's cart entirely - this is the catch-all, and it is meant to be reached here.
    const r = fresh(SAVED_ANA, []);
    talk(r, DRIVER, []);
    H.tick(2);
    check('  after the quest: the catch-all still answers', /Don't trouble me/.test(said(r)), true);
    H.despawn(r);
}
{
    // Carrying the barrel, at a stage before the cart: his own line about it, and nothing after.
    const s2 = fresh(24, []); // ^desertrescue_retrieved_ana_liftbarrel
    H.give(s2, 'thanainabarrel', 1);
    H.tick(1);
    H.clearLogs();
    talk(s2, DRIVER, []);
    H.tick(2);
    check('  carrying the barrel: he tells you to load it', /big barrel around/.test(said(s2)), true);
    check('    and does not brush you off as well', /Don't trouble me/.test(said(s2)), false);
    H.despawn(s2);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
