// GHOSTS AHOY: THE PORCELAIN CUP, and the fact that nothing in the world made one.
// Usage: NODE_MEMBERS=true npx tsx tools/sim/ahoytea.ts   (exit code is the verdict)
//
// Reported from play (DeathPlateau-Bugs#92): "ghosts ahoy, old crone doesnt give you the cup for
// her tea". She didn't, and nothing else did either.
//
// WHAT THE CHAIN LOOKED LIKE. The crone takes nettle tea in her own porcelain cup with milk in it
// and refuses it in anything else. Everything up to the tea worked: nettles could be picked, put
// in a bowl of water, boiled into bowl_nettletea and milked. Then it stopped. All four cup objs
// (chinacup_of_nettletea, cup_of_nettletea and their milky versions) existed in the cache with an
// op3=Empty stub that poured them away and NO WAY TO FILL ONE, and chinacup_empty had no source at
// all - no shop, no drop, no script. So the item she demands could not be obtained by any means,
// and the quest was a hard stop at questvar 3 of 15.
//
// WHY NOTHING CAUGHT IT: tools/sim/quest_ahoy_run.ts opens with
//   { give: 'chinacup_of_nettletea_milky' }
// under a comment saying "the crone's fuss about the cup is tested, not skipped". The fuss was
// tested. Where the cup comes from was the part being skipped, and it was the part that was broken.
// That run now starts from a bowl of tea and has to get the cup out of her, as a player must.
import * as H from './harness.js';
import * as A from './a1lib.js';
import { check, R, player } from './a1lib.js';
import ObjType from '#/cache/config/ObjType.js';
import InvType from '#/cache/config/InvType.js';

await H.boot();
H.loginOrder();

// Her hut, east of the Slayer Tower. A.talk puts the player beside her, so this is only a start.
const HUT: [number, number] = [3463, 3556];
const NAMED = 3; // ^ahoy_crone_named - Velorina has told you where to find her
const TOLD = 4; // ^ahoy_crone_told - she has had her tea and named the book

// EVERYTHING SHE SAYS, not just the pages after the first. A.talk marks H.ifaces when it starts
// driving the dialogue, which is after the opnpc script has already run - so a one-line answer
// like her refusals is set before the mark and does not come back in A.talk's return. Three of
// this file's checks passed on an empty list before that was noticed. Marking it here catches the
// first line too.
const talkRead = (p: any, picks: (number | string)[] = []): string[] => {
    const from = H.ifaces.length;
    A.talk(p, 'ahoy_crone', picks);
    return H.ifaces
        .slice(from)
        .filter(i => i.who === p.username && i.kind === 'text' && i.text)
        .map(i => i.text!);
};

// A player standing in her hut, at the point in the quest where the tea matters.
const atHer = (name: string, asked = true) => {
    const p: any = player(name, HUT[0], HUT[1], 0);
    H.maxOut(p);
    H.clearInv(p);
    H.setVarBit(p, 'ahoy_questvar', NAMED);
    if (asked) {
        // She has already said what she wants. That is one talk, and it is not what is under test
        // here, so it is set rather than walked through.
        H.setVarBit(p, 'ahoy_subquest_nettletea', 1); // ^ahoy_tea_asked
    }
    H.tick(1);
    H.clearLogs();
    return p;
};

console.log('== the tea itself was never the problem');
{
    const p = atHer('tea_chain');
    H.give(p, 'nettles_picked');
    H.give(p, 'bowl_water');
    A.useHeld(p, 'nettles_picked', 'bowl_water');
    check('nettles go into a bowl of water', H.invCount(p, 'bowl_nettlewater'), 1);
    // Boiling is cooking, and cooking has its own sims; this run starts from the boiled tea.
    H.clearInv(p);
    H.give(p, 'bowl_nettletea');
    H.give(p, 'bucket_milk');
    A.useHeld(p, 'bucket_milk', 'bowl_nettletea');
    check('  and milk goes into the boiled tea', H.invCount(p, 'bowl_nettletea_milky'), 1);
}

