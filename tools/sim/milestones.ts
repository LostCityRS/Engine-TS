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
//   * the four experience tiers above 99 (50m/100m/150m/200m) fire once each, nothing fires
//     between them, and a gain that clears several at once sends only the highest;
//   * a collection log page announces on the item that COMPLETES it and not before, a page too
//     small to be a collection stays quiet, and the whole log announces once;
//   * and NO milestone line is long enough to wrap onto a second chatbox line - measured against
//     the real font, for every skill, every tier and every page, at the longest name a player can
//     have. The first version of this file said "200 million Woodcutting experience" and arrived
//     as two lines, the second of them reading "@bla@maximum." on its own.
import * as H from './harness.js';
import Player, { getExpByLevel } from '#/engine/entity/Player.js';
import { PlayerStatMap } from '#/engine/entity/PlayerStat.js';
import { MilestoneStore } from '#/engine/MilestoneStore.js';
import ClientCheatHandler from '#/network/game/client/handler/ClientCheatHandler.js';
import ClientCheat from '#/network/game/client/model/ClientCheat.js';
import ObjType from '#/cache/config/ObjType.js';
import EnumType from '#/cache/config/EnumType.js';
import FontType from '#/cache/config/FontType.js';
import DbTableType from '#/cache/config/DbTableType.js';
import DbRowType from '#/cache/config/DbRowType.js';

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

console.log('\n================ THE EXPERIENCE TIERS ABOVE 99');

// Experience is stored x10, so these are the engine's own thresholds (Player.xpMilestones).
const M50 = 500_000_000;
const M100 = 1_000_000_000;
const M200 = 2_000_000_000; // 150m has no constant here: it is only ever crossed by the jump below

/** Put a skill AT a given stored-experience figure, through addXp - the only path with the hook. */
function xpTo(p: Player, stat: string, xp: number) {
    const id = PlayerStatMap.get(stat.toUpperCase());
    if (id === undefined) throw new Error('no such stat: ' + stat);
    if (xp > p.stats[id]) {
        p.addXp(id, xp - p.stats[id], false);
    }
    H.tick(6);
}
const xpLines = (p: Player) => seenBy(p).filter(t => t.includes(' XP@'));

{
    // ms_first is already 99 Fishing from the section above - 13m experience, a long way short of
    // the first tier. That is the point: the tiers are the tail AFTER 99.
    H.clearLogs();
    xpTo(first, 'fishing', M50 - 10);
    check('one experience short of 50m announces nothing', xpLines(watcher), []);

    H.clearLogs();
    xpTo(first, 'fishing', M50);
    check('50m announces', xpLines(watcher).length, 1);
    check(
        '...as the server first, naming the skill and the figure',
        xpLines(watcher).some(t => t.includes('[Server first!]') && t.includes('50m Fishing XP')),
        true
    );

    // THE QUIET STRETCH. 50m to just under 100m is months of play; a tier system that fired on the
    // way would be the worst offender in the file.
    H.clearLogs();
    xpTo(first, 'fishing', M100 - 10);
    check('the climb from 50m to 100m is silent', xpLines(watcher), []);

    H.clearLogs();
    xpTo(first, 'fishing', M100);
    check(
        '100m announces',
        xpLines(watcher).some(t => t.includes('100m Fishing XP')),
        true
    );

    // ONLY THE HIGHEST TIER A SINGLE GAIN CROSSES. This jump clears 150m and 200m together.
    H.clearLogs();
    xpTo(first, 'fishing', M200);
    check('a jump across two tiers sends one line, not two', xpLines(watcher).length, 1);
    check(
        '...and it is the higher of them',
        xpLines(watcher).some(t => t.includes('200m Fishing XP')),
        true
    );
    // AND THE CAP DOES NOT ANNOUNCE ITSELF AGAIN on every further gain, which is what would happen
    // if the test were "is it at the cap" rather than "did it just cross".
    H.clearLogs();
    first.addXp(PlayerStatMap.get('FISHING')!, 1_000_000, false);
    H.tick(6);
    check('experience thrown at a capped skill announces nothing', xpLines(watcher), []);

    // A SECOND PLAYER GETS THE ORDINARY LINE.
    H.clearLogs();
    xpTo(second, 'fishing', M50);
    check('the second player to 50m Fishing is announced', xpLines(watcher).length, 1);
    check(
        '...but not as the first',
        xpLines(watcher).some(t => t.includes('[Server first!]')),
        false
    );

    // A FRESH SKILL TAKEN STRAIGHT TO THE CAP - the ::setstat-shaped case. One line.
    H.clearLogs();
    xpTo(second, 'runecraft', M200);
    check('0 to the cap in one gain is one line', xpLines(watcher).length, 1);
    check(
        '...the cap, not 50m',
        xpLines(watcher).some(t => t.includes('200m Runecraft XP')),
        true
    );
}

