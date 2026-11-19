import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';

import Player from '#/engine/entity/Player.js';
import World from '#/engine/World.js';
import MessageClan from '#/network/game/server/model/MessageClan.js';
import UpdateClanChannel, { ClanMemberInfo } from '#/network/game/server/model/UpdateClanChannel.js';
import Environment from '#/util/Environment.js';
import { fromBase37, toBase37 } from '#/util/JString.js';

// CLAN CHAT (custom, 2026-09-23). The 2008 channel: a player sets up a channel under their own name,
// others join it by typing that name, and anything said with "/" in front goes to everyone in it.
//
// A CHANNEL BELONGS TO ITS OWNER'S NAME and exists once the owner has given it a name in Clan Setup
// (clan_setname). It does not need its owner online - people talk in it while they are away - so the
// settings live here, not in anybody's save. Setting the name to "" closes it.
//
// RANKS are the numbers 2008 used, so the requirement settings compare with >=:
//   -1 anyone   0 the owner's friends   1 Recruit  2 Corporal  3 Sergeant  4 Lieutenant  5 Captain
//   6 General   7 the owner   127 staff (staffModLevel 2 and up)
// The owner gives a rank (1-6) to individual friends in Clan Setup; a friend without one is 0. Enter
// and talk take any of -1..7 ("Anyone", "Any friends", "Recruit+" .. "General+", "Only me"), kick
// 2..7 ("Corporal+" .. "Only me") - 474's own menus. A friend's rank is kept after they leave the
// friend list, but only a friend is ever ranked by it.
//
// "ANY FRIENDS" NEEDS THE OWNER'S FRIEND LIST, which the engine does not hold - it lives with the
// friend server. The list the friend server sends at login is kept on the Player (friends37) and
// changed with every add and delete, and an owner's list is copied into their channel row so the
// check still works while they are offline.
//
// ONE WORLD. The members, and who is in what, are this process's. A second world would have
// channels of its own; putting clan chat through the friend server is what would join them.
//
// A KICK keeps the player out for an hour, as it did in 2008. That is held in memory - a restart
// forgives it.

export const enum ClanRank {
    ANYONE = -1,
    FRIEND = 0,
    OWNER = 7,
    STAFF = 127
}

const MAX_MEMBERS = 100;
const KICK_BAN_MS = 60 * 60 * 1000;

// THE HELP CHANNEL. A channel like any other - a row in `channel` - except that nobody owns it and
// everybody starts in it. The owner key is the name players TYPE to join, so it has to be the plain
// word: "help" is what goes in the Join Chat box, and a key that could not be typed (a '#help' that
// base37 cannot hold) would leave anyone who left with no way back in.
//
// Nothing logs in as `help`, so rankOf never returns OWNER for it: entering and talking are open to
// anyone and kicking falls to staff, which is what a help channel wants.
//
// THE NAME IS WORTH RESERVING AT REGISTRATION. A player who manages to register the username "help"
// becomes this channel's owner and can rename or close it. That is a one-line check wherever names
// are vetted, and is not done here because this file does not own that list.
const HELP_OWNER = 'help';
const HELP_NAME = 'Help';

type Channel = {
    owner: string;
    name: string;
    enter: number;
    talk: number;
    kick: number;
    friends: Set<bigint>;
    ranks: Map<bigint, number>;
    members: Player[];
};

type ChannelRow = { owner: string; name: string; enter: number; talk: number; kick: number; friends: string; ranks: string };

function parseRanks(text: string): Map<bigint, number> {
    const out = new Map<bigint, number>();
    for (const entry of text.split(',')) {
        const [name, rank] = entry.split(':');
        if (name && rank) {
            out.set(BigInt(name), parseInt(rank));
        }
    }
    return out;
}

function formatRanks(ranks: Map<bigint, number>): string {
    return [...ranks].map(([name, rank]) => `${name}:${rank}`).join(',');
}

class ClanChatService {
    private dbHandle: DatabaseSync | null = null;
    private readonly channels: Map<string, Channel> = new Map();
    private readonly bans: Map<string, number> = new Map(); // `${owner}:${player}` -> until (ms)
    private messageCount = 0;

