/**
 * Put a question to the players, and read what they said.
 *
 *   npx tsx tools/server/poll.ts list
 *   npx tsx tools/server/poll.ts new "Should X?" "Yes" "No" "Don't mind"
 *   npx tsx tools/server/poll.ts new "Should X?" "Yes" "No" "Don't mind" --confirm
 *   npx tsx tools/server/poll.ts results 3
 *   npx tsx tools/server/poll.ts close 3 --confirm
 *   npx tsx tools/server/poll.ts --profile main ...     (default: NODE_PROFILE)
 *
 * NO DEPLOY AND NO RESTART. This is the whole reason a poll is a database row rather than a content
 * config: `new` here puts the question in front of every player, in game and on the website, as
 * soon as it returns. Nothing is packed and the world keeps running. See src/engine/poll/PollBook.ts
 * for the rest of that argument.
 *
 * A DRY RUN BY DEFAULT, like wipe.ts and veteran.ts: `new` and `close` print what they would do and
 * change nothing until --confirm. `list` and `results` are reads and take no flag.
 *
 * ONE OPEN POLL AT A TIME, and that rule lives HERE rather than in PollBook. The schema allows
 * several quite happily; what cannot sensibly handle several is an NPC asking a question in a
 * dialogue, and a page with one set of buttons. If that ever changes, this is the only place that
 * has to learn - which is why the store was left permissive.
 */
import path from 'path';

import PollBook, { VoteResult } from '#/engine/poll/PollBook.js';
import Environment from '#/util/Environment.js';

const args = process.argv.slice(2);
const confirm = args.includes('--confirm');

function valueOf(flag: string): string | null {
    const at = args.indexOf(flag);
    if (at !== -1 && at + 1 < args.length) {
        return args[at + 1];
    }
    const inline = args.find(a => a.startsWith(flag + '='));
    return inline ? inline.slice(flag.length + 1) : null;
}

function fail(message: string): never {
    console.error(`poll: ${message}`);
    process.exit(1);
}

const profile = valueOf('--profile') ?? Environment.NODE_PROFILE;
const file = path.join('data/polls', `${profile}.sqlite`);

/** The positional arguments, with the flags and their values taken out. */
function positional(): string[] {
    const out: string[] = [];
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--confirm') {
            continue;
        }
        if (args[i] === '--profile') {
            i++; // and its value
            continue;
        }
        if (args[i].startsWith('--')) {
            continue;
        }
        out.push(args[i]);
    }
    return out;
}

function when(ms: number | null): string {
    if (ms === null) {
        return 'open';
    }
    // US Eastern, because every other time this server reports is - see the launch runbook.
    return new Date(ms).toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' });
}

function bar(votes: number, total: number): string {
    const width = total > 0 ? Math.round((votes / total) * 24) : 0;
    return '#'.repeat(width).padEnd(24, '.');
}

function showResults(book: PollBook, id: number): void {
    const poll = book.poll(id);
    if (!poll) {
        fail(`there is no poll ${id}. "poll.ts list" shows them.`);
    }

    const rows = book.results(id);
    const turnout = book.turnout(id);

    console.log(`\n#${poll.id}  ${poll.question}`);
    console.log(`  opened ${when(poll.opens)}${poll.closes === null ? '  (still open)' : `, closed ${when(poll.closes)}`}`);
    console.log('');

    // FULL COUNTS, on the owner's call (15 November 2026). The alternative was showing only the
    // winning option; counts are more honest and more interesting, and the asymmetry is that it is
    // easy to have never shown them and awkward to stop.
    for (const row of rows) {
        const share = turnout.total > 0 ? ((row.votes / turnout.total) * 100).toFixed(1) : '0.0';
        console.log(`  ${String(row.idx).padStart(2)}. ${row.label.padEnd(30)} ${bar(row.votes, turnout.total)} ${String(row.votes).padStart(5)}  ${share.padStart(5)}%`);
    }

    console.log('');
    console.log(`  ${turnout.total} vote${turnout.total === 1 ? '' : 's'} - ${turnout.game} in game, ${turnout.web} on the website`);
}

const positionals = positional();
const command = positionals[0];
const book = new PollBook(file);

