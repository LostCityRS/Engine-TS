// SHIELD OF ARRAV, played through on foot, by the BLACK ARM GANG.
//
// THE OTHER GANG, and the helper table did not know it existed. There was one Shield of Arrav row,
// keyed on %phoenixgang, with seven Phoenix legs. The two gangs are mutually exclusive - katrine.rs2
// refuses a Phoenix member, straven.rs2 refuses a Black Arm one - and they are tracked by two
// different varps. On this side %phoenixgang stops at ^phoenixgang_spoken_reldo (3) and never moves
// again, so the panel sat on leg 3 for the whole quest and told the player to go and see Baraek
// about joining the Phoenix Gang. Reported as "shield of arrav helper, straven steps incorrect"
// (DeathPlateau-Bugs#73): the steps were not subtly wrong, they were the other gang's.
//
// TWO ROWS, EACH ON ITS OWN VARP, which needs nothing new: a row already carries one `stageVar`,
// and HAZEEL CULT and TEMPLE OF IKOV are two rows each. What #73 called a data-model question -
// "the helper has to allow a quest two alternative stage vars" - is answered by not needing one.
//
// ONE PLAYER, and that is this build rather than Old School. The wiki's Black Arm route needs a
// partner in the Phoenix Gang: they hold the weapon store key, and the Curator hands each of you
// half a certificate to trade. Here the Curator writes a whole certificate for one half shield,
// which is the half-reward path an earlier fix left in place deliberately - see DeathPlateau-Bugs#74,
// where whether to restore the two-halves rule is still an open question. If it is restored, this
// run is where the second player would have to go in.
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_arrav_blackarm_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const RELDO: [number, number, number] = [3211, 3493, 0];
const BOOKCASE: [number, number] = [3212, 3493];
// CHARLIE THE TRAMP IS `tramppg`, not `tramp`. The cache has both: `tramp` is the level-2 one with
// nothing but Attack on it, and this one is vislevel=hide with Talk-to - the quest npc. Clicking
// the wrong one is a crash in the harness rather than a wrong answer, which is the useful kind.
const TRAMP: [number, number, number] = [3208, 3391, 0];
const KATRINE: [number, number, number] = [3186, 3385, 0];
// The weapon store, east of the south gate. The crossbows and the Weaponsmaster are UPSTAIRS; the
// way up is an ordinary ladder on the east side of the building.
const STORE_DOOR: [number, number] = [3251, 3385];
const STORE_LADDER: [number, number] = [3252, 3384];
// The two crossbows lie at 3245,3385 and 3243,3383. The first is taken where the climb lands you,
// so only the second needs a walk.
const _CROSSBOW_A: [number, number] = [3245, 3385];
const CROSSBOW_B: [number, number] = [3243, 3383];
// Upstairs in the Black Arm headquarters, which is the only room the right half is ever in.
const CUPBOARD: [number, number] = [3189, 3385];
const _HQ_LADDER: [number, number] = [3187, 3390]; // the way up, which the run jumps rather than climbs
const CURATOR: [number, number, number] = [3255, 3445, 0];
const ROALD: [number, number, number] = [3222, 3476, 0];