    private get db(): DatabaseSync {
        if (!this.dbHandle) {
            const file = `data/clans/${Environment.NODE_PROFILE}.sqlite`;
            fs.mkdirSync(path.dirname(file), { recursive: true });
            this.dbHandle = new DatabaseSync(file);
            this.dbHandle.exec('PRAGMA journal_mode = WAL');
            this.dbHandle.exec(`
                CREATE TABLE IF NOT EXISTS channel (
                    owner   TEXT PRIMARY KEY,
                    name    TEXT NOT NULL,
                    enter   INTEGER NOT NULL DEFAULT -1,
                    talk    INTEGER NOT NULL DEFAULT -1,
                    kick    INTEGER NOT NULL DEFAULT 7,
                    friends TEXT NOT NULL DEFAULT ''
                );
                CREATE TABLE IF NOT EXISTS last_channel (
                    player TEXT PRIMARY KEY,
                    owner  TEXT NOT NULL
                );
            `);
            // ranks came after the table did: add the column to a database from before it
            const columns = this.dbHandle.prepare('PRAGMA table_info(channel)').all() as { name: string }[];
            if (!columns.some(c => c.name === 'ranks')) {
                this.dbHandle.exec("ALTER TABLE channel ADD COLUMN ranks TEXT NOT NULL DEFAULT ''");
            }
            // WHO HAS ALREADY BEEN PUT IN THE HELP CHANNEL, which is a different question from who is
            // in it now and cannot be answered by last_channel: an explicit leave DELETES that row, so
            // "no row" means both "never joined anything" and "left on purpose". Without somewhere to
            // write it down, leaving Help would put you straight back in on your next login.
            this.dbHandle.exec(`
                CREATE TABLE IF NOT EXISTS help_seeded (
                    player TEXT PRIMARY KEY
                );
            `);
            // The channel itself, created once and then left alone - OR IGNORE so a rename or a
            // settings change made in game survives every restart after it.
            this.dbHandle.prepare('INSERT OR IGNORE INTO channel (owner, name, enter, talk, kick, friends, ranks) VALUES (?, ?, -1, -1, 7, ?, ?)').run(HELP_OWNER, HELP_NAME, '', '');
        }
        return this.dbHandle;
    }

    // ---- the channel record

    private row(owner: string): ChannelRow | undefined {
        return this.db.prepare('SELECT owner, name, enter, talk, kick, friends, ranks FROM channel WHERE owner = ?').get(owner) as ChannelRow | undefined;
    }

    /** The channel, loaded if nobody is in it yet; null if the owner has none (or has closed it). */
    private channel(owner: string): Channel | null {
        const open = this.channels.get(owner);
        if (open) {
            return open;
        }
        const row = this.row(owner);
        if (!row || row.name.length === 0) {
            return null;
        }
        const channel: Channel = {
            owner,
            name: row.name,
            enter: row.enter,
            talk: row.talk,
            kick: row.kick,
            friends: new Set(row.friends.length ? row.friends.split(',').map(x => BigInt(x)) : []),
            ranks: parseRanks(row.ranks),
            members: []
        };
        const online = World.getPlayerByUsername(owner);
        if (online && online.friends37) {
            channel.friends = new Set(online.friends37);
        }
        this.channels.set(owner, channel);
        return channel;
    }

    rankOf(channel: Channel, player: Player): number {
        if (player.username === channel.owner) {
            return ClanRank.OWNER;
        }
        if (player.staffModLevel >= 2) {
            return ClanRank.STAFF;
        }
        if (channel.friends.has(player.username37)) {
            return channel.ranks.get(player.username37) ?? ClanRank.FRIEND;
        }
        return ClanRank.ANYONE;
    }

    // ---- joining and leaving

    join(player: Player, owner: string, quiet: boolean = false): void {
        if (player.clanOwner === owner) {
            return;
        }
        const channel = this.channel(owner);
        if (!channel) {
            if (!quiet) {
                player.messageGame('The channel you tried to join does not exist.');
            }
            return;
        }
        const rank = this.rankOf(channel, player);
        const banned = this.bans.get(`${owner}:${player.username}`);
        if (banned && banned > Date.now() && rank < ClanRank.STAFF) {
            player.messageGame('You are temporarily banned from this clan channel.');
            return;
        }
        if (rank < channel.enter) {
            player.messageGame('You do not have a high enough rank to join this clan channel.');
            return;
        }
        if (channel.members.length >= MAX_MEMBERS && rank < ClanRank.STAFF) {
            player.messageGame('The channel you tried to join is full.');
            return;
        }

        if (player.clanOwner) {
            this.leave(player, false);
        }

        channel.members.push(player);
        player.clanOwner = owner;
        this.db.prepare('INSERT INTO last_channel (player, owner) VALUES (?, ?) ON CONFLICT(player) DO UPDATE SET owner = excluded.owner').run(player.username, owner);

        player.messageGame(`Now talking in clan channel ${channel.name}`);
        player.messageGame('To talk, start each line of chat with the / symbol.');
        this.refresh(channel);
    }

