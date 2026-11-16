import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';

import Environment from '#/util/Environment.js';

/**
 * WHO GOT THERE FIRST, and the fact that nobody can get there first twice.
 *
 * A server-first announcement - "first to 99 Fishing" - is the one milestone that cannot be worked
 * out from the player who earned it. Every other one is a question about that account's own save:
 * a 99 is a stat, a max cape is twenty-three of them, 2277 is their sum. "First" is a question
 * about every account that ever played here, including the ones not logged in, so it needs
 * somewhere to be written down.
 *
 * ONE ROW PER MILESTONE, KEYED BY THE MILESTONE. The key is content's to choose ("99:fishing",
 * "total:2277") so that adding a kind of first needs no engine change - the engine only enforces
 * that a key is claimed once.
 *
 * THE CLAIM IS THE WRITE. claimFirst INSERTs and reports whether the row was new, rather than
 * reading and then writing: between a read and a write two players on the same tick both see an
 * empty table and both announce. INSERT OR IGNORE settles it in the database, where the primary
 * key is, so the loser's insert changes nothing and the loser is told no.
 *
 * Worlds do not share this. It lives beside the clan and vote databases under the world's own
 * profile, so a test world cannot spend the live world's firsts.
 */
class MilestoneStoreService {
    private dbHandle: DatabaseSync | null = null;

    private get db(): DatabaseSync {
        if (!this.dbHandle) {
            const file = `data/milestones/${Environment.NODE_PROFILE}.sqlite`;
            fs.mkdirSync(path.dirname(file), { recursive: true });
            this.dbHandle = new DatabaseSync(file);
            this.dbHandle.exec('PRAGMA journal_mode = WAL');
            this.dbHandle.exec(`
                CREATE TABLE IF NOT EXISTS first (
                    milestone TEXT PRIMARY KEY,
                    player    TEXT NOT NULL,
                    at        INTEGER NOT NULL
                );
            `);
        }
        return this.dbHandle;
    }

    /**
     * Claim `milestone` for `player`. True only for the account that got there first, and only
     * once ever - a second call with the same key is false even for the same player, which is what
     * makes it safe to call from a level-up that can fire again after a stat is restored.
     */
    claimFirst(milestone: string, player: string): boolean {
        const result = this.db.prepare('INSERT OR IGNORE INTO first (milestone, player, at) VALUES (?, ?, ?)').run(milestone, player, Date.now());
        return Number(result.changes) === 1;
    }

    /** Who holds a first, or null if it is unclaimed. For a future hiscores page, and for tests. */
    holderOf(milestone: string): string | null {
        const row = this.db.prepare('SELECT player FROM first WHERE milestone = ?').get(milestone) as { player: string } | undefined;
        return row?.player ?? null;
    }

    /** Testing only: forget every claim, so a sim can prove the same key twice. */
    reset(): void {
        this.db.exec('DELETE FROM first');
    }
}

export const MilestoneStore = new MilestoneStoreService();