try {
    switch (command) {
        case 'list': {
            const polls = book.allPolls();
            if (polls.length === 0) {
                console.log(`no polls yet in ${path.resolve(file)}`);
                break;
            }
            console.log(`${polls.length} poll${polls.length === 1 ? '' : 's'} in ${path.resolve(file)}:\n`);
            for (const poll of polls) {
                const turnout = book.turnout(poll.id);
                console.log(`  #${String(poll.id).padStart(3)}  ${poll.closes === null ? 'OPEN  ' : 'closed'}  ${String(turnout.total).padStart(5)} votes  ${poll.question}`);
            }
            break;
        }

        case 'results': {
            const id = Number(positionals[1]);
            if (!Number.isInteger(id)) {
                fail('usage: results <poll id>');
            }
            showResults(book, id);
            break;
        }

        case 'new': {
            const question = positionals[1];
            const labels = positionals.slice(2);
            if (!question || labels.length < 2) {
                fail('usage: new "<question>" "<option>" "<option>" [more options] [--confirm]');
            }

            const already = book.openPolls();
            if (already.length > 0) {
                fail(`#${already[0].id} is still open ("${already[0].question}"). Close it first: poll.ts close ${already[0].id} --confirm`);
            }

            console.log(`\n  ${question}`);
            labels.forEach((label, i) => console.log(`  ${String(i + 1).padStart(2)}. ${label}`));
            console.log(`\n  into ${path.resolve(file)}, profile ${profile}`);

            if (!confirm) {
                console.log('\nNothing was changed. Run it again with --confirm to put it up.');
                break;
            }

            const id = book.createPoll(question, labels);
            console.log(`\nposted as poll #${id}. It is live in game and on the website now - no deploy needed.`);
            break;
        }

        case 'close': {
            const id = Number(positionals[1]);
            if (!Number.isInteger(id)) {
                fail('usage: close <poll id> [--confirm]');
            }
            const poll = book.poll(id);
            if (!poll) {
                fail(`there is no poll ${id}. "poll.ts list" shows them.`);
            }
            if (poll.closes !== null) {
                fail(`#${id} closed already, ${when(poll.closes)}.`);
            }

            showResults(book, id);

            if (!confirm) {
                console.log('\nNothing was changed. Run it again with --confirm to close it.');
                break;
            }

            book.closePoll(id);
            console.log(`\n#${id} is closed. The results stay readable, in game and on the site.`);
            break;
        }

        // Not advertised in the usage above: there is no reason to cast a vote from a terminal
        // except to check that the one-vote rule holds on a real file, which is what it is for.
        case 'testvote': {
            const id = Number(positionals[1]);
            const username = positionals[2];
            const idx = Number(positionals[3]);
            if (!Number.isInteger(id) || !username || !Number.isInteger(idx)) {
                fail('usage: testvote <poll id> <username> <option>');
            }
            if (!confirm) {
                fail('testvote writes a real vote. Pass --confirm.');
            }
            const result = book.vote(id, username, idx, 'game');
            const said = {
                [VoteResult.CAST]: 'cast',
                [VoteResult.ALREADY]: `already voted (they picked option ${book.votedOption(id, username)})`,
                [VoteResult.CLOSED]: 'no such poll, or it is closed',
                [VoteResult.NO_SUCH_OPTION]: 'no such option on that poll'
            }[result];
            console.log(`${username} -> poll #${id} option ${idx}: ${said}`);
            break;
        }

        default:
            console.log(
                [
                    'poll - put a question to the players, and read what they said.',
                    '',
                    '  poll.ts list                                     every poll and its turnout',
                    '  poll.ts results <id>                             the full counts',
                    '  poll.ts new "<question>" "<a>" "<b>" [...]        what it would post',
                    '  poll.ts new ... --confirm                         post it',
                    '  poll.ts close <id> [--confirm]                   stop taking votes',
                    '',
                    '  --profile <name>                                 default: NODE_PROFILE',
                    '',
                    'A poll goes up with no deploy and no world restart.'
                ].join('\n')
            );
            process.exit(command === undefined ? 0 : 1);
    }
} finally {
    book.close();
}
