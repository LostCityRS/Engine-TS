// THE CAMULET, AND THE THIRTY-TWO CAMELS IT IS FOR.
//
// The amulet itself was finished - granted on completing Enakhra's Lament, Check-charge and Rub
// both held and worn, charges in a varbit - and the thing it exists for was not: every camel in
// Al Kharid, Sophanem and the desert offered Talk-to with nothing behind it.
//
// WHAT IS WORTH TESTING:
//   1. The amulet is the switch. Without it the player mutters and the camel stamps, glares or
//      spits; with it the camel talks. Both halves, on every camel, because a check that only
//      proves the camulet branch would pass just as well if the other branch had been forgotten -
//      and the muttering is the joke the amulet pays off.
//   2. Al remembers. He has two states and the cache has had the bits for both all along
//      (al_camel_exposit, al_camel_advicegiven) and nothing read or wrote them: the first meeting
//      is him getting four lines of sonnet out before he can be stopped, and after that it is a
//      menu of two poems. The Elly question is asked once, ever.
//   3. Talking to an Ugthanki drops it. That is a mechanic, not flavour, and it leans on the
//      cowardly hunt's own check_notcombat rather than on a timer of its own.
//   4. Neferti answers from outside her paddock, because there is no way into it. An op trigger
//      would have walked a player at a fence forever.
import * as H from './harness.ts';
import { check, R, player, drive, connected } from './a1lib.ts';
import NpcType from '#/cache/config/NpcType.js';
import Npc from '#/engine/entity/Npc.js';
import Player from '#/engine/entity/Player.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import World from '#/engine/World.js';

await H.boot();

type Mark = { iface: number; mes: number };
const mark = (): Mark => ({ iface: H.ifaces.length, mes: H.mesgs.length });
function lines(p: Player, from: Mark): string[] {
    return [
        ...H.ifaces
            .slice(from.iface)
            .filter(i => i.who === p.username && i.kind === 'text' && i.text)
            .map(i => i.text!),
        ...H.mesgs.slice(from.mes).filter(m => m.who === p.username).map(m => m.text)
    ];
}
// Joined, because ~chatnpc wraps at 380 pixels into separate component texts - the trap recorded in
// zanaris.ts and phasmatys.ts. Al's sonnet is eight lines of it.
const said = (out: string[], s: string) => out.join(' ').includes(s);

const hear = (p: Player) => H.equip(p, { front: 'camulet' });

function must(name: string, x: number, z: number, level = 0): Npc {
    const npc = H.npcNear(name, x, z, level);
    if (!npc) {
        throw new Error(`no ${name} is placed near ${x},${z},${level}`);
    }
    return npc;
}

function placed(name: string): number {
    const id = NpcType.getId(name);
    let n = 0;
    for (const npc of World.npcs) {
        if (npc && npc.type === id) {
            n++;
        }
    }
    return n;
}

function talkTo(p: Player, npc: Npc, picks: (number | string)[] = [], label = 'the menu this step expects'): string[] {
    const from = mark();
    if (!H.standBeside(p, npc)) {
        throw new Error(`nowhere to stand beside ${npc.x},${npc.z},${npc.level}`);
    }
    H.opNpc(p, npc, 1);
    for (let t = 0; t < 10 && !p.activeScript; t++) {
        H.tick(1);
    }
    try {
        drive(p, picks);
    } catch (e) {
        check(`  ${label}`, String(e).replace(/^Error: /, ''), picks.length ? 'the camel menu' : 'no menu at all');
    }
    H.tick(2);
    return lines(p, from);
}

/** The three things a player mutters, and the three ways a camel answers for it. */
const REMARKS = ["it'll probably bite my hand off", 'would make a nice kebab', 'has fleas'];
const OFFENCE = ['tries to stamp on your foot', 'turns its head and glares at you', 'spits at you, and you jump back'];

