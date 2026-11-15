import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';

// POLLS (custom, 2026-11-15). A question the owner puts up, and one vote per account on it.
//
// WHY ITS OWN DATABASE, rather than the content build or db.sqlite.
//
// Not the content build, which was the obvious place and is the wrong one: content becomes packs,
// packs go out through deploy.sh, and deploy.sh RESTARTS THE WORLD. Putting a poll up should not
// boot everybody out of the game. A row is read live by whoever asks, with no deploy and no
// restart, and the question appears in game and on the website at the same moment.
//
// Not db.sqlite either, for the reason the site's own src/lib/db.ts gives for opening that file
// read-only: "a bug on this side can never corrupt an account, and it is the whole reason the site
// is allowed near the live database at all". The website has to WRITE a vote, so the votes go in a
// file of their own. That keeps the guarantee that matters - the worst a bug on the web side can do
// here is miscount a poll, and nothing it can reach holds a level, an item or a password. Same
// argument the trading post and the vote ledger already make for their own files.
//
// ONE VOTE PER ACCOUNT IS THE PRIMARY KEY, not a check either side performs. (poll_id, username)
// means the game and the website cannot double-vote, cannot overwrite each other, and cannot
// disagree, because there is only one record to disagree about.
//
// NOT A VARBIT. Remembering a player's vote in their save is how the game would normally do this
// and it is what 2006 would have done - but a varbit cannot see a vote cast on the website, so the
// two would drift apart and both would be telling the truth as they knew it.
//
// It opens the file plainly, like TradingPost and unlike VoteBook. VoteBook explains an open
// failure in detail because its message reached a player's chatbox; this one is opened by a command
// line tool and at startup, where node's own error is in front of whoever ran it.
//
// ONE WORLD'S POLLS. Two worlds pointed at the same file would each think they owned it, which is
// written down in the trading post and the vote ledger too.

export type PollOption = {
    idx: number;
    label: string;
};

export type Poll = {
    id: number;
    question: string;
    opens: number; // unix ms
    closes: number | null; // unix ms, or null while it is still open
    created: number; // unix ms
    options: PollOption[];
};

export type PollResult = {
    idx: number;
    label: string;
    votes: number;
};

export const enum VoteResult {
    /** Written. */
    CAST = 0,
    /** This account has already voted on this poll. Nothing changed. */
    ALREADY = 1,
    /** There is no such poll, or it has closed. */
    CLOSED = 2,
    /** The poll exists and is open, but has no option with that number. */
    NO_SUCH_OPTION = 3
}

export default class PollBook {
    private readonly db: DatabaseSync;

    constructor(file: string) {
        if (file !== ':memory:') {
            fs.mkdirSync(path.dirname(file), { recursive: true });
        }
        this.db = new DatabaseSync(file);
        this.db.exec('PRAGMA journal_mode = WAL');
        this.db.exec('PRAGMA synchronous = FULL');
        this.db.exec(`
            -- The question. closes is null while it is open; closing writes the time rather than a
            -- flag, so "when did that poll close" is answerable later without a second column.
            CREATE TABLE IF NOT EXISTS poll (
                id       INTEGER PRIMARY KEY AUTOINCREMENT,
                question TEXT    NOT NULL,
                opens    INTEGER NOT NULL,
                closes   INTEGER,
                created  INTEGER NOT NULL
            );

            -- The options, in the order they are shown. idx is 1-based because it is read aloud by
            -- an NPC dialogue and printed in a results table, and "option 0" reads as a mistake.
            CREATE TABLE IF NOT EXISTS poll_option (
                poll_id INTEGER NOT NULL,
                idx     INTEGER NOT NULL,
                label   TEXT    NOT NULL,
                PRIMARY KEY (poll_id, idx)
            );

            -- One row per account per poll, and the primary key is the whole of the one-vote rule.
            -- via is 'game' or 'web': it answers whether the website half was worth building, or
            -- whether everybody votes in game anyway.
            CREATE TABLE IF NOT EXISTS vote (
                poll_id  INTEGER NOT NULL,
                username TEXT    NOT NULL,
                idx      INTEGER NOT NULL,
                cast_at  INTEGER NOT NULL,
                via      TEXT    NOT NULL,
                PRIMARY KEY (poll_id, username)
            );
            CREATE INDEX IF NOT EXISTS vote_tally ON vote (poll_id, idx);
        `);
    }

    close() {
        this.db.close();
    }

    /**
     * Put a question up. Returns its id.
     *
     * It does NOT refuse a second open poll - the schema allows several and the tool is where that
     * policy lives, because "one at a time" is a decision about the NPC dialogue and the web page
     * rather than about the data.
     */
    createPoll(question: string, labels: string[], now: number = Date.now()): number {
        if (labels.length < 2) {
            throw new Error('a poll needs at least two options');
        }

        this.db.exec('BEGIN IMMEDIATE');
        try {
            this.db.prepare('INSERT INTO poll (question, opens, closes, created) VALUES (?, ?, NULL, ?)').run(question, now, now);
            const id = Number((this.db.prepare('SELECT last_insert_rowid() AS id').get() as unknown as { id: number }).id);

            const option = this.db.prepare('INSERT INTO poll_option (poll_id, idx, label) VALUES (?, ?, ?)');
            labels.forEach((label, i) => option.run(id, i + 1, label));

            this.db.exec('COMMIT');
            return id;
        } catch (err) {
            this.db.exec('ROLLBACK');
            throw err;
        }
    }

