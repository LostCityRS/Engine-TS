import { WebSocket, WebSocketServer } from 'ws';

import { db, toDbDate } from '#/db/query.js';
import { FriendServerRepository } from '#/server/friend/FriendServerRepository.js';
import InternalClient from '#/server/InternalClient.js';
import { ChatModePrivate } from '#/engine/entity/ChatModes.js';
import Environment from '#/util/Environment.js';
import { fromBase37, toBase37 } from '#/util/JString.js';
import { printInfo } from '#/util/Logger.js';

/**
 * client -> server opcodes for friends server
 */
export const enum FriendsClientOpcodes {
    WORLD_CONNECT,
    FRIENDLIST_ADD,
    FRIENDLIST_DEL,
    IGNORELIST_ADD,
    IGNORELIST_DEL,
    PLAYER_LOGIN,
    PLAYER_LOGOUT,
    PLAYER_CHAT_SETMODE,
    PRIVATE_MESSAGE,
    PUBLIC_CHAT_LOG,
    // temporarily in the friend server (it has a constant connection established)
    RELAY_MUTE,
    RELAY_KICK,
    RELAY_SHUTDOWN,
    RELAY_BROADCAST,
    RELAY_TRACK,
    RELAY_RELOAD,
    RELAY_CLEARLOGINS,
    RELAY_CLEARLOGOUTS,
    RELAY_QUEUESCRIPT,
}

/**
 * server -> client opcodes for friends server
 */
export const enum FriendsServerOpcodes {
    UPDATE_FRIENDLIST,
    UPDATE_IGNORELIST,
    PRIVATE_MESSAGE,
    // temporarily in the friend server
    RELAY_MUTE,
    RELAY_KICK,
    RELAY_SHUTDOWN,
    RELAY_BROADCAST,
    RELAY_TRACK,
    RELAY_RELOAD,
    RELAY_CLEARLOGINS,
    RELAY_CLEARLOGOUTS,
    RELAY_QUEUESCRIPT,
}

// TODO make this configurable (or at least source it from somewhere common)
const WORLD_PLAYER_LIMIT = 2000;

/**
 * TODO refactor, this class shares a lot with the other servers
 */
export class FriendServer {
    private server: WebSocketServer;

    /**
     * repositories[profile] = repository
     */
    private repositories: Record<string, FriendServerRepository> = {};

    /**
     * socketByWorld[profile][worldId] = socket
     */
    private socketByWorld: Record<string, Record<number, WebSocket>> = {};

