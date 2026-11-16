// MILESTONE ANNOUNCEMENTS, through the real level-up trigger.
//
//   npx tsx tools/sim/milestones.ts
//
// "broadcast level 99, maybe increments of 25? idk, maybe too many spammed stuff" - so the thing
// worth proving is not only that a 99 announces, but that nothing ELSE does. A milestone system
// that fires on the way past is worse than none: it is the one kind of message every player on the
// world has to read.
//
// WHAT THIS ASSERTS
//   * a 99 announces, to everybody, naming the skill;
//   * levels 2..98 announce nothing at all - the quiet case, checked across a whole skill;
//   * the server first is claimed ONCE: the second player to 99 the same skill gets the ordinary
//     line, and the first player cannot claim it twice;
//   * total-level steps announce when they are PASSED, not only when they are landed on exactly;
//   * ::milestones hides them for the player who ran it and nobody else;
//   * and a broadcast still reaches a player who has not touched the setting.
import * as H from './harness.js';
import Player, { getExpByLevel } from '#/engine/entity/Player.js';
import { PlayerStatMap } from '#/engine/entity/PlayerStat.js';
import { MilestoneStore } from '#/engine/MilestoneStore.js';
import ClientCheatHandler from '#/network/game/client/handler/ClientCheatHandler.js';
import ClientCheat from '#/network/game/client/model/ClientCheat.js';

await H.boot();
H.loginOrder();

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

// This world's firsts are a database that outlives the run. A sim that left them claimed would
// pass once and then report "not the first" for ever after.
MilestoneStore.reset();

// EVERY LABEL THIS FILE CAN PRODUCE. Listed once: the first version of the new-player section
// failed for three runs because these two helpers knew "[Milestone]" and "[Server first!]" and not
// "[New player]", so a line that was being broadcast correctly read as nothing being broadcast.
const LABELS = ['[Milestone]', '[Server first!]', '[New player]'];
const isMilestone = (text: string) => LABELS.some(label => text.includes(label));

/** Every milestone line any player saw since the last clearLogs. */
const broadcasts = () => H.mesgs.filter(m => isMilestone(m.text)).map(m => `${m.who}: ${m.text}`);
/** ...and the ones a particular player saw. */
const seenBy = (p: Player) => H.mesgs.filter(m => m.who === p.username && isMilestone(m.text)).map(m => m.text);

// A FRESH ACCOUNT, NOT a1lib's player(), which calls H.maxOut and hands back every skill at 99.
// Built on that helper this file passed its quiet case and failed everything else, for the reason
// that makes it worthless as a test: a player who is already 99 never levels up, so the trigger
// under test never ran once.
let n = 0;
const player = (name: string): Player => {
    const p = H.makePlayer(name, 3222 + (n++ % 5), 3218);
    H.loginOrder(p);
    // THE LEVEL-UP POPUP OFF. It is a modal, and a modal blocks the next script on the player's
    // ENGINE queue - so a second level-up does not run until the box is clicked. A real player
    // clicks it; a sim does not, and with the popup on every level-up after the first silently
    // did nothing. Nothing about the milestones depends on this: it is how the sim gets to click
    // through, and %option_levelup is a setting players use anyway.
    H.setVar(p, 'option_levelup', 1);
    H.tick(1);
    return p;
};

/**
 * Take a skill to `level` THROUGH addXp, which is the only path that fires [advancestat] and so
 * [label,levelup]. setLevel writes the numbers straight into the save and announces nothing - a
 * sim built on it would have proved the milestones work while never running them once.
 *
 * allowMulti false so the world's XP rate cannot overshoot the level this asks for.
 */
function levelTo(p: Player, stat: string, level: number) {
    const id = PlayerStatMap.get(stat.toUpperCase());
    if (id === undefined) throw new Error('no such stat: ' + stat);
    const want = getExpByLevel(level);
    if (want > p.stats[id]) {
        p.addXp(id, want - p.stats[id], false);
    }
    // SIX TICKS, NOT TWO. [label,levelup] is enqueued on the ENGINE queue rather than run inline,
    // so the broadcast lands a tick or more after the xp does. At two the first 99's line arrived
    // during the NEXT section of this file and was counted there - which read as "the first 99
    // announced nothing" and "the second player was the server first", two wrong answers from one
    // short wait.
    H.tick(6);
}

console.log('\n================ A 99 ANNOUNCES, THE WAY THERE DOES NOT');

const watcher = player('ms_watch'); // never levels; only listens
const first = player('ms_first');

