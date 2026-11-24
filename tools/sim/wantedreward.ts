// WANTED!: what the quest pays.
// Usage: NODE_MEMBERS=true npx tsx tools/sim/wantedreward.ts   (exit code is the verdict)
//
// Reported from play (DeathPlateau-Bugs#99): "wanted! questgives wrong reward". It did, in both
// skills at once. Old School's list is "1 Quest point, 5,000 Slayer experience, Access to the White
// Knights' armoury" (oldschool.runescape.wiki/w/Wanted!) and ours paid 18,000 Magic and 5,000
// Hitpoints - a skill the quest does not touch, a second skill it does not touch, and nothing of
// the one it does.
//
// The 5,000 was the right number against the wrong skill, which is likely how it happened. The
// 18,000 Magic has no source anywhere on the page.
//
// THE ARMOURY IS NOT CHECKED HERE because this build has not got one: Sir Vyvin answers "Do you
// have anything to trade?" with "No, I'm sorry." The completion scroll no longer promises it, and
// that absence is asserted below so the scroll and the game cannot drift apart again.
import * as H from './harness.js';
import * as A from './a1lib.js';
import { check, R, player } from './a1lib.js';
import { PlayerStat } from '#/engine/entity/PlayerStat.js';

await H.boot();
H.loginOrder();

const xp = (p: any, stat: number) => p.stats[stat];

console.log('== handing the hat over pays Slayer, and only Slayer');
{
    // THE HAT GOES TO SIR AMIK VARZE, not to Sir Tiffy, and this file used to take it to Tiffy.
    // Old School's ending is "Return to Falador. Talk to Sir Amik Varze in the White Knights'
    // Castle, and hand over the hat" and the page gives Tiffy no part in it at all; the quest was
    // awarding itself on his bench. Moved with the fix that moved the hand-in.
    const p: any = player('wreward', 2960, 3338, 0); // the White Knights' Castle
    H.maxOut(p);
    H.clearInv(p);
    H.setVarBit(p, 'rd_main', 2);
    // ^wanted_cornered - the hunt is done and the trophy is in hand, one conversation from the end.
    H.setVarBit(p, 'wanted_main', 40);
    H.give(p, 'wanted_solus_trophy');
    H.tick(2);

    const before = [xp(p, PlayerStat.SLAYER), xp(p, PlayerStat.MAGIC), xp(p, PlayerStat.HITPOINTS)];
    H.clearLogs();
    // Sir Amik offers the topic rather than being taken over by it - he is also the start of Black
    // Knights' Fortress - so the conversation has to be asked for by name.
    const said = A.talk(p, 'sir_amik_varze', ['Solus Dellagar']);
    H.tick(14);
    A.drive(p);
    H.tick(8);

    const gained = [xp(p, PlayerStat.SLAYER) - before[0], xp(p, PlayerStat.MAGIC) - before[1], xp(p, PlayerStat.HITPOINTS) - before[2]];
    console.log(`  gained: slayer ${gained[0] / 10}, magic ${gained[1] / 10}, hitpoints ${gained[2] / 10}`);
    check('the quest is complete', H.getVarBit(p, 'wanted_main') >= 50 || !said, true);
    // Experience is in tenths, so 5,000 Slayer is 50000.
    check('5,000 Slayer experience', gained[0], 50000);
    check('  ...and no Magic experience at all', gained[1], 0);
    check('  ...and no Hitpoints experience at all', gained[2], 0);
    check('  ...and the hat is taken', H.invCount(p, 'wanted_solus_trophy'), 0);
}

console.log('\n== and the scroll does not promise a shop that is not there');
{
    // THE ARMOURY. Old School's third reward is access to the White Knights' armoury and this build
    // has none, so the scroll must not claim it. Asserted both ways: the words are gone, and Sir
    // Vyvin still has nothing to trade - the day somebody builds the armoury, this check is the
    // reminder to put the line back.
    const p: any = player('wvyvin', 2997, 3374, 0);
    H.maxOut(p);
    H.clearInv(p);
    H.tick(2);
    H.clearLogs();
    const lines = A.talk(p, 'sir_vyvin', ['anything to trade']);
    H.tick(4);
    const all = lines.concat(H.ifaces.filter(i => i.who === p.username && i.kind === 'text' && i.text).map(i => i.text!)).join(' ');
    check('Sir Vyvin still has no armoury to open', all.includes("No, I'm sorry"), true);
    check('  ...and no shop window opened', p.modalMain, -1);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
