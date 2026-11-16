import fs from 'fs';
import fsp from 'fs/promises';

import * as bcrypt from 'bcrypt-ts';
import { WebSocket, WebSocketServer } from 'ws';

import { db, toDbDate } from '#/db/query.js';
import Player from '#/engine/entity/Player.js';
import { PlayerLoading } from '#/engine/entity/PlayerLoading.js';
import { PlayerStatEnabled } from '#/engine/entity/PlayerStat.js';
import Packet from '#/io/Packet.js';
import Environment from '#/util/Environment.js';
import { toSafeName } from '#/util/JString.js';
import { printInfo } from '#/util/Logger.js';
import { startManagementWeb } from '#/server/management/ManagementWeb.js';
import { createInternalServer } from '#/server/InternalServer.js';
import InvType from '#/cache/config/InvType.js';
import VarPlayerType from '#/cache/config/VarPlayerType.js';
import LoginToken from '#/server/login/LoginToken.js';

/**
 * THE FIGURES THAT ARE NOT SKILLS, and the hiscore types they are filed under.
 *
 * The game has counted all of these since September - content/scripts/player/configs/player_stats.varp
 * and the quest point varp - and shows them on the quest tab's Player Statistics page. None of
 * them has ever left the save file, so the website could show a player's levels and nothing about
 * what they had actually done. This is the only thing missing: the counting, the saving and the
 * display were all already built.
 *
 * TYPES START AT 100 so they cannot collide with a skill. A skill's type is its PlayerStat plus
 * one, and the day somebody adds the twenty-fourth skill it should not land on top of quest
 * points. 0 in hiscore_large is the overall row and is not ours.
 *
 * THEY GO IN `hiscore` RATHER THAN A TABLE OF THEIR OWN because rank then costs nothing: the site
 * already ranks a row by counting the rows above it, so "NPC kills, ranked 5th" falls out of
 * exactly the query that ranks Attack. `level` is 0 for all of them - a kill count has no level,
 * and writing the value there twice would be inventing a second meaning for the column.
 */
const TRACKED: readonly { varp: string; type: number }[] = [
    { varp: 'qp', type: 100 },
    { varp: 'player_npc_kills', type: 101 },
    { varp: 'player_pvp_kills', type: 102 },
    { varp: 'player_deaths', type: 103 },
    { varp: 'player_playtime', type: 104 }
];

/**
 * Varp ids by name, worked out once.
 *
 * -1 IS A FINE ANSWER and is cached like any other: a profile whose content does not define one of
 * these simply never gets that row, rather than this asking the config every logout for a name
 * that was not there the first time.
 */
const trackedIds = new Map<string, number>();

function trackedVarp(name: string): number {
    const known = trackedIds.get(name);
    if (known !== undefined) {
        return known;
    }
    const id = VarPlayerType.getId(name);
    trackedIds.set(name, id);
    return id;
}

/**
 * Boss kill counts, one hiscore type each.
 *
 * content/scripts/bosses/configs/boss_kills.varp has counted these per god and per boss since
 * September, for the God Wars doors among other things, and like the player statistics they have
 * never left the save.
 *
 * THE TYPES ARE WRITTEN OUT RATHER THAN COUNTED FROM THE FILE. Numbering them by their order in
 * boss_kills.varp would mean that inserting a boss silently renumbered every boss after it, and
 * every row already in the database would then be filed under the wrong one. A type is a promise
 * about what a number means; it does not get to move.
 *
 * 200 upwards, which leaves 100-199 for whole-account figures and the whole of 1-99 for skills.
 */
