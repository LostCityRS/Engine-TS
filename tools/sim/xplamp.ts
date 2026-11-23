// FOUR LAMPS SHARE ONE INTERFACE AND NOT ONE AWARD.
//
// macro_genilamp pays the skill's own level x 10, tgbr_blessed_lamp a flat 5,000 above level 30,
// Recipe for Disaster's hundred_rewardlamp 20,000 above level 50, and A Tail of Two Cats'
// twocats_rewardlamp 2,500 above level 30. Two of those four used to open the interface from
// another file without saying which lamp they were, so they paid whatever the interface was last
// told - normally a genie lamp's level x 10, which is 990 experience at level 99 in place of
// RFD's 20,000.
//
// WHAT THIS IS REALLY GUARDING is a boolean that could not count to four. The interface held
// "is this the blessed lamp", nothing cleared it, and scope=temp does not mean cleared when the
// window closes: rub the blessed lamp, close it without choosing, rub a different lamp, and the
// second lamp paid the blessed award and demanded the blessed lamp's level. That is section 3,
// and it is the check to keep if any of these ever has to go.
//
// AND THE LAMP THAT WAS RUBBED IS THE ONE THAT GOES. The old consume scanned the bag in a fixed
// order and deleted the first lamp it found, which was defensible only while every lamp paid the
// same; holding two and rubbing the better one cost you the other and paid you for it.
//
//   npx tsx tools/sim/xplamp.ts
import * as H from './harness.ts';
import { check, R, player } from './a1lib.ts';
import { PlayerStatMap } from '#/engine/entity/PlayerStat.js';
import VarPlayerType from '#/cache/config/VarPlayerType.js';

await H.boot();

const COOK = PlayerStatMap.get('COOKING')!;
const KIND = VarPlayerType.getId('xplamp_kind');
let seq = 0;

/** Rub a lamp, pick Cooking, confirm - and say what it paid and whether the lamp survived. */
function rub(lamp: string, level: number): { xp: number; kept: number } {
    const p: any = player('lamp' + seq++, 3222, 3218, 0);
    p.setLevel(COOK, level);
    H.give(p, lamp, 1);
    const before = p.stats[COOK];
    H.opheld(p, lamp, 1);
    H.ifButton(p, 'xplamp:cooking');
    H.ifButton(p, 'xplamp:confirm');
    H.tick(2);
    return { xp: (p.stats[COOK] - before) / 10, kept: H.invCount(p, lamp) };
}

// ------------------------------------------------------------------ 1. what each one pays
console.log('\nWHAT EACH LAMP PAYS, at a level above its gate');
for (const [lamp, want, what] of [
    ['macro_genilamp', 500, 'the genie lamp pays the level x 10'],
    ['tgbr_blessed_lamp', 5000, "the blessed lamp's flat 5,000"],
    ['hundred_rewardlamp', 20000, "Recipe for Disaster's 20,000"],
    ['twocats_rewardlamp', 2500, "A Tail of Two Cats' 2,500"]
] as [string, number, string][]) {
    const r = rub(lamp, 50);
    check(what, r.xp, want);
    check('  ...and the lamp is used up', r.kept, 0);
}

// THE GENIE LAMP SCALES and the other three do not, which is the one thing a single number cannot
// show: a flat lamp read as "level x 10" would pass the 50 case above at exactly one level.
check('the genie lamp follows the level: 1 -> 10', rub('macro_genilamp', 1).xp, 10);
check('  ...and 99 -> 990', rub('macro_genilamp', 99).xp, 990);
check('a flat lamp does NOT follow the level: RFD at 99 is still 20,000', rub('hundred_rewardlamp', 99).xp, 20000);

// ------------------------------------------------------------------ 2. the level gates
console.log('\nTHE GATES: below the level, nothing is paid and the lamp stays');
for (const [lamp, level, want, what] of [
    ['hundred_rewardlamp', 49, 50, 'RFD refuses at 49'],
    ['twocats_rewardlamp', 29, 30, 'two cats refuses at 29'],
    ['tgbr_blessed_lamp', 29, 30, 'blessed refuses at 29']
] as [string, number, number, string][]) {
    const r = rub(lamp, level);
    check(`${what} (needs ${want})`, r.xp, 0);
    check('  ...and keeps the lamp, so nothing is lost', r.kept, 1);
}
// AT the gate, not just above it: "at least" rather than "over", which is the reading the blessed
// lamp arrived with and the one the wiki's own list page uses.
check('RFD pays AT level 50, not only above it', rub('hundred_rewardlamp', 50).xp, 20000);
check('two cats pays AT level 30', rub('twocats_rewardlamp', 30).xp, 2500);
// and the genie lamp has no gate at all
check('the genie lamp has no gate - level 1 is paid', rub('macro_genilamp', 1).kept, 0);

// ------------------------------------------------------------------ 3. nothing is inherited
//
// The regression this file exists for. Rub the blessed lamp, abandon the window, rub a different
// lamp: the second lamp must be itself.
console.log('\nNOTHING IS INHERITED from a lamp that was opened and abandoned');
const p: any = player('lampLeak', 3222, 3218, 0);
p.setLevel(COOK, 50);
H.give(p, 'tgbr_blessed_lamp', 1);
H.give(p, 'hundred_rewardlamp', 1);
H.opheld(p, 'tgbr_blessed_lamp', 1);
check('rubbing the blessed lamp says so', p.getVar(KIND), 1);
p.closeModal();
H.tick(2);
H.opheld(p, 'hundred_rewardlamp', 1);
check('rubbing the RFD lamp next says RFD, not blessed', p.getVar(KIND), 2);
const before = p.stats[COOK];
H.ifButton(p, 'xplamp:cooking');
H.ifButton(p, 'xplamp:confirm');
H.tick(2);
check('  ...so it pays 20,000 and not 5,000', (p.stats[COOK] - before) / 10, 20000);
check('  ...and takes the RFD lamp', H.invCount(p, 'hundred_rewardlamp'), 0);
check('  ...leaving the blessed lamp alone, which it used to eat', H.invCount(p, 'tgbr_blessed_lamp'), 1);

console.log(R.bad ? `FAILED: ${R.bad} of ${R.ok + R.bad}` : `${R.ok} ok`);
process.exit(R.bad ? 1 : 0);