    constructor() {
        this.server = new WebSocketServer({ port: Environment.FRIEND_PORT, host: '0.0.0.0' }, () => {
            printInfo(`Friend server listening on port ${Environment.FRIEND_PORT}`);
        });

        this.server.on('connection', (socket: WebSocket) => {
            /**
             * The world number and profile for this connection. This is set when the world sends a WORLD_CONNECT packet.
             */
            let world: number | null = null;
            let profile: string | null = null;

            socket.on('message', async (buf: Buffer) => {
                try {
                    const message = JSON.parse(buf.toString());
                    const { type, _replyTo } = message;

                    if (type === FriendsClientOpcodes.WORLD_CONNECT) {
                        if (world !== null) {
                            // console.error('[Friends]: Received WORLD_CONNECT after already connected');
                            return;
                        }

                        world = message.world as number;
                        profile = message.profile as string;

                        this.initializeWorld(profile, world, socket);

                        // printDebug(`[Friends]: World ${world} connected`);
                    } else if (type === FriendsClientOpcodes.PLAYER_LOGIN) {
                        if (world === null || profile === null) {
                            world = message.world as number;
                            profile = message.profile as string;

                            this.initializeWorld(profile, world, socket);

                            // console.error('[Friends]: Received PLAYER_LOGIN before WORLD_CONNECT');
                            // return;
                        }

                        const username37 = BigInt(message.username37);
                        let privateChat: ChatModePrivate = message.privateChat;

                        if (privateChat !== 0 && privateChat !== 1 && privateChat !== 2) {
                            // console.error(`[Friends]: Player ${fromBase37(username37)} tried to log in with invalid private chat setting ${privateChat}`);
                            privateChat = ChatModePrivate.ON;
                        }

                        // remove player from previous world, if any
                        this.repositories[profile].unregister(username37);

                        if (!(await this.repositories[profile].register(world, username37, privateChat, message.staffLvl))) {
                            // TODO handle this better?
                            // console.error(`[Friends]: World ${world} is full`);
                            return;
                        }

                        // printDebug(`[Friends]: Player ${fromBase37(username37)} (${privateChat}) logged in to world ${world}`);

                        // notify the player who just logged in about their friends
                        // we can use `socket` here because we know the player is connected to this world
                        await this.sendFriendsListToPlayer(profile, username37, socket);
                        await this.sendIgnoreListToPlayer(profile, username37, socket);

                        // notify all friends of the player who just logged in
                        await this.broadcastWorldToFollowers(profile, username37);
                    } else if (type === FriendsClientOpcodes.PLAYER_LOGOUT) {
                        if (world === null || profile === null) {
                            world = message.world as number;
                            profile = message.profile as string;

                            this.initializeWorld(profile, world, socket);

                            // console.error('[Friends]: Received PLAYER_LOGOUT before WORLD_CONNECT');
                            // return;
                        }

                        const username37 = BigInt(message.username37);
                        const _username = fromBase37(username37);

                        // printDebug(`[Friends]: Player ${username} logged out of world ${world}`);

                        // remove player from previous world, if any
                        this.repositories[profile].unregister(username37);

                        await this.broadcastWorldToFollowers(profile, username37);
                    } else if (type === FriendsClientOpcodes.PLAYER_CHAT_SETMODE) {
                        if (world === null || profile === null) {
                            world = message.world as number;
                            profile = message.profile as string;

                            this.initializeWorld(profile, world, socket);

                            // console.error('[Friends]: Received PLAYER_CHAT_SETMODE before WORLD_CONNECT');
                            // return;
                        }

                        const username37 = BigInt(message.username37);
                        const _username = fromBase37(username37);
                        let privateChat: ChatModePrivate = message.privateChat;

                        if (privateChat !== 0 && privateChat !== 1 && privateChat !== 2) {
                            // console.error(`[Friends]: Player ${fromBase37(username37)} tried to set chatmode to invalid private chat setting ${privateChat}`);
                            privateChat = ChatModePrivate.ON;
                        }

                        // printDebug(`[Friends]: Player ${username} set chat mode to ${privateChat}`);

                        this.repositories[profile].setChatMode(username37, privateChat);
                        await this.broadcastWorldToFollowers(profile, username37);
                    } else if (type === FriendsClientOpcodes.FRIENDLIST_ADD) {
                        if (world === null || profile === null) {
                            world = message.world as number;
                            profile = message.profile as string;

                            this.initializeWorld(profile, world, socket);

                            // console.error('[Friends]: Received FRIENDLIST_ADD before WORLD_CONNECT');
                            // return;
                        }

                        const username37 = BigInt(message.username37);
                        const targetUsername37 = BigInt(message.targetUsername37);

                        await this.repositories[profile].addFriend(username37, targetUsername37);

                        await this.sendPlayerWorldUpdate(profile, username37, targetUsername37);

                        // we can refactor this to only send the update to the new friend
                        // currently we broadcast this in case the player has private chat set to "Friends"
                        await this.broadcastWorldToFollowers(profile, username37);
                    } else if (type === FriendsClientOpcodes.FRIENDLIST_DEL) {
                        if (world === null || profile === null) {
                            world = message.world as number;
                            profile = message.profile as string;

                            this.initializeWorld(profile, world, socket);

                            // console.error('[Friends]: Received FRIENDLIST_DEL before WORLD_CONNECT');
                            // return;
                        }

                        const username37 = BigInt(message.username37);
                        const targetUsername37 = BigInt(message.targetUsername37);

                        await this.repositories[profile].deleteFriend(username37, targetUsername37);

                        // we can refactor this to only send the update to the ex-friend
                        await this.broadcastWorldToFollowers(profile, username37);
                    } else if (type === FriendsClientOpcodes.IGNORELIST_ADD) {
                        if (world === null || profile === null) {
                            world = message.world as number;
                            profile = message.profile as string;

                            this.initializeWorld(profile, world, socket);

                            // console.error('[Friends]: Received IGNORELIST_ADD before WORLD_CONNECT');
                            // return;
                        }

                        const username37 = BigInt(message.username37);
                        const targetUsername37 = BigInt(message.targetUsername37);

                        await this.repositories[profile].addIgnore(username37, targetUsername37);

                        // we can refactor this to only send the update to the player who was added to the ignore list
                        await this.broadcastWorldToFollowers(profile, username37);
                    } else if (type === FriendsClientOpcodes.IGNORELIST_DEL) {
                        if (world === null || profile === null) {
                            world = message.world as number;
                            profile = message.profile as string;

                            this.initializeWorld(profile, world, socket);

                            // console.error('[Friends]: Received IGNORELIST_DEL before WORLD_CONNECT');
                            // return;
                        }

                        const username37 = BigInt(message.username37);
                        const targetUsername37 = BigInt(message.targetUsername37);

                        await this.repositories[profile].deleteIgnore(username37, targetUsername37);

                        // we can refactor this to only send the update to the player who was removed from the ignore list
                        await this.broadcastWorldToFollowers(profile, username37);
                    } else if (type === FriendsClientOpcodes.PRIVATE_MESSAGE) {
                        if (world === null || profile === null) {
                            world = message.world as number;
                            profile = message.profile as string;

                            this.initializeWorld(profile, world, socket);

                            // console.error('[Friends]: Recieved PRIVATE_MESSAGE before WORLD_CONNECT');
                            // return;
                        }

                        const username37 = BigInt(message.username37);
                        const targetUsername37 = BigInt(message.targetUsername37);
                        const { staffLvl, pmId, chat } = message;

                        const from = await db.selectFrom('account').selectAll().where('username', '=', fromBase37(username37)).executeTakeFirstOrThrow();
                        const to = await db.selectFrom('account').selectAll().where('username', '=', fromBase37(targetUsername37)).executeTakeFirstOrThrow();

                        await db
                            .insertInto('private_chat')
                            .values({
                                account_id: from.id,
                                profile: message.profile,
                                to_account_id: to.id,
                                timestamp: toDbDate(Date.now()),
                                coord: message.coord,
                                message: chat
                            })
                            .execute();

                        await this.sendPrivateMessage(profile, username37, staffLvl, pmId, targetUsername37, chat);
                    } else if (type === FriendsClientOpcodes.PUBLIC_CHAT_LOG) {
                        const { nodeId, nodeTime, profile, username, coord, chat } = message;

                        const from = await db.selectFrom('account').selectAll().where('username', '=', username).executeTakeFirstOrThrow();

                        await db
                            .insertInto('public_chat')
                            .values({
                                account_id: from.id,
                                profile,
                                world: nodeId,

                                timestamp: toDbDate(nodeTime),
                                coord,
                                message: chat
                            })
                            .execute();
                    } else if (type === FriendsClientOpcodes.RELAY_MUTE) {
                        const { profile, nodeId, username, muted_until } = message;

                        if (typeof this.socketByWorld[profile] !== 'undefined'
                            && typeof this.socketByWorld[profile][nodeId] !== 'undefined') {
                            this.socketByWorld[profile][nodeId].send(
                                JSON.stringify({
                                    type: FriendsServerOpcodes.RELAY_MUTE,
                                    username,
                                    muted_until
                                })
                            );
                        }
                    } else if (type === FriendsClientOpcodes.RELAY_KICK) {
                        const { profile, nodeId, username } = message;

                        if (typeof this.socketByWorld[profile] !== 'undefined'
                            && typeof this.socketByWorld[profile][nodeId] !== 'undefined') {
                            this.socketByWorld[profile][nodeId].send(
                                JSON.stringify({
                                    type: FriendsServerOpcodes.RELAY_KICK,
                                    username
                                })
                            );
                        }
                    } else if (type === FriendsClientOpcodes.RELAY_SHUTDOWN) {
                        const { profile, nodeId, duration } = message;

                        if (typeof this.socketByWorld[profile] !== 'undefined'
                            && typeof this.socketByWorld[profile][nodeId] !== 'undefined') {
                            this.socketByWorld[profile][nodeId].send(
                                JSON.stringify({
                                    type: FriendsServerOpcodes.RELAY_SHUTDOWN,
                                    duration
                                })
                            );
                        }
                    } else if (type === FriendsClientOpcodes.RELAY_BROADCAST) {
                        const { profile, nodeId, broadcast } = message;

                        if (typeof this.socketByWorld[profile] !== 'undefined'
                            && typeof this.socketByWorld[profile][nodeId] !== 'undefined') {
                            this.socketByWorld[profile][nodeId].send(
                                JSON.stringify({
                                    type: FriendsServerOpcodes.RELAY_BROADCAST,
                                    message: broadcast
                                })
                            );
                        }
                    } else if (type === FriendsClientOpcodes.RELAY_TRACK) {
                        const { profile, nodeId, username, state } = message;

                        if (typeof this.socketByWorld[profile] !== 'undefined'
                            && typeof this.socketByWorld[profile][nodeId] !== 'undefined') {
                            this.socketByWorld[profile][nodeId].send(
                                JSON.stringify({
                                    type: FriendsServerOpcodes.RELAY_TRACK,
                                    username,
                                    state
                                })
                            );
                        }
                    } else if (type === FriendsClientOpcodes.RELAY_RELOAD) {
                        const { profile, nodeId } = message;

                        if (typeof this.socketByWorld[profile] !== 'undefined'
                            && typeof this.socketByWorld[profile][nodeId] !== 'undefined') {
                            this.socketByWorld[profile][nodeId].send(
                                JSON.stringify({
                                    type: FriendsServerOpcodes.RELAY_RELOAD
                                })
                            );
                        }
                    } else if (type === FriendsClientOpcodes.RELAY_CLEARLOGINS) {
                        const { profile, nodeId } = message;

                        if (typeof this.socketByWorld[profile] !== 'undefined'
                            && typeof this.socketByWorld[profile][nodeId] !== 'undefined') {
                            this.socketByWorld[profile][nodeId].send(
                                JSON.stringify({
                                    type: FriendsServerOpcodes.RELAY_CLEARLOGINS
                                })
                            );
                        }
                    } else if (type === FriendsClientOpcodes.RELAY_CLEARLOGOUTS) {
                        const { profile, nodeId } = message;

                        if (typeof this.socketByWorld[profile] !== 'undefined'
                            && typeof this.socketByWorld[profile][nodeId] !== 'undefined') {
                            this.socketByWorld[profile][nodeId].send(
                                JSON.stringify({
                                    type: FriendsServerOpcodes.RELAY_CLEARLOGOUTS
                                })
                            );
                        }
                    } else if (type === FriendsClientOpcodes.RELAY_QUEUESCRIPT) {
                        const { profile, nodeId, scriptName, username } = message;

                        if (typeof this.socketByWorld[profile] !== 'undefined'
                            && typeof this.socketByWorld[profile][nodeId] !== 'undefined') {
                            this.socketByWorld[profile][nodeId].send(
                                JSON.stringify({
                                    type: FriendsServerOpcodes.RELAY_QUEUESCRIPT,
                                    scriptName,
                                    username
                                })
                            );
                        }
                    } else {
                        console.error(`[Friend]: Unknown message type=${type}`);
                    }
                } catch (err) {
                    console.error(err);
                }
            });

            socket.on('close', () => {});
            socket.on('error', () => {});
        });
    }

