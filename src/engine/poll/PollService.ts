import { printInfo, printWarning } from '#/util/Logger.js';
import Environment from '#/util/Environment.js';
import PollBook from '#/engine/poll/PollBook.js';
import Player from '#/engine/entity/Player.js';
import VarPlayerType from '#/cache/config/VarPlayerType.js';

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

/**
 * How long an account must have played before it may vote: two hours, as minutes.
 *
 * WHY A PLAYTIME GATE AND NOT AN IDENTITY ONE. The worry is ballot stuffing on a small player base,
 * and the only measure a stuffer cannot buy cheaply is TIME. A game account here is free and
 * instant - no email - so keying votes on the account is no barrier at all, and keying them on a
 * linked Discord account only raises the price to one throwaway email, which is ten minutes' work.
 * Twenty accounts with two hours on each is forty hours of somebody's life. Old School gates its
 * own polls the same way, on total level and hours played.
 *
 * It also costs nobody their vote: no Discord account needed, no launcher, identical in the browser
 * client, and every real player passes it within an evening.
 *
 * MINUTES, which is what %player_playtime counts - content/scripts/player/scripts/player_stats.rs2
 * runs softtimer(playtime_minute, 100), and 100 ticks is sixty seconds.
 *
 * Mirrored in content as ^poll_min_minutes and on the website as MIN_MINUTES (src/lib/polls.ts).
 * Three copies because three programs ask the question and none can call the others; raise it in
 * all three or the clerk and the website will disagree about who may vote.
 */
export const POLL_MIN_MINUTES = 120;

export default class PollService {
    private static playtimeVarp: number = -2;

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

    /** How many minutes this player has played - the varp the quest tab and the hiscores both read. */
    static minutesPlayed(player: Player): number {
        if (PollService.playtimeVarp === -2) {
            PollService.playtimeVarp = VarPlayerType.getId('player_playtime');
        }
        if (PollService.playtimeVarp < 0) {
            // No such varp in this content build. Letting the vote through beats refusing everybody
            // over a missing config: this is a deterrent, not a security boundary.
            return POLL_MIN_MINUTES;
        }
        return player.vars[PollService.playtimeVarp] ?? 0;
    }
}