/** Every named camel, where it stands, and the line that proves its own conversation ran. */
const CAMELS: [string, number, number, string][] = [
    ['al_the_camel', 3273, 3166, 'such important matters weighing on my soul'],
    ['elly_the_camel', 3310, 3210, "Ollie is so remote, and I can't get up the courage"],
    ['ollie_the_camel', 3288, 3210, 'Do you know anything about flying?'],
    ['cam_the_camel', 3296, 3226, "The weather's really hot, don't you think?"],
    ['neferti_the_camel', 3292, 2753, 'Have you come from outside this town?']
];

console.log('WHAT IS STANDING THERE');
{
    for (const [name] of CAMELS) {
        const trigger = name === 'neferti_the_camel' ? `[apnpc1,${name}]` : `[opnpc1,${name}]`;
        check(`  ${name} answers ${trigger}`, !!ScriptProvider.getByName(trigger), true);
        check('  ...and the map places one', placed(name), 1);
    }
    check('  alice_the_camel has a handler too', !!ScriptProvider.getByName('[opnpc1,alice_the_camel]'), true);
    // ...and is unreachable until Ali Morrisane's traders exist: she is the second half of a
    // multinpc on desert_alkharid_alis_visible, and nothing in this build sets that bit.
    check('  ...but is not placed as herself', placed('alice_the_camel'), 0);
    check('  her multinpc shell is, as a plain camel', placed('alice_the_camel_multinpc'), 1);
    check('  ugthanki answers Talk-to', !!ScriptProvider.getByName('[opnpc1,ugthanki]'), true);
    check('  and there are twenty-seven of them', placed('ugthanki'), 27);
    // [camel] declares no ops at all, so there is nothing on it for a script to answer.
    check('  the plain desert camel has no options to answer', NpcType.get(NpcType.getId('camel')).op, null);
}

console.log('\nWITHOUT THE AMULET, A CAMEL IS STILL RUDE');
{
    const p = player('camel_deaf', CAMELS[1][1], CAMELS[1][2]);
    const seenRemark = new Set<number>();
    const seenOffence = new Set<number>();
    for (let i = 0; i < 40; i++) {
        const out = talkTo(p, must('elly_the_camel', CAMELS[1][1], CAMELS[1][2]), ['unpleasant']);
        REMARKS.forEach((r, n) => said(out, r) && seenRemark.add(n));
        OFFENCE.forEach((o, n) => said(out, o) && seenOffence.add(n));
        if (said(out, CAMELS[1][3])) {
            check('  a deaf player never gets the conversation', false, true);
        }
    }
    check('  all three things to mutter come up', seenRemark.size, 3);
    check('  and all three ways of being answered for it', seenOffence.size, 3);

    let out = talkTo(p, must('elly_the_camel', CAMELS[1][1], CAMELS[1][2]), ['dung']);
    check('  the dung question is not appreciated', said(out, "didn't seem to appreciate that question"), true);
    check('  and gets no dung, because there is none in this cache', said(out, 'close your eyes'), false);

    out = talkTo(p, must('elly_the_camel', CAMELS[1][1], CAMELS[1][2]), ['polite']);
    check('  and a polite player gets nothing at all', REMARKS.some(r => said(out, r)) || OFFENCE.some(o => said(out, o)), false);
}

console.log('\nWITH IT, THEY TALK');
{
    for (const [name, x, z, proof] of CAMELS) {
        const p = player('cam_' + name.slice(0, 9), x, z);
        hear(p);
        const out = talkTo(p, must(name, x, z), ['unpleasant']);
        check(`  ${name} answers back`, said(out, proof), true);
        check('  ...and no stamping, glaring or spitting', OFFENCE.some(o => said(out, o)), false);
    }
}

console.log('\nTHE DUNG QUESTION, ASKED OF A CAMEL THAT CAN ANSWER');
{
    const p = player('camel_dung', CAMELS[3][1], CAMELS[3][2]);
    hear(p);
    const out = talkTo(p, must('cam_the_camel', CAMELS[3][1], CAMELS[3][2]), ['dung']);
    check('  it takes the question seriously', said(out, 'Are you serious?'), true);
    check('  and has nothing to give right now', said(out, "I can't really help you right now"), true);
    // The "Otherwise" branch of the transcript needs an ugthanki dung obj, which this cache has not
    // got - the whole mechanic is My Arm's Big Adventure. Nothing must promise what it cannot do.
    check('  and never offers to produce any', said(out, 'close your eyes'), false);
}