    async start() {}

    private async initializeWorld(profile: string, world: number, socket: WebSocket) {
        if (!this.socketByWorld[profile]) {
            this.socketByWorld[profile] = {};
        }

        if (this.socketByWorld[profile][world]) {
            this.socketByWorld[profile][world].terminate();
        }

        this.socketByWorld[profile][world] = socket;

        if (!this.repositories[profile]) {
            this.repositories[profile] = new FriendServerRepository(profile);
        }

        this.repositories[profile].initializeWorld(world, WORLD_PLAYER_LIMIT);
    }

    private async sendFriendsListToPlayer(profile: string, username37: bigint, socket: WebSocket) {
        const playerFriends = await this.repositories[profile].getFriends(username37);

        socket.send(
            JSON.stringify({
                type: FriendsServerOpcodes.UPDATE_FRIENDLIST,
                username37: username37.toString(),
                friends: playerFriends.map(f => [f[0], f[1].toString()])
            })
        );
    }

    private async sendIgnoreListToPlayer(profile: string, username37: bigint, socket: WebSocket) {
        const playerIgnores = await this.repositories[profile].getIgnores(username37);

        socket.send(
            JSON.stringify({
                type: FriendsServerOpcodes.UPDATE_IGNORELIST,
                username37: username37.toString(),
                ignored: playerIgnores.map(i => i.toString())
            })
        );
    }

