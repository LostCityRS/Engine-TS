// GRANDPA JACK SELLS HIS FISHING ROD.
//
//   npx tsx tools/sim/grandpajack.ts
//
// Five coins for the "competition winning" rod, which is an ordinary fishing_rod. He is the only
// seller anywhere near the Fishing Contest - the pond itself turns a player away with "You need a
// fishing rod to catch these fish" (quest_fishingcompo/hemenster_fishing.rs2) and the next nearest
// are Port Sarim and Catherby - so this is the difference between the quest being startable on the
// spot and a trip across the map.
//
// IT IS A CONVERSATION, NOT A SHOP. His npc config has op1=Talk-to and no Trade (377 all.npc), and
// that is correct rather than something missing, so there is no shop inv to assert against: the
// whole sale is the dialogue branch and the four states it can end in.
//
// WHAT THIS ASSERTS
//   * the option is there, and is there OUTSIDE the quest as well as during it;
//   * five coins in, one rod out, and the coins actually leave;
//   * he refuses a player already carrying a rod, and takes nothing;
//   * he refuses a player who cannot pay, and takes nothing;
//   * he refuses a player with nowhere to put it, and takes nothing;
//   * and the one case that reads as a refusal and is not: a FULL pack whose coins are exactly the
//     five being spent. Paying empties that stack and frees its slot, so the sale makes its own
//     room - a plain inv_freespace test refuses a player it should serve.
import * as H from './harness.js';
import Player from '#/engine/entity/Player.js';
import { check, R, player, talk } from './a1lib.js';
import InvType from '#/cache/config/InvType.js';

await H.boot();

const ROD = 'fishing_rod';
const PICK = 'buy your fishing rod';
const rods = (p: Player) => H.invCount(p, ROD);
const gp = (p: Player) => H.invCount(p, 'coins');

/** A fresh customer at Hemenster with nothing but what we give them. */
function customer(name: string, coins: number): Player {
    const p = player(name, 2965, 3380);
    H.clearInv(p);
    if (coins > 0) H.give(p, 'coins', coins);
    return p;
}

console.log('\n================ HE SELLS IT');
{
    const p = customer('gjbuy', 10);
    H.clearLogs();
    talk(p, 'grandpa_jack', [PICK]);
    check('one rod', rods(p), 1);
    check('five coins gone', gp(p), 5);
    // mes() is a game message, not a chat line, so it lands in H.mesgs rather than in what talk()
    // hands back - the first version of this looked for it in the dialogue and reported a line
    // that was being sent correctly as missing.
    check(
        'and he says so',
        H.mesgs.some(m => m.who === p.username && m.text.includes('hand over the money and receive a fishing rod')),
        true
    );
}

console.log('\n================ AND OUTSIDE THE QUEST TOO');
{
    // %fishingcompo 0 is "never started", which is the state of every player who has not begun the
    // Fishing Contest - the option list is a different one there (p_choice3, not p_choice4) and
    // this is what says the rod is on both of them.
    const p = customer('gjnoquest', 10);
    H.setVar(p, 'fishingcompo', 0);
    talk(p, 'grandpa_jack', [PICK]);
    check('a player who has never started the quest can still buy one', rods(p), 1);
}

console.log('\n================ AND REFUSES, WITHOUT TAKING ANYTHING');
{
    const p = customer('gjhasrod', 10);
    H.give(p, ROD, 1);
    const said = talk(p, 'grandpa_jack', [PICK]);
    check('a player already carrying a rod gets no second one', rods(p), 1);
    check('...and keeps their coins', gp(p), 10);
    check(
        '...and is told why',
        said.some(m => m.toLowerCase().includes('already')),
        true
    );
}
{
    const p = customer('gjbroke', 4);
    talk(p, 'grandpa_jack', [PICK]);
    check('four coins buys nothing', rods(p), 0);
    check('...and the four are still there', gp(p), 4);
}
{
    // A FULL PACK WITH MONEY TO SPARE. 27 junk items and a stack of 10 coins is 28 of 28 slots, so
    // paying leaves 5 in the stack and there is still nowhere for the rod to go. inv_add would put
    // it on the floor, which is a rod the player paid for lying in the dirt.
    const p = customer('gjfull', 10);
    H.fillInv(p);
    const coinsBefore = gp(p);
    talk(p, 'grandpa_jack', [PICK]);
    check('a full pack buys nothing', rods(p), 0);
    check('...and the coins are untouched', gp(p), coinsBefore);
}

console.log('\n================ EXCEPT WHEN PAYING MAKES THE ROOM');
{
    // THE CASE THE OBVIOUS CHECK GETS WRONG. Full pack, and the coins in it are exactly the five
    // being handed over - so the stack empties, its slot frees, and the rod fits. A player refused
    // here is refused for want of a space the sale itself creates.
    // five coins first, then junk into every slot left: a full pack whose only money is the
    // exact price.
    const p = customer('gjexact', 5);
    H.fillInv(p);
    check('the pack really is full', p.getInventory(InvType.INV)!.freeSlotCount, 0);
    check('...with exactly five coins in it', gp(p), 5);
    talk(p, 'grandpa_jack', [PICK]);
    check('the sale makes its own room', rods(p), 1);
    check('...and the coins are spent', gp(p), 0);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
