/**
 * Read and write everything an account is, from outside the running server.
 *
 * PRISMA STUDIO SHOWS ONLY HALF OF ONE. An account is TWO things kept in two places: a row in the
 * database (username, password hash, members, mod level, bans, mutes, friends, ignores, hiscores)
 * and a SAVE FILE at data/players/<profile>/<username>.sav holding the character - position,
 * appearance, every stat, every varp, and every permanent inventory including the bank. Studio can
 * edit the first and cannot see the second at all, which is why the levels and items you go
 * looking for in it are never there.
 *
 * IT NEVER RE-IMPLEMENTS THE SAVE FORMAT. The file is read with PlayerLoading.load and written
 * with Player.save - the same two functions the server itself uses - so a save this tool writes is
 * a save the server wrote, checksum, version byte and all. There is no second decoder here to
 * drift out of step the next time SAV_VERSION moves.
 *
 * THREE THINGS STAND BETWEEN AN EDIT AND A LOST CHARACTER:
 *   * it refuses to write while that account is logged in, because the server holds the character
 *     in memory and rewrites the file at logout - your edit would be overwritten and you would
 *     have no way of knowing. --force is there for a save the server left marked online after a
 *     crash, and for nothing else;
 *   * the new bytes are loaded back through PlayerLoading before anything is replaced, so a save
 *     that would not load is never the one on disk;
 *   * the old file is copied to <username>.sav.bak-<timestamp> first.
 *
 * WHAT IS NOT EDITABLE, ON PURPOSE. The chat, report, session and wealth log tables are a record
 * of what happened; `show` summarises them and nothing here writes them. Neither is the password
 * hash exported - a hash in a JSON file on disk is a liability, and `password` sets a new one
 * properly instead.
 *
 * EXPERIENCE IS SHOWN AND TAKEN AS THE REAL NUMBER. Internally the engine keeps it in tenths -
 * a 99 is 130,344,310 in the file - and this converts at the edges, so `set bob save.stats.ATTACK
 * 99` and a JSON that says 13034431 both mean the same thing and both mean what they look like.
 *
 * "ALREADY LOGGED IN" IS A THIRD PLACE, and the one that catches people out. Neither the database
 * row nor the save file says whether somebody is online: a separate account_login row holds the
 * NODE ID of the world they are on, and a session that ended badly leaves it set. The login server
 * then refuses them before the world ever sees the attempt, so ::kick has nothing to kick.
 * `logout` clears it. A world restart clears every row for its own node id and is usually the
 * better fix; see cmdLogout for when it is not.
 *
 * HISCORES ARE DERIVED, not stored: LoginServer recomputes every row from the save each time the
 * player saves. Editing them is pointless, so this does not - change the stat and the hiscore
 * follows on the player's next logout.
 *
 *   npx tsx tools/server/account.ts list
 *   npx tsx tools/server/account.ts show bob
 *   npx tsx tools/server/account.ts export bob --out bob.json
 *   npx tsx tools/server/account.ts import bob --in bob.json      (--in - reads stdin)
 *   npx tsx tools/server/account.ts set bob save.stats.ATTACK 99
 *   npx tsx tools/server/account.ts set bob 'save.stats.*' 99
 *   npx tsx tools/server/account.ts set bob account.members true
 *   npx tsx tools/server/account.ts give bob abyssal_whip 1 --inv bank
 *   npx tsx tools/server/account.ts rename bob robert
 *   npx tsx tools/server/account.ts delete bob
 *   npx tsx tools/server/account.ts password bob hunter2
 *   npx tsx tools/server/account.ts deaths bob --days 3
 *   npx tsx tools/server/account.ts audit                       every staff command, last 7 days
 *   npx tsx tools/server/account.ts audit bob --days 30
 *   npx tsx tools/server/account.ts audit --summary --limit 500
 *   npx tsx tools/server/account.ts chat bob --days 7       what they said: public, private, clan
 *   npx tsx tools/server/account.ts chat bob --with alice --where
 *   npx tsx tools/server/account.ts clan "Death Plateau"       a whole clan channel, oldest first
 *   npx tsx tools/server/account.ts whois bob                  other accounts on the same IP or PC
 *   npx tsx tools/server/account.ts logout bob
 *
 * --profile <name> picks the world profile (default: NODE_PROFILE, or "main").
 */
import fs from 'fs';
import path from 'path';

import * as bcrypt from 'bcrypt-ts';

// World FIRST, and not alphabetically. Player and NetworkPlayer are a cycle - NetworkPlayer
// extends Player and Player names it back - and only World's module graph pulls them in the order
// that resolves. Importing Player first is a "Cannot access 'Player' before initialization" at
// startup. tools/sim/harness.ts has the same line at the top for the same reason.
import World from '#/engine/World.js';

import InvType from '#/cache/config/InvType.js';
import ObjType from '#/cache/config/ObjType.js';
import VarPlayerType from '#/cache/config/VarPlayerType.js';
import { db, toDbDate } from '#/db/query.js';
import Player, { getExpByLevel, getLevelByExp } from '#/engine/entity/Player.js';
import { PlayerLoading } from '#/engine/entity/PlayerLoading.js';
import { PLAYER_STAT_COUNT, PlayerStatMap, PlayerStatNameMap } from '#/engine/entity/PlayerStat.js';
import Packet from '#/io/Packet.js';
import { toBase37, toSafeName } from '#/util/JString.js';
import Environment from '#/util/Environment.js';

// ChatModePublic and friends are const enums, so they are erased at build time and cannot be
// indexed at runtime. The four names in save order, which is what the packed byte holds.
const PUBLIC_MODES = ['ON', 'FRIENDS', 'OFF', 'HIDE'];
const PRIVATE_MODES = ['ON', 'FRIENDS', 'OFF'];
const TRADE_MODES = ['ON', 'FRIENDS', 'OFF'];

type Args = { _: string[]; [flag: string]: string | boolean | string[] };

function parseArgs(argv: string[]): Args {
    const out: Args = { _: [] };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a.startsWith('--')) {
            const next = argv[i + 1];
            if (next === undefined || next.startsWith('--')) {
                out[a.slice(2)] = true;
            } else {
                out[a.slice(2)] = next;
                i++;
            }
        } else {
            out._.push(a);
        }
    }
    return out;
}

const args = parseArgs(process.argv.slice(2));
const command = args._[0];
const profile = typeof args.profile === 'string' ? args.profile : Environment.NODE_PROFILE;

// WealthEventType.DEATH. Not imported: WealthEventType is a const enum, which erases at compile
// time, and this file is run through tsx where that import would resolve to nothing at runtime.
const DEATH_EVENT_TYPE = 3;

// LoggerEventType.MODERATOR, not imported for the same reason.
const MODERATOR_EVENT_TYPE = 2;

function fail(msg: string): never {
    console.error(msg);
    process.exit(1);
}

function savePath(username: string) {
    return path.join('data/players', profile, `${username.toLowerCase()}.sav`);
}

// ---------------------------------------------------------------- the database half

/**
 * Every DB read goes through this. A missing db.sqlite, an unmigrated one, or a MySQL that is not
 * up are all the same situation for this tool: the save file is still readable and still editable,
 * and reporting "no account row" beats a stack trace that makes it look like the save is broken.
 */
async function tryDb<T>(what: string, fn: () => Promise<T>): Promise<T | null> {
    try {
        return await fn();
    } catch (err) {
        console.error(`  (database unavailable for ${what}: ${(err as Error).message})`);
        return null;
    }
}

async function getAccount(username: string) {
    return await tryDb('the account row', () => db.selectFrom('account').selectAll().where('username', '=', username.toLowerCase()).executeTakeFirst());
}

/** 0 or null means nobody has it. Anything else is the node id of the world it is logged into. */
async function isOnline(accountId: number) {
    const row = await tryDb('the login state', () => db.selectFrom('account_login').select('logged_in').where('account_id', '=', accountId).where('profile', '=', profile).executeTakeFirst());
    return row != null && row.logged_in !== 0;
}

// ---------------------------------------------------------------- the save-file half

let cacheLoaded = false;
function loadCache() {
    if (cacheLoaded) return;
    // Not World.start: that boots the map, the login and friend worker threads and the dev
    // watcher, none of which a file edit needs, and all of which would keep the process alive.
    // reload() is the part that fills ObjType, InvType, VarPlayerType and the rest.
    // NO CACHE IS A NORMAL STATE, not a broken install: data/pack is exactly what you delete
    // after pulling new content, and the server rebuilds it on its next start. Without it some
    // loaders throw on a missing .dat and others return QUIETLY, which would leave the tables
    // empty and this tool cheerfully reporting a bank full of obj_0 - and, far worse, writing
    // one. All three shapes of that end up as the same sentence.
    const noCache = 'data/pack is empty or missing - there is no cache here to read item, inventory and varp names from.\nBuild it first (npm run build), or start the server once, then run this again.';

    if (!fs.existsSync('data/pack')) {
        fail(noCache);
    }

    try {
        World.reload();
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
            fail(noCache);
        }
        throw err;
    }

    if (ObjType.count === 0 || InvType.count === 0) {
        fail(noCache);
    }

    cacheLoaded = true;
}

function readSave(username: string): Player {
    loadCache();
    const file = savePath(username);
    const raw = fs.existsSync(file) ? new Uint8Array(fs.readFileSync(file)) : new Uint8Array(0);
    return PlayerLoading.load(username.toLowerCase(), new Packet(raw), null);
}

/**
 * Write the character back, but only after proving the bytes load. A save that fails its own
 * checksum or overruns is indistinguishable from a deleted character to the login server, and by
 * then the original is gone.
 */
