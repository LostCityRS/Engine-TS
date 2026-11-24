import fs from 'fs';
import os from 'os';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';

import {
    ASK_CLOSE,
    ASK_OPEN,
    DISCORD_LIMIT,
    LEAD_MAX,
    TELL_CLOSE,
    TELL_OPEN,
    addHandoverColumns,
    blockBudget,
    bugTicketIds,
    commentsSince,
    extractAskPlayer,
    extractTellPlayer,
    fileBugIssue,
    reportsToRecover,
    trackerReady,
    trackerRepo
} from '#/server/tickets/BugTracker.js';

// WHAT A HAND-OVER DOES, CHECKED WITHOUT DISCORD OR GITHUB (custom, 2026-11-10).
//
// The "Hand to Claude" button in server/tickets/TicketBot.ts is one press that writes a private
// GitHub issue and alters a live sqlite table. Neither half can be tried out on Corey's box without
// consequences - a migration you cannot test is a migration you find out about in production - so
// this runs both against a temporary database and a stubbed fetch.
//
// Run it with: npx tsx tools/tickets/bugtracker-check.ts
//
// WHAT IT DOES NOT COVER. It never talks to GitHub, so it cannot say whether the token is right or
// the repository exists. The button's own answer does that: it reports GitHub's status line back to
// whoever pressed it.

// RUN IT WITH `npm run tickets:check`, which sets the two fake values below in the shell. They
// cannot be set in this file: Environment snapshots process.env once, when it is first loaded, and
// an import at the top of a file runs before any statement in it - so by the time a line here could
// assign one, the empty value is already frozen. Setting them before node starts is also the honest
// test, because it is the path the real bot takes. `dotenv/config` does not override a variable
// that is already set, so a real token in .env cannot leak in here either.
const WANT_REPO = 'coreysho/DeathPlateau-Bugs';
const WANT_TOKEN = 'ghp_thisisnotarealtokenatall0000000000';
if (process.env.BUGS_GITHUB_REPO !== WANT_REPO || process.env.BUGS_GITHUB_TOKEN !== WANT_TOKEN) {
    console.log('Run this with `npm run tickets:check` - it needs the two stand-in values set before node starts.');
    process.exit(1);
}

let ok = 0;
const bad: string[] = [];

function check(what: string, got: unknown, want: unknown) {
    if (got === want) {
        ok++;
        return;
    }
    bad.push(`${what}\n      wanted: ${JSON.stringify(want)}\n      got:    ${JSON.stringify(got)}`);
}

function checkThat(what: string, got: boolean) {
    check(what, got, true);
}

