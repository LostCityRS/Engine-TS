// WANTED!: who may start it, what the commorb costs, and who takes the hat.
// Usage: NODE_MEMBERS=true npx tsx tools/sim/wantedstart.ts   (exit code is the verdict)
//
// Three pieces of Old School's quest that this build did not have (DeathPlateau-Bugs#98):
//
//   THE REQUIREMENTS were not checked. The box reads "32 Quest points [required to start]" plus
//   Recruitment Drive, The Lost Tribe, Priest in Peril and Enter the Abyss - and only Recruitment
//   Drive was looked at, and only because Sir Tiffy is Recruitment Drive's own npc. One quest got
//   you the whole of this one.
//
//   THE COMMORB was free. "Sir Tiffy offers you a communication device for 10,000 coins, or he can
//   make one if you bring the supplies ... a law rune, an enchanted gem and molten glass."
//   And a LOST one is a loan, not a second sale: "Sir Tiffy Cashien will lend you his" - without
//   which losing the orb mid-hunt was a dead end, because nothing else in the game issues one.
//
//   THE HAT went to Sir Tiffy. "Return to Falador. Talk to Sir Amik Varze in the White Knights'
//   Castle, and hand over the hat." The page gives Tiffy no part in the ending at all.
import * as H from './harness.js';
import * as A from './a1lib.js';
import { check, R, player } from './a1lib.js';
import { PlayerStat } from '#/engine/entity/PlayerStat.js';

await H.boot();
H.loginOrder();

const QP = 32;
const COST = 10000;
// Completion values, and every gate is "< complete" rather than "!= complete": priestperil's own
// post-quest stage (barrier access) is 61 against a completion value of 60, so != would refuse the
// players who had done the most.
const DONE = { lost_tribe_quest: 11, priestperil: 60, abyssal_miniquest: 4, rd_main: 2 };

// A player who meets everything except whatever the caller spoils.
const candidate = (name: string, spoil: Partial<Record<string, number>> = {}) => {
    const p: any = player(name, 2997, 3374, 0); // Falador park, where Sir Tiffy sits
    H.maxOut(p);
    H.clearInv(p);
    H.setVar(p, 'qp', spoil.qp !== undefined ? spoil.qp : QP);
    H.setVarBit(p, 'rd_main', DONE.rd_main);
    H.setVarBit(p, 'lost_tribe_quest', spoil.lost_tribe_quest !== undefined ? spoil.lost_tribe_quest : DONE.lost_tribe_quest);
    H.setVar(p, 'priestperil', spoil.priestperil !== undefined ? spoil.priestperil : DONE.priestperil);
    H.setVar(p, 'abyssal_miniquest', spoil.abyssal_miniquest !== undefined ? spoil.abyssal_miniquest : DONE.abyssal_miniquest);
    H.tick(2);
    return p;
};
// Tiffy's start has TWO menus - "Go on." before the exposition, then the commorb offer - so a
// caller buying an orb has to answer both. A.talk throws if a pick goes unused, which is how the
// second menu was found at all; A.drive is then given none, or it throws for the same reason.
// AND IT CATCHES. With the gate absent, Tiffy walks straight into his "Go on." menu and A.talk
// throws "unexpected menu" on the first candidate - which aborts the file and reports nothing. A
// run against the unfixed tree should say WHICH behaviours are missing, not die on check one, so
// an unexpected menu is recorded as what it actually means: the conversation got past the gate.
const saidTo = (p: any, picks: string[] = []) => {
    H.clearLogs();
    let lines: string[] = [];
    try {
        lines = A.talk(p, 'rd_teleporter_guy', picks);
        H.tick(8);
        A.drive(p);
    } catch (e) {
        lines = ['<conversation did not go as this check expects: ' + (e as Error).message + '>'];
    }
    H.tick(6);
    return lines.concat(H.ifaces.filter(i => i.who === p.username && i.kind === 'text' && i.text).map(i => i.text!)).join(' ');
};

