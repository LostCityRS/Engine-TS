import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

/**
 * THE LAUNCHER'S DISCORD SIGN-IN, as far as the game is concerned: turning a token into a Discord
 * account, and recording the link a login earns.
 *
 * WHO WRITES THESE ROWS. The website does. It is the only one of the three programs holding the
 * OAuth client secret and the only one Discord will redirect a browser to, so the sign-in happens
 * there and `launcher_session` is where it leaves the answer (src/lib/launchersession.ts on that
 * side). The game reads it when a client logs in carrying the token. The table is created HERE
 * because this side owns the file, and the site refuses to mint a session until it exists - so
 * there is exactly one definition of it and an engine that has not been deployed yet fails loudly
 * instead of honouring sessions it knows nothing about.
 *
 * WHY IT IS ITS OWN FILE rather than more of DiscordThread. DiscordThread cannot be imported by
 * anything: it throws unless it is a worker thread and logs into Discord on the way up. The rules
 * below - never overwrite a link, renew on use, refuse an expired token - are the whole of what
 * this feature does to the database, and they take a month and three computers to check by hand.
 * Here they can be driven directly: tools/sim/launchersessions.ts.
 *
 * WHAT A TOKEN IS WORTH, said plainly because it decides every rule here: the NAMES of the
 * characters linked to that Discord account, which are on the hiscores anyway, and the link below.
 * It cannot log anybody in. Handing out something that could was version B of this feature and it
 * was refused - it would have made one Discord account a master key to every character linked to
 * it, and a throwaway Discord account costs one email.
 *
 * ONLY A HASH IS STORED, as with LoginToken: the token lives in the launcher's own file on the
 * player's computer and nowhere on either server, so a copy of this database signs in as nobody.
 */

/**
 * Thirty days, pushed out every time the sign-in is used.
 *
 * KEPT IN STEP BY HAND with LAUNCHER_SESSION_DAYS in the site's src/lib/launchersession.ts, which
 * renews the same row the same way when the launcher asks for the character list. Two programs
 * write this column and neither can call the other. It is LoginToken's month, for the same reason:
 * a player who plays keeps their sign-in, one who stops loses it.
 */
export const LAUNCHER_SESSION_DAYS = 30;

const LIFETIME_MS = LAUNCHER_SESSION_DAYS * 86_400_000;

/**
 * THE TABLE, WORD FOR WORD AS THE SITE EXPECTS IT.
 *
 * `CREATE TABLE IF NOT EXISTS` and nothing else: this runs on every start of the Discord relay, on
 * a database that may be years old. The live deploy applies no migrations to these feature
 * databases, so a column added here later has to come with the code that reads it.
 */
export const TABLE_SQL = `
    CREATE TABLE IF NOT EXISTS launcher_session (
        token_hash TEXT PRIMARY KEY,
        discord_id TEXT NOT NULL,
        issued     INTEGER NOT NULL,
        last_used  INTEGER NOT NULL,
        expires    INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS launcher_session_discord ON launcher_session (discord_id);
`;

function digest(token: string): string {
    return createHash('sha256').update(token).digest('hex');
}

/** LoginToken's shape, which is what the site mints with, so a malformed field never reaches a query. */
export function looksLikeToken(value: string): boolean {
    return /^[a-z0-9]{20}$/.test(value);
}

/**
 * Which Discord account a launcher token stands for, or null for one that is expired, revoked or
 * never ours. Renews it as a side effect, and takes expired rows away on the way past - nothing
 * else prunes this table.
 */
export function discordIdFor(db: DatabaseSync, token: string, now: number = Date.now()): string | null {
    if (!looksLikeToken(token)) {
        return null;
    }
    db.prepare('DELETE FROM launcher_session WHERE expires < ?').run(now);
    const hash = digest(token);
    const row = db.prepare('SELECT discord_id FROM launcher_session WHERE token_hash = ?').get(hash) as { discord_id: string } | undefined;
    if (!row) {
        return null;
    }
    db.prepare('UPDATE launcher_session SET last_used = ?, expires = ? WHERE token_hash = ?').run(now, now + LIFETIME_MS, hash);
    return row.discord_id;
}

export type LinkOutcome = 'linked' | 'already' | 'conflict';

/**
 * Record the link a launcher login earns.
 *
 * 'linked' there was none and now there is; 'already' it was this Discord account all along;
 * 'conflict' the character belongs to somebody else's Discord account and NOTHING WAS CHANGED.
 *
 * THE RULE IS THAT IT ONLY EVER ADDS, and that is not tidiness. ::discord and /link prove both
 * ends - you are logged in to the character AND you are using the Discord account - while this
 * proves the character and a launcher that was signed in on that computer. On a shared machine
 * those are two different people, so the weaker claim is never allowed to overwrite the stronger
 * one. A conflict is reported rather than swallowed, because silence there looks to the player
 * like a sign-in that did nothing.
 */
export function recordLink(db: DatabaseSync, username: string, discordId: string, now: number = Date.now()): LinkOutcome {
    const existing = db.prepare('SELECT discord_id FROM link WHERE username = ?').get(username) as { discord_id: string } | undefined;
    if (existing) {
        return existing.discord_id === discordId ? 'already' : 'conflict';
    }
    db.prepare('INSERT INTO link (username, discord_id, linked) VALUES (?, ?, ?)').run(username, discordId, now);
    return 'linked';
}

/**
 * Every launcher signed in as this Discord account, forgotten. This is what /unlink does on top of
 * dropping the links: somebody saying "nothing of mine is connected to this any more" should not
 * leave a launcher able to list their characters.
 *
 * ::discord unlink in game is deliberately NOT this. It unlinks one character, and the sign-in may
 * own others.
 */
export function revokeSessions(db: DatabaseSync, discordId: string): number {
    return db.prepare('DELETE FROM launcher_session WHERE discord_id = ?').run(discordId).changes as number;
}