    /** Every poll still open, newest first. The game and the site both show [0]. */
    openPolls(now: number = Date.now()): Poll[] {
        const rows = this.db.prepare('SELECT id, question, opens, closes, created FROM poll WHERE closes IS NULL AND opens <= ? ORDER BY id DESC').all(now) as unknown as Omit<Poll, 'options'>[];
        return rows.map(row => ({ ...row, options: this.options(row.id) }));
    }

    /** Every poll, newest first, open or closed. */
    allPolls(): Poll[] {
        const rows = this.db.prepare('SELECT id, question, opens, closes, created FROM poll ORDER BY id DESC').all() as unknown as Omit<Poll, 'options'>[];
        return rows.map(row => ({ ...row, options: this.options(row.id) }));
    }

    poll(id: number): Poll | null {
        const row = this.db.prepare('SELECT id, question, opens, closes, created FROM poll WHERE id = ?').get(id) as unknown as Omit<Poll, 'options'> | undefined;
        return row ? { ...row, options: this.options(row.id) } : null;
    }

    private options(pollId: number): PollOption[] {
        return this.db.prepare('SELECT idx, label FROM poll_option WHERE poll_id = ? ORDER BY idx').all(pollId) as unknown as PollOption[];
    }

    /** Stop taking votes. Returns false if there is no such poll or it was already closed. */
    closePoll(id: number, now: number = Date.now()): boolean {
        const changed = this.db.prepare('UPDATE poll SET closes = ? WHERE id = ? AND closes IS NULL').run(now, id);
        return Number(changed.changes) > 0;
    }

    /**
     * Cast a vote. One statement decides it: the insert is refused by the primary key if this
     * account has voted on this poll before, which is the same "insert if new, else do nothing"
     * the vote ledger relies on rather than a read followed by a write that another process can
     * slip between.
     */
    vote(pollId: number, username: string, idx: number, via: 'game' | 'web', now: number = Date.now()): VoteResult {
        const who = username.toLowerCase();

        const open = this.db.prepare('SELECT 1 AS ok FROM poll WHERE id = ? AND closes IS NULL AND opens <= ?').get(pollId, now);
        if (open === undefined) {
            return VoteResult.CLOSED;
        }

        const option = this.db.prepare('SELECT 1 AS ok FROM poll_option WHERE poll_id = ? AND idx = ?').get(pollId, idx);
        if (option === undefined) {
            return VoteResult.NO_SUCH_OPTION;
        }

        const written = this.db.prepare('INSERT INTO vote (poll_id, username, idx, cast_at, via) VALUES (?, ?, ?, ?, ?) ON CONFLICT (poll_id, username) DO NOTHING').run(pollId, who, idx, now, via);
        return Number(written.changes) > 0 ? VoteResult.CAST : VoteResult.ALREADY;
    }

    /** The option this account chose, or -1 if it has not voted on this poll. */
    votedOption(pollId: number, username: string): number {
        const row = this.db.prepare('SELECT idx FROM vote WHERE poll_id = ? AND username = ?').get(pollId, username.toLowerCase()) as unknown as { idx: number } | undefined;
        return row ? Number(row.idx) : -1;
    }

    /**
     * Every option with its count, in option order, including the options nobody picked - a results
     * table that silently omits a zero reads as a shorter poll than the one people voted in.
     */
    results(pollId: number): PollResult[] {
        return this.db
            .prepare(
                `SELECT o.idx AS idx, o.label AS label, COUNT(v.username) AS votes
                 FROM poll_option o
                 LEFT JOIN vote v ON v.poll_id = o.poll_id AND v.idx = o.idx
                 WHERE o.poll_id = ?
                 GROUP BY o.idx, o.label
                 ORDER BY o.idx`
            )
            .all(pollId) as unknown as PollResult[];
    }

    /** How many accounts have voted on this poll, by route. */
    turnout(pollId: number): { total: number; game: number; web: number } {
        const row = this.db
            .prepare(
                `SELECT COUNT(*) AS total,
                        SUM(CASE WHEN via = 'game' THEN 1 ELSE 0 END) AS game,
                        SUM(CASE WHEN via = 'web'  THEN 1 ELSE 0 END) AS web
                 FROM vote WHERE poll_id = ?`
            )
            .get(pollId) as unknown as { total: number; game: number; web: number };
        return { total: Number(row?.total ?? 0), game: Number(row?.game ?? 0), web: Number(row?.web ?? 0) };
    }
}