console.log('\n== she hands the cup over, which is the half that did not exist');
{
    const p = atHer('cup_given', false);
    const l1 = talkRead(p);
    check('her first answer asks for the tea', A.saw(l1, 'Nettle tea'), true);
    check('  and names the cup she wants it in', A.saw(l1, 'porcelain cup'), true);
    // THE SAME CONVERSATION, not the next one. There is no talk in which she has named the cup and
    // not produced it, because that gap is exactly where a player gets stuck looking for an item
    // no shop sells.
    check('  and hands it over there and then', H.invCount(p, 'chinacup_empty'), 1);
    check('  saying it is her own', A.saw(l1, 'my own cup'), true);

    // Once, not once per talk.
    talkRead(p);
    talkRead(p);
    check('  and only one cup, however often she is asked', H.invCount(p, 'chinacup_empty'), 1);
}

console.log('\n== and being well prepared is not punished');
{
    // THE BUG THIS FILE MISSED. Every check above sets ^ahoy_tea_asked by hand, which quietly
    // assumes the player spoke to her before making the tea. A player who makes it FIRST - which
    // is what a walkthrough tells you to do - has never heard her ask, and in the first cut of
    // this fix all of her refusals returned before the asking dialogue that sets that varbit. She
    // refused the bowl, never asked, never set it, and so never reached the line that hands over
    // the cup: stuck forever, for being organised. tools/sim/quest_ahoy_run.ts caught it by
    // walking up to her carrying the bowl, which is the one thing these unit checks could not do.
    const p = atHer('prepared', false);
    H.give(p, 'bowl_nettletea');
    const l = talkRead(p);
    check('she asks even when the tea is already made', A.saw(l, 'porcelain cup'), true);
    check('  and the cup comes in the same conversation', H.invCount(p, 'chinacup_empty'), 1);
    // And from there the quest finishes, which is the whole point.
    A.useHeld(p, 'bowl_nettletea', 'chinacup_empty');
    H.give(p, 'bucket_milk');
    A.useHeld(p, 'bucket_milk', 'chinacup_of_nettletea');
    talkRead(p);
    check('  so she gets her tea and the quest moves on', H.getVarBit(p, 'ahoy_questvar'), TOLD);
}

console.log('\n== the tea goes into the cup, from either side of the click');
{
    const p = atHer('pour_a');
    H.give(p, 'bowl_nettletea');
    H.give(p, 'chinacup_empty');
    A.useHeld(p, 'bowl_nettletea', 'chinacup_empty');
    check('bowl on cup fills the cup', H.invCount(p, 'chinacup_of_nettletea'), 1);
    check('  the cup is used up', H.invCount(p, 'chinacup_empty'), 0);
    check('  the tea is out of the bowl', H.invCount(p, 'bowl_nettletea'), 0);
    check('  and the bowl comes back empty', H.invCount(p, 'bowl_empty'), 1);
}
{
    // THE OTHER DIRECTION, which is the mistake in 963 of this cache's item pairs (tools/sim/opheldu.ts).
    const p = atHer('pour_b');
    H.give(p, 'bowl_nettletea');
    H.give(p, 'chinacup_empty');
    A.useHeld(p, 'chinacup_empty', 'bowl_nettletea');
    check('cup on bowl fills it too', H.invCount(p, 'chinacup_of_nettletea'), 1);
}
{
    // Milk first, cup second: the same obj at the end.
    const p = atHer('pour_milky');
    H.give(p, 'bowl_nettletea_milky');
    H.give(p, 'chinacup_empty');
    A.useHeld(p, 'bowl_nettletea_milky', 'chinacup_empty');
    check('milky tea poured in arrives milky', H.invCount(p, 'chinacup_of_nettletea_milky'), 1);
}
{
    // Cup first, milk second: the wiki's own order.
    const p = atHer('milk_in_cup');
    H.give(p, 'chinacup_of_nettletea');
    H.give(p, 'bucket_milk');
    A.useHeld(p, 'bucket_milk', 'chinacup_of_nettletea');
    check('and milk can go in after the pour', H.invCount(p, 'chinacup_of_nettletea_milky'), 1);
}