    /** Take the player out of their channel. forget: an explicit leave, so login does not put them back. */
    leave(player: Player, forget: boolean, quiet: boolean = false): void {
        const owner = player.clanOwner;
        player.clanOwner = null;
        if (forget) {
            this.db.prepare('DELETE FROM last_channel WHERE player = ?').run(player.username);
        }
        if (!owner) {
            return;
        }
        const channel = this.channels.get(owner);
        if (channel) {
            channel.members = channel.members.filter(p => p !== player);
            this.refresh(channel);
            this.unloadIfEmpty(channel);
        }
        if (forget && !quiet) {
            player.messageGame('You have left the channel.');
        }
        player.write(new UpdateClanChannel(0n, 0n, 0, []));
    }

    kick(player: Player, target37: bigint): void {
        const owner = player.clanOwner;
        const channel = owner ? this.channels.get(owner) : undefined;
        if (!channel) {
            return;
        }
        const target = channel.members.find(p => p.username37 === target37);
        if (!target || target === player) {
            return;
        }
        const rank = this.rankOf(channel, player);
        if (rank < channel.kick || rank <= this.rankOf(channel, target)) {
            player.messageGame('You do not have a high enough rank to kick in this channel.');
            return;
        }
        this.bans.set(`${channel.owner}:${target.username}`, Date.now() + KICK_BAN_MS);
        this.leave(target, true, true);
        target.messageGame('You have been kicked from the channel.');
        player.messageGame(`${target.displayName} has been kicked from the channel.`);
    }

    // ---- talking

    message(player: Player, text: string): void {
        const owner = player.clanOwner;
        const channel = owner ? this.channels.get(owner) : undefined;
        if (!channel) {
            player.messageGame('You are not currently in a channel.');
            return;
        }
        if (this.rankOf(channel, player) < channel.talk) {
            player.messageGame('You are not allowed to talk in this channel.');
            return;
        }
        const id = (Environment.NODE_ID << 24) + ((Math.random() * 0xff) << 16) + (this.messageCount++ & 0xffff);
        const packet = new MessageClan(player.username37, toBase37(channel.name), id, player.chatIcons(), text);
        for (const member of channel.members) {
            member.write(packet);
        }

        // AFTER THE TWO REFUSALS ABOVE, so the log holds what was said and not what somebody tried
        // to say in a channel that would not carry it. `text` is already ChatText.decode'd by
        // ClanMessageHandler, which is the same as-typed string public chat logs as logMessage.
        World.logClanChat(player, channel.owner, channel.name, text);
    }

    // ---- login, logout, friends

    onLogin(player: Player): void {
        const last = this.db.prepare('SELECT owner FROM last_channel WHERE player = ?').get(player.username) as { owner: string } | undefined;
        if (last) {
            this.join(player, last.owner, true);
            return;
        }
        // Nobody's channel to go back to. That is a new player on their first login - put them in
        // Help - or somebody who left one on purpose, who stays out. help_seeded is what tells the
        // two apart, and it is written BEFORE the join so a channel that is full or missing still
        // counts as having been offered: the alternative is retrying it at every login forever.
        if (this.db.prepare('SELECT player FROM help_seeded WHERE player = ?').get(player.username)) {
            return;
        }
        this.db.prepare('INSERT OR IGNORE INTO help_seeded (player) VALUES (?)').run(player.username);
        this.join(player, HELP_OWNER, true);
    }

    onLogout(player: Player): void {
        if (player.clanOwner) {
            this.leave(player, false);
        }
    }

    /**
     * Friends the friend server has told this player about. It sends the whole list at login and then
     * one friend at a time as they come and go, so this adds and never replaces; a friend only leaves
     * the list through removeFriend, the player's own Delete.
     */
    addFriends(player: Player, friends: bigint[]): void {
        const set = (player.friends37 ??= new Set());
        let changed = false;
        for (const friend of friends) {
            if (!set.has(friend)) {
                set.add(friend);
                changed = true;
            }
        }
        if (changed) {
            this.ownerFriendsChanged(player);
        }
    }

    addFriend(player: Player, friend37: bigint): void {
        (player.friends37 ??= new Set()).add(friend37);
        this.ownerFriendsChanged(player);
    }

    removeFriend(player: Player, friend37: bigint): void {
        player.friends37?.delete(friend37);
        this.ownerFriendsChanged(player);
    }

    private ownerFriendsChanged(owner: Player): void {
        const friends = [...(owner.friends37 ?? [])];
        this.db.prepare('UPDATE channel SET friends = ? WHERE owner = ?').run(friends.join(','), owner.username);
        const channel = this.channels.get(owner.username);
        if (channel) {
            channel.friends = new Set(friends);
            this.refresh(channel);
        }
    }

    // ---- setup (RuneScript: clan_setname, clan_setrank, clan_name, clan_rank)

    nameOf(owner: string): string {
        return this.row(owner)?.name ?? '';
    }