    private async broadcastWorldToFollowers(profile: string, username37: bigint) {
        const followers = this.repositories[profile].getFollowers(username37);

        for (const follower of followers) {
            await this.sendPlayerWorldUpdate(profile, follower, username37);
        }
    }

    private getPlayerWorldSocket(profile: string, username: bigint) {
        const world = this.repositories[profile].getWorld(username);
        if (!world) {
            return null;
        }

        return this.socketByWorld[profile][world] ?? null;
    }

    private sendPlayerWorldUpdate(profile: string, viewer: bigint, other: bigint) {
        const socket = this.getPlayerWorldSocket(profile, viewer);

        if (!socket) {
            return Promise.resolve();
        }

        const otherPlayerWorld = this.repositories[profile].getWorld(other);

        socket.send(
            JSON.stringify({
                type: FriendsServerOpcodes.UPDATE_FRIENDLIST,
                username37: viewer.toString(),
                friends: [[this.repositories[profile].isVisibleTo(viewer, other) ? otherPlayerWorld : 0, other.toString()]]
            })
        );
    }

    private sendPrivateMessage(profile: string, username: bigint, staffLvl: number, pmId: number, target: bigint, chat: string) {
        const socket = this.getPlayerWorldSocket(profile, target);

        if (!socket) {
            return Promise.resolve();
        }

        socket.send(
            JSON.stringify({
                type: FriendsServerOpcodes.PRIVATE_MESSAGE,
                username37: username.toString(),
                targetUsername37: target.toString(),
                staffLvl,
                pmId,
                chat
            })
        );
    }
}