function writeSave(username: string, player: Player) {
    const file = savePath(username);
    const bytes = player.save();

    PlayerLoading.load(username.toLowerCase(), new Packet(new Uint8Array(bytes)), null);

    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (fs.existsSync(file)) {
        const backup = `${file}.bak-${new Date().toISOString().replace(/[:.]/g, '-')}`;
        fs.copyFileSync(file, backup);
        console.log(`  backed up ${path.basename(file)} -> ${path.basename(backup)}`);
    }
    fs.writeFileSync(file, bytes);
    console.log(`  wrote ${file} (${bytes.length} bytes)`);
}

// ---------------------------------------------------------------- one account, as JSON

type SaveJson = {
    position: { x: number; z: number; level: number };
    appearance: { body: number[]; colors: number[]; gender: number };
    runenergy: number;
    playtime: number;
    lastLoginTime: string;
    chat: { public: string; private: string; tradeDuel: string };
    afkZones: number[];
    lastAfkZone: number;
    stats: Record<string, { level: number; xp: number }>;
    vars: Record<string, number>;
    invs: Record<string, { slot: number; obj: string; count: number }[]>;
};

/**
 * THE ENGINE STORES EXPERIENCE IN TENTHS. levelExperience is the real table times ten, so a 99 is
 * 130,344,310 in a save file and 13,034,431 in the game - and Slayer and Smithing really do pay
 * fractions, which is what the tenth is for. Everything this tool prints or reads is the REAL
 * number, converted at this boundary only, so nobody has to know that. The round trip is exact:
 * stored/10 back through Math.round(x * 10) recovers the integer for any value a save can hold.
 */
function toRealXp(stored: number) {
    return stored / 10;
}

function toStoredXp(real: number) {
    return Math.round(real * 10);
}

function objName(id: number) {
    const type = ObjType.get(id);
    return type?.debugname ?? `obj_${id}`;
}

/**
 * The name objName would have printed, back to an id.
 *
 * A REAL NAME WINS, AND THE obj_<id> FALLBACK IS READ TOO - because objName WRITES it. The cache
 * holds 11518 objs and the content build names 9640 of them, sparsely: only 17 of the 201 ids
 * between 8900 and 9100 have a debugname at all. So a character holding one of the unnamed ones
 * exported as "obj_9013" and then could not be imported back, and the two halves of this tool
 * disagreed about its own file format.
 *
 * That broke every WRITE, not just the ones about items: set, give, rename and delete all go
 * through fullExport -> fullImport, so the whole save round-trips whatever single field is being
 * changed. "no such obj: obj_9013" is what `set schema account.staffmodlevel 3` answered on the
 * live server (2026-11-15) - a rank edit, refused by a bank slot it was not touching, which left
 * raw sqlite as the only way to change a rank.
 *
 * The id is still checked against the loaded table, so a hand-edited JSON naming obj_99999 is
 * refused rather than written into a save. ObjType.count being 0 is already impossible here:
 * loadCache fails on an empty cache rather than let this tool read names from nothing.
 */
function objId(name: string) {
    const id = ObjType.getId(name);
    if (id !== -1) return id;

    const unnamed = /^obj_(\d+)$/.exec(name);
    if (unnamed) {
        const fallback = parseInt(unnamed[1], 10);
        if (fallback >= 0 && fallback < ObjType.count) return fallback;
    }

    fail(`no such obj: ${name}`);
}

function saveToJson(player: Player): SaveJson {
    const stats: SaveJson['stats'] = {};
    for (let i = 0; i < PLAYER_STAT_COUNT; i++) {
        stats[PlayerStatNameMap.get(i) ?? `STAT_${i}`] = { level: player.levels[i], xp: toRealXp(player.stats[i]) };
    }

    // Only the varps that are actually held: a save writes the non-zero permanent ones and
    // nothing else, so a dump of all 4000 would be 4000 lines of zero.
    const vars: SaveJson['vars'] = {};
    for (let id = 0; id < player.vars.length; id++) {
        const varp = VarPlayerType.get(id);
        if (!varp || varp.scope !== VarPlayerType.SCOPE_PERM || player.vars[id] === 0) continue;
        vars[varp.debugname ?? `varp_${id}`] = player.vars[id];
    }

    const invs: SaveJson['invs'] = {};
    for (const [typeId, inventory] of player.invs) {
        const invType = InvType.get(typeId);
        if (!invType || invType.scope !== InvType.SCOPE_PERM) continue;
        const contents = [];
        for (let slot = 0; slot < inventory.capacity; slot++) {
            const obj = inventory.get(slot);
            if (obj) contents.push({ slot, obj: objName(obj.id), count: obj.count });
        }
        invs[invType.debugname ?? `inv_${typeId}`] = contents;
    }

    return {
        position: { x: player.x, z: player.z, level: player.level },
        appearance: { body: Array.from(player.body), colors: Array.from(player.colors), gender: player.gender },
        runenergy: player.runenergy,
        playtime: player.playtime,
        // A bigint is not JSON, and this one is a millisecond timestamp that would lose precision
        // as a double. It goes out and comes back as a string.
        lastLoginTime: player.lastLoginTime.toString(),
        chat: {
            public: PUBLIC_MODES[player.publicChat] ?? String(player.publicChat),
            private: PRIVATE_MODES[player.privateChat] ?? String(player.privateChat),
            tradeDuel: TRADE_MODES[player.tradeDuel] ?? String(player.tradeDuel)
        },
        afkZones: Array.from(player.afkZones),
        lastAfkZone: player.lastAfkZone,
        stats,
        vars,
        invs
    };
}

function jsonToSave(player: Player, json: SaveJson) {
    if (json.position) {
        player.x = json.position.x;
        player.z = json.position.z;
        player.level = json.position.level;
    }
    if (json.appearance) {
        for (let i = 0; i < 7; i++) player.body[i] = json.appearance.body[i];
        for (let i = 0; i < 5; i++) player.colors[i] = json.appearance.colors[i];
        player.gender = json.appearance.gender;
    }
    if (json.runenergy !== undefined) player.runenergy = json.runenergy;
    if (json.playtime !== undefined) player.playtime = json.playtime;
    if (json.lastLoginTime !== undefined) player.lastLoginTime = BigInt(json.lastLoginTime);
    if (json.chat) {
        player.publicChat = modeIndex(PUBLIC_MODES, json.chat.public, 'public chat');
        player.privateChat = modeIndex(PRIVATE_MODES, json.chat.private, 'private chat');
        player.tradeDuel = modeIndex(TRADE_MODES, json.chat.tradeDuel, 'trade/duel');
    }
    if (json.afkZones) {
        for (let i = 0; i < player.afkZones.length; i++) player.afkZones[i] = json.afkZones[i] ?? 0;
    }
    if (json.lastAfkZone !== undefined) player.lastAfkZone = json.lastAfkZone;

    if (json.stats) {
        for (const [name, value] of Object.entries(json.stats)) {
            const id = PlayerStatMap.get(name.toUpperCase());
            if (id === undefined) fail(`no such stat: ${name}`);
            setStat(player, id, value.level, toStoredXp(value.xp));
        }
    }

    if (json.vars) {
        // A varp absent from the JSON is back to ITS DEFAULT, not left alone - that is the only
        // way to clear one from a dump. The default is not always zero: Player's constructor
        // starts every non-int varp at -1, so this takes the defaults from a fresh character
        // rather than restating the rule and drifting from it.
        const fresh = PlayerLoading.load(player.username, new Packet(new Uint8Array(0)), null);
        player.vars.set(fresh.vars);
        for (const [name, value] of Object.entries(json.vars)) {
            const id = VarPlayerType.getId(name);
            if (id === -1) fail(`no such varp: ${name}`);
            player.vars[id] = value;
        }
    }

    if (json.invs) {
        for (const [name, contents] of Object.entries(json.invs)) {
            const typeId = InvType.getId(name);
            if (typeId === -1) fail(`no such inv: ${name}`);
            const inventory = player.getInventory(typeId);
            if (!inventory) fail(`inv ${name} is not one this player holds`);
            for (let slot = 0; slot < inventory.capacity; slot++) inventory.set(slot, null);
            for (const item of contents) {
                if (item.slot >= inventory.capacity) fail(`${name} slot ${item.slot} is past its ${inventory.capacity} slots`);
                inventory.set(item.slot, { id: objId(item.obj), count: item.count });
            }
        }
    }
}

function modeIndex(modes: string[], value: string, what: string) {
    const i = modes.indexOf(String(value).toUpperCase());
    if (i === -1) fail(`${what} must be one of ${modes.join(', ')} - got ${value}`);
    return i;
}

/**
 * Levels and experience are two numbers that have to agree: baseLevels is what the experience
 * says, and levels is the current (possibly boosted or drained) one. Setting a level alone would
 * leave the player's real level to be recomputed from unchanged experience at the next login.
 */
function setStat(player: Player, id: number, level: number, xp?: number) {
    const exp = xp ?? getExpByLevel(level);
    player.stats[id] = exp;
    player.baseLevels[id] = getLevelByExp(exp);
    player.levels[id] = level;
}

type AccountRow = NonNullable<Awaited<ReturnType<typeof getAccount>>>;

/** Dates come out of sqlite as strings and out of MySQL as Dates; ISO is the one both read back. */
function accountToJson(account: AccountRow | null | undefined) {
    if (!account) {
        return null;
    }
    return {
        id: account.id,
        username: account.username,
        members: !!account.members,
        staffmodlevel: account.staffmodlevel,
        muted_until: account.muted_until ? new Date(account.muted_until).toISOString() : null,
        banned_until: account.banned_until ? new Date(account.banned_until).toISOString() : null,
        registration_ip: account.registration_ip,
        registration_date: account.registration_date ? new Date(account.registration_date).toISOString() : null
    };
}

