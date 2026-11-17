import fs from 'fs';
import { parentPort } from 'worker_threads';

import { LoginClient } from '#/server/login/LoginClient.js';
import LoginToken from '#/server/login/LoginToken.js';
import { db, toDbDate } from '#/db/query.js';
import * as bcrypt from 'bcrypt-ts';
import Environment from '#/util/Environment.js';

import { type GenericLoginThreadResponse } from './index.d.js';
import { trackLoginAttempts, trackLoginTime } from './LoginMetrics.js';

const client = new LoginClient(Environment.NODE_ID);

if (!parentPort) throw new Error('This file must be run as a worker thread.');

parentPort.on('message', async msg => {
    try {
        if (!parentPort) throw new Error('This file must be run as a worker thread.');
        await handleRequests(parentPort, msg);
    } catch (err) {
        console.error(err);

        // custom (2026-10-19) - a login that throws (a database error, a race on a new account) used to get
        // no reply at all, and the world held its socket waiting forever. Answer it: -1 is "login server
        // offline", which the client shows as "try again".
        if (msg?.type === 'player_login' && parentPort) {
            const { socket, username, lowMemory, reconnecting } = msg;
            parentPort.postMessage({ type: 'player_login', socket, username, lowMemory, reconnecting, reply: -1, save: null, account_id: -1, members: false });
        }
    }
});

client.onMessage((opcode, data) => {
    parentPort!.postMessage({ opcode, data });
});

type ParentPort = {
    postMessage: (msg: GenericLoginThreadResponse) => void;
};

// custom (2026-09-27) - the reply for a login refused by NODE_MIN_STAFF_LEVEL. Not one the login server
// uses; World.onLoginMessage turns it into the client's "This world is full. Please use a different world."
// (Not exported: this file is a worker, and importing it anywhere else would run it.)
const REPLY_STAFF_ONLY = 11;

// The account's own level, from the database - checked BEFORE the dev-mode bump below lifts everyone to
// 4, or a staff-only dev world would let every player in.
function belowStaffLevel(staffmodlevel: number | undefined | null): boolean {
    return Environment.NODE_MIN_STAFF_LEVEL > 0 && (staffmodlevel ?? 0) < Environment.NODE_MIN_STAFF_LEVEL;
}