console.log('\n== her three answers are three different answers');
{
    const p = atHer('refuse_bowl');
    H.give(p, 'bowl_nettletea_milky');
    // TWO TALKS, because the first is spent on the cup - which is the wiki's own order: she
    // produces the cup, and only once you have it does "that is the wrong thing" mean anything.
    // Asserting the refusal on the FIRST talk passed over nothing: she said the giving line and
    // the test read an empty list.
    const gave = talkRead(p);
    check('the first talk is spent handing over the cup', H.invCount(p, 'chinacup_empty'), 1);
    check('  so no refusal yet', A.saw(gave, 'wrong thing'), false);
    const l = talkRead(p);
    check('milky tea still in a BOWL is then refused', A.saw(l, 'wrong thing'), true);
    check('  and the quest does not move', H.getVarBit(p, 'ahoy_questvar'), NAMED);
    check('  and the tea is not taken', H.invCount(p, 'bowl_nettletea_milky'), 1);
}
{
    const p = atHer('refuse_dry');
    H.give(p, 'chinacup_of_nettletea');
    const l = talkRead(p);
    // HER CUP WITH NO MILK IS A DIFFERENT COMPLAINT, and saying "that is the wrong thing" to a
    // player holding the right thing is what a bug report looks like.
    check('her cup without milk gets the milk complaint', A.saw(l, 'no milk in it'), true);
    check('  not the wrong-vessel one', A.saw(l, 'wrong thing'), false);
    check('  and the quest does not move', H.getVarBit(p, 'ahoy_questvar'), NAMED);
}
{
    const p = atHer('accept');
    H.give(p, 'chinacup_of_nettletea_milky');
    talkRead(p);
    check('her cup with milk is accepted', H.getVarBit(p, 'ahoy_questvar'), TOLD);
    check('  and the tea is drunk', H.invCount(p, 'chinacup_of_nettletea_milky'), 0);
}

console.log('\n== an ordinary cup can be filled too, and she still says no');
{
    const p = atHer('plain_cup');
    H.give(p, 'bowl_nettletea_milky');
    H.give(p, 'cup_empty');
    A.useHeld(p, 'bowl_nettletea_milky', 'cup_empty');
    check('a shop-bought cup fills', H.invCount(p, 'cup_of_nettletea_milky'), 1);
    talkRead(p); // her cup, first
    const l = talkRead(p);
    check('  and she refuses it', A.saw(l, 'wrong thing'), true);
    check('  and the quest does not move', H.getVarBit(p, 'ahoy_questvar'), NAMED);
}

console.log('\n== losing the cup does not end the quest');
{
    // THE POINT OF THE REPLACEMENT. The cup is a 2-coin quest item with no other use, and without
    // this a player who drops it is stuck at questvar 3 for good - which is the state the report
    // describes, reached a second way.
    const p = atHer('lost_cup');
    const l = talkRead(p);
    check('a player with no cup is given one', H.invCount(p, 'chinacup_empty'), 1);
    check('  and told whose it is', A.saw(l, 'my own cup'), true);
}
{
    // ASSERTED AS A PAIR, and that is deliberate. "She gives no second cup to a player whose cup
    // is in the bank" is true of a game that hands out no cups at all - it was green with this
    // whole change reverted - so the control belongs inside the check. Two players in the same
    // state, one with a cup banked and one without: 0 and 1, and only the bank check produces that.
    const banked = atHer('banked_cup');
    banked.invAdd(InvType.getId('bank'), ObjType.getId('chinacup_empty'), 1);
    H.tick(1);
    talkRead(banked);
    const bare = atHer('bare_cup');
    talkRead(bare);
    check('a cup in the bank is not a lost cup', [H.invCount(banked, 'chinacup_empty'), H.invCount(bare, 'chinacup_empty')], [0, 1]);
}
{
    const p = atHer('full_inv');
    H.fillInv(p);
    const l = talkRead(p);
    check('a full inventory is told so', A.saw(l, 'hand free'), true);
    check('  and nothing is silently destroyed', H.invCount(p, 'chinacup_empty'), 0);
}

console.log('\n== and the cup cannot be turned into a faucet');
{
    // The replacement is only safe because the cup cannot be given away. Same reasoning as the
    // ectophial's, which carries the same note in all.obj.
    for (const name of ['chinacup_empty', 'chinacup_of_nettletea', 'chinacup_of_nettletea_milky']) {
        check(`${name} is untradeable`, ObjType.get(ObjType.getId(name)).tradeable, false);
    }
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