/**
 * Everything an account is, as JSON.
 *
 * `save: false` LEAVES THE CHARACTER OUT, and `set account.<field>` asks for that. A database
 * column has nothing to do with the save file, but every write here went through
 * fullExport -> fullImport, so changing a rank read the whole character out through names and
 * wrote the whole character back. On 15 November `set schema account.staffmodlevel 3` was refused
 * by a bank slot it was not touching - an obj with no debugname, exported as obj_9013 and not
 * recognised on the way in - and raw sqlite was the only way left to change a rank.
 *
 * objId reads that fallback now, so that exact failure is gone. This is the other half: a rank
 * edit should not be able to be stopped by the save at all, nor rewrite it, nor leave a .bak
 * behind. The blast radius of a column change should be the column.
 */
async function fullExport(username: string, opts: { save?: boolean } = {}) {
    const player = opts.save === false ? null : readSave(username);
    const account = await getAccount(username);
    const friends = account ? await tryDb('friends', () => db.selectFrom('friendlist').select('friend_username').where('account_id', '=', account.id).where('profile', '=', profile).execute()) : null;
    const ignores = account ? await tryDb('ignores', () => db.selectFrom('ignorelist').select('value').where('account_id', '=', account.id).where('profile', '=', profile).execute()) : null;

    return {
        username: username.toLowerCase(),
        profile,
        account: accountToJson(account),
        friends: friends ? friends.map(f => f.friend_username) : [],
        ignores: ignores ? ignores.map(i => i.value) : [],
        save: player ? saveToJson(player) : null
    };
}

type Export = Awaited<ReturnType<typeof fullExport>>;

async function fullImport(username: string, data: Export, force: boolean) {
    const account = await getAccount(username);
    if (account && (await isOnline(account.id)) && !force) {
        fail(`${username} is logged in. The server holds the character in memory and rewrites the save at logout, so this edit would be thrown away.\nLog them out first, or pass --force if the server crashed and left them marked online.`);
    }

    if (data.save) {
        const player = readSave(username);
        jsonToSave(player, data.save);
        writeSave(username, player);
    }

    if (!account) {
        console.log('  no account row in the database - the save file is all that changed');
        return;
    }

    if (data.account) {
        await tryDb('the account row', async () => {
            await db
                .updateTable('account')
                .set({
                    // sqlite has no boolean: the column is an integer and Kysely types it as one.
                    members: data.account!.members ? 1 : 0,
                    staffmodlevel: data.account!.staffmodlevel,
                    muted_until: data.account!.muted_until ? toDbDate(data.account!.muted_until) : null,
                    banned_until: data.account!.banned_until ? toDbDate(data.account!.banned_until) : null
                })
                .where('id', '=', account.id)
                .execute();
            console.log('  updated the account row');
            return true;
        });
    }

    // Friends and ignores are the whole list, replaced: an entry dropped from the JSON is an
    // entry the player no longer has, which is the only way to remove one from here.
    if (data.friends) {
        await tryDb('friends', async () => {
            await db.deleteFrom('friendlist').where('account_id', '=', account.id).where('profile', '=', profile).execute();
            if (data.friends.length) {
                await db
                    .insertInto('friendlist')
                    .values(data.friends.map(name => ({ account_id: account.id, profile, friend_username: name })))
                    .execute();
            }
            console.log(`  friends: ${data.friends.length}`);
            return true;
        });
    }

    if (data.ignores) {
        await tryDb('ignores', async () => {
            await db.deleteFrom('ignorelist').where('account_id', '=', account.id).where('profile', '=', profile).execute();
            if (data.ignores.length) {
                await db
                    .insertInto('ignorelist')
                    .values(data.ignores.map(value => ({ account_id: account.id, profile, value })))
                    .execute();
            }
            console.log(`  ignores: ${data.ignores.length}`);
            return true;
        });
    }
}

// ---------------------------------------------------------------- dotted-path edits

/** `save.stats.ATTACK`, `account.members`, `save.vars.<name>`, and `save.stats.*` for all of them. */
function applyPath(data: Export, dotted: string, raw: string) {
    const parts = dotted.split('.');

    // Only reachable through a caller that asked for no save and then named one; say which rather
    // than failing on a null field three lines down.
    if (parts[0] === 'save' && !data.save) {
        fail(`the character was not read, so ${dotted} cannot be set here`);
    }

    if (parts[0] === 'save' && parts[1] === 'stats') {
        const level = parseInt(raw, 10);
        if (!Number.isInteger(level) || level < 1 || level > 99) fail('a stat level is 1-99');
        const which = parts[2];
        const field = parts[3]; // optional: level | xp
        const stats = data.save!.stats;
        const names = which === '*' ? Object.keys(stats) : [which.toUpperCase()];
        for (const name of names) {
            if (!(name in stats)) fail(`no such stat: ${name}`);
            if (field === 'xp') {
                stats[name].xp = Number(raw);
                stats[name].level = getLevelByExp(toStoredXp(Number(raw)));
            } else {
                stats[name] = { level, xp: toRealXp(getExpByLevel(level)) };
            }
        }
        return;
    }

    // A VARP THE PLAYER DOES NOT HOLD YET IS STILL A VARP. saveToJson writes only the non-zero
    // permanent ones, so the varp you most often want to set is the one that is missing: a player
    // who has never opened the XP rate chooser has xp_rate 0, it is left out of the dump, and
    // `set koda save.vars.xp_rate 10` answered "no such field: save.vars.xp_rate" - which reads
    // as "that varp does not exist" rather than "they have not got one". The way round it was to
    // export the whole character to a file, add one line and import it back.
    //
    // The name is checked against the cache, not against what the player happens to hold, and it
    // has to be a PERM varp: a temp one is not written to the save at all, so setting it here
    // would report success and change nothing.
    if (parts[0] === 'save' && parts[1] === 'vars' && parts.length === 3 && !(parts[2] in data.save!.vars)) {
        const name = parts[2];
        const id = VarPlayerType.getId(name);
        if (id === -1) fail(`no such varp: ${name}`);
        if (VarPlayerType.get(id)?.scope !== VarPlayerType.SCOPE_PERM) {
            fail(`${name} is a temporary varp - it is not kept in the save, so setting it here would do nothing`);
        }
        const value = Number(raw);
        if (!Number.isInteger(value)) fail(`a varp holds a whole number, not ${raw}`);
        data.save!.vars[name] = value;
        return;
    }

    // Everything else is an ordinary field: walk to its parent and coerce to the type already
    // sitting there, so `true` lands as a boolean and `3222` as a number without being told.
    let node: Record<string, unknown> = data as unknown as Record<string, unknown>;
    for (let i = 0; i < parts.length - 1; i++) {
        const next = node[parts[i]];
        if (next === null || typeof next !== 'object') fail(`${parts.slice(0, i + 1).join('.')} is not something with fields`);
        node = next as Record<string, unknown>;
    }
    const leaf = parts[parts.length - 1];
    const existing = node[leaf];
    if (existing === undefined && !(leaf in node)) fail(`no such field: ${dotted}`);

    if (raw === 'null') node[leaf] = null;
    else if (typeof existing === 'boolean') node[leaf] = raw === 'true' || raw === '1' || raw === 'yes';
    else if (typeof existing === 'number') node[leaf] = Number(raw);
    else node[leaf] = raw;
}

// ---------------------------------------------------------------- commands

function listSaves() {
    const dir = path.join('data/players', profile);
    if (!fs.existsSync(dir)) return [];
    return fs
        .readdirSync(dir)
        .filter(f => f.endsWith('.sav'))
        .map(f => f.slice(0, -4))
        .sort();
}

async function cmdList() {
    const saves = listSaves();
    const accounts = (await tryDb('the account table', () => db.selectFrom('account').selectAll().execute())) ?? [];
    const byName = new Map(accounts.map(a => [a.username, a]));

    console.log(`profile ${profile}: ${saves.length} save${saves.length === 1 ? '' : 's'}, ${accounts.length} account row${accounts.length === 1 ? '' : 's'}`);
    const names = [...new Set([...saves, ...accounts.map(a => a.username)])].sort();
    for (const name of names) {
        const account = byName.get(name);
        const flags = [];
        if (!saves.includes(name)) flags.push('no save');
        if (!account) flags.push('no account row');
        if (account?.members) flags.push('members');
        if (account?.staffmodlevel) flags.push(`modlevel ${account.staffmodlevel}`);
        if (account?.banned_until && new Date(account.banned_until) > new Date()) flags.push('BANNED');
        if (account?.muted_until && new Date(account.muted_until) > new Date()) flags.push('MUTED');
        console.log(`  ${name.padEnd(14)} ${flags.join(', ')}`);
    }
}

async function cmdShow(username: string) {
    const data = await fullExport(username);
    // show and give both ask for the character, so it is there.
    const s = data.save!;

    console.log(`${data.username}  (profile ${data.profile})`);
    if (!fs.existsSync(savePath(username))) console.log('  NO SAVE FILE - everything below is a fresh character');

    if (data.account) {
        const a = data.account;
        console.log(`  account #${a.id}  members=${a.members}  modlevel=${a.staffmodlevel}`);
        console.log(`    registered ${a.registration_date ?? '?'} from ${a.registration_ip ?? '?'}`);
        console.log(`    banned_until=${a.banned_until ?? 'never'}  muted_until=${a.muted_until ?? 'never'}`);
        console.log(`    online=${await isOnline(a.id)}`);
    } else {
        console.log('  no account row in the database');
    }

    console.log(`  at ${s.position.x}, ${s.position.z}, level ${s.position.level}   runenergy ${s.runenergy}   playtime ${s.playtime} ticks`);
    console.log(`  chat: public=${s.chat.public} private=${s.chat.private} trade=${s.chat.tradeDuel}`);

    const baseLevel = (xp: number) => getLevelByExp(toStoredXp(xp));
    const total = Object.values(s.stats).reduce((n, v) => n + baseLevel(v.xp), 0);
    console.log(`  stats (total level ${total}):`);
    for (const [name, v] of Object.entries(s.stats)) {
        const base = baseLevel(v.xp);
        console.log(`    ${name.toLowerCase().padEnd(13)} ${String(base).padStart(2)}  ${String(v.xp).padStart(10)} xp${v.level !== base ? `  (currently ${v.level})` : ''}`);
    }

    for (const [name, contents] of Object.entries(s.invs)) {
        if (!contents.length) continue;
        console.log(`  ${name} (${contents.length} slot${contents.length === 1 ? '' : 's'} used):`);
        for (const item of contents) console.log(`    ${String(item.slot).padStart(3)}  ${item.obj} x${item.count}`);
    }

    const vars = Object.entries(s.vars);
    console.log(`  varps held: ${vars.length}`);
    for (const [name, value] of vars) console.log(`    ${name} = ${value}`);

    console.log(`  friends (${data.friends.length}): ${data.friends.join(', ') || '-'}`);
    console.log(`  ignores (${data.ignores.length}): ${data.ignores.join(', ') || '-'}`);

    if (data.account) await showLogs(data.account.id);
}

