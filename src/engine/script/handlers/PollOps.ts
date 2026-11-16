import { ScriptOpcode } from '#/engine/script/ScriptOpcode.js';
import { CommandHandlers } from '#/engine/script/ScriptRunner.js';
import PollService, { POLL_MIN_MINUTES } from '#/engine/poll/PollService.js';

// The script side of engine/poll. Content owns the clerk, what she says and how she says it; this
// owns the database and the one-vote rule, and nothing here can hand out an item.
//
// THE POLL ID IS PASSED BACK IN rather than looked up again on every op. poll_open gives content
// the id once and the dialogue carries it, so a poll that closes mid-conversation cannot make the
// question and the options come from two different polls - the cast is then refused against the id
// the player was actually shown, which is the honest outcome.
//
// EVERYTHING FAILS SOFT. A database that will not open answers 0 options and an empty question
// rather than throwing, for the reason PollService explains: a poll is an npc asking a question and
// must never be able to break a dialogue. The one exception is poll_cast, which reports
// ^poll_unavailable so the clerk can say the vote did not go in rather than claiming it did.

const PollOps: CommandHandlers = {
    // poll_open()(int): the open poll's id, or 0 if there is nothing to vote on. Needs nobody -
    // the question is the same for everyone.
    [ScriptOpcode.POLL_OPEN]: state => {
        state.pushInt(PollService.openId());
    },

    // poll_question(int $poll)(string): empty where there is no such poll, which content checks
    // for rather than printing an empty line in a chatbox.
    [ScriptOpcode.POLL_QUESTION]: state => {
        const id = state.popInt();
        state.pushString(PollService.bookOrNull()?.poll(id)?.question ?? '');
    },

    // poll_optioncount(int $poll)(int): how many choices, so content can build the menu. 0 for a
    // poll that is not there, and a poll can never have one option - PollBook refuses to create it.
    [ScriptOpcode.POLL_OPTIONCOUNT]: state => {
        const id = state.popInt();
        state.pushInt(PollService.bookOrNull()?.poll(id)?.options.length ?? 0);
    },

    // poll_option(int $poll, int $idx)(string): one option's text. idx is 1-based, as it is
    // everywhere else polls are counted - in the tool's output, on the website, and in the
    // dialogue the player reads.
    [ScriptOpcode.POLL_OPTION]: state => {
        const [id, idx] = state.popInts(2);
        const options = PollService.bookOrNull()?.poll(id)?.options ?? [];
        state.pushString(options.find(option => option.idx === idx)?.label ?? '');
    },

    // poll_voted(int $poll)(int): the option the active player chose, or -1 if they have not voted.
    // Only looks - the clerk can tell somebody what they picked without spending anything, which is
    // the same split vote_owed makes against vote_take.
    [ScriptOpcode.POLL_VOTED]: state => {
        const id = state.popInt();
        state.pushInt(PollService.bookOrNull()?.votedOption(id, state.activePlayer.username) ?? -1);
    },

    // poll_cast(int $poll, int $idx)(int): record the vote, and say what happened -
    // ^poll_cast, ^poll_already, ^poll_closed, ^poll_badoption or ^poll_unavailable.
    //
    // THE ONE-VOTE RULE IS NOT CHECKED HERE. PollBook's insert is refused by its primary key if
    // this account has voted already, which is deliberate: the WEBSITE writes the same table, so a
    // check in this op followed by a write is a race against another process. Asking for the
    // result of one statement is the only way either side can be sure.
    [ScriptOpcode.POLL_CAST]: state => {
        const [id, idx] = state.popInts(2);
        const book = PollService.bookOrNull();
        if (!book) {
            state.pushInt(-1); // ^poll_unavailable
            return;
        }

        // THE PLAYTIME GATE, checked here rather than in PollBook: the book is shared with the
        // website and with the command line tool, and neither of those has a player to ask. Both
        // callers that DO have one check before writing, which is why this is duplicated on the
        // site rather than pushed down - see POLL_MIN_MINUTES.
        if (PollService.minutesPlayed(state.activePlayer) < POLL_MIN_MINUTES) {
            state.pushInt(4); // ^poll_notyet
            return;
        }

        state.pushInt(book.vote(id, state.activePlayer.username, idx, 'game') as number);
    },

    // poll_minutes()(int): how long the active player has played, in minutes, so the clerk can say
    // how much longer rather than only that it is not enough. Reads the same varp the gate does.
    [ScriptOpcode.POLL_MINUTES]: state => {
        state.pushInt(PollService.minutesPlayed(state.activePlayer));
    },

    // poll_minminutes()(int): the threshold itself, so content need not hardcode a second copy of
    // it in the sentence it prints.
    [ScriptOpcode.POLL_MINMINUTES]: state => {
        state.pushInt(POLL_MIN_MINUTES);
    },

    // poll_votes(int $poll, int $idx)(int): how many accounts picked that option, so the clerk can
    // read the standings out. Full counts, on the owner's call - see tools/server/poll.ts.
    [ScriptOpcode.POLL_VOTES]: state => {
        const [id, idx] = state.popInts(2);
        const results = PollService.bookOrNull()?.results(id) ?? [];
        state.pushInt(results.find(row => row.idx === idx)?.votes ?? 0);
    },

    // poll_total(int $poll)(int): how many accounts have voted at all, which is what a share is a
    // share OF. Content works the percentage out itself rather than being handed one, because a
    // chatbox line wants it rounded its own way.
    [ScriptOpcode.POLL_TOTAL]: state => {
        const id = state.popInt();
        state.pushInt(PollService.bookOrNull()?.turnout(id).total ?? 0);
    }
};

export default PollOps;