const BOSSES: readonly { varp: string; type: number }[] = [
    { varp: 'boss_kc_jad', type: 200 },
    { varp: 'boss_kc_kril', type: 201 },
    { varp: 'boss_kc_graardor', type: 202 },
    { varp: 'boss_kc_zilyana', type: 203 },
    { varp: 'boss_kc_kreearra', type: 204 },
    { varp: 'boss_kc_kq', type: 205 },
    { varp: 'boss_kc_chaos_elemental', type: 206 },
    { varp: 'boss_kc_dag_rex', type: 207 },
    { varp: 'boss_kc_dag_supreme', type: 208 },
    { varp: 'boss_kc_dag_prime', type: 209 },
    { varp: 'boss_kc_kbd', type: 210 },
    { varp: 'boss_kc_mole', type: 211 },
    { varp: 'boss_kc_kraken', type: 212 },
    { varp: 'boss_kc_zulrah', type: 213 }
];

/**
 * How much of the collection log an account has filled, as one number.
 *
 * THE LOG IS AN INVENTORY, NOT A VARP. collection_log.inv keeps one slot per distinct item ever
 * obtained, the slot's count being how many - so "obtained" is simply how many slots are taken,
 * and that is the figure the log itself puts in its heading. The items in it are not written
 * here: which items somebody owns is a different question from how far along they are, and the
 * answer to it is 803 columns wide.
 */
const COLLECTION_LOG_TYPE = 105;

const SAFE_PROFILE = /^[A-Za-z0-9_-]{1,32}$/;
const SAVE_FILE_MESSAGES = new Set(['player_login', 'player_logout', 'player_autosave']);