console.log('\nAL REMEMBERS');
{
    const p = player('camel_al', CAMELS[0][1], CAMELS[0][2]);
    hear(p);
    check('  he starts with neither bit set', [H.getVarBit(p, 'al_camel_exposit'), H.getVarBit(p, 'al_camel_advicegiven')], [0, 0]);

    let out = talkTo(p, must('al_the_camel', CAMELS[0][1], CAMELS[0][2]), ['unpleasant']);
    check('  the first time, he tells you about Elly', said(out, 'hide like spun gold'), true);
    check('  gets four lines out', said(out, 'Thou art drier and more rough-skinned'), true);
    check('  and is cut off', said(out, "But I've only got six lines left!"), true);
    check('  which is remembered', H.getVarBit(p, 'al_camel_exposit'), 1);
    check('  no poem menu on the first visit', said(out, 'Which one would you like to hear?'), false);

    out = talkTo(p, must('al_the_camel', CAMELS[0][1], CAMELS[0][2]), ['unpleasant', 'No, thank you']);
    check('  afterwards he asks first', said(out, 'Have you come back to listen to my poems?'), true);
    check('  and takes no for an answer', said(out, 'I shall return to writing poems'), true);
    check('  reciting nothing', said(out, 'Shall I compare thee'), false);

    // Four picks, not three: the Elly question ends on a two-option menu of its own, and leaving
    // it unanswered is what drive() throws on.
    out = talkTo(p, must('al_the_camel', CAMELS[0][1], CAMELS[0][2]), ['unpleasant', "I'd love to", 'Shall I compare thee', 'Why not tell her how you feel']);
    check('  the sonnet runs to its last line', said(out, 'So long lives this, and this gives life to thee'), true);
    check('  and he asks after Elly once', said(out, 'What does Elly think of your poems?'), true);
    check('  which names his rival', said(out, 'I suspect she loves another - Ollie'), true);
    check('  and is remembered too', H.getVarBit(p, 'al_camel_advicegiven'), 1);
    check('  pressed on it, he will not say anything to her', said(out, 'She seems happy enough as she is'), true);
    check('  and asks you back either way', said(out, 'please come back again'), true);

    out = talkTo(p, must('al_the_camel', CAMELS[0][1], CAMELS[0][2]), ['unpleasant', "I'd love to", 'This Is Just To Say']);
    check('  the second poem is there as well', said(out, 'I have nibbled the cacti'), true);
    check('  and the Elly question is not asked twice', said(out, 'What does Elly think of your poems?'), false);
}

console.log('\nTHE UGTHANKI ARE RUDE BACK');
{
    const THREATS = ["I'll bite your leg off", 'you two-legged combat wrangler', 'your father smelt of cactuses'];
    const p = player('camel_ugth', 3264, 3051);
    let out = talkTo(p, must('ugthanki', 3264, 3051), [], 'an ugthanki offers no menu');
    check('  no menu - you do not ask a vicious camel for a favour', out.some(l => l.includes('Neither - ')), false);
    check('  the player mutters', REMARKS.some(r => said(out, r)), true);
    check('  and gets stamped on', OFFENCE.some(o => said(out, o)), true);

    hear(p);
    const seen = new Set<number>();
    for (let i = 0; i < 40; i++) {
        out = talkTo(p, must('ugthanki', 3264, 3051), [], 'an ugthanki offers no menu');
        THREATS.forEach((t, n) => said(out, t) && seen.add(n));
    }
    check('  with the amulet, all three threats come up', seen.size, 3);
}