// ---------------------------------------------------------------- the migration, on an old table

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bugtracker-'));
const dbPath = path.join(dir, 'tickets.sqlite');
try {
    const db = new DatabaseSync(dbPath);
    // The ticket table EXACTLY as it was before 2026-11-10, with a row in it, because the thing that
    // matters is what happens to a database that already has tickets in it.
    db.exec(`
        CREATE TABLE ticket (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            kind           TEXT NOT NULL,
            source         TEXT NOT NULL,
            opener_id      TEXT,
            username       TEXT,
            subject        TEXT NOT NULL,
            thread_id      TEXT,
            log_channel_id TEXT,
            log_message_id TEXT,
            status         TEXT NOT NULL DEFAULT 'open',
            claimed_by     TEXT,
            created        INTEGER NOT NULL,
            closed         INTEGER,
            closed_by      TEXT,
            close_reason   TEXT
        );
    `);
    db.prepare('INSERT INTO ticket (kind, source, subject, username, created) VALUES (?, ?, ?, ?, ?)').run('bug', 'game', 'fell through the floor', 'zezima', 1762000000000);

    const columns = () => (db.prepare("SELECT name FROM pragma_table_info('ticket')").all() as { name: string }[]).map(r => r.name);
    checkThat('before: the four columns are not there', !columns().includes('report') && !columns().includes('issue_url'));

    addHandoverColumns(db);
    for (const column of ['report', 'issue_number', 'issue_url', 'handed_by']) {
        checkThat(`after: ticket.${column} exists`, columns().includes(column));
    }

    // THE ROW SURVIVES. An ALTER that dropped or rewrote the existing tickets would be the worst
    // outcome here and the easiest to miss, since the bot would start up perfectly well.
    const row = db.prepare('SELECT * FROM ticket WHERE id = 1').get() as Record<string, unknown>;
    check('the ticket that was already there still reads back', row?.subject, 'fell through the floor');
    check('its new columns are null, not missing', row?.issue_url, null);

    // TWICE IS THE NORMAL CASE: the bot runs this on every start, so a second pass has to be a
    // no-op rather than an error that stops support from coming up.
    addHandoverColumns(db);
    addHandoverColumns(db);
    check('running it three times leaves 19 columns', columns().length, 19);

    // ---- which tickets the backfill picks up
    //
    // The real backlog is 44 bug reports with no stored detail, filed before the columns existed.
    // Both queries are quiet when wrong: too narrow and part of that backlog is skipped for good,
    // too wide and a support ticket - or a report whose detail is already stored - is overwritten.
    const add = db.prepare('INSERT INTO ticket (id, kind, source, subject, created, report, thread_id) VALUES (?, ?, ?, ?, ?, ?, ?)');
    add.run(10, 'bug', 'game', 'no detail, has a thread', 1, null, 't10');
    add.run(11, 'bug', 'game', 'detail already stored', 1, 'the full report', 't11');
    add.run(12, 'bug', 'game', 'no detail and no thread', 1, null, null);
    add.run(13, 'support', 'discord', 'a support ticket with no detail', 1, null, 't13');
    add.run(14, 'bug', 'discord', 'another one to recover', 1, null, 't14');
    db.prepare("UPDATE ticket SET status = 'closed' WHERE id = 14").run();

    const toRecover = reportsToRecover(db, 500);
    check('only the bug reports missing detail that still have a thread', toRecover.map(r => r.id).join(','), '10,14');
    check('and it brings the thread id along', toRecover[0]?.thread_id, 't10');
    checkThat(
        'a closed one is included - a closed report can still be handed over',
        toRecover.some(r => r.id === 14)
    );

    // The log-message rebuild is deliberately WIDER: every bug ticket, whatever its state.
    check('the rebuild covers every bug ticket and no support ticket', bugTicketIds(db, 500).join(','), '1,10,11,12,14');
    check('the limit is honoured', reportsToRecover(db, 1).length, 1);
    db.close();
} finally {
    fs.rmSync(dir, { recursive: true, force: true });
}

// ---------------------------------------------------------------- what gets sent to GitHub

check('the tracker reads its repository from the environment', trackerRepo(), WANT_REPO);
checkThat('and counts itself ready with both halves set', trackerReady());

type Sent = { url: string; init: RequestInit };
const real = globalThis.fetch;
let sent: Sent | null = null;
let reply: { status: number; json: unknown } = { status: 201, json: { number: 12, html_url: 'https://github.com/coreysho/DeathPlateau-Bugs/issues/12' } };
globalThis.fetch = (async (url: string, init: RequestInit) => {
    sent = { url, init };
    return {
        ok: reply.status >= 200 && reply.status < 300,
        status: reply.status,
        statusText: 'Stubbed',
        json: async () => reply.json,
        text: async () => JSON.stringify(reply.json)
    };
}) as unknown as typeof globalThis.fetch;

// A report with a fenced code block inside it, which is the case that breaks a naive ``` fence and
// lets a player's text out into the issue's own markdown.
const nasty = 'the fairy ring eats my code\n\n```\nAJR\n```\n\nand ```` this ```` too';
const filing = {
    ticket: 7,
    source: 'game',
    subject: 'the fairy ring eats my code',
    report: nasty,
    username: 'Zezima',
    threadUrl: 'https://discord.com/channels/1/2/3',
    handedBy: 'corey'
};