async function updateHiscores(account: { id: number; staffmodlevel: number; banned_until: string | null } | undefined, player: Player, profile: string) {
    if (!account) return;

    // THE ACCOUNT'S EXPERIENCE RATE, MIRRORED OUT OF THE SAVE (custom, 2026-11-15).
    //
    // ABOVE THE RETURNS BELOW ON PURPOSE. Staff and banned accounts leave this function without
    // writing a hiscore row, and rightly - but their rate is still a true fact about them, and the
    // player page shows which mode somebody is on whether or not they are ranked. A column that is
    // only correct for ranked accounts is a column every reader has to remember the exception to.
    //
    // ONE STATEMENT, NO READ. The `!=` in the where clause makes it a no-op when nothing has
    // changed, which is every logout after the first - so this costs a statement that matches no
    // rows rather than a select on every save.
    //
    // The varp is the source and this is the copy; it exists because the WEBSITE cannot open a save
    // file to find out which board somebody belongs on. See prisma/*/migrations/*_account_xp_rate.
    await db.updateTable('account').set({ xp_rate: player.xpRate() }).where('id', '=', account.id).where('xp_rate', '!=', player.xpRate()).execute();

    // NOBODY WHO CAN HAND THEMSELVES THE SCORE. ::give and ::setstat are in the staffModLevel >= 3
    // block of ClientCheatHandler - "admin commands, potentially destructive for a live economy" -
    // so 3 and above is exactly the set of people who can award themselves an item or a level, and
    // exactly the set that must not appear on a board. (Owner, 2 November.)
    //
    // ALL STAFF, NOT JUST THE ONES WHO COULD CHEAT (changed 2026-11-05, for the launch wipe).
    //
    // This used to stop at 3 and the reasoning was sound on its own terms: a moderator has ban,
    // mute and kick and a super-moderator has tele and setvis, none of which fabricates a level,
    // and excluding somebody for holding the ban hammer punishes them for helping.
    //
    // The wipe is what changes it. Staff keep their characters when everybody else starts again,
    // so a moderator on the boards is not ranked against the players - they are ranked on months
    // of progress from before the server launched, which nobody else was allowed to keep. The
    // first logout after a wipe would put them straight back on top, because these rows are
    // DERIVED from the save and rebuilt every time it is written.
    //
    // So: no staff on the boards at all. If a staff member wants to be ranked, the way to do it is
    // the way everybody else does - a character that started when theirs did.
    if (account.staffmodlevel > 0) {
        return;
    }

    if (account.banned_until !== null && new Date(account.banned_until) >= new Date()) {
        return;
    }

    const insert = [];
    const update = [];

    let totalXp = 0;
    let totalLevel = 0;
    for (let i = 0; i < player.stats.length; i++) {
        if (!PlayerStatEnabled[i]) {
            continue;
        }

        totalXp += player.stats[i];
        totalLevel += player.baseLevels[i];
    }

    const existing = await db.selectFrom('hiscore_large').select('type').select('value').where('account_id', '=', account.id).where('type', '=', 0).where('profile', '=', profile).executeTakeFirst();
    if (existing && existing.value !== totalXp) {
        await db
            .updateTable('hiscore_large')
            .set({
                type: 0,
                level: totalLevel,
                value: totalXp,
                date: toDbDate(new Date())
            })
            .where('account_id', '=', account.id)
            .where('type', '=', 0)
            .where('profile', '=', profile)
            .execute();
    } else if (!existing) {
        await db
            .insertInto('hiscore_large')
            .values({
                account_id: account.id,
                profile,
                type: 0,
                level: totalLevel,
                value: totalXp
            })
            .execute();
    }

    for (let stat = 0; stat < player.stats.length; stat++) {
        if (!PlayerStatEnabled[stat]) {
            continue;
        }

        if (player.baseLevels[stat] >= 15) {
            const hiscoreType = stat + 1;

            // todo: can we upsert in kysely?
            const existing = await db.selectFrom('hiscore').select('type').select('value').where('account_id', '=', account.id).where('type', '=', hiscoreType).where('profile', '=', profile).executeTakeFirst();
            if (existing && existing.value !== player.stats[stat]) {
                update.push({
                    type: hiscoreType,
                    level: player.baseLevels[stat],
                    value: player.stats[stat],
                    date: toDbDate(new Date())
                });
            } else if (!existing) {
                insert.push({
                    account_id: account.id,
                    profile,
                    type: hiscoreType,
                    level: player.baseLevels[stat],
                    value: player.stats[stat]
                });
            }
        }
    }

    // The non-skill figures, onto the same two piles so they are written in the same round trip.
    for (const tracked of TRACKED) {
        const varp = trackedVarp(tracked.varp);
        if (varp === -1) {
            continue;
        }

        // Zero is not written. A player who has never died should have no deaths row rather than a
        // row saying nothing happened - and it keeps a brand new account off five hiscore tables.
        const value = player.vars[varp] ?? 0;
        if (value <= 0) {
            continue;
        }

        const current = await db.selectFrom('hiscore').select('value').where('account_id', '=', account.id).where('type', '=', tracked.type).where('profile', '=', profile).executeTakeFirst();
        if (current && current.value !== value) {
            update.push({ type: tracked.type, level: 0, value, date: toDbDate(new Date()) });
        } else if (!current) {
            insert.push({ account_id: account.id, profile, type: tracked.type, level: 0, value });
        }
    }

    // Boss kill counts, onto the same two piles. Same rule as above: a boss nobody has killed
    // gets no row rather than a row of zero.
    for (const boss of BOSSES) {
        const varp = trackedVarp(boss.varp);
        if (varp === -1) {
            continue;
        }

        const value = player.vars[varp] ?? 0;
        if (value <= 0) {
            continue;
        }

        const current = await db.selectFrom('hiscore').select('value').where('account_id', '=', account.id).where('type', '=', boss.type).where('profile', '=', profile).executeTakeFirst();
        if (current && current.value !== value) {
            update.push({ type: boss.type, level: 0, value, date: toDbDate(new Date()) });
        } else if (!current) {
            insert.push({ account_id: account.id, profile, type: boss.type, level: 0, value });
        }
    }

    // And how far through the collection log they are: the number of slots taken in it.
    const logInv = InvType.getId('collection_log');
    const log = logInv === -1 ? undefined : player.invs.get(logInv);
    const obtained = log ? log.itemsFiltered.length : 0;

    // WHICH items, into a table of their own. Rewritten whole rather than merged: the inventory in
    // the save is the truth and this is a copy of it, so working out a difference would mean
    // trusting rows this table should never have had. An account with an empty log still gets the
    // delete, which is how an item removed in game stops being shown on the website.
    if (log) {
        await db.deleteFrom('collection_log').where('account_id', '=', account.id).where('profile', '=', profile).execute();
        const owned = log.itemsFiltered.map(item => ({ profile, account_id: account.id, obj: item.id, count: item.count }));
        if (owned.length > 0) {
            await db.insertInto('collection_log').values(owned).execute();
        }
    }
    if (obtained > 0) {
        const current = await db.selectFrom('hiscore').select('value').where('account_id', '=', account.id).where('type', '=', COLLECTION_LOG_TYPE).where('profile', '=', profile).executeTakeFirst();
        if (current && current.value !== obtained) {
            update.push({ type: COLLECTION_LOG_TYPE, level: 0, value: obtained, date: toDbDate(new Date()) });
        } else if (!current) {
            insert.push({ account_id: account.id, profile, type: COLLECTION_LOG_TYPE, level: 0, value: obtained });
        }
    }

    if (insert.length > 0) {
        await db.insertInto('hiscore').values(insert).execute();
    }

    // todo: batch update query?
    for (let i = 0; i < update.length; i++) {
        await db.updateTable('hiscore').set(update[i]).where('account_id', '=', account.id).where('type', '=', update[i].type).where('profile', '=', profile).execute();
    }
}