// EVERY LEVEL FROM 2 TO 98, one at a time. This is the "too spammy" question asked directly.
H.clearLogs();
for (let lv = 2; lv <= 98; lv++) {
    levelTo(first, 'fishing', lv);
}
check('97 level-ups on the way to 99 announce nothing', broadcasts(), []);

H.clearLogs();
levelTo(first, 'fishing', 99);
check('the 99 announces once', broadcasts().length, 2); // the watcher and the player themselves
check(
    'it is the server first',
    seenBy(watcher).some(t => t.includes('[Server first!]') && t.includes('99 Fishing')),
    true
);
check('and the watcher saw it too', seenBy(watcher).length, 1);

console.log('\n================ A SERVER FIRST IS CLAIMED ONCE');

const second = player('ms_second');
H.clearLogs();
levelTo(second, 'fishing', 99);
check('the second player to 99 Fishing is announced', seenBy(watcher).length, 1);
check(
    '...but not as the first',
    seenBy(watcher).some(t => t.includes('[Server first!]')),
    false
);
check(
    '...and the line still names the skill',
    seenBy(watcher).some(t => t.includes('99 Fishing')),
    true
);

// A DIFFERENT SKILL IS A DIFFERENT FIRST.
H.clearLogs();
levelTo(second, 'cooking', 99);
check(
    'a first in another skill is still available',
    seenBy(watcher).some(t => t.includes('[Server first!]') && t.includes('99 Cooking')),
    true
);

console.log('\n================ TOTAL LEVEL IS MARKED, NOT MATCHED');

// A player who jumps PAST 1000 total without landing on it must still be announced. This is the
// case an "is it exactly 1000" test would miss, and the reason the mark varp exists.
const jumper = player('ms_jump');
H.clearLogs();
for (const s of ['attack', 'strength', 'defence', 'hitpoints', 'ranged', 'magic', 'prayer', 'cooking', 'woodcutting', 'fishing', 'crafting']) {
    levelTo(jumper, s, 99);
}
const totals = seenBy(watcher).filter(t => t.includes('total level'));
check(
    'passing 1000 total announces it',
    totals.some(t => t.includes('1000 total level')),
    true
);
check('and it is announced once, not once per level-up', totals.filter(t => t.includes('1000 total level')).length, 1);

console.log('\n================ ::milestones HIDES THEM, FOR ONE PLAYER');

const quiet = player('ms_quiet');
const handler = new ClientCheatHandler();
handler.handle(new ClientCheat('milestones'), quiet);
H.tick(1);
check('the command answers', H.mesgs.filter(m => m.who === quiet.username && m.text.includes('hidden')).length, 1);

const noisy = player('ms_noisy');
const sender = player('ms_send');
H.clearLogs();
levelTo(sender, 'mining', 99);
check('the player who opted out hears nothing', seenBy(quiet), []);
check('a player who never touched the setting still hears it', seenBy(noisy).length, 1);

// AND IT TOGGLES BACK, or it is a trap rather than a setting.
handler.handle(new ClientCheat('milestones'), quiet);
H.tick(1);
H.clearLogs();
levelTo(sender, 'smithing', 99);
check('turning it back on restores them', seenBy(quiet).length, 1);

console.log('\n================ A NEW PLAYER IS ANNOUNCED ONCE, AND ONLY AFTER THE TUTORIAL');

// THROUGH [login,_], which is where this really happens - the first version of this section called
// the proc by hand after logging the player in, and by then login had already announced them and
// set the mark. It reported "not announced" for a player who had just been announced.
const TUTORIAL_COMPLETE = 1000; // ^tutorial_complete, general/configs/quest.constant
{
    // An account still on the island is not an arrival. Announcing on account creation instead
    // would be a spam channel anybody could open by making accounts.
    const island = H.makePlayer('ms_island', 3222, 3218);
    H.clearLogs();
    H.loginOrder(island);
    H.tick(3);
    check('an account still in the tutorial is not announced', broadcasts(), []);

    const arrived = H.makePlayer('ms_new', 3223, 3218);
    H.setVar(arrived, 'tutorial', TUTORIAL_COMPLETE);
    H.clearLogs();
    H.loginOrder(arrived);
    H.tick(3);
    check(
        'one who has finished it is announced on login',
        broadcasts().some(t => t.includes('[New player]')),
        true
    );
    check(
        '...and it reaches other players',
        seenBy(watcher).some(t => t.includes('[New player]')),
        true
    );

    // ONCE PER ACCOUNT, NOT ONCE PER LOGIN. The mark is what makes the second login quiet, so ask
    // the proc directly - it is what [login,_] calls every time.
    H.clearLogs();
    H.runProc(arrived, '[proc,milestone_welcome]');
    H.tick(2);
    check('and not again on their next login', broadcasts(), []);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