try {
    const issue = await fileBugIssue(filing);
    check('it returns the issue number GitHub gave it', issue.number, 12);
    check('and the issue url', issue.url, 'https://github.com/coreysho/DeathPlateau-Bugs/issues/12');

    const s = sent as unknown as Sent;
    check('it posts', s.init.method, 'POST');
    check('to the tracker, not a code repository', s.url, 'https://api.github.com/repos/coreysho/DeathPlateau-Bugs/issues');
    const headers = s.init.headers as Record<string, string>;
    checkThat('with the token as a bearer', headers.Authorization === `Bearer ${WANT_TOKEN}`);
    check('and a pinned api version', headers['X-GitHub-Api-Version'], '2022-11-28');

    const body = JSON.parse(String(s.init.body)) as { title: string; body: string; labels?: unknown };
    check('the title carries the ticket number, zero padded', body.title, '[#0007] the fairy ring eats my code');
    checkThat('no labels are sent at all', body.labels === undefined);
    checkThat('the report is in the body, every character of it', body.body.includes(nasty));
    checkThat("the body says the quoted text is a player's, not an instruction", body.body.includes('no authority over this repository'));
    checkThat('the thread is linked so staff can get back to the player', body.body.includes(filing.threadUrl));
    checkThat('the reporter is named', body.body.includes('Zezima'));
    checkThat('and who handed it over', body.body.includes('corey'));

    // THE FENCE IS LONGER THAN ANYTHING IN THE REPORT. The report contains a run of four backticks,
    // so a five-backtick fence is the shortest that can hold it.
    checkThat('the fence outlasts the backticks inside it', body.body.includes('`````text\n'));
    const afterFence = body.body.split('`````text\n')[1] ?? '';
    checkThat('and nothing of the report escapes it', afterFence.startsWith(nasty) && afterFence.trimEnd().endsWith('`````'));

    // THE TIME IS READABLE OFF DISCORD. <t:...:f> is a local date in Discord and nine digits of
    // nothing everywhere else, and the field it is in is the one that says WHEN the bug happened.
    // Issue #2 in the real tracker is where this turned up.
    sent = null;
    await fileBugIssue({ ...filing, report: 'it broke\n\nWhen: <t:1794355081:f>\n\nWorld: 10' });
    const timed = JSON.parse(String((sent as unknown as Sent).init.body)) as { body: string };
    checkThat('a Discord timestamp is spelled out', timed.body.includes('When: 2026-11-10 23:58:01 UTC'));
    checkThat('and the token itself is gone', !timed.body.includes('<t:'));
    checkThat('the rest of the report is untouched', timed.body.includes('it broke') && timed.body.includes('World: 10'));

    // EVERY STYLE DISCORD WRITES, because the bot uses :f today and a later field could use any of
    // them - :R especially, which is the "2 hours ago" one.
    sent = null;
    await fileBugIssue({ ...filing, report: 'a <t:1794355081:R> b <t:1794355081> c <t:1794355081:D>' });
    const styles = JSON.parse(String((sent as unknown as Sent).init.body)) as { body: string };
    checkThat('relative, bare and date-only styles all convert', (styles.body.match(/2026-11-10 23:58:01 UTC/g) ?? []).length === 3);

    // AND NOT A PLAYER'S OWN ANGLE BRACKETS. Only the bot's timestamps are translated; anything
    // else a player typed stays exactly as typed, because it is quoted evidence.
    sent = null;
    await fileBugIssue({ ...filing, report: 'the shop says <t:abc> and <@12345> too' });
    const left = JSON.parse(String((sent as unknown as Sent).init.body)) as { body: string };
    checkThat("a player's own angle brackets are left alone", left.body.includes('<t:abc>') && left.body.includes('<@12345>'));

    // A LONG TITLE IS CLIPPED, because GitHub rejects one over 256 and a rejected call loses the
    // report. ::bug takes a whole sentence, so this is the normal case and not the odd one.
    sent = null;
    await fileBugIssue({ ...filing, subject: 'x'.repeat(400) });
    const long = JSON.parse(String((sent as unknown as Sent).init.body)) as { title: string };
    checkThat("a long subject is clipped under GitHub's limit", long.title.length <= 250);

    // AND AN OLD TICKET, from before the report column existed, still files - on its subject.
    sent = null;
    await fileBugIssue({ ...filing, report: null });
    const old = JSON.parse(String((sent as unknown as Sent).init.body)) as { body: string };
    checkThat('a ticket with no stored report falls back to its subject', old.body.includes(filing.subject));

    // ---- and the two ways it can fail
    reply = { status: 404, json: { message: 'Not Found' } };
    let threw = '';
    try {
        await fileBugIssue(filing);
    } catch (err) {
        threw = (err as Error).message;
    }
    checkThat('a 404 throws, naming the status', threw.includes('404'));
    // THE TOKEN IS NEVER IN THE ERROR. This message is sent straight back into Discord, where the
    // staff log is a channel - so a token in it would be a token posted in a channel.
    checkThat('and the error does not carry the token', !threw.includes(WANT_TOKEN));

    reply = { status: 201, json: { html_url: 'https://github.com/x/y/issues/1' } };
    threw = '';
    try {
        await fileBugIssue(filing);
    } catch (err) {
        threw = (err as Error).message;
    }
    checkThat('a reply with no issue number throws rather than being recorded', threw.includes('no issue number'));

    // ---- which part of a tracker comment reaches the player
    //
    // THIS IS THE SECURITY-RELEVANT ONE. A tracker comment is written for Corey and can describe an
    // exploit; only a deliberately marked block is relayed into the reporter's Discord thread. Every
    // way of getting that wrong leaks an internal note to a player, so each is checked.
    const internal = 'The hole is in BuildArea.rebuildNormal and the fix is to clamp the zone.';
    check('no markers at all relays nothing', extractAskPlayer(internal), null);
    check('a marked block is relayed, and only the block', extractAskPlayer(`${internal}\n\n${ASK_OPEN}\nWhich ladder was it?\n${ASK_CLOSE}\n\n${internal}`), 'Which ladder was it?');
    // An opening marker with no close must NOT relay everything after it - that is the leak.
    check('an unclosed block relays nothing', extractAskPlayer(`${internal}\n${ASK_OPEN}\nWhich ladder?`), null);
    check('a closing marker alone relays nothing', extractAskPlayer(`${internal}\n${ASK_CLOSE}\nWhich ladder?`), null);
    check('an empty block relays nothing', extractAskPlayer(`${ASK_OPEN}\n   \n${ASK_CLOSE}`), null);
    check('the first block wins when there are two', extractAskPlayer(`${ASK_OPEN}\nfirst\n${ASK_CLOSE}\n${ASK_OPEN}\nsecond\n${ASK_CLOSE}`), 'first');
    checkThat('the markers are html comments, so they do not render on the issue', ASK_OPEN.startsWith('<!--') && ASK_CLOSE.startsWith('<!--'));

    // ---- and the same again for an UPDATE block, which is the second thing that can reach a player
    //
    // Every rule above has to hold here too. A second marker is a second way to leak an internal
    // note, and it would be leaked to the same person, out of the same comment.
    check('no markers at all tells nothing', extractTellPlayer(internal), null);
    check('a marked block is sent, and only the block', extractTellPlayer(`${internal}\n\n${TELL_OPEN}\nFixed - it ships in the next client.\n${TELL_CLOSE}\n\n${internal}`), 'Fixed - it ships in the next client.');
    check('an unclosed block tells nothing', extractTellPlayer(`${internal}\n${TELL_OPEN}\nFixed`), null);
    check('a closing marker alone tells nothing', extractTellPlayer(`${internal}\n${TELL_CLOSE}\nFixed`), null);
    check('an empty block tells nothing', extractTellPlayer(`${TELL_OPEN}\n   \n${TELL_CLOSE}`), null);
    check('the first block wins when there are two', extractTellPlayer(`${TELL_OPEN}\nfirst\n${TELL_CLOSE}\n${TELL_OPEN}\nsecond\n${TELL_CLOSE}`), 'first');
    checkThat('its markers are html comments too', TELL_OPEN.startsWith('<!--') && TELL_CLOSE.startsWith('<!--'));

    // THE TWO MUST NOT READ EACH OTHER'S BLOCKS. They are extracted by one shared function given
    // two different pairs of markers, so a mistake there would not be a compile error - it would be
    // a question delivered as "your bug is fixed", or an update delivered as a question. Worse, the
    // opening markers differ by a single '/' from the closing ones, so a sloppy indexOf could match
    // a close as an open.
    const askOnly = `${ASK_OPEN}\nWhich ladder?\n${ASK_CLOSE}`;
    const tellOnly = `${TELL_OPEN}\nFixed in the next client.\n${TELL_CLOSE}`;
    check('a question block is invisible to the update extractor', extractTellPlayer(askOnly), null);
    check('an update block is invisible to the question extractor', extractAskPlayer(tellOnly), null);
    check('one comment can carry both, and each extractor takes its own', extractAskPlayer(`${askOnly}\n\n${tellOnly}`), 'Which ladder?');
    check('and the other takes the other', extractTellPlayer(`${askOnly}\n\n${tellOnly}`), 'Fixed in the next client.');
    check('an opening marker is not found inside a closing one', `${ASK_CLOSE}${TELL_CLOSE}`.includes(ASK_OPEN) || `${ASK_CLOSE}${TELL_CLOSE}`.includes(TELL_OPEN), false);

    // ---- and the whole message has to FIT, or the reporter is told nothing at all
    //
    // Discord refuses an over-long message rather than trimming it, so this arithmetic is the
    // difference between a clipped sentence and silence. Checked for more blocks than the relay can
    // currently produce, because the cost of a third kind of block one day is this going unnoticed.
    for (const n of [1, 2, 3, 4]) {
        const whole = n * blockBudget(n) + n * LEAD_MAX;
        checkThat(`${n} block(s) still fit inside Discord's limit (${whole} of ${DISCORD_LIMIT})`, whole <= DISCORD_LIMIT);
    }
    check('one block keeps the 1600 it had before updates existed', blockBudget(1), 1600);
    checkThat('two blocks each get less than one block does', blockBudget(2) < blockBudget(1));
    check('a nonsensical count is treated as one block rather than dividing by zero', blockBudget(0), 1600);

    // ---- reading the tracker's comments, which must be ONE request however many issues there are
    sent = null;
    reply = {
        status: 200,
        json: [
            { id: 11, body: `${ASK_OPEN}\nwhich quest?\n${ASK_CLOSE}`, created_at: '2026-11-11T03:16:15Z', issue_url: 'https://api.github.com/repos/coreysho/DeathPlateau-Bugs/issues/3' },
            { id: 12, body: 'nothing for the player here', created_at: '2026-11-11T03:29:18Z', issue_url: 'https://api.github.com/repos/coreysho/DeathPlateau-Bugs/issues/6' },
            // Malformed rows must be dropped rather than throwing: one bad row would otherwise stop
            // every later comment from ever being relayed.
            { id: 13, body: 'no issue url at all', created_at: '2026-11-11T03:30:00Z' },
            { body: 'no id', created_at: '2026-11-11T03:31:00Z', issue_url: 'https://api.github.com/repos/x/y/issues/9' }
        ]
    };
    const since = await commentsSince('2026-11-11T03:00:00Z');
    const url = (sent as unknown as Sent).url;
    checkThat('it asks the repository-wide comments endpoint, not one issue', url.includes('/issues/comments?'));
    checkThat('passing the watermark through', url.includes('since=2026-11-11T03%3A00%3A00Z'));
    checkThat('and a full page, oldest first', url.includes('per_page=100') && url.includes('direction=asc'));
    check('two well-formed comments survive', since.length, 2);
    check('the issue number is read out of the url', since[0]?.issueNumber, 3);
    check('with its comment id', since[0]?.id, 11);
    check('and the second maps to its own issue', since[1]?.issueNumber, 6);
} finally {
    globalThis.fetch = real;
}