export default class LoginServer {
    private server: WebSocketServer;
    private loginRequests: Set<string> = new Set();

    rejectLoginForSafety(s: WebSocket, replyTo: number) {
        // Send opcode 7 ('Please try again') if something has gone wrong
        // during login attempt, which may be resolved by simply retrying.
        s.send(
            JSON.stringify({
                replyTo,
                response: 7
            })
        );
    }

    async wouldResetSaveFile(newSaveBytes: Buffer, profile: string, username: string) {
        // check whether `save`, if saved to disk, would have reset `username`'s progress.
        // it does this by checking whether the player's tick count has gone backwards.
        if (!fs.existsSync(`data/players/${profile}/${username}.sav`)) {
            // No existing save - no problem.
            return false;
        }
        const existingSaveRaw = await fsp.readFile(`data/players/${profile}/${username}.sav`);
        const existingSave = PlayerLoading.load('tmp', new Packet(existingSaveRaw), null);
        const newSave = PlayerLoading.load('tmp', new Packet(newSaveBytes), null);
        if (existingSave.playtime > newSave.playtime) {
            // Int32, 1 per tick logged in. Should wrap only after insane amount of years.
            return true;
        }
        return false;
    }

    constructor() {
        if (Environment.LOGIN_SERVER && !Environment.EASY_STARTUP) {
            startManagementWeb();
        }

        InvType.load('data/pack');
        // AND THE VARPS, because updateHiscores reads them by name. Without this
        // VarPlayerType.getId answers -1 for everything and every figure it writes - deaths,
        // kills, playtime, quest points, boss counts - is skipped in silence, which is exactly
        // what happened the first time this shipped. InvType was loaded here and varps were
        // not, because until now nothing in this process had ever needed one.
        VarPlayerType.load('data/pack');

        this.server = createInternalServer('Login server', Environment.LOGIN_PORT, () => {
            printInfo(`Login server listening on port ${Environment.LOGIN_PORT}`);
        });

        this.server.on('connection', (s: WebSocket) => {
            s.on('message', async (data: Buffer) => {
                try {
                    const msg = JSON.parse(data.toString());
                    const { type, nodeId, nodeTime, profile } = msg;

                    // custom (2026-09-27) - profile and username go straight into data/players/<profile>/<username>.sav.
                    // A world only ever sends a plain profile and a safe name; anything else is someone
                    // trying to write outside the saves folder.
                    if (profile !== undefined && (typeof profile !== 'string' || !SAFE_PROFILE.test(profile))) {
                        console.error(`[Login]: rejected ${type} with invalid profile`);
                        return;
                    }
                    if (SAVE_FILE_MESSAGES.has(type) && (typeof msg.username !== 'string' || msg.username.length === 0 || msg.username !== toSafeName(msg.username))) {
                        console.error(`[Login]: rejected ${type} with invalid username`);
                        return;
                    }

                    if (type === 'world_startup') {
                        await db
                            .updateTable('account_login')
                            .set({
                                logged_in: 0,
                                login_time: null
                            })
                            .where('logged_in', '=', nodeId)
                            .where('profile', '=', profile)
                            .execute();
                    } else if (type === 'player_login') {
                        const { nodeMembers, replyTo, username, password, uid, socket, remoteAddress, reconnecting, hasSave } = msg;
                        const safeName = toSafeName(username);

                        // custom (2026-11-02) - a saved login. This server owns accounts and
                        // checks passwords, so it owns the token that stands in for one: it
                        // reads the same database the token store does, and a world asking
                        // its login server to prove a login should not have to care which of
                        // the two the client sent. See LoginToken.
                        const token: string = typeof msg.token === 'string' ? msg.token : '';
                        const remember: boolean = msg.remember === true;
                        const saved = token.length > 0;

                        if (this.loginRequests.has(safeName)) {
                            s.send(
                                JSON.stringify({
                                    replyTo,
                                    response: 8
                                })
                            );
                            return;
                        }
                        this.loginRequests.add(safeName);

                        try {
                            const ipBan = await db.selectFrom('ipban').selectAll().where('ip', '=', remoteAddress).executeTakeFirst();

                            if (ipBan) {
                                s.send(
                                    JSON.stringify({
                                        replyTo,
                                        response: 7
                                    })
                                );
                                return;
                            }

                            let account = await db
                                .selectFrom('account')
                                .leftJoin('account_login', join => join.onRef('account_id', '=', 'id').on('profile', '=', profile))
                                .where('username', '=', username)
                                .selectAll()
                                .executeTakeFirst();

                            // A token can only ever match an account that already exists, so a
                            // name nobody has registered is refused below as a wrong one would
                            // be. Registering from a saved login would let a token minted
                            // anywhere make its own account.
                            if (!Environment.WEBSITE_REGISTRATION && !account && !saved) {
                                // register the user automatically
                                const insertResult = await db
                                    .insertInto('account')
                                    .values({
                                        username,
                                        password: bcrypt.hashSync(password.toLowerCase(), 10),
                                        registration_ip: remoteAddress,
                                        registration_date: toDbDate(new Date())
                                    })
                                    .executeTakeFirst();

                                if (typeof insertResult.insertId === 'undefined') {
                                    return;
                                }

                                account = await db
                                    .selectFrom('account')
                                    .leftJoin('account_login', join => join.onRef('account_id', '=', 'id').on('profile', '=', profile))
                                    .where('username', '=', username)
                                    .selectAll()
                                    .executeTakeFirst();
                            }

                            // custom (2026-11-02) - one of the two, and the refusal is the same
                            // either way: nothing in reply 1 says which of them was wrong.
                            const proven = account ? (saved ? await LoginToken.accepts(account.id, token) : await bcrypt.compare(password.toLowerCase(), account.password)) : false;
                            if (!account || !proven) {
                                // invalid username or password
                                s.send(
                                    JSON.stringify({
                                        replyTo,
                                        response: 1
                                    })
                                );
                                return;
                            }

                            if (account.banned_until !== null && new Date(account.banned_until) > new Date()) {
                                // account disabled
                                s.send(
                                    JSON.stringify({
                                        replyTo,
                                        response: 5
                                    })
                                );
                                return;
                            }

                            // custom (2026-11-02) - said here because here is where it is
                            // decided. A login that asks for nothing is indistinguishable
                            // afterwards from a client too old to ask, so the log says which.
                            if (saved) {
                                console.log(`[Login/server]: ${username} signed in with a saved login`);
                            } else if (!remember) {
                                console.log(`[Login/server]: ${username} asked for no saved login (client sends them: ${msg.sendsToken === true})`);
                            }

                            // The token this client gets to keep. Minted once it has proved it
                            // knows the password and only for a login that is about to
                            // succeed, so a refusal below does not spend one of the five an
                            // account may have. Not on a token login: that client has one
                            // already, and accepts() has just pushed its month out from today.
                            // A failure is logged and dropped - a login that works is worth
                            // more than a login that saves, and the player can ask again.
                            const accountId = account.id;
                            const savedLogin = async (): Promise<string | undefined> => {
                                if (!remember || saved) {
                                    return undefined;
                                }
                                try {
                                    const issued = await LoginToken.issue(accountId, typeof uid === 'number' ? uid : null, remoteAddress ?? null);
                                    console.log(`[Login/server]: issued a saved login for ${username}`);
                                    return issued;
                                } catch (err) {
                                    console.error(`[Login/server]: could not save the login for ${username}: ${err instanceof Error ? err.message : err}`);
                                    return undefined;
                                }
                            };

                            if (nodeMembers && !account.members) {
                                if (Environment.NODE_AUTO_SUBSCRIBE_MEMBERS) {
                                    // Set members=1 for the account and proceed with login
                                    await db.updateTable('account').where('id', '=', account.id).set('members', 1).executeTakeFirstOrThrow();
                                    account.members = 1;
                                } else {
                                    s.send(
                                        JSON.stringify({
                                            replyTo,
                                            response: 9
                                        })
                                    );
                                    return;
                                }
                            }

                            if (reconnecting && account.logged_in === nodeId) {
                                await db
                                    .insertInto('session')
                                    .values({
                                        uuid: socket,
                                        account_id: account.id,
                                        profile,
                                        world: nodeId,
                                        timestamp: toDbDate(nodeTime),
                                        uid,
                                        ip: remoteAddress
                                    })
                                    .execute();

                                if (!hasSave) {
                                    const save = await fsp.readFile(`data/players/${profile}/${username}.sav`);
                                    if (!save || !PlayerLoading.verify(new Packet(save))) {
                                        // Extreme safety check for savefile existing but having bad data on read:
                                        console.error('on reconnect, account_id %s had invalid save data on disk', account.id);
                                        this.rejectLoginForSafety(s, replyTo);
                                    }
                                    s.send(
                                        JSON.stringify({
                                            replyTo,
                                            response: 2,
                                            account_id: account.id,
                                            staffmodlevel: account.staffmodlevel,
                                            veteran: account.veteran,
                                            helper: account.helper,
                                            muted_until: account.muted_until,
                                            save: save.toString('base64'),
                                            members: account.members,
                                            messageCount: 0,
                                            token: await savedLogin()
                                        })
                                    );
                                } else {
                                    s.send(
                                        JSON.stringify({
                                            replyTo,
                                            response: 2,
                                            account_id: account.id,
                                            staffmodlevel: account.staffmodlevel,
                                            veteran: account.veteran,
                                            helper: account.helper,
                                            muted_until: account.muted_until,
                                            members: account.members,
                                            messageCount: 0,
                                            token: await savedLogin()
                                        })
                                    );
                                }
                                return;
                            } else if (account.logged_in !== null && account.logged_in !== 0) {
                                // already logged in elsewhere
                                s.send(
                                    JSON.stringify({
                                        replyTo,
                                        response: 3
                                    })
                                );
                                return;
                            } else if (account.staffmodlevel < 2 && account.logged_out !== 0 && account.logged_out !== nodeId && account.logout_time !== null) {
                                const remaining = new Date(account.logout_time).getTime() - new Date(Date.now() - Environment.NODE_HOP_TIME).getTime();
                                if (remaining > 0) {
                                    // rate limited (hop timer)
                                    s.send(
                                        JSON.stringify({
                                            replyTo,
                                            response: 10,
                                            remaining
                                        })
                                    );
                                    return;
                                }
                            }

                            await db
                                .insertInto('session')
                                .values({
                                    uuid: socket,
                                    account_id: account.id,
                                    profile,
                                    world: nodeId,
                                    timestamp: toDbDate(nodeTime),
                                    uid,
                                    ip: remoteAddress
                                })
                                .execute();

                            if (!fs.existsSync(`data/players/${profile}/${username}.sav`)) {
                                // not an error - never logged in before
                                // ^ Only not an error if the user has never logged in before:
                                if (account.logout_time !== null) {
                                    console.error('on login, account_id %s had no save data on disk!', account.id);
                                    this.rejectLoginForSafety(s, replyTo);
                                    return;
                                } else {
                                    s.send(
                                        JSON.stringify({
                                            replyTo,
                                            response: 4,
                                            account_id: account.id,
                                            staffmodlevel: account.staffmodlevel,
                                            veteran: account.veteran,
                                            helper: account.helper,
                                            muted_until: account.muted_until,
                                            messageCount: 0,
                                            token: await savedLogin()
                                        })
                                    );
                                }
                            } else {
                                const save = await fsp.readFile(`data/players/${profile}/${username}.sav`);
                                // Extreme safety check for savefile existing but having bad data on read:
                                if (!save || !PlayerLoading.verify(new Packet(save))) {
                                    console.error('on login, account_id %s had invalid save data on disk!', account.id);
                                    this.rejectLoginForSafety(s, replyTo);
                                    return;
                                }
                                s.send(
                                    JSON.stringify({
                                        replyTo,
                                        response: 0,
                                        account_id: account.id,
                                        staffmodlevel: account.staffmodlevel,
                                        veteran: account.veteran,
                                        helper: account.helper,
                                        save: save.toString('base64'),
                                        muted_until: account.muted_until,
                                        members: account.members,
                                        messageCount: 0,
                                        token: await savedLogin()
                                    })
                                );
                            }

                            // Login is valid - update account table
                            if (account.account_id) {
                                await db
                                    .updateTable('account_login')
                                    .set({
                                        logged_in: nodeId,
                                        login_time: toDbDate(new Date())
                                    })
                                    .where('account_id', '=', account.id)
                                    .where('profile', '=', profile)
                                    .executeTakeFirst();
                            } else {
                                await db
                                    .insertInto('account_login')
                                    .values({
                                        account_id: account.id,
                                        profile: profile,
                                        logged_in: nodeId,
                                        login_time: toDbDate(new Date())
                                    })
                                    .executeTakeFirst();
                            }
                        } finally {
                            this.loginRequests.delete(safeName);
                        }
                    } else if (type === 'player_logout') {
                        const { replyTo, username, save, requestedAt } = msg;

                        const raw = Buffer.from(save, 'base64');
                        if (PlayerLoading.verify(new Packet(raw)) && !(await this.wouldResetSaveFile(raw, profile, username))) {
                            if (!fs.existsSync(`data/players/${profile}`)) {
                                await fsp.mkdir(`data/players/${profile}`, { recursive: true });
                            }

                            await fsp.writeFile(`data/players/${profile}/${username}.sav`, raw);
                        } else {
                            console.error(username, 'Invalid save file');
                        }

                        const account = await db
                            .selectFrom('account')
                            .leftJoin('account_login', join => join.onRef('account_id', '=', 'id').on('profile', '=', profile))
                            .where('username', '=', username)
                            .selectAll()
                            .executeTakeFirst();

                        // A LOGOUT CAN ARRIVE AFTER THE NEXT LOGIN, and clearing the row then
                        // puts a player who is standing in the game down as gone. World retries
                        // this message every 15 seconds until it is acknowledged, so a lost or
                        // slow acknowledgement sends a second copy - and by the time that one is
                        // read, the player whose connection dropped can be back on. iron_sgt on
                        // 16 November 2026: logged_in 0, login_time null, logout_time 16:04:29,
                        // and he was in the game while the row said otherwise. The website's
                        // activity page counted three players from the world's own gauge and
                        // could only name two.
                        //
                        // THE TEST IS THE LOGIN TIME, not the node: both sessions are the same
                        // world here, so `logged_in = nodeId` matches either way and would catch
                        // nothing. The login this logout ends always started before the player
                        // left, so a login_time AFTER requestedAt belongs to a later session and
                        // is not ours to clear. The save half of this message has had the
                        // equivalent guard since it was written - see wouldResetSaveFile, which
                        // refuses a save that would move the player backwards.
                        //
                        // STILL ACKNOWLEDGED EITHER WAY, below: a logout we decline to apply is
                        // finished business, and answering anything else would have World retry
                        // it every 15 seconds for ever.
                        // THE STORED TIME IS UTC WITH NO ZONE ON IT (toDbDate), and `new Date` reads a
                        // bare 'YYYY-MM-DD HH:MM:SS' as LOCAL time - five hours out on this box.
                        // Left unsaid, every ordinary logout would have looked like it came from a
                        // stale session and the whole server would have stayed marked online.
                        const leftAt = typeof requestedAt === 'number' ? requestedAt : null;
                        const lastLogin = account?.login_time == null ? NaN : Date.parse(`${account.login_time.replace(' ', 'T')}Z`);
                        const loggedInSince = leftAt !== null && Number.isFinite(lastLogin) && lastLogin > leftAt;

                        if (loggedInSince) {
                            console.error(`[Login]: ${username} logged out at ${new Date(leftAt).toISOString()} but has logged in since - leaving the login record alone`);
                        }

                        if (account?.account_id && !loggedInSince) {
                            await db
                                .updateTable('account_login')
                                .set({
                                    logged_in: 0,
                                    login_time: null,
                                    logged_out: nodeId,
                                    logout_time: toDbDate(new Date())
                                })
                                .where('account_id', '=', account.id)
                                .where('profile', '=', profile)
                                .executeTakeFirst();
                        }

                        s.send(
                            JSON.stringify({
                                replyTo,
                                response: 0
                            })
                        );

                        await updateHiscores(account, PlayerLoading.load(username, new Packet(raw), null), profile);
                    } else if (type === 'player_autosave') {
                        const { username, save } = msg;

                        const raw = Buffer.from(save, 'base64');
                        if (PlayerLoading.verify(new Packet(raw)) && !(await this.wouldResetSaveFile(raw, profile, username))) {
                            if (!fs.existsSync(`data/players/${profile}`)) {
                                await fsp.mkdir(`data/players/${profile}`, { recursive: true });
                            }

                            await fsp.writeFile(`data/players/${profile}/${username}.sav`, raw);
                        } else {
                            console.error(username, 'Invalid save file');
                        }
                    } else if (type === 'player_force_logout') {
                        const { username } = msg;

                        const account = await db
                            .selectFrom('account')
                            .leftJoin('account_login', join => join.onRef('account_id', '=', 'id').on('profile', '=', profile))
                            .where('username', '=', username)
                            .selectAll()
                            .executeTakeFirst();

                        if (account?.account_id) {
                            await db
                                .updateTable('account_login')
                                .set({
                                    logged_in: 0,
                                    login_time: null
                                })
                                .where('account_id', '=', account.id)
                                .where('profile', '=', profile)
                                .executeTakeFirst();
                        }
                    } else if (type === 'player_ban') {
                        const { _staff, username, until } = msg;

                        // todo: audit log

                        await db
                            .updateTable('account')
                            .set({
                                banned_until: toDbDate(until)
                            })
                            .where('username', '=', username)
                            .executeTakeFirst();
                    } else if (type === 'player_mute') {
                        const { _staff, username, until } = msg;

                        // todo: audit log

                        await db
                            .updateTable('account')
                            .set({
                                muted_until: toDbDate(until)
                            })
                            .where('username', '=', username)
                            .executeTakeFirst();
                    }
                } catch (err) {
                    console.error(err);
                }
            });

            s.on('close', () => {});
            s.on('error', () => {});
        });
    }
}