    rankSetting(owner: string, which: number): number {
        const row = this.row(owner);
        if (!row) {
            return which === 2 ? ClanRank.OWNER : ClanRank.ANYONE;
        }
        return which === 0 ? row.enter : which === 1 ? row.talk : row.kick;
    }

    setName(owner: Player, name: string): void {
        // p_namedialog hands back underscores for spaces
        const clean = name
            .replace(/_/g, ' ')
            .replace(/[^A-Za-z0-9 ]/g, '')
            .trim()
            .slice(0, 12);
        const friends = [...(owner.friends37 ?? [])].join(',');
        this.db.prepare('INSERT INTO channel (owner, name, friends) VALUES (?, ?, ?) ON CONFLICT(owner) DO UPDATE SET name = excluded.name, friends = excluded.friends').run(owner.username, clean, friends);
        const channel = this.channels.get(owner.username);
        if (!channel) {
            return;
        }
        if (clean.length === 0) {
            // closing it: everybody out
            for (const member of [...channel.members]) {
                this.leave(member, true, true);
                member.messageGame('The channel you were in has been closed.');
            }
            this.channels.delete(owner.username);
            return;
        }
        channel.name = clean;
        this.refresh(channel);
    }

    setRank(owner: Player, which: number, rank: number): void {
        // 474's menus: enter and talk from Anyone (-1) to Only me (7), kick from Corporal+ (2)
        const lowest = which === 2 ? 2 : ClanRank.ANYONE;
        if (which < 0 || which > 2 || rank < lowest || rank > ClanRank.OWNER) {
            return;
        }
        if (!this.row(owner.username)) {
            this.db.prepare('INSERT INTO channel (owner, name) VALUES (?, ?)').run(owner.username, '');
        }
        const column = which === 0 ? 'enter' : which === 1 ? 'talk' : 'kick';
        this.db.prepare(`UPDATE channel SET ${column} = ? WHERE owner = ?`).run(rank, owner.username);
        const channel = this.channels.get(owner.username);
        if (channel) {
            if (which === 0) {
                channel.enter = rank;
            } else if (which === 1) {
                channel.talk = rank;
            } else {
                channel.kick = rank;
            }
            this.refresh(channel);
        }
    }

    // ---- friends' ranks (RuneScript: clan_friend_count, clan_friend, clan_friend_rank, clan_setfriendrank)

    /** The owner's friends, in the order Clan Setup lists them: by name. */
    friendsOf(owner: Player): bigint[] {
        return [...(owner.friends37 ?? [])].sort((a, b) => {
            const x = fromBase37(a);
            const y = fromBase37(b);
            return x < y ? -1 : x > y ? 1 : 0;
        });
    }

    private ranksOf(owner: string): Map<bigint, number> {
        return this.channels.get(owner)?.ranks ?? parseRanks(this.row(owner)?.ranks ?? '');
    }

    friendRank(owner: Player, index: number): number {
        const friend = this.friendsOf(owner)[index];
        return friend === undefined ? -1 : (this.ranksOf(owner.username).get(friend) ?? ClanRank.FRIEND);
    }

    setFriendRank(owner: Player, index: number, rank: number): void {
        const friend = this.friendsOf(owner)[index];
        if (friend === undefined || rank < ClanRank.FRIEND || rank > 6) {
            return;
        }
        const ranks = new Map(this.ranksOf(owner.username));
        if (rank === ClanRank.FRIEND) {
            ranks.delete(friend);
        } else {
            ranks.set(friend, rank);
        }
        if (!this.row(owner.username)) {
            this.db.prepare('INSERT INTO channel (owner, name) VALUES (?, ?)').run(owner.username, '');
        }
        this.db.prepare('UPDATE channel SET ranks = ? WHERE owner = ?').run(formatRanks(ranks), owner.username);
        const channel = this.channels.get(owner.username);
        if (channel) {
            channel.ranks = ranks;
            this.refresh(channel);
        }
    }

    // ---- telling the members

    private refresh(channel: Channel): void {
        const members: ClanMemberInfo[] = channel.members.map(p => ({
            name: p.username37,
            world: Environment.NODE_ID,
            rank: this.rankOf(channel, p)
        }));
        // owner first, then by rank, then by name - the order 2008 listed them in
        members.sort((a, b) => b.rank - a.rank || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
        const packet = new UpdateClanChannel(toBase37(channel.owner), toBase37(channel.name), channel.kick, members);
        for (const member of channel.members) {
            member.write(packet);
        }
    }

    private unloadIfEmpty(channel: Channel): void {
        if (channel.members.length === 0) {
            this.channels.delete(channel.owner);
        }
    }
}

const ClanChat = new ClanChatService();
export default ClanChat;
