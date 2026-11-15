import { printInfo, printWarning } from '#/util/Logger.js';
import Environment from '#/util/Environment.js';
import PollBook from '#/engine/poll/PollBook.js';

/**
 * The one poll database this world uses, opened when something first asks for it.
 *
 * WHY IT CAN RETURN NULL, and why that is the whole point of this file. VoteService says what
 * happens otherwise, having learned it the hard way: a ledger that would not open "threw a script
 * error into the chatbox and abandoned the REST OF THE LOGIN SCRIPT". A poll is further from
 * essential than voting is - an npc asking a question - so nothing about it may break a dialogue,
 * let alone a login. Every op goes through bookOrNull() and answers "there is no poll" rather than
 * throwing.
 *
 * IT IS TRIED ONCE. A file that will not open now will not open itself a tick later, and retrying
 * on every poll_open would put the same stack trace in the log every time anybody talked to the
 * clerk.
 *
 * THE FILE DOES NOT EXIST UNTIL A POLL IS POSTED. `tools/server/poll.ts new --confirm` creates it.
 * So "no database" is the normal state of a server that has never run a poll, which is why the
 * miss is logged once at info rather than as a fault.
 */

let book: PollBook | null = null;
let refused = false;

export default class PollService {
    static file(): string {
        return `data/polls/${Environment.NODE_PROFILE}.sqlite`;
    }

    /** The poll database, or null if it will not open. Never throws. */
    static bookOrNull(): PollBook | null {
        if (book) {
            return book;
        }
        if (refused) {
            return null;
        }
        try {
            book = new PollBook(PollService.file());
            printInfo(`Polls open: ${PollService.file()}`);
            return book;
        } catch (err) {
            refused = true;
            printWarning(`Polls unavailable (${PollService.file()}): ${err instanceof Error ? err.message : err}`);
            return null;
        }
    }

    /**
     * The open poll's id, or 0 for "nothing to vote on" - which is also what an unopenable
     * database gives. Content cannot tell the two apart and does not need to: both mean the clerk
     * has no question today.
     */
    static openId(): number {
        const polls = PollService.bookOrNull()?.openPolls() ?? [];
        return polls.length > 0 ? polls[0].id : 0;
    }
}