console.log('== nobody gets in without the quest points and the four quests');
{
    const short = candidate('wq_qp', { qp: QP - 1 });
    const said = saidTo(short);
    check(`one quest point short: he says so (${QP - 1}/${QP})`, said.includes(`${QP} quest points`), true);
    check('  ...and the quest has not started', H.getVarBit(short, 'wanted_main'), 0);
    check('  ...and no commorb changed hands', H.invCount(short, 'wanted_crystal_ball'), 0);

    const noTribe = candidate('wq_tribe', { lost_tribe_quest: DONE.lost_tribe_quest - 1 });
    check('The Lost Tribe unfinished: refused by name', saidTo(noTribe).includes('The Lost Tribe'), true);
    check('  ...and the quest has not started', H.getVarBit(noTribe, 'wanted_main'), 0);

    const noPeril = candidate('wq_peril', { priestperil: DONE.priestperil - 1 });
    check('Priest in Peril unfinished: refused by name', saidTo(noPeril).includes('Priest in Peril'), true);
    check('  ...and the quest has not started', H.getVarBit(noPeril, 'wanted_main'), 0);

    const noAbyss = candidate('wq_abyss', { abyssal_miniquest: DONE.abyssal_miniquest - 1 });
    check('Enter the Abyss unfinished: refused by name', saidTo(noAbyss).includes('Enter the Abyss'), true);
    check('  ...and the quest has not started', H.getVarBit(noAbyss, 'wanted_main'), 0);
}

console.log('\n== and finishing Priest in Peril PROPERLY is not held against you');
{
    // ^priestperil_complete is 60 and ^priestperil_access_holy_barrier is 61. A != test refuses the
    // player at 61 - someone who finished the quest AND earned barrier access. This is the check
    // that makes the operator in the script load-bearing.
    const past = candidate('wq_past', { priestperil: 61 });
    H.give(past, 'coins', COST);
    H.tick(1);
    const said = saidTo(past, ['Go on', "I'll pay"]);
    check('a player past the completion stage is not refused', said.includes('Priest in Peril'), false);
    check('  ...and can start the quest', H.getVarBit(past, 'wanted_main'), 10);
}

console.log('\n== the commorb is sold, not given');
{
    const broke = candidate('wq_broke');
    const said = saidTo(broke, ['Go on', "I'll pay"]);
    check('no money, no orb', H.invCount(broke, 'wanted_crystal_ball'), 0);
    check('  ...and the quest has not started', H.getVarBit(broke, 'wanted_main'), 0);
    check('  ...and he names the price', said.includes(String(COST)) || said.includes('ten thousand'), true);

    const payer = candidate('wq_pays');
    H.give(payer, 'coins', COST + 5);
    H.tick(1);
    saidTo(payer, ['Go on', "I'll pay"]);
    check('ten thousand coins buys one', H.invCount(payer, 'wanted_crystal_ball'), 1);
    check('  ...and exactly ten thousand is taken', H.invCount(payer, 'coins'), 5);
    check('  ...and the quest starts', H.getVarBit(payer, 'wanted_main'), 10);

    const maker = candidate('wq_parts');
    for (const o of ['lawrune', 'slayer_gem', 'molten_glass']) H.give(maker, o);
    H.tick(1);
    saidTo(maker, ['Go on', 'brought the parts']);
    check('or a law rune, an enchanted gem and molten glass', H.invCount(maker, 'wanted_crystal_ball'), 1);
    check('  ...and all three parts are taken', [H.invCount(maker, 'lawrune'), H.invCount(maker, 'slayer_gem'), H.invCount(maker, 'molten_glass')], [0, 0, 0]);
    check('  ...and the quest starts', H.getVarBit(maker, 'wanted_main'), 10);

    const short = candidate('wq_short');
    for (const o of ['lawrune', 'slayer_gem']) H.give(short, o); // no molten glass
    H.tick(1);
    saidTo(short, ['Go on', 'brought the parts']);
    check('two parts out of three is not enough', H.invCount(short, 'wanted_crystal_ball'), 0);
    check('  ...and neither part is taken', [H.invCount(short, 'lawrune'), H.invCount(short, 'slayer_gem')], [1, 1]);
}