// ------------------------------------------------- every button the bot posts reaches a branch
//
// WHY THIS IS READ AS TEXT. A button is one string - `tk|close|41` - split on the bars by the
// handler, so a button and the code that answers it are joined by nothing a compiler can see. A
// label typed as `tk|closed|` builds, deploys, and does nothing at all when pressed. Importing
// TicketBot.ts to ask it properly would open the live ticket database and build a Discord client,
// which is a worse trade than reading the file, so the two sets are lifted out of the source and
// compared.
const bot = fs.readFileSync('src/server/tickets/TicketBot.ts', 'utf8');
const posted = new Set([...bot.matchAll(/`tk\|(\w+)\|/g)].map(m => m[1]));
const answered = new Set([...bot.matchAll(/action === '(\w+)'/g)].map(m => m[1]));
for (const action of [...posted].sort()) {
    checkThat(`the ${action} button has a branch to answer it`, answered.has(action));
}
check('and all four are posted somewhere', [...posted].sort().join(' '), 'claim close hand reopen');

// ------------------------------------------------- what the relay does to the thread afterwards
//
// READ AS TEXT for the same reason the buttons above are: importing TicketBot.ts opens the live
// ticket database and builds a Discord client. These three are a decision of Corey's rather than
// an implementation detail, and all three fail silently if they regress - the thread is simply
// left in the wrong state, which nobody notices until a player cannot reply or a channel fills up.
const relay = /async function relayToReporters\(\)([\s\S]*?)\n}\n/.exec(bot)?.[1] ?? '';
checkThat('the relay function was found to read', relay.length > 0);
checkThat('an update archives the thread behind itself', /setArchived\(true/.test(relay));
checkThat('and only when the message carried no question', /!blocks\.some\(b => b\.kind === 'ask'\)/.test(relay));
// COREY'S CALL, 2026-11-24: archiving takes the thread out of the list, locking would take away
// the reply. "It still happens to me" is the most useful sentence anybody can send about a fix,
// and re-locking here is how nobody would ever hear it.
checkThat('and it never locks a thread, so the reporter can still answer', !/setLocked\(true/.test(relay));

// THE CLOSE BUTTON ON THE LOG MESSAGE is this file's own subject only in that it sits in the same
// row as Hand to Claude. Pinned here because the row is built in one place and read by nobody else:
// deleting the button would otherwise be silent.
const fromLog = bot.slice(bot.indexOf('function logMessage('), bot.indexOf('async function postLog('));
checkThat('staff can close from the log message, not only the thread', fromLog.includes('`tk|close|${t.id}`'));
checkThat('and claim from it, as before', fromLog.includes('`tk|claim|${t.id}`'));
// DISCORD ALLOWS FIVE BUTTONS IN A ROW and the row now has five places that add one - but the
// tracker link and Hand to Claude are the two arms of one `else if`, so at most four ever render.
// Counted rather than asserted as a maximum, because what a row renders depends on the ticket;
// a sixth place would turn this red and make whoever added it work out which four can coincide.
check('five places add a button to the row', (fromLog.match(/addComponents\(/g) ?? []).length, 5);
checkThat('two of them are the arms of one else-if, so four is the most that render', fromLog.includes("} else if (t.kind === 'bug' && trackerReady())"));

console.log();
for (const line of bad) {
    console.log(`  FAIL  ${line}`);
}
console.log(`${ok} ok, ${bad.length} FAIL`);
process.exit(bad.length ? 1 : 0);