export class FriendClient extends InternalClient {
    nodeId: number = 0;
    profile: string;

    constructor(nodeId: number) {
        super(Environment.FRIEND_HOST, Environment.FRIEND_PORT);

        this.nodeId = nodeId;
        this.profile = Environment.NODE_PROFILE;
    }

    public async worldConnect() {
        await this.connect();

        if (!this.ws || !this.wsr || !this.wsr.checkIfWsLive()) {
            return;
        }

        this.ws.send(
            JSON.stringify({
                type: FriendsClientOpcodes.WORLD_CONNECT,
                world: this.nodeId,
                profile: this.profile
            })
        );
    }

    public async playerLogin(username: string, privateChat: number, staffLvl: number) {
        await this.connect();

        if (!this.ws || !this.wsr || !this.wsr.checkIfWsLive()) {
            return;
        }

        this.ws.send(
            JSON.stringify({
                type: FriendsClientOpcodes.PLAYER_LOGIN,
                world: this.nodeId,
                profile: this.profile,
                username37: toBase37(username).toString(),
                privateChat,
                staffLvl
            })
        );
    }

    public async playerLogout(username: string) {
        await this.connect();

        if (!this.ws || !this.wsr || !this.wsr.checkIfWsLive()) {
            return;
        }

        this.ws.send(
            JSON.stringify({
                type: FriendsClientOpcodes.PLAYER_LOGOUT,
                world: this.nodeId,
                profile: this.profile,
                username37: toBase37(username).toString()
            })
        );
    }