/** The record tables. Read-only here - this is what happened, not what the account is. */
async function showLogs(accountId: number) {
    const sessions = await tryDb('sessions', () => db.selectFrom('session').select(['uuid', 'timestamp', 'world', 'ip']).where('account_id', '=', accountId).where('profile', '=', profile).orderBy('timestamp', 'desc').limit(5).execute());
    if (sessions?.length) {
        console.log(`  last ${sessions.length} session${sessions.length === 1 ? '' : 's'}:`);
        for (const s of sessions) console.log(`    ${new Date(s.timestamp).toISOString()}  world ${s.world}  ${s.ip ?? '?'}`);

        const uuids = sessions.map(s => s.uuid);
        const wealth = await tryDb('wealth events', () => db.selectFrom('session_wealth').select(['timestamp', 'event_type', 'account_items', 'account_value']).where('session_uuid', 'in', uuids).orderBy('timestamp', 'desc').limit(10).execute());
        if (wealth?.length) {
            console.log(`  last ${wealth.length} wealth event${wealth.length === 1 ? '' : 's'}:`);
            for (const w of wealth) console.log(`    ${new Date(w.timestamp).toISOString()}  type ${w.event_type}  ${w.account_value}gp  ${w.account_items}`);
        }

        const reports = await tryDb('reports', () => db.selectFrom('report').select(['timestamp', 'offender', 'reason']).where('session_uuid', 'in', uuids).orderBy('timestamp', 'desc').limit(5).execute());
        if (reports?.length) {
            console.log(`  reports made (${reports.length}):`);
            for (const r of reports) console.log(`    ${new Date(r.timestamp).toISOString()}  ${r.offender}  reason ${r.reason}`);
        }
    }
}

async function cmdGive(username: string) {
    const obj = args._[2];
    const count = args._[3] ? parseInt(args._[3], 10) : 1;
    const invName = typeof args.inv === 'string' ? args.inv : 'inv';
    if (!obj) fail('usage: give <user> <obj> [count] [--inv inv|bank]');

    const data = await fullExport(username);
    loadCache();
    const id = objId(obj);
    const stackable = ObjType.get(id).stackable;
    const contents = (data.save!.invs[invName] ??= []);

    const typeId = InvType.getId(invName);
    if (typeId === -1) fail(`no such inv: ${invName}`);
    const capacity = InvType.get(typeId).size;

    const existing = stackable ? contents.find(i => i.obj === obj) : undefined;
    if (existing) {
        existing.count += count;
    } else {
        const used = new Set(contents.map(i => i.slot));
        // Unstackables take a slot each, which is the difference between "give 28 sharks" working
        // and it silently becoming one slot holding 28.
        const needed = stackable ? 1 : count;
        for (let n = 0; n < needed; n++) {
            let slot = 0;
            while (used.has(slot)) slot++;
            if (slot >= capacity) fail(`${invName} has only ${capacity} slots and they are full`);
            used.add(slot);
            contents.push({ slot, obj, count: stackable ? count : 1 });
        }
    }

    contents.sort((a, b) => a.slot - b.slot);
    await fullImport(username, data, args.force === true);
    console.log(`  gave ${count} x ${obj} to ${invName}`);
}

async function cmdRename(from: string, to: string) {
    const oldName = toSafeName(from);
    const newName = toSafeName(to);
    // toBase37 is the real test, NOT the length of what comes back. A name with nothing usable in it
    // encodes to 0, and fromBase37(0) is the string "invalid_name" - twelve perfectly ordinary
    // characters, so a length check passes and the account is quietly renamed to that. Caught by
    // trying to rename an account to "!!!" and watching it succeed.
    if (toBase37(to) === 0n) fail(`"${to}" is not a name: the game keeps letters, digits, spaces and underscores, and that leaves nothing.`);
    if (toBase37(from) === 0n) fail(`"${from}" is not a name.`);
    // Silently keeping the first 12 characters of a longer name would rename somebody to something
    // they did not ask for, so say so instead.
    if (newName !== to.trim().toLowerCase().replaceAll(' ', '_')) {
        console.log(`  note: "${to}" is stored as "${newName}" - that is the name the game can hold`);
    }
    if (oldName === newName) fail(`${oldName} is already called that.`);

    const account = await getAccount(oldName);
    if (!account) fail(`no account row for ${oldName}.`);
    if ((await isOnline(account.id)) && args.force !== true) {
        fail(`${oldName} is logged in. The server holds the character in memory and rewrites the save at logout, so this rename would be undone.
Log them out first, or pass --force if the server crashed and left them marked online.`);
    }
    if (await getAccount(newName)) fail(`${newName} is taken.`);

    const oldFile = savePath(oldName);
    const newFile = savePath(newName);
    if (fs.existsSync(newFile)) fail(`${newFile} already exists, even though no account row holds that name. Move it aside first.`);
    if (!fs.existsSync(oldFile)) console.log(`  note: ${oldFile} does not exist - renaming the account row only`);

    // THE DATABASE FIRST, because it is the half that can be rolled back. If the file move fails
    // after it, the name is reported below and can be moved by hand; if the file moved first and the
    // update failed, the server would look for a save that is no longer there.
    await db.updateTable('account').set({ username: newName }).where('id', '=', account.id).execute();

    // FRIENDS AND IGNORES ARE STORED BY NAME, not by account id (prisma schema: friendlist
    // .friend_username, ignorelist.value), so everyone who has this player on either list points at
    // the old name and would silently lose them. This is the part a rename is really made of.
    const friends = await db.updateTable('friendlist').set({ friend_username: newName }).where('friend_username', '=', oldName).where('profile', '=', profile).executeTakeFirst();
    const ignores = await db.updateTable('ignorelist').set({ value: newName }).where('value', '=', oldName).where('profile', '=', profile).executeTakeFirst();

    if (fs.existsSync(oldFile)) {
        fs.copyFileSync(oldFile, `${oldFile}.bak-${new Date().toISOString().replace(/[:.]/g, '-')}`);
        fs.renameSync(oldFile, newFile);
    }

    console.log(`  ${oldName} -> ${newName}`);
    console.log(`  save   ${fs.existsSync(newFile) ? newFile : '(none)'}`);
    console.log(`  friend lists updated: ${Number(friends?.numUpdatedRows ?? 0)}`);
    console.log(`  ignore lists updated: ${Number(ignores?.numUpdatedRows ?? 0)}`);
    console.log('  hiscores follow on their next logout - they are recomputed from the save, not stored by name.');
}

/**
 * Remove an account entirely, so its name is free for somebody else.
 *
 * DELETING THE .sav IS NOT ENOUGH, which is the trap this exists to close: the account row still
 * holds the username, so the name stays taken - `rename` refuses it, and the old owner can still log
 * in and be handed a brand new character on the same name. Both halves have to go.
 *
 * It takes a full JSON export first, always, without being asked, and moves the save aside rather
 * than unlinking it. A rename can be undone by running it backwards; this cannot.
 *
 * BE CLEAR ABOUT WHAT THAT BACKUP IS, because it is not a full undo: `import` writes the SAVE back,
 * and it does not recreate the account row - there is no password in the export to recreate it with,
 * deliberately. Putting a deleted player back means restoring the character from the JSON (or moving
 * the .deleted- file back) and then making the login again with `password`.
 *
 * Other people's lists are cleaned too. friendlist.friend_username and ignorelist.value hold a NAME,
 * so rows naming this account would otherwise survive it - and if the name is then given to someone
 * else, which is exactly why a name gets freed, those strangers would find the new owner sitting on
 * their friends list.
 */