const m: Manifest = {
    quest: 'SHIELD OF ARRAV (BLACK ARM GANG)',
    source: 'oldschool.runescape.wiki/w/Shield_of_Arrav',
    stageVar: 'blackarmgang',
    done: 4, // ^blackarmgang_complete
    start: RELDO,
    steps: [
        { note: 'wiki: food and a weapon that can kill a level 23, which is the Weaponsmaster' },
        { give: 'rune_scimitar' },
        { held: 'rune_scimitar', op: 2, why: 'wield it' },

        { note: 'wiki step 1: Reldo in the Varrock palace library starts it for either gang' },
        { talk: 'reldo', picks: ['in search of a quest'], why: 'he points at a book' },

        { note: 'wiki step 2: the book itself, and reading it is the step rather than taking it' },
        { loc: 'questbookcase', at: BOOKCASE, op: 2, want: 'take the book', why: 'search the case' },
        { has: 'the_shield_of_arrav' },
        { held: 'the_shield_of_arrav', op: 1, why: 'read it' },

        { note: 'wiki step 3: Charlie the Tramp, by the alleyway, is where the two gangs part' },
        { setpos: TRAMP, why: 'south-west to the alleyway' },
        {
            talk: 'tramppg',
            picks: ['Is there anything down this alleyway?', 'Do you think they would let me join?'],
            want: 'Katrine',
            why: 'he names Katrine and the alleyway'
        },
        { stage: 1, why: '^blackarmgang_started - and the Phoenix varp never moves past 3 from here' },

        { note: 'wiki step 4: Katrine, in the headquarters down the alleyway. She wants two' },
        { note: "crossbows stolen from the Phoenix Gang's weapon store before she will have you." },
        { setpos: KATRINE, why: 'to the headquarters' },
        {
            talk: 'katrine',
            picks: ["I've heard you're the Black Arm Gang.", 'It was the tramp outside.', 'I want to become a member of your gang.', "Well, you can give me a try can't you?", 'Ok, no problem.'],
            want: 'crossbows',
            why: 'she sets the test'
        },
        { stage: 2, why: '^blackarmgang_spoken_katrine - the crossbow job' },

        { note: 'wiki step 5: the crossbows are upstairs in the weapon store, and the Weaponsmaster' },
        { note: 'will prevent you and attack rather than let you take one, so he has to be killed' },
        { note: 'first' },
        // THE GIVE IS THE SECOND PLAYER. Straven hands phoenixkey2 to his own members and nothing
        // else in the game gives one out, so there is no way for a Black Arm player to earn it -
        // which is the quest's design rather than a gap, and is why the leg above asks the player
        // to bring one. A `loc` click on that door instead of this `useLoc` leaves the player
        // outside on level 0 with the ladder unreachable; that is the mutation that proves the
        // step, and it is the whole reason the key is in the leg's item list.
        { give: 'phoenixkey2' },
        { setpos: [STORE_DOOR[0], STORE_DOOR[1] + 1, 0], why: 'east to the weapon store' },
        { note: "wiki: the store door is locked and its key is the Phoenix Gang's, so it has to" },
        { note: 'come from your partner, who can hand one over without losing their own' },
        { useLoc: 'phoenixdoor2', at: STORE_DOOR, obj: 'phoenixkey2', want: 'unlock the door', why: 'unlock it' },
        { loc: 'ladder', at: STORE_LADDER, hop: true, why: 'up the ladder' },
        { wait: 4, why: 'the climb is an arrivedelay and a teleport' },
        { nearnpc: 'weaponsmaster', r: 10, why: 'he is up here' },
        { fight: 'weaponsmaster', tries: 3, r: 16, why: 'kill him' },
        { take: 'phoenix_crossbow', r: 10, tries: 3, why: 'and take the first crossbow' },
        { go: CROSSBOW_B, exact: true, r: 20, soft: true, why: 'to the second one' },
        { take: 'phoenix_crossbow', r: 10, tries: 3, why: 'and the second' },
        { has: 'phoenix_crossbow', n: 2 },

        { note: 'wiki step 6: back to Katrine, who makes you a Black Arm' },
        { setpos: KATRINE, why: 'back to the headquarters' },
        // NO `picks` HERE. @katrine_got_yet asks "Have you got those crossbows for me yet?" and
        // then answers it off the inventory, so "Yes, I have." is her script talking rather than an
        // option a player chooses - and a pick for it fails with "the dialogue never offered" it.
        { talk: 'katrine', want: 'join our gang', why: 'she takes the crossbows' },
        { stage: 3, why: '^blackarmgang_joined' },
        { hasnt: 'phoenix_crossbow' },

        { note: 'wiki step 7: the right half of the shield is in a cupboard upstairs in the' },
        { note: 'headquarters, which only a member can reach' },
        { setpos: [CUPBOARD[0], CUPBOARD[1] + 1, 1], why: 'upstairs' },
        { loc: 'blackarmcupboardshut', at: CUPBOARD, why: 'open the cupboard' },
        { wait: 4, why: 'opening it is its own action' },
        { loc: 'blackarmcupboardopen', at: CUPBOARD, op: 2, until: 'arravshield2', tries: 3, why: 'and search it' },
        { has: 'arravshield2' },

        { note: 'wiki step 8: the Curator at the museum writes the certificate' },
        { setpos: CURATOR, why: 'north to the museum' },
        { talk: 'curator', want: 'certificate', why: 'he takes the half shield' },
        { has: 'arravcertificate' },
        { hasnt: 'arravshield2' },

        { note: 'wiki step 9: and the certificate to King Roald' },
        { setpos: ROALD, why: 'west to the palace' },
        { talk: 'king_roald', why: 'the reward' },
        { stage: 4 },
        { hasnt: 'arravcertificate' },
        { has: 'coins', n: 600 }
    ]
};

const p: any = H.makePlayer('arravba', m.start[0], m.start[1]);
H.tick(2);
p.teleport(m.start[0], m.start[1], m.start[2]);
p.applyDamage = function () {};
H.setVar(p, 'macro_event', 1);
H.maxOut(p);
H.tick(1);

const res = play(m, p);
const bad = res.filter(r => !r.ok);
console.log('');
if (bad.length) {
    console.log('WHAT WENT WRONG');
    for (const r of bad) console.log('  step ' + r.n + '  ' + r.what + (r.detail ? '  -- ' + r.detail : ''));
}
process.exit(bad.length ? 1 : 0);