console.log('\nAND TALKING TO ONE DROPS IT');
{
    // NO TICKS BETWEEN THE TWO READS, and that is the point. The first version of this check gave
    // the npc ten ticks to answer the click and then asked whether it still had a target - and it
    // passed with npc_setmode(none) deleted, because an ugthanki standing next to a player loses
    // and retakes its target over those ten ticks for reasons of its own. The trigger is run
    // directly with the npc active instead: npc_setmode(none) is its first statement, so this reads
    // the state the word itself left behind and nothing else.
    const p = player('camel_drop', 3264, 3051);
    H.maxOut(p);
    const npc = must('ugthanki', 3264, 3051);
    H.standBeside(p, npc);
    H.setNpcMode(npc, 'OPPLAYER2', p);
    check('  it is on the player', npc.target === p, true);
    H.runNpcProc(npc, '[opnpc1,ugthanki]', p);
    check('  and the first thing a word does is drop it', npc.target === p, false);
}

console.log('\nNEFERTI IS BEHIND A FENCE');
{
    const npc = must('neferti_the_camel', 3292, 2753);
    // "there is no way into the pasture" - so no tile beside her is reachable from the town, and an
    // [opnpc1] would have walked a player at the fence until the interaction timed out.
    const reachable = [
        [npc.x + 1, npc.z],
        [npc.x - 1, npc.z],
        [npc.x, npc.z + 1],
        [npc.x, npc.z - 1]
    ].filter(([x, z]) => connected(0, 3300, 2760, x, z, 60));
    console.log(`    ${reachable.length} of the four tiles beside her can be walked to from Sophanem`);
    check('  her Talk-to is an ap trigger, not an op', [!!ScriptProvider.getByName('[apnpc1,neferti_the_camel]'), !!ScriptProvider.getByName('[opnpc1,neferti_the_camel]')], [true, false]);
}

// ========================================================================= Lazim, afterwards
// He is the only way back to the amulet once it is gone and the only way to stop counting its
// charges. Both matter more here than in Old School: there is no ugthanki dung in this cache, so a
// spent Camulet cannot be recharged and his million is the only thing that keeps the teleport
// working at all.

/** Lazim at the altar on the temple's top floor, where he stands from completion onwards. */
const LAZIM = { x: 3105, z: 9318, level: 2 };

/** Talk to Lazim there, with the quest finished and him moved to the altar. */
function lazim(p: Player, picks: (number | string)[] = [], label = 'the menu this step expects'): string[] {
    H.setVarBit(p, 'enakh_quest', 70); // ^enakh_complete
    H.setVarBit(p, 'enakh_where_is_lazim', 3); // ^enakh_lazim_at_altar
    const npc = H.npcNear('enakh_lazim_altar_multinpc', LAZIM.x, LAZIM.z, LAZIM.level);
    if (!npc) {
        throw new Error('Lazim is not placed at the altar');
    }
    return talkTo(p, npc, picks, label);
}

console.log('\nLAZIM KEEPS A SPARE');
{
    const p = player('cam_lazim_a', LAZIM.x, LAZIM.z, LAZIM.level);
    H.setVarBit(p, 'enakh_camulet_charge', 4);
    check('  the player has no camulet anywhere', H.invCount(p, 'camulet'), 0);
    const out = lazim(p, [], 'a player with no camulet is given one, with no menu');
    check('  he greets the player as warmly as ever', said(out, 'How are you and your defective brain doing nowadays'), true);
    check('  and blames them for losing it', said(out, 'You really are an idiot'), true);
    check('  then hands one over', said(out, 'Lazim returns the Camulet to you.'), true);
    check('  which the player now has', H.invCount(p, 'camulet'), 1);
    check('  and he does not try to sell an upgrade in the same breath', said(out, 'one million coins'), false);
}