async function cmdDelete(username: string) {
    const name = toSafeName(username);
    const account = await getAccount(name);
    const file = savePath(name);
    if (!account && !fs.existsSync(file)) fail(`${name} has neither an account row nor a save file - nothing to remove.`);
    if (account && (await isOnline(account.id)) && args.force !== true) {
        fail(`${name} is logged in. Log them out first, or pass --force if the server crashed and left them marked online.`);
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dump = typeof args.out === 'string' ? args.out : `${name}.deleted-${stamp}.json`;
    fs.writeFileSync(dump, JSON.stringify(await fullExport(name), null, 4));
    console.log(`  backup   ${dump}`);

    if (fs.existsSync(file)) {
        const aside = `${file}.deleted-${stamp}`;
        fs.renameSync(file, aside);
        console.log(`  save     moved to ${aside}`);
    } else {
        console.log('  save     (none)');
    }

    let theirs = 0;
    let others = 0;
    if (account) {
        for (const table of ['friendlist', 'ignorelist'] as const) {
            const r = await db.deleteFrom(table).where('account_id', '=', account.id).where('profile', '=', profile).executeTakeFirst();
            theirs += Number(r?.numDeletedRows ?? 0);
        }
        const f = await db.deleteFrom('friendlist').where('friend_username', '=', name).where('profile', '=', profile).executeTakeFirst();
        const i = await db.deleteFrom('ignorelist').where('value', '=', name).where('profile', '=', profile).executeTakeFirst();
        others = Number(f?.numDeletedRows ?? 0) + Number(i?.numDeletedRows ?? 0);
        await db.deleteFrom('account_login').where('account_id', '=', account.id).where('profile', '=', profile).execute();
        await db.deleteFrom('account').where('id', '=', account.id).execute();
        console.log(`  account  row #${account.id} removed`);
    } else {
        console.log('  account  (no row)');
    }
    console.log(`  their own friend/ignore entries removed: ${theirs}`);
    console.log(`  entries OTHER players held naming them:  ${others}`);
    console.log(`  "${name}" is now free.`);
    console.log('  to put them back: import the JSON (or move the .deleted- save back), then set a password - the account row is not in the backup.');
}

/**
 * Clear a stale "logged in" flag, so somebody the login server believes is already playing can get
 * back in.
 *
 * WHAT GOES WRONG. account_login holds one row per account per profile, and logged_in is the NODE
 * ID of the world it is on rather than a yes or no - 0 is free. A session that ends without a
 * clean logout (a crash, a socket dropped mid-login, a world killed rather than stopped) leaves
 * that number set, and every later attempt is turned away by the LOGIN SERVER with "already logged
 * in" before the world ever sees it.
 *
 * ::kick CANNOT HELP, and it is worth knowing why before reaching for it: kick acts on a player in
 * the world, and there is no such player - that is the whole problem. The world is empty of them
 * and the login server will not let them in.
 *
 * A RESTART IS THE OTHER FIX, and usually the better one: World startup clears every row carrying
 * its own node id, so one restart frees everybody stuck on that world at once. This is for when a
 * restart is not wanted - a live world with people on it - or when the stale row names a world
 * that is not coming back, such as a dev world from deploy.sh --dev, whose node id the live
 * world's startup never touches.
 *
 * IT CANNOT PUT TWO SESSIONS ON ONE WORLD. World.processLogins scans its own player list for the
 * same username and refuses with response 5 whatever this table says, so the world is the real
 * guard against a double login. What this flag alone guards is logging into a DIFFERENT world
 * while still on one - so on a multi-world setup, clear it only when you know they are not on the
 * other one.
 */
async function cmdLogout(username: string) {
    const account = await getAccount(username);
    if (!account) fail(`no account row for ${username} - the login flag lives in the database, not the save file`);

    const rows = await tryDb('the login state', () => db.selectFrom('account_login').select(['profile', 'logged_in', 'login_time']).where('account_id', '=', account.id).execute());
    if (rows === null) return;

    // EVERY PROFILE, not just the one being acted on. The row that is stuck is not always the
    // live world's: an administrator who was last on a dev world is stuck on THAT profile, and a
    // command that silently reported "nothing to do" for main would send them hunting.
    console.log(`  ${username} (account #${account.id})`);
    if (rows.length === 0) {
        console.log('    no account_login rows at all - nothing has ever marked them online');
    }
    for (const row of rows) {
        const where = row.logged_in === 0 ? 'free' : `world ${row.logged_in}`;
        const when = row.login_time ? `, since ${row.login_time}` : '';
        console.log(`    profile ${row.profile}: ${where}${when}${row.profile === profile ? '   <- this one' : ''}`);
    }

    const mine = rows.find(row => row.profile === profile);
    if (!mine || mine.logged_in === 0) {
        console.log(`  profile ${profile} is already free, so nothing was changed.`);
        const elsewhere = rows.filter(row => row.logged_in !== 0 && row.profile !== profile);
        if (elsewhere.length) {
            console.log(`  but ${elsewhere.map(row => row.profile).join(', ')} still says online - rerun with --profile ${elsewhere[0].profile} to clear that.`);
        }
        return;
    }

    const ok = await tryDb('the login flag', async () => {
        await db.updateTable('account_login').set({ logged_in: 0, login_time: null }).where('account_id', '=', account.id).where('profile', '=', profile).execute();
        return true;
    });
    if (!ok) return;

    console.log(`  cleared: ${username} was marked on world ${mine.logged_in} for profile ${profile}, now free.`);
    console.log('  they can log in again straight away - the login server reads this row fresh on every attempt.');
    console.log('  if they were REALLY still in the world, nothing is broken: the world refuses a second');
    console.log('  session on the same name by itself, so they would simply be told to try again.');
}

async function cmdPassword(username: string) {
    const plain = args._[2];
    if (!plain) fail('usage: password <user> <newpassword>');
    const account = await getAccount(username);
    if (!account) fail(`no account row for ${username} - a password lives in the database, not the save file`);

    // toLowerCase mirrors LoginServer, which hashes and compares the lowercased password. A hash
    // made from the original casing would never match a login.
    const hash = bcrypt.hashSync(plain.toLowerCase(), 10);
    const ok = await tryDb('the password', async () => {
        await db.updateTable('account').set({ password: hash }).where('id', '=', account.id).execute();
        return true;
    });
    if (ok) console.log(`  password set for ${username}`);
}

/**
 * The wealth log, read by time rather than through the account.
 *
 * session_wealth names a player only by session_uuid, and the uuid -> account mapping lives in
 * the `session` table, which only LoginServer writes. A world running without it still logs every
 * death - World gives each player a session from their client uuid regardless - but those rows
 * cannot be attributed, which is why `show` lists nothing for them. Going by time instead still
 * answers the question that actually gets asked, which is "X died about an hour ago, what did
 * they drop".
 */
async function cmdDeaths() {
    // parseArgs hands back every flag as a string, so this has to convert rather than typeof-test
    // for a number - a test that is always false, and a --days that silently does nothing.
    let days = 7;
    if (typeof args.days === 'string') {
        days = parseInt(args.days, 10);
        if (!Number.isFinite(days) || days < 1) fail('--days takes a whole number of days, 1 or more');
    }
    const since = toDbDate(Date.now() - days * 86400000);
    const username = args._[1];

    let uuids: string[] | null = null;
    if (username) {
        const account = await getAccount(username);
        if (!account) fail(`no account called ${username}`);
        const sessions = await tryDb('sessions', () => db.selectFrom('session').select('uuid').where('account_id', '=', account!.id).where('profile', '=', profile).execute());
        uuids = sessions?.map(x => x.uuid) ?? [];
        if (!uuids.length) {
            console.log(`  no session rows for ${username} - the login server is not recording them, so deaths cannot be tied to an account.`);
            console.log('  showing every death in the window instead; match it by the time they went down.');
            uuids = null;
        }
    }

    let query = db.selectFrom('session_wealth').select(['timestamp', 'session_uuid', 'coord', 'account_items', 'account_value']).where('event_type', '=', DEATH_EVENT_TYPE).where('timestamp', '>=', since).orderBy('timestamp', 'desc').limit(40);
    if (uuids) query = query.where('session_uuid', 'in', uuids);

    const rows = await tryDb('the wealth log', () => query.execute());
    if (rows === null) return;

    if (!rows.length) {
        console.log(`  no deaths logged in the last ${days} day${days === 1 ? '' : 's'}.`);
        console.log('  if that is a surprise: LOGGER_SERVER must be true AND `npm run logger` must be running.');
        return;
    }

    for (const row of rows) {
        const level = (row.coord >> 28) & 0x3;
        const x = (row.coord >> 14) & 0x3fff;
        const z = row.coord & 0x3fff;

        console.log(`  ${new Date(row.timestamp).toISOString()}  at ${x}, ${z}, level ${level}  worth ${row.account_value}gp  (session ${row.session_uuid})`);

        // Written by the engine as JSON; a row from a future version that is not is still worth
        // printing raw rather than throwing away the one record of what somebody lost.
        let items: { name: string | null; id: number | undefined; count: number }[];
        try {
            items = JSON.parse(row.account_items);
        } catch {
            console.log(`      ${row.account_items}`);
            continue;
        }

        for (const item of items) {
            console.log(`      ${String(item.count).padStart(8)}  ${item.name ?? `id ${item.id}`}`);
        }
    }

    console.log('');
    console.log('  these are the items that DROPPED. Anything protected on death stayed on the character,');
    console.log('  and anything they ran back for is already theirs again - check against `show` before giving.');
}

/**
 * What staff have been typing.
 *
 * ClientCheatHandler writes one session_log row per command - the event is literally
 * "Ran cheat " plus what was typed - for anybody at staffModLevel 2 or above, stamped with the
 * time and the coord they stood on. This reads it back.
 *
 * NOTHING IS RECORDED UNLESS LOGGER_SERVER IS TRUE, and it defaults to false. Every log type goes
 * through LoggerThread, which drops the message on the floor when that flag is off - so an empty
 * result is ambiguous in exactly the way an audit must not be. This tells the two apart: if
 * session_log has no rows AT ALL then the logger was never on, and it says so instead of
 * reporting a clean bill of health nobody has earned.
 *
 * Names come from the `session` table, which only LoginServer writes. Without it the commands are
 * still all here, just as session uuids - the same fallback `deaths` makes, and for the same
 * reason: the question is usually "what was run around then", and a time still answers it.
 *
 * WHAT IS NOT IN HERE. Helpers are not staff and are not logged - the one command the rank grants
 * is ::sz, the staff zone teleport. ::home, ::yell, ::bug, ::discord, ::changepassword,
 * ::forgetlogins, ::milestones and ::commands are handled before the logging line and are not
 * recorded either; none of them is a staff power. Anything a staff member did through ordinary
 * play - trading, dropping, picking up - is the wealth log, not this: see `deaths` and `show`.
 */
async function cmdAudit() {
    // parseArgs hands every flag back as a string, so these convert rather than typeof-test for a
    // number, which is always false and silently ignores the flag.
    let days = 7;
    if (typeof args.days === 'string') {
        days = parseInt(args.days, 10);
        if (!Number.isFinite(days) || days < 1) fail('--days takes a whole number of days, 1 or more');
    }
    let limit = 50;
    if (typeof args.limit === 'string') {
        limit = parseInt(args.limit, 10);
        if (!Number.isFinite(limit) || limit < 1) fail('--limit takes a whole number, 1 or more');
    }
    const since = toDbDate(Date.now() - days * 86400000);
    const username = args._[1];
    const everything = args.all === true;

    let uuids: string[] | null = null;
    if (username) {
        const account = await getAccount(username);
        if (!account) fail(`no account called ${username}`);
        const sessions = await tryDb('sessions', () => db.selectFrom('session').select('uuid').where('account_id', '=', account!.id).where('profile', '=', profile).execute());
        if (sessions === null) return;
        uuids = sessions.map(x => x.uuid);
        if (!uuids.length) {
            console.log(`  no session rows for ${username} - the login server is not recording them, so commands cannot be tied to an account.`);
            console.log('  showing every staff command in the window instead; match it by the time.');
            uuids = null;
        }
    }

    let query = db.selectFrom('session_log').select(['timestamp', 'session_uuid', 'coord', 'event']).where('event_type', '=', MODERATOR_EVENT_TYPE).where('timestamp', '>=', since).orderBy('timestamp', 'desc').limit(limit);
    if (!everything) query = query.where('event', 'like', 'Ran cheat%');
    if (uuids) query = query.where('session_uuid', 'in', uuids);

    const rows = await tryDb('the moderator log', () => query.execute());
    if (rows === null) return;

    if (!rows.length) {
        // The distinction that matters. "No commands" and "no logging" look identical from here,
        // and only one of them is good news.
        const any = await tryDb('the moderator log', () => db.selectFrom('session_log').select('id').limit(1).execute());
        if (any !== null && !any.length) {
            console.log('  session_log is EMPTY - nothing has ever been recorded on this world, so this says');
            console.log('  nothing about whether staff have run anything. Turn the logger on:');
            console.log('');
            console.log('    LOGGER_SERVER=true in .env, AND a logger process running (npm run logger,');
            console.log('    or EASY_STARTUP=true to run one inside the world).');
            console.log('');
            console.log('  the world prints a warning about this at startup. Nothing is recorded retroactively.');
            return;
        }
        console.log(`  no staff commands logged in the last ${days} day${days === 1 ? '' : 's'}.`);
        console.log('  the log has rows, so the logger is working - this window is simply quiet.');
        return;
    }

    // uuid -> name, in two steps rather than a join: the file does its reads this way throughout,
    // and a missing session row has to degrade to the uuid rather than drop the command.
    const names = new Map<string, string>();
    const seen = [...new Set(rows.map(r => r.session_uuid))];
    const sessions = await tryDb('sessions', () => db.selectFrom('session').select(['uuid', 'account_id']).where('uuid', 'in', seen).execute());
    if (sessions && sessions.length) {
        const ids = [...new Set(sessions.map(s => s.account_id))];
        const accounts = await tryDb('accounts', () => db.selectFrom('account').select(['id', 'username']).where('id', 'in', ids).execute());
        const byId = new Map((accounts ?? []).map(a => [a.id, a.username]));
        for (const session of sessions) {
            const name = byId.get(session.account_id);
            if (name) names.set(session.uuid, name);
        }
    }

    if (args.summary === true) {
        // Who ran what, and how often. The shape of abuse is usually a count, not a single line.
        const tally = new Map<string, number>();
        for (const row of rows) {
            const who = names.get(row.session_uuid) ?? `session ${row.session_uuid.slice(0, 8)}`;
            const cheat = row.event.startsWith('Ran cheat ') ? row.event.slice('Ran cheat '.length) : row.event;
            const cmd = cheat.split(' ')[0] || '(empty)';
            const key = `${who}\u0000${cmd}`;
            tally.set(key, (tally.get(key) ?? 0) + 1);
        }
        const sorted = [...tally.entries()].sort((a, b) => b[1] - a[1]);
        console.log(`  ${rows.length} command${rows.length === 1 ? '' : 's'} in the last ${days} day${days === 1 ? '' : 's'}, by who and what:`);
        console.log('');
        for (const [key, count] of sorted) {
            const [who, cmd] = key.split('\u0000');
            console.log(`  ${String(count).padStart(6)}  ${who.padEnd(20)} ::${cmd}`);
        }
        console.log('');
        console.log(`  --limit is ${limit}, so a tally can only count what came back - raise it before reading much into these.`);
        return;
    }

    for (const row of rows) {
        const level = (row.coord >> 28) & 0x3;
        const x = (row.coord >> 14) & 0x3fff;
        const z = row.coord & 0x3fff;
        const who = names.get(row.session_uuid) ?? `session ${row.session_uuid.slice(0, 8)}`;
        // The :: belongs to a command and to nothing else - --all brings back the other
        // moderator-log events too, and "::Server check in" reads like something somebody typed.
        const ran = row.event.startsWith('Ran cheat ');
        const what = ran ? `::${row.event.slice('Ran cheat '.length)}` : row.event;

        console.log(`  ${new Date(row.timestamp).toISOString()}  ${who.padEnd(16)} ${what}`);
        console.log(`      at ${x}, ${z}, level ${level}`);
    }

    console.log('');
    console.log(`  ${rows.length} shown, newest first (--limit ${limit}, --days ${days}). --summary counts them by who and what.`);
    if (!everything) console.log('  commands only; --all adds the other moderator-log events.');
}

// --------------------------------------------------------------------------------------------
// WHAT A PLAYER SAID, and WHO ELSE THEY ARE.
//
// NEITHER CHAT TABLE HOLDS A USERNAME. public_chat is keyed by LOGIN SESSION (a uuid) and
// private_chat by ACCOUNT NUMBER, so a raw look at either - in Prisma Studio or any other table
// browser - is a wall of uuids and integers with every name in a different table. Worse, the
// schema declares no relations at all, so nothing in such a browser is clickable: reading one
// player's week is four manual passes and a notepad. These two commands do those passes.
//
// A UID OF ZERO IS NOT A MACHINE. uid is the client's install id: signlink.getuid writes a
// random number to uid.dat in the cache directory and returns it, and RETURNS 0 WHEN IT CANNOT
// READ THE FILE. Zero therefore means "unknown" and is shared by every player whose client
// failed to read it, so `whois` excludes it - treating it as a link would group strangers
// together and name them alts. A non-zero match is strong: one chance in a hundred million of
// coinciding, and it survives a change of address. It does NOT survive a cache wipe, so a uid
// that fails to match proves nothing either way.
//
// AN ADDRESS OF 'unknown' IS NOT AN ADDRESS, and it is the same trap wearing different clothes.
// normalizeAddress (src/server/ConnectionLimiter.ts) returns the LITERAL STRING 'unknown' when a
// socket has no address - which Node does for a connection already destroyed by the time the
// event fires - and that string goes straight into session.ip. It is not NULL, so a plain
// not-null test lets it through, and then every bad-socket login matches every other one. On the
// live server that turned eight unrelated players, each with one or two such logins, into the
// owner's alts. Found only because somebody read the output and knew it was wrong.
//
// SO THE MATCHED ADDRESS IS PRINTED. A match that cannot name what it matched on is a match
// nobody can check, which is exactly how the above survived being written, tested and shipped.
//
// AN ADDRESS IS THE WEAKER HALF even when it is real. Families, shared houses, phone networks and
// VPNs all put unrelated people on one address, so an address that many accounts have used says
// little; `whois` counts how many and says so rather than presenting a crowded one as a finding.

/**
 * An address worth matching on. NOT just "not null": normalizeAddress writes the literal string
 * 'unknown' for a socket with no address, and an empty string is as empty as a null.
 */
function usableAddress(ip: string | null | undefined): ip is string {
    return typeof ip === 'string' && ip.length > 0 && ip !== 'unknown';
}

function coordText(coord: number) {
    const level = (coord >> 28) & 0x3;
    const x = (coord >> 14) & 0x3fff;
    const z = coord & 0x3fff;
    return `${x}, ${z}, level ${level}`;
}

function windowFlags(defDays: number, defLimit: number) {
    // parseArgs hands every flag back as a string, so these convert rather than typeof-test for
    // a number, which is always false and silently ignores the flag. Same as cmdAudit.
    let days = defDays;
    if (typeof args.days === 'string') {
        days = parseInt(args.days, 10);
        if (!Number.isFinite(days) || days < 1) fail('--days takes a whole number of days, 1 or more');
    }
    let limit = defLimit;
    if (typeof args.limit === 'string') {
        limit = parseInt(args.limit, 10);
        if (!Number.isFinite(limit) || limit < 1) fail('--limit takes a whole number, 1 or more');
    }
    return { days, limit };
}

type ChatLine = { timestamp: string; who: string; message: string; coord: number; kind: 'public' | 'private' | 'clan' };

async function cmdChat(username: string) {
    const { days, limit } = windowFlags(7, 200);
    const since = toDbDate(Date.now() - days * 86400000);

    const account = await getAccount(username);
    if (!account) fail(`no account called ${username}`);

    // ANY of --public/--private/--clan selects; none of them means all three. --with names a
    // correspondent and only a private message has one, so it narrows to the private half unless
    // another is asked for alongside it - without that, `--with alice` returned every unrelated
    // thing the player shouted that week beside the two lines wanted.
    const withUser = typeof args.with === 'string';
    const picked = args.public === true || args.private === true || args.clan === true;
    const wantPublic = picked ? args.public === true : !withUser;
    const wantPrivate = (picked ? args.private === true : true) || withUser;
    const wantClan = picked ? args.clan === true : !withUser;

    // --with restricts the private half to one correspondent. The pair is what matters in a
    // scam report, and without this a chatty player buries it.
    let withId: number | null = null;
    if (typeof args.with === 'string') {
        const other = await getAccount(args.with);
        if (!other) fail(`no account called ${args.with}`);
        withId = other.id;
    }

    const lines: ChatLine[] = [];

    if (wantPublic || wantClan) {
        // Public and clan chat are both tied to a session, not an account, so their sessions come
        // first - and one lookup serves both. Every session: a player who logs in daily has
        // hundreds, and the window is applied to the chat rows rather than to the sessions
        // because a session that began before the window can carry lines inside it.
        const sessions = await tryDb('sessions', () => db.selectFrom('session').select('uuid').where('account_id', '=', account.id).where('profile', '=', profile).execute());
        if (sessions === null) return;
        const uuids = sessions.map(s => s.uuid);
        if (uuids.length && wantPublic) {
            const rows = await tryDb('public chat', () => db.selectFrom('public_chat').select(['timestamp', 'coord', 'message']).where('session_uuid', 'in', uuids).where('timestamp', '>=', since).orderBy('timestamp', 'desc').limit(limit).execute());
            if (rows === null) return;
            for (const row of rows) lines.push({ timestamp: row.timestamp as unknown as string, who: account.username, message: row.message, coord: row.coord, kind: 'public' });
        }
        if (uuids.length && wantClan) {
            const rows = await tryDb('clan chat', () => db.selectFrom('clan_chat').select(['timestamp', 'coord', 'message', 'channel']).where('session_uuid', 'in', uuids).where('timestamp', '>=', since).orderBy('timestamp', 'desc').limit(limit).execute());
            if (rows === null) return;
            for (const row of rows) lines.push({ timestamp: row.timestamp as unknown as string, who: `${account.username} @${row.channel}`, message: row.message, coord: row.coord, kind: 'clan' });
        }
    }

    if (wantPrivate) {
        // Both directions in one pass, then the names. account_id is the sender and
        // to_account_id the recipient, so an account appears in either column.
        let query = db.selectFrom('private_chat').select(['timestamp', 'coord', 'message', 'account_id', 'to_account_id']).where('profile', '=', profile).where('timestamp', '>=', since);
        query = query.where(eb => eb.or([eb('account_id', '=', account.id), eb('to_account_id', '=', account.id)]));
        if (withId !== null) query = query.where(eb => eb.or([eb('account_id', '=', withId!), eb('to_account_id', '=', withId!)]));
        const rows = await tryDb('private chat', () => query.orderBy('timestamp', 'desc').limit(limit).execute());
        if (rows === null) return;

        const ids = [...new Set(rows.flatMap(r => [r.account_id, r.to_account_id]))];
        const names = new Map<number, string>();
        if (ids.length) {
            const accounts = await tryDb('accounts', () => db.selectFrom('account').select(['id', 'username']).where('id', 'in', ids).execute());
            for (const a of accounts ?? []) names.set(a.id, a.username);
        }
        const nameOf = (id: number) => names.get(id) ?? `account ${id}`;
        for (const row of rows) lines.push({ timestamp: row.timestamp as unknown as string, who: `${nameOf(row.account_id)} -> ${nameOf(row.to_account_id)}`, message: row.message, coord: row.coord, kind: 'private' });
    }

    // Each half was limited on its own, so the merge is sliced again - otherwise asking for 20
    // lines of a conversation could return 20 public and 20 private.
    lines.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
    const shown = lines.slice(0, limit);

    if (!shown.length) {
        console.log(`  nothing from ${account.username} in the last ${days} day${days === 1 ? '' : 's'}.`);
        // "Said nothing" and "nothing is being recorded" look identical from here, and only one
        // of them is good news. Same distinction cmdAudit draws for session_log.
        const anyPub = await tryDb('public chat', () => db.selectFrom('public_chat').select('id').limit(1).execute());
        const anyPriv = await tryDb('private chat', () => db.selectFrom('private_chat').select('id').limit(1).execute());
        const anyClan = await tryDb('clan chat', () => db.selectFrom('clan_chat').select('id').limit(1).execute());
        if (anyPub !== null && anyPriv !== null && anyClan !== null && !anyPub.length && !anyPriv.length && !anyClan.length) {
            console.log('');
            console.log('  ALL THREE CHAT TABLES ARE EMPTY - nothing has ever been recorded on this world, so this');
            console.log('  says nothing about what anyone has said. Chat is written by the FRIEND server:');
            console.log('');
            console.log('    FRIEND_SERVER=true in .env, AND a friend process running (npm run friend,');
            console.log('    or EASY_STARTUP=true to run one inside the world).');
            console.log('');
            console.log('  nothing is recorded retroactively.');
        }
        return;
    }

    const pub = shown.filter(l => l.kind === 'public').length;
    const clan = shown.filter(l => l.kind === 'clan').length;
    const priv = shown.length - pub - clan;
    console.log(`  ${account.username}, last ${days} day${days === 1 ? '' : 's'} - ${shown.length} line${shown.length === 1 ? '' : 's'} (${pub} public, ${priv} private, ${clan} clan)`);
    console.log('');
    const width = Math.max(...shown.map(l => l.who.length));
    for (const line of shown) {
        console.log(`  ${String(line.timestamp).slice(0, 19)}  ${line.who.padEnd(width)}  ${line.message}`);
        if (args.where === true) console.log(`  ${' '.repeat(19)}  ${' '.repeat(width)}  at ${coordText(line.coord)}`);
    }
    console.log('');
    console.log('  a bare name is public chat, "a -> b" a private message, "a @name" a clan channel.');
    console.log('  --where adds the tile. --public, --private and --clan each narrow it to one kind.');
    // NO NUMBER HERE, deliberately. Each half was capped at --limit before the merge, so
    // lines.length is not the total that exists - subtracting from it reported '2 older lines'
    // for a player with five more. Either half coming back full means there may be more.
    if (lines.length >= limit) console.log(`  there may be older lines than these - raise --limit (now ${limit}).`);
}

/**
 * A whole clan channel, rather than one player's share of it. `chat` answers "what did this
 * person say", which deliberately leaves out everyone they were talking to; a channel is where
 * the trade gets arranged and the scam gets planned, and that only reads as a conversation.
 *
 * TAKES THE NAME OR THE OWNER. A channel's identity is its owner and its name can be changed at
 * any time, so somebody reading a report has whichever of the two the report happened to quote.
 */
async function cmdClan(channel: string) {
    const { days, limit } = windowFlags(7, 200);
    const since = toDbDate(Date.now() - days * 86400000);
    const needle = channel.toLowerCase();

    const rows = await tryDb('clan chat', () =>
        db
            .selectFrom('clan_chat')
            .select(['timestamp', 'coord', 'message', 'owner', 'channel', 'session_uuid'])
            .where('timestamp', '>=', since)
            .where(eb => eb.or([eb(eb.fn('lower', ['channel']), '=', needle), eb(eb.fn('lower', ['owner']), '=', needle)]))
            .orderBy('timestamp', 'desc')
            .limit(limit)
            .execute()
    );
    if (rows === null) return;

    if (!rows.length) {
        console.log(`  nothing in a channel called ${channel} in the last ${days} day${days === 1 ? '' : 's'}.`);
        const any = await tryDb('clan chat', () => db.selectFrom('clan_chat').select('id').limit(1).execute());
        if (any !== null && !any.length) {
            console.log('');
            console.log('  clan_chat is EMPTY - no clan line has ever been recorded on this world. It needs');
            console.log('  FRIEND_SERVER=true and a friend process running, the same as public chat, AND an');
            console.log('  engine new enough to log it at all. Nothing is recorded retroactively.');
            return;
        }
        const named = await tryDb('clan chat', () => db.selectFrom('clan_chat').select(['owner', 'channel']).orderBy('timestamp', 'desc').limit(200).execute());
        const seen = [...new Map((named ?? []).map(r => [`${r.owner}\u0000${r.channel}`, r])).values()];
        if (seen.length) {
            console.log('  channels with lines recently, as "name (owner)":');
            for (const c of seen.slice(0, 20)) console.log(`    ${c.channel} (${c.owner})`);
        }
        return;
    }

    // uuid -> name, in two steps rather than a join: the file does its reads this way throughout,
    // and a missing session row has to degrade to the uuid rather than drop the line.
    const names = new Map<string, string>();
    const uuids = [...new Set(rows.map(r => r.session_uuid))];
    const sessions = await tryDb('sessions', () => db.selectFrom('session').select(['uuid', 'account_id']).where('uuid', 'in', uuids).execute());
    if (sessions?.length) {
        const ids = [...new Set(sessions.map(x => x.account_id))];
        const accounts = await tryDb('accounts', () => db.selectFrom('account').select(['id', 'username']).where('id', 'in', ids).execute());
        const byId = new Map((accounts ?? []).map(a => [a.id, a.username]));
        for (const session of sessions) {
            const name = byId.get(session.account_id);
            if (name) names.set(session.uuid, name);
        }
    }

    const channels = [...new Set(rows.map(r => `${r.channel} (${r.owner})`))];
    console.log(`  ${channels.join(', ')} - last ${days} day${days === 1 ? '' : 's'}, ${rows.length} line${rows.length === 1 ? '' : 's'}`);
    console.log('');
    const width = Math.max(...rows.map(r => (names.get(r.session_uuid) ?? r.session_uuid.slice(0, 8)).length));
    for (const row of rows.slice().reverse()) {
        const who = names.get(row.session_uuid) ?? `session ${row.session_uuid.slice(0, 8)}`;
        console.log(`  ${String(row.timestamp).slice(0, 19)}  ${who.padEnd(width)}  ${row.message}`);
        if (args.where === true) console.log(`  ${' '.repeat(19)}  ${' '.repeat(width)}  at ${coordText(row.coord)}`);
    }
    console.log('');
    // OLDEST FIRST, unlike every other read here, because this one is a conversation and a
    // conversation read upwards is not one.
    console.log('  oldest first - it is a conversation. --where adds the tile.');
    if (rows.length >= limit) console.log(`  there may be older lines than these - raise --limit (now ${limit}).`);
}

async function cmdWhois(username: string) {
    const account = await getAccount(username);
    if (!account) fail(`no account called ${username}`);

    const mine = await tryDb('sessions', () => db.selectFrom('session').select(['uid', 'ip', 'timestamp']).where('account_id', '=', account.id).where('profile', '=', profile).execute());
    if (mine === null) return;
    if (!mine.length) {
        console.log(`  no session rows for ${account.username} - the login server is not recording them, so there is`);
        console.log('  nothing to match on. See `audit` for how to turn the logger on.');
        return;
    }

    // Neither sentinel is NULL, and that is the whole point - see the note above. uid 0 is "the
    // client could not read uid.dat"; ip 'unknown' is "the socket had no address". Both are
    // shared by strangers, so neither is a link.
    const ips = [...new Set(mine.map(s => s.ip).filter(usableAddress))];
    const uids = [...new Set(mine.map(s => s.uid).filter(x => typeof x === 'number' && x !== 0))];

    const ipLogins = new Map<string, number>();
    for (const s of mine) if (usableAddress(s.ip)) ipLogins.set(s.ip, (ipLogins.get(s.ip) ?? 0) + 1);
    const unreadable = mine.filter(s => !usableAddress(s.ip)).length;

    console.log(`  ${account.username} (account ${account.id}) - ${mine.length} login${mine.length === 1 ? '' : 's'} recorded`);
    console.log(`    addresses:      ${ips.length ? ips.map(ip => `${ip} (${ipLogins.get(ip)})`).join(', ') : 'none usable'}${unreadable ? `  (and ${unreadable} login${unreadable === 1 ? '' : 's'} whose socket had no address - not matchable)` : ''}`);
    console.log(`    client installs: ${uids.length ? uids.join(', ') : 'none usable'}${mine.some(s => s.uid === 0) ? '  (some logins reported uid 0 - unknown, not matchable)' : ''}`);
    console.log('');

    if (!ips.length && !uids.length) {
        console.log('  neither an address nor a usable install id, so there is nothing to match against.');
        return;
    }

    const others = await tryDb('sessions', () =>
        db
            .selectFrom('session')
            .select(['account_id', 'uid', 'ip', 'timestamp'])
            .where('profile', '=', profile)
            .where('account_id', '!=', account.id)
            .where(eb => eb.or([...(ips.length ? [eb('ip', 'in', ips)] : []), ...(uids.length ? [eb('uid', 'in', uids)] : [])]))
            .execute()
    );
    if (others === null) return;

    if (!others.length) {
        console.log('  no other account has logged in from any of them.');
        console.log('  that is not proof of a single owner: a cache wipe changes the install id, and an');
        console.log('  address changes on its own.');
        return;
    }

    type Match = { byIp: boolean; byUid: boolean; first: string; last: string; logins: number; addresses: Set<string> };
    const matches = new Map<number, Match>();
    for (const row of others) {
        const ts = String(row.timestamp).slice(0, 19);
        const m = matches.get(row.account_id) ?? { byIp: false, byUid: false, first: ts, last: ts, logins: 0, addresses: new Set<string>() };
        if (row.ip && ips.includes(row.ip)) {
            m.byIp = true;
            m.addresses.add(row.ip);
        }
        if (row.uid !== 0 && uids.includes(row.uid)) m.byUid = true;
        if (ts < m.first) m.first = ts;
        if (ts > m.last) m.last = ts;
        m.logins++;
        matches.set(row.account_id, m);
    }

    const ids = [...matches.keys()];
    const accounts = await tryDb('accounts', () => db.selectFrom('account').select(['id', 'username', 'banned_until', 'muted_until', 'staffmodlevel']).where('id', 'in', ids).execute());
    const byId = new Map((accounts ?? []).map(a => [a.id, a]));

    // An install id matched is worth more than an address matched, so the strongest sit at the
    // top rather than the oldest or the lowest numbered.
    const order = ids.sort((a, b) => {
        const ma = matches.get(a)!;
        const mb = matches.get(b)!;
        const score = (m: Match) => (m.byUid ? 2 : 0) + (m.byIp ? 1 : 0);
        return score(mb) - score(ma) || mb.last.localeCompare(ma.last);
    });

    console.log(`  ${order.length} other account${order.length === 1 ? '' : 's'} seen from the same address or machine:`);
    console.log('');
    const nameWidth = Math.max(8, ...order.map(id => (byId.get(id)?.username ?? `account ${id}`).length));
    // The address goes in its own column rather than inline, so a "same PC" row with no address
    // and a "same address" row with one still line up against each other.
    const vias = new Map(order.map(id => [id, [...matches.get(id)!.addresses].join(', ')]));
    const viaWidth = Math.max(0, ...vias.values().map(v => v.length));
    for (const id of order) {
        const other = byId.get(id);
        const m = matches.get(id)!;
        const name = other?.username ?? `account ${id}`;
        const link = m.byUid && m.byIp ? 'same PC + address' : m.byUid ? 'same PC' : 'same address';
        const flags: string[] = [];
        if (other?.banned_until && new Date(other.banned_until) > new Date()) flags.push(`BANNED until ${String(other.banned_until).slice(0, 19)}`);
        if (other?.muted_until && new Date(other.muted_until) > new Date()) flags.push(`MUTED until ${String(other.muted_until).slice(0, 19)}`);
        if (other && other.staffmodlevel > 0) flags.push(`staff level ${other.staffmodlevel}`);
        console.log(`  ${name.padEnd(nameWidth)}  ${link.padEnd(17)}  ${(vias.get(id) ?? '').padEnd(viaWidth)}  ${m.logins} login${m.logins === 1 ? '' : 's'}, ${m.first} to ${m.last}${flags.length ? `  ${flags.join(', ')}` : ''}`);
    }
    console.log('');

    // A crowded address is the main way this command misleads, so it says so itself rather than
    // leaving the reader to assume every row above is an alt.
    const crowded: string[] = [];
    for (const ip of ips) {
        const all = await tryDb('sessions', () => db.selectFrom('session').select('account_id').where('ip', '=', ip).where('profile', '=', profile).execute());
        const count = new Set((all ?? []).map(r => r.account_id)).size;
        if (count >= 8) crowded.push(`${ip} (${count} accounts)`);
    }
    console.log('  "same PC" is an install id match: one chance in a hundred million, so take it seriously.');
    console.log('  "same address" is weaker - families, shared houses, phone networks and VPNs all share one.');
    if (crowded.length) {
        console.log('');
        console.log(`  CAREFUL: ${crowded.join(', ')} - too many accounts for one household. Treat an address`);
        console.log('  match there as nothing on its own.');
    }
}

async function main() {
    const username = args._[1];

    switch (command) {
        case 'list':
            await cmdList();
            break;

        case 'show':
            if (!username) fail('usage: show <user>');
            await cmdShow(username);
            break;

        case 'export': {
            if (!username) fail('usage: export <user> [--out file.json]');
            const data = await fullExport(username);
            const json = JSON.stringify(data, null, 4);
            if (typeof args.out === 'string') {
                fs.writeFileSync(args.out, json);
                console.log(`  wrote ${args.out}`);
            } else {
                console.log(json);
            }
            break;
        }

        case 'import': {
            if (!username || typeof args.in !== 'string') fail('usage: import <user> --in file.json   (--in - reads stdin)');
            // --in - is how edit-account.bat gets a file from the machine you are sitting at onto
            // a server you are only ssh'd into, without leaving a copy of somebody's account in
            // /tmp on the way.
            const raw = args.in === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(args.in, 'utf8');
            const data = JSON.parse(raw) as Export;
            await fullImport(username, data, args.force === true);
            break;
        }

        case 'set': {
            const dotted = args._[2];
            const value = args._[3];
            if (!username || !dotted || value === undefined) fail('usage: set <user> <path> <value>   e.g. set bob save.stats.ATTACK 99');
            // THE CHARACTER IS ONLY READ WHEN THE CHANGE IS TO IT. set account.staffmodlevel is a
            // database column and nothing else; reading and rewriting the save to get there is how
            // a rank change came to be refused by a bank slot. See fullExport.
            const data = await fullExport(username, { save: String(dotted).startsWith('save.') });
            applyPath(data, dotted, value);
            await fullImport(username, data, args.force === true);
            console.log(`  ${dotted} = ${value}`);
            break;
        }

        case 'give':
            if (!username) fail('usage: give <user> <obj> [count] [--inv inv|bank]');
            await cmdGive(username);
            break;

        case 'rename':
            if (!username || !args._[2]) fail('usage: rename <user> <newname>');
            await cmdRename(username, String(args._[2]));
            break;

        case 'delete':
            if (!username) fail('usage: delete <user> [--out backup.json]');
            await cmdDelete(username);
            break;

        case 'deaths':
            await cmdDeaths();
            break;

        case 'audit':
            await cmdAudit();
            break;

        case 'chat':
            if (!username) fail('usage: chat <user> [--days 7] [--limit 200] [--with <user>] [--public|--private|--clan] [--where]');
            await cmdChat(username);
            break;

        case 'clan':
            if (!username) fail('usage: clan <channel name or owner> [--days 7] [--limit 200] [--where]');
            await cmdClan(username);
            break;

        case 'whois':
            if (!username) fail('usage: whois <user>   - other accounts seen from the same address or machine');
            await cmdWhois(username);
            break;

        case 'password':
            if (!username) fail('usage: password <user> <newpassword>');
            await cmdPassword(username);
            break;

        case 'logout':
            if (!username) fail('usage: logout <user>   - clears a stale "already logged in", for a session that never ended cleanly');
            await cmdLogout(username);
            break;

        default:
            console.log(
                fs
                    .readFileSync(new URL(import.meta.url), 'utf8')
                    .split('*/')[0]
                    .replace(/^\/\*\*?/, '')
                    .replace(/^ \* ?/gm, '')
            );
            process.exit(command ? 1 : 0);
    }

    await db.destroy().catch(() => {});
    process.exit(0);
}

await main();