console.log('\n================ THE COLLECTION LOG: A PAGE, AND THE WHOLE THING');

const objId = (name: string) => {
    const id = ObjType.getId(name);
    if (id === -1) throw new Error('no such obj: ' + name);
    return id;
};
/** Log an item the way a drop does, through the real ~collection_log_add. */
function logItem(p: Player, objName: string) {
    H.runProc(p, '[proc,collection_log_add]', [objId(objName), 1]);
    H.tick(2);
}
const clogLines = (p: Player) => seenBy(p).filter(t => t.includes('collection log'));

{
    const hunter = player('ms_clog');

    // GIANT MOLE: three items, so it is announced. The first two must be silent - a page that
    // announced on partial progress would fire up to 158 times for the clue pages.
    H.clearLogs();
    logItem(hunter, 'mole_skin');
    logItem(hunter, 'mole_claw');
    check('two of a three-item page announce nothing', clogLines(watcher), []);

    H.clearLogs();
    logItem(hunter, 'bosspet_giant_mole_item');
    check('the item that completes the page announces it', clogLines(watcher).length, 1);
    check(
        '...naming the page, as the server first',
        clogLines(watcher).some(t => t.includes('[Server first!]') && t.includes('Giant Mole')),
        true
    );

    // AND NOT AGAIN. Re-logging an item already in the log is not a new item, so nothing fires -
    // this is the whole guard, there is no mark varp behind it.
    H.clearLogs();
    logItem(hunter, 'mole_claw');
    check('an item already logged announces nothing', clogLines(watcher), []);

    // A PAGE TOO SMALL TO BE A COLLECTION. Both of these items are broadcast as rare drops the
    // instant they fall; "completed the Giants collection log" on top of that is the same news
    // twice. ^milestone_clog_page_min is 3.
    H.clearLogs();
    logItem(hunter, 'hill_giant_club'); // Giants, one item
    check('a one-item page is not announced', clogLines(watcher), []);
    H.clearLogs();
    logItem(hunter, 'dragon_2h_sword'); // Chaos Elemental, two items
    logItem(hunter, 'dragon_pickaxe');
    check('a two-item page is not announced', clogLines(watcher), []);

    // THE SECOND PLAYER TO FINISH A PAGE gets the ordinary line.
    const hunter2 = player('ms_clog2');
    H.clearLogs();
    logItem(hunter2, 'mole_skin');
    logItem(hunter2, 'mole_claw');
    logItem(hunter2, 'bosspet_giant_mole_item');
    check('the second player to finish the page is announced', clogLines(watcher).length, 1);
    check(
        '...but not as the first',
        clogLines(watcher).some(t => t.includes('[Server first!]')),
        false
    );

    // THE WHOLE LOG. Every item in it, for one player.
    const completionist = player('ms_clogall');
    const items = EnumType.getByName('collection_log_items')!;
    H.clearLogs();
    for (const item of items.values.values()) {
        H.runProc(completionist, '[proc,collection_log_add]', [item as number, 1]);
    }
    H.tick(4);
    const all = clogLines(watcher).filter(t => t.includes('entire collection log'));
    check('completing every item announces the log itself', all.length, 1);
    check(
        '...as the server first',
        all.some(t => t.includes('[Server first!]')),
        true
    );
    // And the pages it is made of announced too, on the way.
    check('and the pages it is made of announced on the way', clogLines(watcher).filter(t => !t.includes('entire collection log')).length > 20, true);
}