    public async playerFriendslistAdd(username: string, target: bigint) {
        await this.connect();

        if (!this.ws || !this.wsr || !this.wsr.checkIfWsLive()) {
            return;
        }

        this.ws.send(
            JSON.stringify({
                type: FriendsClientOpcodes.FRIENDLIST_ADD,
                world: this.nodeId,
                profile: this.profile,
                username37: toBase37(username).toString(),
                targetUsername37: target.toString()
            })
        );
    }

    public async playerFriendslistRemove(username: string, target: bigint) {
        await this.connect();

        if (!this.ws || !this.wsr || !this.wsr.checkIfWsLive()) {
            return;
        }

        this.ws.send(
            JSON.stringify({
                type: FriendsClientOpcodes.FRIENDLIST_DEL,
                world: this.nodeId,
                profile: this.profile,
                username37: toBase37(username).toString(),
                targetUsername37: target.toString()
            })
        );
    }

    public async playerIgnorelistAdd(username: string, target: bigint) {
        await this.connect();

        if (!this.ws || !this.wsr || !this.wsr.checkIfWsLive()) {
            return;
        }

        this.ws.send(
            JSON.stringify({
                type: FriendsClientOpcodes.IGNORELIST_ADD,
                world: this.nodeId,
                profile: this.profile,
                username37: toBase37(username).toString(),
                targetUsername37: target.toString()
            })
        );
    }

    public async playerIgnorelistRemove(username: string, target: bigint) {
        await this.connect();

        if (!this.ws || !this.wsr || !this.wsr.checkIfWsLive()) {
            return;
        }

        this.ws.send(
            JSON.stringify({
                type: FriendsClientOpcodes.IGNORELIST_DEL,
                world: this.nodeId,
                profile: this.profile,
                username37: toBase37(username).toString(),
                targetUsername37: target.toString()
            })
        );
    }

    public async playerChatSetMode(username: string, privateChatMode: ChatModePrivate) {
        await this.connect();

        if (!this.ws || !this.wsr || !this.wsr.checkIfWsLive()) {
            return;
        }

        this.ws.send(
            JSON.stringify({
                type: FriendsClientOpcodes.PLAYER_CHAT_SETMODE,
                world: this.nodeId,
                profile: this.profile,
                username37: toBase37(username).toString(),
                privateChat: privateChatMode
            })
        );
    }

    public async privateMessage(username: string, staffLvl: number, pmId: number, target: bigint, chat: string, coord: number) {
        await this.connect();

        if (!this.ws || !this.wsr || !this.wsr.checkIfWsLive()) {
            return;
        }

        this.ws.send(
            JSON.stringify({
                type: FriendsClientOpcodes.PRIVATE_MESSAGE,
                world: this.nodeId,
                profile: this.profile,
                nodeTime: Date.now(),
                username37: toBase37(username).toString(),
                targetUsername37: target.toString(),
                staffLvl,
                pmId,
                chat,
                coord
            })
        );
    }

    async publicMessage(username: string, coord: number, chat: string) {
        await this.connect();

        if (!this.ws || !this.wsr || !this.wsr.checkIfWsLive()) {
            return;
        }

        this.ws.send(
            JSON.stringify({
                type: FriendsClientOpcodes.PUBLIC_CHAT_LOG,
                nodeId: this.nodeId,
                profile: this.profile,
                nodeTime: Date.now(),
                username,
                coord,
                chat
            })
        );
    }
}