console.log('\nAND SELLS UNLIMITED CHARGES FOR A MILLION');
{
    const p = player('cam_lazim_b', LAZIM.x, LAZIM.z, LAZIM.level);
    H.give(p, 'camulet', 1);
    H.give(p, 'coins', 999999);
    let out = lazim(p, ['Why do you need so much money'], 'the upgrade pitch');
    check('  he offers the upgrade', said(out, 'For one million coins I can give it unlimited charges'), true);
    check('  and gives his three reasons', said(out, "we're not big on charity work"), true);
    check('  including hating the player', said(out, 'in case you need reminding, I hate you'), true);
    // One coin short: the transcript has the player say so themselves rather than being offered a
    // button they cannot press.
    check('  a coin short, the offer is not made', said(out, "Okay, here's one million coins"), false);
    check('  and the player says so', said(out, "I haven't got that kind of money on me"), true);
    check('  nothing is taken', H.invCount(p, 'coins'), 999999);
    check('  and nothing is upgraded', H.getVarBit(p, 'enakh_camulet_unlimited'), 0);

    H.give(p, 'coins', 1);
    out = lazim(p, ['Why do you need so much money', "I'm not interested"], 'the pay-or-not menu');
    check('  with the money, refusing costs nothing', H.invCount(p, 'coins'), 1000000);
    check('  and he takes it badly', said(out, 'Your loss.'), true);
    check('  still not upgraded', H.getVarBit(p, 'enakh_camulet_unlimited'), 0);

    out = lazim(p, ['Why do you need so much money', "here's one million coins"], 'the pay-or-not menu');
    check('  paying costs exactly a million', H.invCount(p, 'coins'), 0);
    check('  and augments the amulet', said(out, 'augments the enchantment on the Camulet'), true);
    check('  which is remembered', H.getVarBit(p, 'enakh_camulet_unlimited'), 1);

    // ...and from then on he only gloats about it.
    out = lazim(p, [], 'a gloat needs no menu');
    check('  afterwards he takes the credit', said(out, 'And don\'t forget who gave it unlimited charges for you!'), true);
    check('  and does not sell it twice', said(out, 'For one million coins'), false);
}

console.log('\nAND AN UPGRADED AMULET STOPS COUNTING');
{
    const p = player('cam_lazim_c', 3273, 3166);
    H.give(p, 'camulet', 1);
    H.setVarBit(p, 'enakh_quest', 70);
    H.setVarBit(p, 'enakh_camulet_charge', 0);
    H.setVarBit(p, 'enakh_camulet_unlimited', 1);

    let from = mark();
    H.opheld(p, 'camulet', 3);
    drive(p, []);
    check('  Check-charge says so', said(lines(p, from), 'Your camulet has unlimited charges.'), true);

    // A spent-out amulet with the upgrade still teleports, which is the whole of what the million
    // buys - and the only way the teleport works at all in a build with no ugthanki dung in it.
    const was = [p.x, p.z];
    from = mark();
    H.opheld(p, 'camulet', 4);
    for (let t = 0; t < 12; t++) {
        H.tick(1);
    }
    drive(p, []);
    check('  and Rub still works on nought charges', p.x !== was[0] || p.z !== was[1], true);
    check('  spending nothing', H.getVarBit(p, 'enakh_camulet_charge'), 0);
    check('  and saying nothing about charges left', said(lines(p, from), 'charges left'), false);
    // AND IT LANDS BESIDE LAZIM, which is the point of the destination this PR moved. The Camulet's
    // own page gives "Inside Enakhra's Temple" as the default and the surface entrance only "after
    // the hard Desert Diary" - 2015 content - and the surface entrance was the only one wired. It
    // matters because he is the only source of a replacement amulet: "To get to Lazim after
    // completing the quest, teleport to him with the camulet."
    console.log(`    rubbed to ${p.x},${p.z} plane ${p.level}; Lazim is at ${LAZIM.x},${LAZIM.z} plane ${LAZIM.level}`);
    check('  inside the temple, on Lazim\'s own floor', p.level, LAZIM.level);
    check('  and within a few tiles of him', Math.max(Math.abs(p.x - LAZIM.x), Math.abs(p.z - LAZIM.z)) <= 5, true);
}

console.log(`\n${R.ok} ok, ${R.bad} failed`);
process.exit(R.bad ? 1 : 0);