async function handleRequests(parentPort: ParentPort, msg: any) {
    const { type } = msg;

    switch (type) {
        case 'world_startup': {
            if (Environment.LOGIN_SERVER) {
                await client.worldStartup();
            }
            break;
        }
        case 'player_login': {
            const { socket, remoteAddress, username, password, uid, lowMemory, reconnecting, hasSave } = msg;

            // custom (2026-11-02) - a saved login. `token` is what the client keeps instead of the
            // player's password, and is the whole of what it sends; `remember` is a password login
            // asking for one to keep. See LoginToken.
            const token: string = typeof msg.token === 'string' ? msg.token : '';
            const remember: boolean = msg.remember === true;
            const saved = token.length > 0;
            // Whether the client is new enough to carry those two fields at all, as World read it
            // off the revision. Only used to say so in the log, where the difference between "did
            // not ask" and "could not ask" is the whole diagnosis.
            const sendsSavedLogin: boolean = msg.sendsToken === true;

            if (Environment.LOGIN_SERVER) {
                // custom (2026-11-02) - the saved login goes with it. This branch used to refuse
                // one outright, on the reasoning that a login server owns accounts and has never
                // heard of a token; but it reads the same database the token store does, so it is
                // the authority for both and the right place to decide. Whichever of the two the
                // client sent, it is proved there and a new one comes back in the response - which
                // is spread into the message to World below, carrying `token` with it exactly as
                // the local path does.
                //
                // THAT REFUSAL WAS INVISIBLE, which is the worse half. It returned before any of
                // the three log lines, so on the live world - LOGIN_SERVER=true - a login asking
                // to be remembered read as a login that asked for nothing at all.
                trackLoginAttempts.inc();
                const stopTimer = trackLoginTime.startTimer();
                const response = await client.playerLogin(username, password, uid, socket, remoteAddress, reconnecting, hasSave, remember, token, sendsSavedLogin);

                // A staff-only world (NODE_MIN_STAFF_LEVEL). Only a login the login server let in (0, 2, 4)
                // is refused here - it has marked the account online on this world by now, so it is
                // released again, the way World releases a login it cannot finish.
                if ((response.reply === 0 || response.reply === 2 || response.reply === 4) && belowStaffLevel(response.staffmodlevel)) {
                    await client.playerForceLogout(username);
                    parentPort.postMessage({ type: 'player_login', socket, username, lowMemory, reconnecting, reply: REPLY_STAFF_ONLY, save: null, account_id: -1, members: false });
                    stopTimer();
                    break;
                }

                if (!Environment.NODE_PRODUCTION) {
                    // dev (destructive commands) - AT LEAST 4, so an owner (5) is not demoted
                    response.staffmodlevel = Math.max(4, response.staffmodlevel ?? 0);
                }

                parentPort.postMessage({
                    type: 'player_login',
                    socket,
                    username,
                    lowMemory,
                    reconnecting,
                    ...response
                });
                stopTimer();
            } else {
                const profile = Environment.NODE_PROFILE;

                let account = await db.selectFrom('account').selectAll().where('username', '=', username).executeTakeFirst();

                // A staff-only world never registers anybody: a name it does not know cannot be staff.
                if (!account && Environment.NODE_MIN_STAFF_LEVEL > 0) {
                    parentPort.postMessage({ type: 'player_login', socket, username, lowMemory, reconnecting, reply: REPLY_STAFF_ONLY, save: null, account_id: -1, members: false });
                    break;
                }

                // A token can only ever match an account that already exists, so a name nobody
                // has registered gets the same refusal as a wrong one. Registering from a saved
                // login would mean a token minted anywhere could make its own account.
                if (!account && saved) {
                    parentPort.postMessage({ type: 'player_login', socket, username, lowMemory, reconnecting, reply: 1, save: null, account_id: -1, members: false });
                    break;
                }

                if (!account) {
                    try {
                        await db
                            .insertInto('account')
                            .values({
                                username,
                                password: bcrypt.hashSync(password.toLowerCase(), 10),
                                registration_ip: remoteAddress,
                                registration_date: toDbDate(new Date())
                            })
                            .executeTakeFirst();
                    } catch (err) {
                        // custom (2026-10-19) - two first logins for one new name at once: both found no account,
                        // and the second insert breaks the unique username. That is not an error - the account
                        // now exists - so read it back, and the password check below decides as for any login.
                        console.error(`[Login]: registering ${username}: ${err instanceof Error ? err.message : err}`);
                    }
                    account = await db.selectFrom('account').selectAll().where('username', '=', username).executeTakeFirst();
                }

                // custom (2026-09-27) - this path used to load any existing account and its save without
                // ever looking at the password: anyone could log in as anyone by typing their name.
                // Same checks and replies as LoginServer's player_login.
                //
                // custom (2026-11-02) - and a saved login proves itself with its token instead. One
                // of the two, never either: a client that sends a token sends no password with it,
                // and a token that is not this account's is refused exactly as a wrong password is,
                // with nothing in the reply to say which of the two was wrong.
                const proven = account ? (saved ? await LoginToken.accepts(account.id, token) : await bcrypt.compare(password.toLowerCase(), account.password)) : false;
                if (!account || !proven) {
                    parentPort.postMessage({ type: 'player_login', socket, username, lowMemory, reconnecting, reply: 1, save: null, account_id: -1, members: false });
                    break;
                }

                if (account.banned_until !== null && new Date(account.banned_until) > new Date()) {
                    parentPort.postMessage({ type: 'player_login', socket, username, lowMemory, reconnecting, reply: 5, save: null, account_id: -1, members: false });
                    break;
                }

                // after the password and the ban, so a wrong password still says so
                if (belowStaffLevel(account.staffmodlevel)) {
                    parentPort.postMessage({ type: 'player_login', socket, username, lowMemory, reconnecting, reply: REPLY_STAFF_ONLY, save: null, account_id: -1, members: false });
                    break;
                }

                let staffmodlevel = account ? account.staffmodlevel : 0;
                if (!Environment.NODE_PRODUCTION) {
                    // dev (destructive commands) - AT LEAST 4, so an owner (5) is not demoted
                    staffmodlevel = Math.max(4, staffmodlevel);
                }

                const accountId = account ? account.id : 1;

                // custom (2026-11-02) - the client asked to save this login and has just proved it
                // knows the password, so it gets a token to keep in place of one. Not on a token
                // login: that client already has one, and accepts() has just pushed its month out
                // from today. A failure here is logged and dropped, because a login that works is
                // worth more than a login that saves and the player can ask again.
                let issued: string | undefined;
                if (remember && !saved) {
                    try {
                        issued = await LoginToken.issue(accountId, typeof uid === 'number' ? uid : null, remoteAddress ?? null);
                        console.log(`[Login]: issued a saved login for ${username}`);
                    } catch (err) {
                        console.error(`[Login]: could not save the login for ${username}: ${err instanceof Error ? err.message : err}`);
                    }
                } else if (saved) {
                    console.log(`[Login]: ${username} signed in with a saved login`);
                }

                // The one that cost an evening of reading code: a login that asked for nothing.
                // From here it is indistinguishable from a client that cannot ask, so say which it
                // was - the revision gate is what decides whether those fields were even read.
                if (!remember && !saved) {
                    console.log(`[Login]: ${username} asked for no saved login (client sends them: ${sendsSavedLogin})`);
                }

                if (!fs.existsSync(`data/players/${profile}`)) {
                    fs.mkdirSync(`data/players/${profile}`, { recursive: true });
                }

                if (!fs.existsSync(`data/players/${profile}/${username}.sav`)) {
                    parentPort.postMessage({
                        type: 'player_login',
                        socket,
                        username,
                        lowMemory,
                        reconnecting,
                        reply: 4,
                        staffmodlevel,
                        muted_until: account.muted_until,
                        save: null,
                        account_id: accountId,
                        members: Environment.NODE_MEMBERS,
                        token: issued
                    });
                } else {
                    parentPort.postMessage({
                        type: 'player_login',
                        socket,
                        username,
                        lowMemory,
                        reconnecting,
                        reply: 0,
                        staffmodlevel,
                        muted_until: account.muted_until,
                        save: fs.readFileSync(`data/players/${profile}/${username}.sav`),
                        account_id: accountId,
                        members: Environment.NODE_MEMBERS,
                        token: issued
                    });
                }
            }
            break;
        }
        case 'player_logout': {
            const { username, save, requestedAt } = msg;

            if (Environment.LOGIN_SERVER) {
                const success = await client.playerLogout(username, save, requestedAt);

                parentPort.postMessage({
                    type: 'player_logout',
                    username,
                    success
                });
            } else {
                const profile = Environment.NODE_PROFILE;
                if (!fs.existsSync(`data/players/${profile}`)) {
                    fs.mkdirSync(`data/players/${profile}`, { recursive: true });
                }

                fs.writeFileSync(`data/players/${profile}/${username}.sav`, save);

                parentPort.postMessage({
                    type: 'player_logout',
                    username,
                    success: true
                });
            }
            break;
        }
        case 'player_autosave': {
            const { username, save } = msg;

            if (Environment.LOGIN_SERVER) {
                await client.playerAutosave(username, save);
            } else {
                const profile = Environment.NODE_PROFILE;
                if (!fs.existsSync(`data/players/${profile}`)) {
                    fs.mkdirSync(`data/players/${profile}`, { recursive: true });
                }

                fs.writeFileSync(`data/players/${profile}/${username}.sav`, save);
            }
            break;
        }
        case 'player_force_logout': {
            if (Environment.LOGIN_SERVER) {
                const { username } = msg;
                await client.playerForceLogout(username);
            }
            break;
        }
        case 'player_ban': {
            const { staff, username, until } = msg;
            if (Environment.LOGIN_SERVER) {
                // todo: wait for confirmation? resend?
                await client.playerBan(staff, username, until);
            } else {
                // custom (2026-09-27) - without a login server a ::ban used to go nowhere: the player was
                // kicked and could log straight back in. Written here, as LoginServer would.
                await db
                    .updateTable('account')
                    .set({ banned_until: toDbDate(until) })
                    .where('username', '=', username)
                    .execute();
            }
            break;
        }
        case 'player_mute': {
            const { staff, username, until } = msg;
            if (Environment.LOGIN_SERVER) {
                // todo: wait for confirmation? resend?
                await client.playerMute(staff, username, until);
            } else {
                // custom (2026-09-27) - as player_ban: a mute now outlasts a relog without a login server
                await db
                    .updateTable('account')
                    .set({ muted_until: toDbDate(until) })
                    .where('username', '=', username)
                    .execute();
            }
            break;
        }
        case 'player_change_password': {
            // custom (2026-09-27) - ::changepassword. The account table is the same database in both login
            // modes, so this goes to it directly. Passwords are compared and stored lowercased, as at login.
            const { username, oldPassword, newPassword } = msg;
            let result: 'ok' | 'wrong' | 'error' = 'error';
            try {
                const account = await db.selectFrom('account').select(['id', 'password']).where('username', '=', username).executeTakeFirst();
                if (!account || !(await bcrypt.compare(oldPassword.toLowerCase(), account.password))) {
                    result = 'wrong';
                } else {
                    const hash = await bcrypt.hash(newPassword.toLowerCase(), 10);
                    await db.updateTable('account').set({ password: hash }).where('id', '=', account.id).execute();
                    // custom (2026-11-02) - and every saved login goes with it. Somebody changing
                    // their password because another person might know it has said everything about
                    // what should happen to the logins saved under the old one.
                    await LoginToken.revokeAll(account.id);
                    result = 'ok';
                }
            } catch (err) {
                console.error(err);
            }
            parentPort.postMessage({ type: 'player_change_password', username, result });
            break;
        }
        case 'player_set_veteran': {
            // custom (2026-11-06) - ::veteran. Straight to the account table, as
            // player_change_password is and for the same reason: that table is the same database
            // in both login modes, so there is nothing for a login server to arbitrate.
            //
            // The account does not have to be logged in, and usually is not - the rank is given
            // out after the launch wipe, to people who may not be online when the list is worked
            // through.
            const { staff, username, veteran } = msg;
            let result: 'ok' | 'unknown' | 'error' = 'error';
            try {
                const account = await db.selectFrom('account').select(['id']).where('username', '=', username).executeTakeFirst();
                if (!account) {
                    result = 'unknown';
                } else {
                    await db
                        .updateTable('account')
                        .set({ veteran: veteran ? 1 : 0 })
                        .where('id', '=', account.id)
                        .execute();
                    result = 'ok';
                }
            } catch (err) {
                console.error(err);
            }
            parentPort.postMessage({ type: 'player_set_veteran', staff, username, result, veteran });
            break;
        }
        case 'player_set_helper': {
            // custom (2026-11-11) - ::helper. The same path as player_set_veteran above, and for
            // the same reasons: the account table is one database in both login modes, and the
            // account usually is not logged in when the rank is handed out.
            const { staff, username, helper } = msg;
            let result: 'ok' | 'unknown' | 'error' = 'error';
            try {
                const account = await db.selectFrom('account').select(['id']).where('username', '=', username).executeTakeFirst();
                if (!account) {
                    result = 'unknown';
                } else {
                    await db
                        .updateTable('account')
                        .set({ helper: helper ? 1 : 0 })
                        .where('id', '=', account.id)
                        .execute();
                    result = 'ok';
                }
            } catch (err) {
                console.error(err);
            }
            parentPort.postMessage({ type: 'player_set_helper', staff, username, result, helper });
            break;
        }
        case 'player_forget_logins': {
            // custom (2026-11-02) - ::forgetlogins. Every saved login for this account, cancelled,
            // including the one on the computer it was typed from - which is the point: a player
            // who left a client signed in somewhere else has no other way to reach it.
            const { username } = msg;
            let count = 0;
            let ok = false;
            try {
                const account = await db.selectFrom('account').select(['id']).where('username', '=', username).executeTakeFirst();
                if (account) {
                    count = await LoginToken.revokeAll(account.id);
                    ok = true;
                }
            } catch (err) {
                console.error(err);
            }
            parentPort.postMessage({ type: 'player_forget_logins', username, count, ok });
            break;
        }
        case 'world_heartbeat': {
            break;
        }
        default:
            console.error('Unknown message type: ' + msg.type);
            break;
    }
}
