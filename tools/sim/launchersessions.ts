// THE LAUNCHER'S DISCORD SIGN-IN, the game's half of it, on its own.
//
// run_discordsignintest.py in the client repo proves the launcher can get a token out of a browser
// and turn it into a list of characters. scripts/check-launcher.mjs in the web repo proves the site
// mints, renews and revokes one. Neither can reach what the GAME does with it, which is the half
// that writes to the link table - and the rules there take a month, two Discord accounts and a
// shared computer to check by hand:
//
//   * an expired or unknown token is worth nothing, and presenting an expired one does not revive it
//   * using a live one pushes its month out, which is what makes "a player who plays keeps their
//     sign-in" true, and the site slides the same column the same way
//   * A LINK IS ONLY EVER ADDED. ::discord proves both ends; a launcher sign-in proves the
//     character and a launcher on that computer, which on a shared machine is somebody else. So a
//     character already linked is never moved, and a conflict is reported rather than swallowed
//   * /unlink takes the launcher sessions with it, because "nothing of mine is connected to this"
//     cannot leave a launcher able to list the characters
//
// It needs no cache, no map, no world and no Discord bot: DiscordThread cannot be imported at all
// (it throws unless it is a worker and logs into Discord on the way up), which is exactly why the
// rules live in src/server/discord/LauncherSessions.ts and this can drive them.
//
//     npx tsx tools/sim/launchersessions.ts
//
// It makes its own database in a temp directory and takes it away again.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

import { discordIdFor, LAUNCHER_SESSION_DAYS, looksLikeToken, recordLink, revokeSessions, TABLE_SQL } from '#/server/discord/LauncherSessions.js';

const R = { ok: 0, bad: 0 };

function check(what: string, got: unknown, want: unknown) {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) {
        R.ok++;
    } else {
        R.bad++;
    }
    console.log(`${pass ? '  ok   ' : 'FAIL   '}${what}${pass ? '' : ` - got ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`}`);
}

const DAY = 86_400_000;
const MINE = '100000000000000001';
const THEIRS = '200000000000000002';
const LIVE = 'aaaabbbbccccddddeeee';
const OLD = '11112222333344445555';

/** The site's own hashing, mirrored so rows can be put in by hand the way it writes them. */
const digest = (token: string) => createHash('sha256').update(token).digest('hex');

// The link table as DiscordThread creates it. Copied because that file cannot be imported; if it
// ever changes shape, this is the suite that should fail.
const LINK_SQL = `
    CREATE TABLE IF NOT EXISTS link (
        username   TEXT PRIMARY KEY,
        discord_id TEXT NOT NULL,
        linked     INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS link_discord ON link (discord_id);
`;

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'launchersessions-'));
const file = path.join(dir, 'main.sqlite');
const db = new DatabaseSync(file);
// WAL, as the relay sets on it: the site writes this file while the game reads it, and a rule
// proved under one journal mode and run under another has not been proved.
db.exec('pragma journal_mode = WAL');
db.exec(LINK_SQL);
db.exec(TABLE_SQL);

const now = Date.now();
const mint = (token: string, discordId: string, expires: number) => db.prepare('INSERT INTO launcher_session (token_hash, discord_id, issued, last_used, expires) VALUES (?, ?, ?, ?, ?)').run(digest(token), discordId, now, now, expires);

try {
    console.log('-- the table is the one the site expects');
    const columns = (db.prepare('select name from pragma_table_info(?) order by name').all('launcher_session') as unknown as { name: string }[]).map(r => r.name);
    check('launcher_session has exactly the five columns', columns, ['discord_id', 'expires', 'issued', 'last_used', 'token_hash']);
    check(
        'and running the DDL again is harmless',
        (() => {
            db.exec(TABLE_SQL);
            return 'ok';
        })(),
        'ok'
    );

    console.log('-- what a token is worth');
    mint(LIVE, MINE, now + 5 * DAY);
    mint(OLD, MINE, now - DAY);
    check('a live sign-in resolves to its Discord account', discordIdFor(db, LIVE, now), MINE);
    check('one that has run out resolves to nothing', discordIdFor(db, OLD, now), null);
    check('nor does a token nobody issued', discordIdFor(db, 'zzzzyyyyxxxxwwwwvvvv', now), null);
    check('nor one of the wrong shape, which never reaches a query', looksLikeToken('nonsense'), false);
    check('...and an expired row is taken away rather than left to rot', (db.prepare('select count(*) as n from launcher_session where token_hash = ?').get(digest(OLD)) as unknown as { n: number }).n, 0);

    console.log('-- using it renews it');
    const expires = (db.prepare('select expires from launcher_session where token_hash = ?').get(digest(LIVE)) as unknown as { expires: number }).expires;
    check('a month from today, not from when it was minted', expires > now + (LAUNCHER_SESSION_DAYS - 1) * DAY, true);

    console.log('-- the link a login earns');
    check('a character with no link gets one', recordLink(db, 'lord_fooby', MINE, now), 'linked');
    check('...written against that Discord account', (db.prepare('select discord_id from link where username = ?').get('lord_fooby') as unknown as { discord_id: string }).discord_id, MINE);
    check('the next login says nothing, rather than reporting it again', recordLink(db, 'lord_fooby', MINE, now), 'already');

    console.log('-- A LINK IS NEVER MOVED, which is the rule the whole thing turns on');
    db.prepare('INSERT INTO link (username, discord_id, linked) VALUES (?, ?, ?)').run('corey', THEIRS, now);
    check("somebody else's character is a conflict", recordLink(db, 'corey', MINE, now), 'conflict');
    check('...and is left exactly as it was', (db.prepare('select discord_id from link where username = ?').get('corey') as unknown as { discord_id: string }).discord_id, THEIRS);

    console.log('-- /unlink revokes the sign-ins too');
    mint('cccc1111dddd2222eeee', MINE, now + 5 * DAY);
    check("both of this account's launchers go", revokeSessions(db, MINE), 2);
    check('and the token is worth nothing afterwards', discordIdFor(db, LIVE, now), null);
    check("somebody else's sessions are untouched", revokeSessions(db, THEIRS), 0);

    console.log('');
    console.log(R.bad === 0 ? `the launcher sign-in's rules hold: ${R.ok} checks` : `${R.bad} CHECK(S) FAILED`);
} finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
}

process.exit(R.bad === 0 ? 0 : 1);