console.log('\n================ NOT ONE LINE WRAPS');

// EVERY LINE THIS SYSTEM CAN PRODUCE, measured against the font the chatbox uses.
//
// Player.wrappedMessageGame splits a broadcast at 456 pixels of FontType 1, and a line over that
// arrives as two: the first cut mid-sentence, the second starting with a bare colour tag. Every
// broadcast already in this build fits on one line - all 803 rare drops do - so a milestone that
// wrapped would be the only one that did not. The first draft of the experience tiers wrapped for
// every skill, and the check that caught it was this one, not a reading of the file.
{
    const font = FontType.get(1);
    // The widest names a player can have: 12 characters is the limit, and 'W'/'M' are the widest
    // glyphs. 'Mod ' because a staff name spends four of those characters on the prefix.
    const NAMES = ['Abcdefghijkl', 'Wwwwwwwwwwww', 'Mod Wwwwwwww'];
    const skills = [...EnumType.getByName('stat_names')!.values.values()] as string[];
    const table = DbTableType.getId('collection_log_entry');
    const pages: string[] = [];
    for (let id = 0; id < DbRowType.count; id++) {
        const r = DbRowType.get(id);
        if (!r || r.tableId !== table) continue;
        // only the pages big enough to be announced - ^milestone_clog_page_min
        if ((r.columnValues[1]?.length ?? 0) >= 3) pages.push(r.columnValues[0]?.[0] as string);
    }

    const bodies: string[] = [];
    for (const skill of skills) {
        bodies.push(`is the first to reach level @dre@99 ${skill}@bla@.`, `has reached level @dre@99 ${skill}@bla@.`);
        for (const n of ['50m', '100m', '150m', '200m']) {
            bodies.push(`is the first to earn @dre@${n} ${skill} XP@bla@.`, `has earned @dre@${n} ${skill} XP@bla@.`);
        }
    }
    for (const page of pages) {
        bodies.push(`filled the @dre@${page}@bla@ collection log.`);
    }
    bodies.push(
        'completed the @dre@entire collection log@bla@!',
        'is the first to master every skill. @dre@Max cape@bla@!',
        'is the first to reach @dre@2277 total level@bla@.',
        'is the first to reach @dre@combat level 126@bla@.',
        'is the first to complete @dre@every quest@bla@.',
        'has arrived on Death Plateau. Say hello!'
    );

    let widest = 0;
    let widestLine = '';
    const over: string[] = [];
    for (const body of bodies) {
        for (const label of ['[Server first!]', '[Milestone]', '[New player]']) {
            for (const name of NAMES) {
                const line = `@sh1@@gre@${label}@sh0@@bla@ @cr3@@dbl@${name}@bla@ ${body}`;
                const width = font.stringWidth(line);
                if (width > widest) {
                    widest = width;
                    widestLine = `${label} ${name} ${body}`;
                }
                if (font.split(line, 456).length > 1) over.push(`${label} / ${name} / ${body}`);
            }
        }
    }
    console.log(`  (${bodies.length} wordings x ${NAMES.length} names x 3 labels; widest ${widest}px of 456)`);
    console.log(`  widest: ${widestLine}`);
    if (over.length) {
        for (const line of over.slice(0, 5)) console.log(`     over: ${line}`);
    }
    check('no milestone line wraps onto a second chatbox line', over.length, 0);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