console.log('\n== a lost commorb is a loan, and it used to be a dead end');
{
    const lost = candidate('wq_lost');
    H.setVarBit(lost, 'wanted_main', 30); // ^wanted_hunting, mid-chase, orb gone
    H.give(lost, 'coins', COST);
    H.tick(2);
    saidTo(lost);
    check('Tiffy lends his own', H.invCount(lost, 'wanted_crystal_ball'), 1);
    check('  ...and does not charge again', H.invCount(lost, 'coins'), COST);
    check('  ...and the hunt is where it was', H.getVarBit(lost, 'wanted_main'), 30);
}

console.log('\n== Sir Amik Varze takes the hat, and Sir Tiffy does not');
{
    const atTiffy = candidate('wq_tiffy');
    H.setVarBit(atTiffy, 'wanted_main', 40); // ^wanted_cornered
    H.give(atTiffy, 'wanted_solus_trophy');
    H.give(atTiffy, 'wanted_crystal_ball');
    H.tick(2);
    const said = saidTo(atTiffy);
    check('Tiffy will not finish it', H.getVarBit(atTiffy, 'wanted_main'), 40);
    check('  ...and keeps his hands off the hat', H.invCount(atTiffy, 'wanted_solus_trophy'), 1);
    check('  ...and sends you to Sir Amik Varze', said.includes('Amik'), true);

    const atAmik: any = player('wq_amik', 2960, 3338, 0); // the White Knights' Castle
    H.maxOut(atAmik);
    H.clearInv(atAmik);
    H.setVarBit(atAmik, 'rd_main', DONE.rd_main);
    H.setVarBit(atAmik, 'wanted_main', 40);
    H.give(atAmik, 'wanted_solus_trophy');
    H.tick(2);
    const slayerBefore = atAmik.stats[PlayerStat.SLAYER];
    H.clearLogs();
    // The pick goes to A.talk ONLY. Giving it to the follow-up A.drive as well leaves it unused
    // there and A.drive throws "menus not reached" - which reads exactly like the menu never
    // appearing, and cost me a round of debugging against a probe that worked fine.
    try {
        A.talk(atAmik, 'sir_amik_varze', ['Solus Dellagar']);
        H.tick(14);
        A.drive(atAmik);
    } catch (e) {
        // Without the hook he has no Solus topic at all, so the pick goes unused and A.talk
        // throws. That is the finding, not a reason to stop the file.
        console.log(`  (Sir Amik had nothing to say about Solus: ${(e as Error).message})`);
    }
    H.tick(8);
    check('Sir Amik completes the quest', H.getVarBit(atAmik, 'wanted_main'), 50);
    check('  ...takes the hat', H.invCount(atAmik, 'wanted_solus_trophy'), 0);
    check('  ...and pays the 5,000 Slayer', atAmik.stats[PlayerStat.SLAYER] - slayerBefore, 50000);
}

console.log('\n== and Savant can sign out another hat, because a full inventory used to end the quest');
{
    const p = candidate('wq_hat');
    H.setVarBit(p, 'wanted_main', 40); // cornered, hat gone
    H.give(p, 'wanted_crystal_ball');
    H.tick(2);
    check('the hat really is gone', H.invCount(p, 'wanted_solus_trophy'), 0);
    H.clearLogs();
    H.opheld(p, 'wanted_crystal_ball', 2); // Contact
    for (let t = 0; t < 30 && !p.activeScript; t++) H.tick(1);
    A.drive(p);
    H.tick(6);
    check('Savant issues a replacement', H.invCount(p, 'wanted_solus_trophy'), 1);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
