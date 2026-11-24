// stdlib
import fs from 'fs';
import { randomInt } from 'crypto';
import { isMainThread, Worker } from 'worker_threads';

// deps
import * as rsbuf from '#/network/rsbuf/index.js';
import { PlayerInfoProt } from '#/network/rsbuf/index.js';
import kleur from 'kleur';
import forge from 'node-forge';
import { TTLCache } from '@isaacs/ttlcache';

// lostcity
import CategoryType from '#/cache/config/CategoryType.js';
import Component from '#/cache/config/Component.js';
import DbRowType from '#/cache/config/DbRowType.js';
import DbTableType from '#/cache/config/DbTableType.js';
import EnumType from '#/cache/config/EnumType.js';
import FontType from '#/cache/config/FontType.js';
import HuntType from '#/cache/config/HuntType.js';
import IdkType from '#/cache/config/IdkType.js';
import InvType from '#/cache/config/InvType.js';
import LocType from '#/cache/config/LocType.js';
import MesanimType from '#/cache/config/MesanimType.js';
import NpcType from '#/cache/config/NpcType.js';
import ObjType from '#/cache/config/ObjType.js';
import ParamType from '#/cache/config/ParamType.js';
import ScriptVarType from '#/cache/config/ScriptVarType.js';
import SeqType from '#/cache/config/SeqType.js';
import SpotanimType from '#/cache/config/SpotanimType.js';
import StructType from '#/cache/config/StructType.js';
import VarNpcType from '#/cache/config/VarNpcType.js';
import VarPlayerType from '#/cache/config/VarPlayerType.js';
import VarSharedType from '#/cache/config/VarSharedType.js';
import { CrcBuffer32, makeCrcs } from '#/cache/CrcTable.js';
import WordEnc from '#/cache/wordenc/WordEnc.js';
import { BlockWalk } from '#/engine/entity/BlockWalk.js';
import { EntityLifeCycle } from '#/engine/entity/EntityLifeCycle.js';
import { NpcList } from '#/engine/entity/EntityList.js';
import { PlayerTimerType } from '#/engine/entity/EntityTimer.js';
import { HuntModeType } from '#/engine/entity/hunt/HuntModeType.js';
import Loc from '#/engine/entity/Loc.js';
import LocObjEvent from '#/engine/entity/LocObjEvent.js';
import { isClientConnected, NetworkPlayer } from '#/engine/entity/NetworkPlayer.js';
import Npc from '#/engine/entity/Npc.js';
import { NpcEventRequest, NpcEventType } from '#/engine/entity/NpcEventRequest.js';
import { NpcStat } from '#/engine/entity/NpcStat.js';
import Obj from '#/engine/entity/Obj.js';
import Player from '#/engine/entity/Player.js';
import { PlayerLoading } from '#/engine/entity/PlayerLoading.js';
import { EntityQueueState, PlayerQueueType } from '#/engine/entity/PlayerQueueRequest.js';
import { PlayerStat } from '#/engine/entity/PlayerStat.js';
import { SessionLog } from '#/engine/entity/tracking/SessionLog.js';
import { WealthTransactionEvent, WealthEvent } from '#/engine/entity/tracking/WealthEvent.js';
import GameMap, { changeLocCollision, changeNpcCollision, changeBlockCollision, changePlayerOccCollision } from '#/engine/GameMap.js';
import { Inventory } from '#/engine/Inventory.js';
import ScriptPointer from '#/engine/script/ScriptPointer.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import { tradingPostDiscord } from '#/engine/script/handlers/TradingPostOps.js';
import ScriptState from '#/engine/script/ScriptState.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import { WorldStat } from '#/engine/WorldStat.js';
import Zone from '#/engine/zone/Zone.js';
import Isaac from '#/io/Isaac.js';
import Packet from '#/io/Packet.js';
import { ReportAbuseReason } from '#/network/game/client/model/ReportAbuse.js';
import MessagePrivate from '#/network/game/server/model/MessagePrivate.js';
import ClanChat from '#/engine/clan/ClanChat.js';
import UpdateFriendList from '#/network/game/server/model/UpdateFriendList.js';
import UpdateIgnoreList from '#/network/game/server/model/UpdateIgnoreList.js';
import UpdateRebootTimer from '#/network/game/server/model/UpdateRebootTimer.js';
import ClientSocket from '#/server/ClientSocket.js';
import { spawnThread } from '#/server/Threads.js';
import { FriendsServerOpcodes } from '#/server/friend/FriendServer.js';
import { FriendThreadMessage } from '#/server/friend/FriendThread.js';
import { LoggerEventType } from '#/server/logger/LoggerEventType.js';
import { filteredEventTypes, groupedEventTypes } from '#/server/logger/WealthEventType.js';
import { type GenericLoginThreadResponse, isChangePasswordResponse, isForgetLoginsResponse, isHelperResponse, isPlayerLoginResponse, isPlayerLogoutResponse, isVeteranResponse } from '#/server/login/index.d.js';
import LoginToken from '#/server/login/LoginToken.js';
import {
    trackCycleBandwidthInBytes,
    trackCycleBandwidthOutBytes,
    trackCycleClientInTime,
    trackCycleClientOutTime,
    trackCycleLoginTime,
    trackCycleLogoutTime,
    trackCycleNpcTime,
    trackCyclePlayerTime,
    trackCycleTime,
    trackCycleWorldTime,
    trackCycleZoneTime,
    trackNpcCount,
    trackPlayerCount,
    trackPlayerPacketsPerTick,
    trackSessionEventsPublished
} from '#/server/Metrics.js';
import Environment from '#/util/Environment.js';
import { fromBase37, toBase37, toDisplayName, toSafeName } from '#/util/JString.js';
import LinkList from '#/datastruct/LinkList.js';
import Ping from '#/network/game/server/model/Ping.js';
import { printDebug, printError, printInfo, printWarning } from '#/util/Logger.js';
import OnDemand from './OnDemand.js';
import { ObjDelayedRequest } from './entity/ObjDelayedRequest.js';
import DbTableIndex from '#/cache/config/DbTableIndex.js';
import VarBitType from '#/cache/config/VarBitType.js';
import FriendlistLoaded from '#/network/game/server/model/FriendlistLoaded.js';
import HashTable from '#/datastruct/HashTable.js';
import Midi from '#/cache/midi/Midi.js';
import { chatCrown } from '#/engine/entity/ChatCrown.js';
import type { BotHooks } from '#/engine/bot/BotHooks.js';

// custom (2026-09-27) - the login block's key. The old one (data/config/private.pem) was 512-bit and
// committed to a public repo, so anyone who saw a login could read the password in it. The new one is
// made on the server by `npm run rsa`, is never committed (data/config/ is ignored), and the client
// carries its public half (Client.java LOGIN_RSAN / LOGIN_RSAE).
if (!fs.existsSync(Environment.LOGIN_RSA_KEY_PATH)) {
    throw new Error(`No login RSA key at ${Environment.LOGIN_RSA_KEY_PATH}. Run \`npm run rsa\` to make one, then put the modulus it prints into the client (Client.java LOGIN_RSAN / LOGIN_RSAE).`);
}
const priv = forge.pki.privateKeyFromPem(fs.readFileSync(Environment.LOGIN_RSA_KEY_PATH, 'ascii'));

// The login thread's replies that are a refusal (World.onLoginMessage turns each into the client's
// message); anything else let the player in.
const LOGIN_FAILURE_REPLIES = new Set([-1, 1, 3, 5, 6, 7, 8, 9, 10, 11]);

// custom (2026-11-02) - the revision that added saved logins, and the one before it.
//
// A login block from LOGIN_TOKEN_REVISION or later carries the two saved-login fields at the end;
// one from before it does not, and is let in without them rather than turned away, so the engine
// and the client can be shipped in either order. When every client in use is past it, both of
// these go and the revision check is an equality again.
const LOGIN_TOKEN_REVISION = 382;
const LOGIN_LEGACY_REVISION = 381;

type LogoutRequest = {
    /**
     * When the player actually left, which is NOT when this is sent. The request is retried every
     * 15 seconds until the login server confirms it, so the copy that arrives may be minutes old
     * and the player may be back on by then. The login server compares this against the account's
     * login time and refuses to mark somebody logged out who has logged in since.
     */
    requestedAt: number;
    save: Uint8Array;
    lastAttempt: number;
};

class World {
    private loginThread = spawnThread(new URL('../server/login/LoginThread.ts', import.meta.url));
    private friendThread = spawnThread(new URL('../server/friend/FriendThread.ts', import.meta.url));
    private loggerThread = spawnThread(new URL('../server/logger/LoggerThread.ts', import.meta.url));
    private devThread: Worker | null = null;
    // custom (2026-09-21) - only when Discord is configured; see server/discord/DiscordThread.ts.
    // AND ONLY ON THE MAIN THREAD. LoginServer imports Player and web.ts, both of which import this
    // file, so with EASY_STARTUP the login worker builds a World of its own - and without this check
    // it started a second bot, which answered every /link a second time against the same codes.
    private discordThread: Worker | null = isMainThread && Environment.DISCORD_TOKEN && Environment.DISCORD_GUILD_ID ? spawnThread(new URL('../server/discord/DiscordThread.ts', import.meta.url)) : null;

    private static readonly PLAYERS: number = Environment.NODE_MAX_PLAYERS;
    private static readonly NPCS: number = Environment.NODE_MAX_NPCS;

    private static readonly TICKRATE: number = 600; // ms (0.6s) - DO NOT CHANGE. This is only exposed for condensing time while testing long-running operations.

    private static readonly INV_STOCKRATE: number = 100; // 1m shop restocks

    private static readonly PLAYER_SAVERATE: number = 1500; // 15m autosave
    private static readonly PLAYER_COORDLOGRATE: number = 50; // 30s server check-in

    private static readonly AFK_EVENTRATE: number = 500; // 5m: 60/5 = 12 chances per hour
    private static readonly AFK_CHANCE1: number = 1 / (120 / 5); // 1/24 - 4% chance every 5 mins: avg 1 event every 2 hrs
    private static readonly AFK_CHANCE2: number = 1 / (60 / 5); // 1/12 - 8% chance every 5 mins: avg 1 event every 1 hr while "aggro zone" hasn't changed

    private static readonly TIMEOUT_NO_CONNECTION: number = 50; // 30s with no connection (16 ticks in osrs)
    private static readonly TIMEOUT_NO_RESPONSE: number = 100; // 60s without any response

    // the game/zones map
    readonly gameMap: GameMap = new GameMap(Environment.NODE_MEMBERS);

    // shared inventories (shops)
    readonly invs: Set<Inventory> = new Set();

    // entities
    readonly loginRequests: Map<string, ClientSocket> = new Map(); // waiting for response from login server
    readonly logoutRequests: Map<string, LogoutRequest> = new Map(); // waiting for confirmation from login server
    readonly newPlayers: Set<Player> = new Set(); // players joining at the end of this tick

    // the server processes players in the underlying bucket-order (key fragment + insertion order)
    readonly playerLoop: HashTable<Player> = new HashTable(8);
    // the client and server communicate via player "slots," separate from processing
    readonly players: Player[] = new Array(2048);

    readonly npcs: NpcList = new NpcList(World.NPCS);

    // zones
    readonly zonesTracking: Set<Zone> = new Set();
    readonly locObjTracker: LinkList<LocObjEvent> = new LinkList();
    readonly queue: LinkList<EntityQueueState> = new LinkList();
    readonly npcEventQueue: LinkList<NpcEventRequest> = new LinkList();
    readonly objDelayedQueue: LinkList<ObjDelayedRequest> = new LinkList();

    // debug data
    // custom (2026-11-03) - 13 entries for PACKETS_OUT_MAX, and Uint32 because Uint16 was already
    // too narrow for the one that was here: BANDWIDTH_OUT counts BYTES per tick, and 65535 of them
    // is 150 packets of 437, so a busy tick wrapped silently and lostcity_cycle_bandwidth_out_bytes
    // under-reported by whole multiples of 64 KB with nothing to say it had.
    readonly lastCycleStats: Uint32Array = new Uint32Array(13);
    readonly cycleStats: Uint32Array = new Uint32Array(13);

    // custom (2026-11-24) - THE LAST FIVE MINUTES OF CYCLE TIMES, so somebody can ask the world how
    // it is keeping up instead of being told the game feels laggy. The slow-tick warning below
    // already writes to the journal, but only when a tick is over budget, only every 30 seconds, and
    // nobody in game can read it - which is how "fishing is slow" and "the world is slow" stayed
    // indistinguishable while fishing's rates were measured three times over. ::ticks reads this.
    //
    // A ring, not a list: 500 entries is five minutes at 600ms and the oldest is simply overwritten,
    // so it costs 2KB and never grows.
    private static readonly CYCLE_HISTORY: number = 500;
    private readonly cycleHistory: Uint32Array = new Uint32Array(World.CYCLE_HISTORY);
    private cycleHistoryWrites: number = 0;

    tickRate: number = World.TICKRATE; // speeds up when we're processing server shutdown
    currentTick: number = 0; // the current tick of the game world.
    nextTick: number = 0; // the next time the game world should tick.
    shutdownTick: number = -1;
    pmCount: number = 1; // can't be 0 as clients will ignore the pm, their array is filled with 0 as default

    vars: Int32Array = new Int32Array(); // var shared
    varsString: string[] = [];

    sessionLogs: SessionLog[] = [];
    wealthTransactionGroup: Map<string, WealthTransactionEvent> = new Map();
    wealthTransactions: WealthTransactionEvent[] = [];

    // custom (2026-09-27) - the bot manager (engine/bot/BotManager.ts) plugs in here when NODE_BOTS is
    // set. A hook rather than an import so the world does not depend on the bots at all.
    bots: BotHooks | null = null;

    // how often a slow tick may be written to the log, and how many went unsaid since (processPings' neighbour)
    static readonly SLOW_TICK_WARN_INTERVAL: number = 30000;
    private slowTickCount: number = 0;
    private lastSlowTickWarning: number = 0;

    loginAddressAttempts: TTLCache<string, number> = new TTLCache({ ttl: 60000 });
    loginDeviceAttempts: TTLCache<string, number> = new TTLCache({ ttl: 15000 });

    constructor() {
        // A WORKER ERROR MUST NOT BE AN UNCAUGHT EXCEPTION. These three workers had 'message'
        // handlers and no 'error' handler, and an unhandled 'error' event on a Worker is rethrown
        // as an uncaught exception - so anything going wrong inside one of them took the whole
        // process down with it, with only the worker's own stack to go on.
        //
        // It is not hypothetical. Under tsx the worker entries cannot resolve their own "#/"
        // imports (package.json maps "#/*", and Node's imports field forbids keys starting with
        // "#/", so only tsx's transform of a static import resolves them - and a worker entry is
        // loaded by Node directly). So in EVERY tools/sim run all three of these fail to start.
        // It stayed invisible because the rejection only lands once something yields to the event
        // loop: a sim that runs straight through to process.exit() never gives it the chance. The
        // ones that did yield - a dynamic import, or simply having no process.exit() and reaching
        // teardown - died with ERR_INVALID_MODULE_SPECIFIER and no summary, which is how
        // blowpipe.ts and huntgaps.ts came to print nothing at all for however long.
        //
        // Logged loudly rather than swallowed: a server running without its logger or login worker
        // is degraded and the operator needs to know, but it is still better than a process that
        // exits on a worker nobody was watching.
        for (const [name, worker] of [
            ['login', this.loginThread],
            ['friend', this.friendThread],
            ['logger', this.loggerThread]
        ] as const) {
            worker.on('error', err => printError(`${name} worker failed: ${err instanceof Error ? err.message : String(err)}`));
        }

        this.loginThread.on('message', msg => {
            try {
                this.onLoginMessage(msg);
            } catch (err) {
                console.error(err);
            }
        });

        this.friendThread.on('message', msg => {
            try {
                this.onFriendMessage(msg);
            } catch (err) {
                console.error(err);
            }
        });

        this.discordThread?.on('message', msg => {
            try {
                this.onDiscordMessage(msg);
            } catch (err) {
                console.error(err);
            }
        });
    }

    // ---- the Discord relay (custom, 2026-09-21) ----

    get discordEnabled(): boolean {
        return this.discordThread !== null;
    }

    // A one-time code for /link. Unambiguous characters only - no 0/O, 1/I/L - because it is read off
    // the game screen and typed into Discord. (2026-10-19) 8 characters from crypto.randomInt: it was 6
    // from Math.random, the same generator the game's own randomness comes from.
    discordCode(player: Player): string {
        const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 8; i++) {
            code += alphabet[randomInt(alphabet.length)];
        }
        this.discordThread?.postMessage({ type: 'code', username: player.username, code });
        return code;
    }

    discordUnlink(player: Player): void {
        this.discordThread?.postMessage({ type: 'unlink', username: player.username });
    }

    /**
     * custom (2026-11-15) - LINKING WITHOUT ::discord. A login that came from a launcher signed in
     * to Discord says so, and the relay records the link itself.
     *
     * ::discord IS NOT GOING ANYWHERE. The browser client at play.deathplateau.com has no launcher
     * and never will, so the code and /link are still the only way for those players - this is a
     * convenience for launcher players, not a replacement, and nothing may be written on the
     * assumption that every account has a link.
     *
     * WHAT IS PROVED, EXACTLY. ::discord proves both ends: you are logged in to the character AND
     * you are using the Discord account. This proves the character (the password or a saved login
     * got us here) and a launcher that was signed in to Discord on this computer - which on a
     * shared machine is not necessarily the same person. So the relay only ever ADDS a link where
     * there is none, never moves one, and the player is told it happened and how to undo it.
     */
    discordLauncherLink(username: string, token: string): void {
        this.discordThread?.postMessage({ type: 'launcher-link', username, token });
    }

    // offer: the pending offer this notice is about, if it is about one - the relay puts Accept and
    // Decline on that message (server/discord/DiscordThread.ts). items: what is in it, listed.
    discordNotify(username: string, text: string, offer?: number, items?: string[]): void {
        this.discordThread?.postMessage({ type: 'notify', username, text, offer, items });
    }

    private onDiscordMessage(msg: { type: string; username: string; discord?: string; had?: boolean; auto?: boolean; id?: number; action?: string; arg?: number }): void {
        // A trading post request from the bot. It is answered from this thread because this thread
        // owns the market's database - see the note above tradingPostDiscord - and the reply carries
        // the worker's own request id back so it can match it up.
        if (msg.type === 'tp') {
            let reply;
            try {
                reply = tradingPostDiscord({ username: msg.username, action: msg.action ?? '', arg: msg.arg ?? 0 });
            } catch (err) {
                console.error('Discord relay: trading post request failed', err);
                reply = { text: 'Something went wrong. Try it in game.' };
            }
            this.discordThread?.postMessage({ type: 'tp-result', id: msg.id, ...reply });
            return;
        }
        const player = this.getPlayerByUsername(msg.username);
        if (!player) {
            return;
        }
        if (msg.type === 'linked') {
            // The automatic one says more, because nobody asked for it: what happened, and the one
            // command that undoes it. A player who typed ::discord and /link knows what they did.
            player.wrappedMessageGame(
                msg.auto
                    ? `Your launcher is signed in to Discord as @dre@${msg.discord}@bla@, so this character is now linked to it. Type @dre@::discord unlink@bla@ if you would rather it was not.`
                    : `Linked to Discord as @dre@${msg.discord}@bla@. Trading post alerts will be sent there too.`
            );
        } else if (msg.type === 'launcher-link-conflict') {
            // Rare and worth saying: the launcher is signed in, but this character belongs to
            // another Discord account. Silence here reads as the sign-in not working.
            player.wrappedMessageGame('This character is already linked to a different Discord account. Type @dre@::discord unlink@bla@ here first if you want to link it to the one your launcher is signed in to.');
        } else if (msg.type === 'unlinked') {
            player.wrappedMessageGame(msg.had ? 'Your account is no longer linked to Discord.' : 'Your account was not linked to Discord.');
        }
    }

    get shutdown() {
        return this.shutdownTick != -1 && this.currentTick >= this.shutdownTick;
    }

    // shutting down within the next 30s
    get shutdownSoon() {
        return this.shutdownTick != -1 && this.currentTick >= this.shutdownTick - 50;
    }

    reload(clearInvs: boolean = true): void {
        OnDemand.reloadCache();

        VarPlayerType.load('data/pack');
        VarBitType.load('data/pack');
        ParamType.load('data/pack');
        ObjType.load('data/pack');
        LocType.load('data/pack');
        NpcType.load('data/pack');
        IdkType.load('data/pack');
        SeqType.load('data/pack');
        SpotanimType.load('data/pack');
        CategoryType.load('data/pack');
        EnumType.load('data/pack');
        StructType.load('data/pack');
        InvType.load('data/pack');

        if (clearInvs) {
            this.invs.clear();
            for (let id = 0; id < InvType.count; id++) {
                const inv = InvType.get(id);

                if (inv.scope === InvType.SCOPE_SHARED) {
                    this.invs.add(Inventory.fromType(id));
                } else if (inv.scope === InvType.SCOPE_TEMP) {
                    for (const player of this.playerLoop.all()) {
                        if (player.invs.has(id)) {
                            player.invs.delete(id);
                        }
                    }
                }
            }
        }

        MesanimType.load('data/pack');
        DbTableType.load('data/pack');
        DbRowType.load('data/pack');
        DbTableIndex.init();
        HuntType.load('data/pack');
        VarNpcType.load('data/pack');
        VarSharedType.load('data/pack');

        if (this.vars.length !== VarSharedType.count) {
            const old = this.vars;
            this.vars = new Int32Array(VarSharedType.count);
            for (let i = 0; i < VarSharedType.count && i < old.length; i++) {
                this.vars[i] = old[i];
            }

            const oldString = this.varsString;
            this.varsString = new Array(VarSharedType.count);
            for (let i = 0; i < VarSharedType.count && i < old.length; i++) {
                this.varsString[i] = oldString[i];
            }

            for (let i = 0; i < this.vars.length; i++) {
                const varsh = VarSharedType.get(i);
                if (varsh.type === ScriptVarType.STRING) {
                    // todo: "null"? another value?
                    continue;
                } else {
                    this.vars[i] = varsh.type === ScriptVarType.INT ? 0 : -1;
                }
            }
        }

        Component.load('data/pack');

        const count = ScriptProvider.load('data/pack');
        if (Environment.NODE_DEBUG) {
            if (count === -1) {
                this.broadcastMes('There was an issue while reloading scripts.');
            } else {
                this.broadcastMes(`Loaded ${count} scripts.`);
            }
        } else {
            if (count === -1) {
                printError('There was an issue while reloading scripts.');
            } else {
                printDebug(`Loaded ${count} scripts.`);
            }
        }

        // todo: check if any jag files changed (transmitted) then reload crcs, instead of always
        makeCrcs();
    }

    /**
     * Whether this world runs its own loop. False means a tool is driving the ticks by hand
     * (tools/sim, tools/charter), and then cycle() must not schedule the next one - see the comment
     * where it would.
     */
    private ownsTheLoop = true;

    async start(skipMaps = false, startCycle = true): Promise<void> {
        this.ownsTheLoop = startCycle;
        printInfo('Starting world');

        FontType.load('data/pack');
        WordEnc.load('data/pack');
        Midi.load();

        this.reload();

        if (!skipMaps) {
            this.gameMap.init();
        }

        setTimeout(() => {
            this.loginThread.postMessage({
                type: 'world_startup'
            });

            this.friendThread.postMessage({
                type: 'connect'
            });
        }, 2000);

        // custom (2026-09-29) - THE DEV THREAD BELONGS TO A SERVER, NOT TO A TOOL. It walks
        // BUILD_SRC_DIR and puts an fs.watch on every directory under it (1200 of them for this
        // content) so that saving a script rebuilds the cache. A tool that drives the ticks itself -
        // tools/sim, tools/charter - wants neither half of that: a rebuild finishing mid-scenario
        // fires dev_reload, which calls reload() and swaps every config out from under the run, and
        // the watcher is still registering handles seconds after boot, so a tool that reaches its
        // process.exit() in that window takes V8 down with it on the way out ("Check failed:
        // (location_) != nullptr", exit code 3, whatever the run had just printed). startCycle is
        // exactly the line between the two: a world that does not run its own loop is a tool.
        if (!Environment.NODE_PRODUCTION && startCycle) {
            this.createDevThread();

            if (Environment.BUILD_STARTUP) {
                this.rebuild();
            }
        }

        // custom (2026-11-04) - SAY SO WHEN NOTHING IS BEING RECORDED. LoggerThread drops every
        // message it is handed unless LOGGER_SERVER is set, and that flag defaults to false, so a
        // world can run for months writing no session_log, no wealth events, no player reports and
        // no input tracking while the logger's own listener prints "Logger server listening" on
        // every boot and means nothing by it. There is no way to tell from the outside except by
        // querying a table and finding it empty.
        if (!Environment.LOGGER_SERVER) {
            printWarning('LOGGER_SERVER is not set, so NOTHING is being recorded: no session_log, no wealth events, no player reports, no input tracking or counts. Set LOGGER_SERVER=true in .env to keep an audit trail.');
        }

        printInfo(kleur.green().bold('World ready'));

        if (startCycle) {
            OnDemand.cycle();

            this.nextTick = Date.now() + World.TICKRATE;
            this.cycle();
        }
    }

    // ----

    /** The recent cycle times in the order they happened, oldest first. Empty on a world that has not ticked. */
    recentCycles(): number[] {
        const n = Math.min(this.cycleHistoryWrites, World.CYCLE_HISTORY);
        const out: number[] = [];
        for (let i = 0; i < n; i++) {
            out.push(this.cycleHistory[(this.cycleHistoryWrites - n + i) % World.CYCLE_HISTORY]);
        }
        return out;
    }

    /** How the world is keeping up, in the lines ::ticks prints. */
    cycleReport(): string[] {
        const cycles = this.recentCycles();
        if (cycles.length === 0) {
            return ['The world has not completed a tick yet.'];
        }
        const budget = this.tickRate;
        const sorted = [...cycles].sort((a, b) => a - b);
        const mean = cycles.reduce((a, b) => a + b, 0) / cycles.length;
        const median = sorted[Math.floor(sorted.length / 2)];
        const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
        const over = budget > 0 ? cycles.filter(c => c > budget).length : 0;
        const window = ((cycles.length * budget) / 1000).toFixed(0);
        const last = this.lastCycleStats;
        return [
            `Last ${cycles.length} ticks (about ${window}s): mean ${mean.toFixed(1)}ms, median ${median}ms, 95th ${p95}ms, worst ${sorted[sorted.length - 1]}ms.`,
            `Budget ${budget}ms. ${over} tick${over === 1 ? '' : 's'} over it (${((over / cycles.length) * 100).toFixed(1)}%).` +
                (over === 0 ? ' The world is keeping up, so whatever feels slow is not the tick rate.' : ' Everything in the game runs late by this much.'),
            `Last tick ${last[WorldStat.CYCLE]}ms: world ${last[WorldStat.WORLD]}, in ${last[WorldStat.CLIENT_IN]}, npcs ${last[WorldStat.NPC]}, players ${last[WorldStat.PLAYER]}, zones ${last[WorldStat.ZONE]}, out ${last[WorldStat.CLIENT_OUT]}, cleanup ${last[WorldStat.CLEANUP]}.`,
            `${this.getHumanPlayerCount()} players, up to ${last[WorldStat.PACKETS_OUT_MAX]} packets to one client.`
        ];
    }

    cycle(): void {
        try {
            const start: number = Date.now();
            const drift: number = Math.max(0, start - this.nextTick);

            // world processing
            // - world queue
            // - npc hunt
            this.processWorld();

            // client input
            // - calculate afk event readiness
            // - process packets
            // - process pathfinding/following request
            // - client input tracking
            this.processClientsIn();

            // Spawn triggers, despawn triggers
            this.processNpcEventQueue();

            // npc processing (if npc is not busy)
            // - resume suspended script
            // - stat regen
            // - timer
            // - queue
            // - movement
            // - modes
            this.processNpcs();

            // player processing
            // - primary queue
            // - weak queue
            // - timers
            // - soft timers
            // - engine queue
            // - interactions
            // - movement
            // - close interface if attempting to logout
            this.processPlayers();

            // player logout
            this.processLogouts();

            // player login, good spot for it (before packets so they immediately load but after processing so nothing hits them)
            this.processLogins();

            // process zones
            // - build list of active zones around players
            // - loc/obj despawn/respawn
            // - compute shared buffer
            this.processZones();

            // process player & npc update info
            // - convert player movements
            // - compute player info
            // - convert npc movements
            // - compute npc info
            this.processInfo();

            // client output
            // - map update
            // - player info
            // - npc info
            // - zone updates
            // - inv changes
            // - stat changes
            // - afk zones changes
            // - flush packets
            // custom (2026-11-03) - measure the round trip to each client, before the flush below
            // so the probe rides out with everything else this tick.
            this.processPings();

            this.processClientsOut();

            // cleanup
            // - reset zones
            // - reset players
            // - reset npcs
            // - reset invs
            this.processCleanup();

            // ----

            const tick: number = this.currentTick;

            if (this.shutdown) {
                this.processShutdown();
            }

            if (tick % World.PLAYER_SAVERATE === 0 && tick > 0) {
                // auto-save players every 15 mins
                this.savePlayers();
            }

            if (tick % World.PLAYER_COORDLOGRATE === 0 && tick > 0) {
                for (const player of this.playerLoop.all()) {
                    player.addSessionLog(LoggerEventType.MODERATOR, 'Server check in');
                }
            }

            // todo: move this into PLAYER_COORDLOGRATE if memory usage is sane?
            if (this.sessionLogs.length > 0) {
                this.loggerThread.postMessage({
                    type: 'session_log',
                    logs: this.sessionLogs
                });

                this.sessionLogs = [];
            }

            if (this.wealthTransactionGroup.size > 0) {
                this.wealthTransactions.push(...this.wealthTransactionGroup.values());

                this.wealthTransactionGroup.clear();
            }

            if (this.wealthTransactions.length > 0) {
                this.loggerThread.postMessage({
                    type: 'wealth_event',
                    events: this.wealthTransactions
                });

                this.wealthTransactions = [];
            }

            this.cycleStats[WorldStat.CYCLE] = Date.now() - start; // set the main logic stat here, before telemetry.
            this.cycleHistory[this.cycleHistoryWrites % World.CYCLE_HISTORY] = this.cycleStats[WorldStat.CYCLE];
            this.cycleHistoryWrites++;

            // custom (2026-11-03) - say so when the world runs late. A tick is 600ms; longer than that
            // and every player feels it, wherever they are. Nothing used to be logged at all, so the
            // only way to know was to be told the game felt laggy. Throttled, with the count of the
            // overruns that were swallowed in between, because a struggling world would otherwise
            // write a line every tick and make the journal part of the problem.
            if (this.cycleStats[WorldStat.CYCLE] > this.tickRate && this.tickRate > 0) {
                this.slowTickCount++;
                if (Date.now() - this.lastSlowTickWarning >= World.SLOW_TICK_WARN_INTERVAL) {
                    const since = this.slowTickCount;
                    this.slowTickCount = 0;
                    this.lastSlowTickWarning = Date.now();
                    printWarning(
                        `tick ${this.currentTick} took ${this.cycleStats[WorldStat.CYCLE]}ms (over the ${this.tickRate}ms budget)` +
                            ` - ${since} slow tick${since === 1 ? '' : 's'} since the last warning.` +
                            ` world ${this.cycleStats[WorldStat.WORLD]} | in ${this.cycleStats[WorldStat.CLIENT_IN]} | npcs ${this.cycleStats[WorldStat.NPC]}` +
                            ` | players ${this.cycleStats[WorldStat.PLAYER]} | zones ${this.cycleStats[WorldStat.ZONE]} | out ${this.cycleStats[WorldStat.CLIENT_OUT]}` +
                            ` | cleanup ${this.cycleStats[WorldStat.CLEANUP]} ms, ${this.getHumanPlayerCount()} players,` +
                            ` up to ${this.cycleStats[WorldStat.PACKETS_OUT_MAX]} packets to one client`
                    );
                }
            }

            this.lastCycleStats[WorldStat.CYCLE] = this.cycleStats[WorldStat.CYCLE];
            this.lastCycleStats[WorldStat.WORLD] = this.cycleStats[WorldStat.WORLD];
            this.lastCycleStats[WorldStat.CLIENT_IN] = this.cycleStats[WorldStat.CLIENT_IN];
            this.lastCycleStats[WorldStat.NPC] = this.cycleStats[WorldStat.NPC];
            this.lastCycleStats[WorldStat.PLAYER] = this.cycleStats[WorldStat.PLAYER];
            this.lastCycleStats[WorldStat.LOGOUT] = this.cycleStats[WorldStat.LOGOUT];
            this.lastCycleStats[WorldStat.LOGIN] = this.cycleStats[WorldStat.LOGIN];
            this.lastCycleStats[WorldStat.ZONE] = this.cycleStats[WorldStat.ZONE];
            this.lastCycleStats[WorldStat.CLIENT_OUT] = this.cycleStats[WorldStat.CLIENT_OUT];
            this.lastCycleStats[WorldStat.CLEANUP] = this.cycleStats[WorldStat.CLEANUP];
            this.lastCycleStats[WorldStat.BANDWIDTH_IN] = this.cycleStats[WorldStat.BANDWIDTH_IN];
            this.lastCycleStats[WorldStat.BANDWIDTH_OUT] = this.cycleStats[WorldStat.BANDWIDTH_OUT];
            this.lastCycleStats[WorldStat.PACKETS_OUT_MAX] = this.cycleStats[WorldStat.PACKETS_OUT_MAX];

            // push stats to prometheus
            if (Environment.NODE_PRODUCTION) {
                trackPlayerCount.set(this.getHumanPlayerCount());
                trackNpcCount.set(this.getTotalNpcs());

                trackCycleTime.observe(this.cycleStats[WorldStat.CYCLE]);
                trackCycleWorldTime.observe(this.cycleStats[WorldStat.WORLD]);
                trackCycleClientInTime.observe(this.cycleStats[WorldStat.CLIENT_IN]);
                trackCycleClientOutTime.observe(this.cycleStats[WorldStat.CLIENT_OUT]);
                trackCycleNpcTime.observe(this.cycleStats[WorldStat.NPC]);
                trackCyclePlayerTime.observe(this.cycleStats[WorldStat.PLAYER]);
                trackCycleZoneTime.observe(this.cycleStats[WorldStat.ZONE]);
                trackCycleLoginTime.observe(this.cycleStats[WorldStat.LOGIN]);
                trackCycleLogoutTime.observe(this.cycleStats[WorldStat.LOGOUT]);

                trackCycleBandwidthInBytes.inc(this.cycleStats[WorldStat.BANDWIDTH_IN]);
                trackCycleBandwidthOutBytes.inc(this.cycleStats[WorldStat.BANDWIDTH_OUT]);
            }

            if (Environment.NODE_DEBUG_PROFILE) {
                printInfo(`tick ${this.currentTick}: ${this.cycleStats[WorldStat.CYCLE]}/${this.tickRate} ms, ${Math.trunc(process.memoryUsage().heapTotal / 1024 / 1024)} MB heap`);
                printDebug(`${this.getTotalPlayers()}/${World.PLAYERS} players | ${this.getTotalNpcs()}/${World.NPCS} npcs | ${this.gameMap.getTotalZones()} zones | ${this.gameMap.getTotalLocs()} locs | ${this.gameMap.getTotalObjs()} objs`);
                printDebug(
                    `${this.cycleStats[WorldStat.WORLD]} ms world | ${this.cycleStats[WorldStat.CLIENT_IN]} ms client in | ${this.cycleStats[WorldStat.NPC]} ms npcs | ${this.cycleStats[WorldStat.PLAYER]} ms players | ${this.cycleStats[WorldStat.LOGOUT]} ms logout | ${this.cycleStats[WorldStat.LOGIN]} ms login | ${this.cycleStats[WorldStat.ZONE]} ms zones | ${this.cycleStats[WorldStat.CLIENT_OUT]} ms client out | ${this.cycleStats[WorldStat.CLEANUP]} ms cleanup`
                );
            }

            this.currentTick++;
            this.nextTick += this.tickRate;

            // ----

            // ONLY IF THIS WORLD OWNS THE LOOP. A tool that calls cycle() by hand (World.start's
            // startCycle = false) must not have one scheduled behind its back: tools/sim is
            // synchronous, so the timer never fires and nobody noticed - until a scenario awaited
            // something, the pending cycle ran while it waited, and because tick() refreshes
            // lastConnected only around its OWN cycles, every player in the run was logged out for
            // a lost connection in the gap. See tools/sim/harness.ts tick().
            if (this.ownsTheLoop) {
                setTimeout(this.cycle.bind(this), Math.max(0, this.tickRate - (Date.now() - start) - drift));
            }
        } catch (err) {
            if (err instanceof Error) {
                printError('eep eep cabbage! An unhandled error occurred during the cycle: ' + err.message);
                console.error(err.stack);
            }

            // custom (2026-10-19) - save first, straight to disk. This used to call removePlayer, which
            // only QUEUES a save for the login thread - and the process exits before that queue is ever
            // posted, so every player went back to their last autosave (up to 15 minutes) and any crash
            // was a dupe: hand an item over, the receiver logs out and is saved, crash the world, and the
            // giver has it back. removePlayer also touches the map and zones, which a crash may be in the
            // middle of breaking, so it runs after, and each player on their own.
            this.writeSavesForCrash();

            printError('Removing all players...');

            for (const player of this.playerLoop.all()) {
                try {
                    this.removePlayer(player);
                } catch (removeErr) {
                    console.error(removeErr);
                }
            }

            // TODO inform Friends server that the world has gone offline

            printError('All players removed.');
            printError('Closing the server.');
            process.exit(1);
        }
    }

    // - world queue
    // - npc hunt
    private processWorld(): void {
        const start: number = Date.now();

        // - world queue
        for (const request of this.queue.all()) {
            const delay = request.delay--;
            if (delay > 0) {
                continue;
            }

            const script: ScriptState = request.script;
            try {
                const state: number = ScriptRunner.execute(script);

                // remove from queue no matter what, re-adds if necessary
                request.unlink();

                if (state === ScriptState.SUSPENDED) {
                    // suspend to player (probably not needed)
                    script.activePlayer.activeScript = script;
                } else if (state === ScriptState.NPC_SUSPENDED) {
                    // suspend to npc (probably not needed)
                    script.activeNpc.activeScript = script;
                } else if (state === ScriptState.WORLD_SUSPENDED) {
                    // suspend to world again
                    this.enqueueScript(script, script.popInt());
                }
            } catch (err) {
                console.error(err);
            }
        }

        // - add objs delayed
        for (const request of this.objDelayedQueue.all()) {
            const delay = request.delay--;
            if (delay > 0) {
                continue;
            }
            try {
                request.unlink();
                this.addObj(request.obj, request.receiver64, request.duration);
            } catch (err) {
                console.error(err);
            }
        }

        // - npc hunt players if not busy
        if (this.getTotalPlayers() > 0) {
            for (const npc of this.npcs) {
                // Check if npc is alive
                if (npc.isActive) {
                    // Hunts will process even if the npc is delayed during this portion
                    if (npc.huntMode !== -1 && rsbuf.getNpcObservers(npc.nid) > 0) {
                        const hunt = HuntType.get(npc.huntMode);

                        if (hunt && hunt.type === HuntModeType.PLAYER) {
                            npc.huntAll(hunt);
                        }
                    }
                }
            }
        }

        this.cycleStats[WorldStat.WORLD] = Date.now() - start;
    }

    // - calculate afk event readiness
    // - process packets
    // - process pathfinding/following request
    // - client input tracking
    private processClientsIn(): void {
        const start: number = Date.now();

        this.cycleStats[WorldStat.BANDWIDTH_IN] = 0;

        // bots: spawns, respawns, removals - before anyone's input, as a login would be
        if (this.bots) {
            try {
                this.bots.cycle();
            } catch (err) {
                console.error(err);
            }
        }

        for (const player of this.playerLoop.all()) {
            try {
                player.playtime++;

                if (this.currentTick % World.AFK_EVENTRATE === 0) {
                    player.afkEventReady = Math.random() < (player.zonesAfk() ? World.AFK_CHANCE2 : World.AFK_CHANCE1);
                }

                // - client input tracking
                player.processInputTracking();

                // A bot's "packets": its brain calls the same handlers a client's packets reach, here,
                // where a client's are read - then the engine treats the result exactly as it would a
                // client's (the block below, repeated for it).
                if (player.isBot && this.bots) {
                    const bot = player as Player & { userPath: number[]; opcalled: boolean };
                    this.bots.input(player);
                    if (bot.userPath.length > 0 || bot.opcalled) {
                        if (player.delayed) {
                            player.unsetMapFlag();
                            continue;
                        }

                        player.moveClickRequest = !(!player.busy() && bot.opcalled);
                    }
                }

                if (isClientConnected(player) && player.decodeIn()) {
                    if (player.userPath.length > 0 || player.opcalled) {
                        if (player.delayed) {
                            player.unsetMapFlag();
                            continue;
                        }

                        if (!player.busy() && player.opcalled) {
                            player.moveClickRequest = false;
                        } else {
                            player.moveClickRequest = true;
                        }
                    }
                }

                if (player.logMessage !== null) {
                    this.logPublicChat(player, player.logMessage);
                }
            } catch (err) {
                console.error(err);
                if (isClientConnected(player)) {
                    player.logout();
                    player.client.close();
                }
            }
        }

        this.cycleStats[WorldStat.CLIENT_IN] = Date.now() - start;
    }

    // Despawn and respawn
    private processNpcEventQueue(): void {
        for (const request of this.npcEventQueue.all()) {
            const npc = request.npc;
            if (!npc.delayed) {
                request.unlink();
                const state = ScriptRunner.init(request.script, npc);
                npc.executeScript(state);
            }
        }
    }

    // - resume suspended script
    // - stat regen
    // - timer
    // - queue
    // - movement
    // - modes
    private processNpcs(): void {
        const start: number = Date.now();
        for (const npc of this.npcs) {
            try {
                npc.turn();
            } catch (err) {
                console.error(err);
                this.removeNpc(npc, 0);
            }
        }
        this.cycleStats[WorldStat.NPC] = Date.now() - start;
    }

    // - resume suspended script
    // - primary queue
    // - weak queue
    // - timers
    // - soft timers
    // - engine queue
    // - interactions
    // - movement
    // - close interface if attempting to logout
    private processPlayers(): void {
        const start: number = Date.now();

        for (const player of this.playerLoop.all()) {
            try {
                if (player.delayed && this.currentTick >= player.delayedUntil) player.delayed = false;

                // - resume suspended script
                if (!player.delayed && player.activeScript && player.activeScript.execution === ScriptState.SUSPENDED) {
                    player.executeScript(player.activeScript, true, true);
                }

                // - primary queue
                // - weak queue
                player.processQueues();
                if (!player.loggingOut) {
                    // - timers
                    player.processTimers(PlayerTimerType.NORMAL);
                    // - soft timers
                    player.processTimers(PlayerTimerType.SOFT);
                }
                // - engine queue
                player.processEngineQueue();
                // Face the interaction target -- both halves, the same tick the op set the target (the op ran
                // in processClientsIn) and before processInteraction can clear it: the FACE_ENTITY mask, plus
                // the serverside faceAngle toward a pathing target (for new observers).
                player.setFaceEntity();
                player.reorientEntity();
                // - interactions
                // - movement
                player.processInteraction();
                // After movement: face a loc/obj target if we walked over and held still (needs stepsTaken).
                player.reorient();

                // - run energy
                player.updateEnergy();

                if ((player.masks & PlayerInfoProt.EXACT_MOVE) == 0) {
                    player.validateDistanceWalked();
                }
            } catch (err) {
                console.error(err);
                if (isClientConnected(player)) {
                    player.logout();
                    player.client.close();
                }
            }
        }

        // ---- SECOND QUEUE PASS: WHY PVP HITS USED TO SPLIT ACROSS TWO TICKS ----
        //
        // A pvp hit is delivered as a queue entry on the VICTIM (~.pvp_damage in the content), and
        // the loop above runs each player's queue BEFORE their own interaction. So a hit queued by
        // an attacker who sits earlier in playerLoop than the victim waits a whole tick, and one
        // queued by an attacker who sits later lands in the same tick. playerLoop buckets by IP
        // address - so which of the two you get was decided by the attackers' IPs.
        //
        // Two players hitting one target on the same tick therefore split across two ticks
        // whenever one of them was in front of the victim and the other behind: measured at 0 of
        // 11 hits stacking in that arrangement, against 5 of 6 when both attackers were in front.
        // That is the "magic spell + melee attack should stack, it currently delays" report.
        //
        // This pass gives every entry added during this tick its chance in this tick, whoever
        // added it, so the arrangement stops mattering: all three orderings now stack, and the
        // splat still lands on the tick the swing happened rather than a tick later.
        // PlayerQueueRequest.lastTick keeps each request counting down exactly once per tick, so
        // nothing that already ran or already counted down is touched twice.
        for (const player of this.playerLoop.all()) {
            try {
                player.processQueues();
            } catch (err) {
                console.error(err);
            }
        }

        this.cycleStats[WorldStat.PLAYER] = Date.now() - start;
    }

    private processLogouts(): void {
        const start: number = Date.now();

        for (const player of this.playerLoop.all()) {
            let force = false;
            if (this.shutdown || this.currentTick - player.lastResponse >= World.TIMEOUT_NO_RESPONSE) {
                // world shutdown or x-logged / timed out for 60s: force logout
                player.loggingOut = true;
                force = true;
                player.logoutReason = this.shutdown ? 'world shutdown' : 'no response for 60s';
            } else if (this.currentTick - player.lastConnected >= World.TIMEOUT_NO_CONNECTION) {
                // connection lost for 30s: request idle logout
                player.requestIdleLogout = true;
                player.logoutReason = 'connection lost for 30s';
            } else if (Environment.NODE_PRODUCTION && Environment.NODE_IDLE_LOGOUT_TICKS > 0 && !player.isBot && player.staffModLevel < 3) {
                // custom (2026-10-19) - idle logout, decided here. The only one there was is the client's
                // IDLE_TIMER, which a modified client never sends (and which NODE_DEBUG, on by default,
                // ignores) - so anyone could stand AFK for ever. After NODE_IDLE_LOGOUT_TICKS with no real
                // input it is the ordinary idle logout, which waits for combat to end; after three times that
                // it does not wait, so standing in a spot where monsters never stop attacking is not a way
                // to stay on. Administrators and up are left alone.
                if (player.lastUserInput === -1) {
                    player.lastUserInput = this.currentTick;
                }
                const idle = this.currentTick - player.lastUserInput;
                if (idle >= Environment.NODE_IDLE_LOGOUT_TICKS * 3) {
                    player.loggingOut = true;
                    force = true;
                    player.logoutReason = 'idle, in combat';
                } else if (idle >= Environment.NODE_IDLE_LOGOUT_TICKS) {
                    player.requestIdleLogout = true;
                    player.logoutReason = 'idle';
                }
            }

            if (player.requestLogout || player.requestIdleLogout) {
                if (this.currentTick >= player.preventLogoutUntil) {
                    player.loggingOut = true;
                } else if (player.requestLogout && player.preventLogoutMessage !== null) {
                    player.messageGame(player.preventLogoutMessage); // engine message type in osrs
                    player.preventLogoutMessage = null;
                }
                player.requestLogout = false;
                player.requestIdleLogout = false;
            }

            if (player.loggingOut && (force || this.currentTick >= player.preventLogoutUntil)) {
                player.closeModal();

                let queueDiscardable = true;
                for (const request of player.queue.all()) {
                    if (request.type === PlayerQueueType.LONG) {
                        const logoutAction = request.args[0];
                        if (logoutAction === 1) {
                            // ^discard
                            continue;
                        }
                    }
                    queueDiscardable = false;
                    break;
                }
                if (player.canAccess() && player.engineQueue.head() === null && queueDiscardable) {
                    const script = ScriptProvider.getByTriggerSpecific(ServerTriggerType.LOGOUT, -1, -1);
                    if (!script) {
                        printError('LOGOUT TRIGGER IS BROKEN!');
                        continue;
                    }

                    const state = ScriptRunner.init(script, player);
                    state.pointerAdd(ScriptPointer.ProtectedActivePlayer);
                    ScriptRunner.execute(state);

                    this.removePlayer(player);
                }
            }
        }

        for (const [username, request] of this.logoutRequests) {
            if (request.lastAttempt < Date.now() - 15000) {
                request.lastAttempt = Date.now();
                this.loginThread.postMessage({
                    type: 'player_logout',
                    username,
                    save: request.save,
                    requestedAt: request.requestedAt
                });
            }
        }

        this.cycleStats[WorldStat.LOGOUT] = Date.now() - start;
    }

    private processLogins(): void {
        const start: number = Date.now();
        player: for (const player of this.newPlayers) {
            // prevent logging in if a player save is being flushed
            if (this.logoutRequests.has(player.username)) {
                console.error(`[DEBUG-KICK] site=mid-logout username=${player.username}`);
                player.addSessionLog(LoggerEventType.ENGINE, 'Tried to log in - old session is mid-logout');

                if (isClientConnected(player)) {
                    player.client.send(Uint8Array.from([5]));
                    player.client.close();
                }

                continue;
            }

            // reconnect a new socket with player in the world
            if (player.reconnecting) {
                for (const other of this.playerLoop.all()) {
                    if (player.username !== other.username) {
                        continue;
                    }

                    if (isClientConnected(other)) {
                        player.addSessionLog(LoggerEventType.MODERATOR, 'Logged to world ' + Environment.NODE_ID + ' replacing session', other.client.uuid);
                        other.client.close();
                    }

                    if (other instanceof NetworkPlayer && player instanceof NetworkPlayer) {
                        other.client = player.client;
                        other.session = other.client.uuid;
                        other.client.send(Uint8Array.from([15]));
                    }

                    rsbuf.cleanupPlayerBuildArea(other.slot);

                    other.onReconnect();

                    this.friendThread.postMessage({
                        type: 'player_login',
                        username: other.username,
                        chatModePrivate: other.privateChat,
                        staffLvl: other.staffModLevel
                    });

                    continue player;
                }
            }

            // a bot world keeps the bots' names to the bots, so "Bot <name>" always means a bot
            if (player instanceof NetworkPlayer && this.bots && this.bots.isReservedName(player.username)) {
                player.addSessionLog(LoggerEventType.ENGINE, 'Tried to log in - name reserved for bots');
                this.forceLogout(player, 3);
                continue;
            }

            // player already logged in
            for (const other of this.playerLoop.all()) {
                if (player.username !== other.username) {
                    continue;
                }

                if (player instanceof NetworkPlayer) {
                    console.error(`[DEBUG-KICK] site=duplicate-username incoming=${player.username} existing=${other.username} existingConnected=${isClientConnected(other)}`);
                    player.addSessionLog(LoggerEventType.ENGINE, 'Tried to log in - already logged in');
                    player.client.send(Uint8Array.from([5]));
                    player.client.close();
                }

                continue player;
            }

            // prevent logging in when the server is shutting down
            if (this.shutdownSoon) {
                if (isClientConnected(player)) {
                    player.addSessionLog(LoggerEventType.ENGINE, 'Tried to log in - server is shutting down');
                    this.forceLogout(player, 14);
                }

                continue;
            }

            // normal login process
            const slot: number = this.getNextPlayerSlot();
            if (slot === -1) {
                // world full
                if (isClientConnected(player)) {
                    player.addSessionLog(LoggerEventType.ENGINE, 'Tried to log in - world full');
                    this.forceLogout(player, 7);
                }
                continue;
            }

            if (isClientConnected(player)) {
                if (player.reconnecting) {
                    player.addSessionLog(LoggerEventType.MODERATOR, 'Logged in (client reports reconnecting)');
                } else {
                    player.addSessionLog(LoggerEventType.MODERATOR, 'Logged in');
                }

                player.client.state = 1;

                player.client.send(
                    Uint8Array.from([
                        2,
                        // the rank the client echoes its own lines with - see ChatCrown
                        //
                        // NO VETERAN HERE, and it is not an oversight. The client keeps this byte
                        // as Client.staffmodlevel and gates three moderator things on it: the
                        // "Report abuse" option on a chat line and the mute option on the report
                        // interface (>= 1), and ::clientdrop / ::lag / ::prefetchmusic (>= 2).
                        // Crown 7 would pass all of them, so a veteran would be offered a
                        // moderator's menu. The server would refuse whatever they clicked, but
                        // being shown it is wrong on its own.
                        //
                        // The veteran emblem reaches the client in the appearance instead
                        // (Player.chatIcons), which is where every other player's icons come from
                        // and which carries no rights with it. This byte is only a fallback for
                        // the local player's own lines before an appearance has been read.
                        chatCrown(player.staffModLevel),
                        1 // mouse tracking can only be enabled on login
                    ])
                );

                const remote = player.client.remoteAddress;
                if (remote.indexOf('.') !== -1) {
                    // IPv4
                    const octets = remote.split('.');
                    const bucket = ((parseInt(octets[0]) << 24) | (parseInt(octets[1]) << 16) | (parseInt(octets[2]) << 8) | parseInt(octets[3])) >>> 0;
                    this.playerLoop.add(BigInt(bucket), player);
                } else if (remote.indexOf(':') !== -1) {
                    // IPv6
                    const hextets = remote.split('%', 1)[0].split(':');
                    let omitted = 8 - hextets.filter(Boolean).length;
                    let key = 0n;
                    for (const hextet of hextets) {
                        if (hextet) {
                            key = (key << 16n) | BigInt(parseInt(hextet, 16));
                        } else if (omitted) {
                            key <<= BigInt(omitted * 16);
                            omitted = 0;
                        }
                    }
                    this.playerLoop.add(key, player);
                } else {
                    // custom (2026-11-03) - AND AN ADDRESS THAT IS NEITHER OF THOSE. normalizeAddress
                    // answers 'unknown' when a socket has no remoteAddress, which Node does for one
                    // already destroyed by the time the connection event fires, and that string holds
                    // no '.' and no ':' - so neither branch above ran and the player was not added to
                    // the loop AT ALL. Logged in, greeted, saved, holding a session, and then never
                    // ticked: no input read, no logout processing, no cleanup, until a restart.
                    //
                    // Everything here buckets by address so that one address cannot take more than
                    // its turn; an address we cannot read is one bucket shared by all of them, which
                    // is the cautious end of that same rule. Found by a sim whose stub socket left
                    // remoteAddress at its default - see tools/sim/packetcount.ts.
                    this.playerLoop.add(0n, player);
                }
            } else {
                // 127.0.0.1
                this.playerLoop.add(2130706433n, player);
            }

            this.players[slot] = player;
            rsbuf.addPlayer(slot);
            player.slot = slot;
            player.uid = ((Number(player.username37 & 0x1fffffn) << 11) | player.slot) >>> 0;
            player.tele = true;
            player.moveClickRequest = false;

            this.gameMap.getZone(player.x, player.z, player.level).enter(player);
            player.onLogin();
            if (!player.isBot) {
                printInfo(`login  ${player.username} at ${player.level},${player.x},${player.z}`);
            }
            if (player.isBot) {
                // no clan channel, no friends-list presence
                continue;
            }
            ClanChat.onLogin(player);
            this.veteranCape(player, player.veteran);

            if (this.shutdownTick != -1) {
                player.write(new UpdateRebootTimer(this.shutdownTick - this.currentTick));
            }

            this.friendThread.postMessage({
                type: 'player_login',
                username: player.username,
                chatModePrivate: player.privateChat,
                staffLvl: player.staffModLevel
            });
        }
        this.newPlayers.clear();
        this.cycleStats[WorldStat.LOGIN] = Date.now() - start;
    }

    // - loc/obj despawn/respawn
    // - compute shared buffer
    private processZones(): void {
        const start: number = Date.now();
        try {
            for (const event of this.locObjTracker.all()) {
                // Check if the event is still valid
                if (event.check()) {
                    event.entity.turn();
                }
                // If this is false, we have not constructed our LinkedList properly somewhere
                else {
                    console.error('Loc Obj event is invalid');
                }
            }

            // Compute shared for tracked zones
            for (const zone of this.zonesTracking) {
                zone.computeShared();
            }
        } catch (err) {
            if (err instanceof Error) {
                printError(`Error during processZones: ${err.message}`);
                console.error(err.stack);
            }
        }
        this.cycleStats[WorldStat.ZONE] = Date.now() - start;
    }

    // - convert player movements
    // - compute player info
    // - convert npc movements
    // - compute npc info
    private processInfo(): void {
        if (this.getTotalPlayers() === 0) {
            return;
        }

        // TODO: benchmark this?
        for (const player of this.playerLoop.all()) {
            // facing (reorientEntity/reorient) runs in the player's turn (processPlayers), not here.
            player.buildArea.rebuildNormal(); // set origin before compute player is why this is above.

            const appearance = player.masks & PlayerInfoProt.APPEARANCE ? player.generateAppearance() : (player.appearanceBuf ?? player.generateAppearance());

            rsbuf.computePlayer(
                player.x,
                player.level,
                player.z,
                player.originX,
                player.originZ,
                player.slot,
                player.tele,
                player.jump,
                player.runDir,
                player.walkDir,
                player.visibility,
                player.isActive,
                player.masks,
                appearance,
                player.lastAppearance,
                player.faceEntity,
                player.faceSquareX,
                player.faceSquareZ,
                player.faceAngleX,
                player.faceAngleZ,
                player.hitmarkDamage,
                player.hitmarkType,
                player.hitmark2Damage,
                player.hitmark2Type,
                player.levels[PlayerStat.HITPOINTS],
                player.baseLevels[PlayerStat.HITPOINTS],
                player.animId,
                player.animDelay,
                player.sayMessage,
                player.chatMessage,
                player.chatColour ?? -1,
                player.chatEffect ?? -1,
                player.chatRights ?? 0,
                player.spotanimId,
                player.spotanimHeight,
                player.spotanimTime,
                player.exactStartX,
                player.exactStartZ,
                player.exactEndX,
                player.exactEndZ,
                player.exactMoveStart,
                player.exactMoveEnd,
                player.exactMoveFacing
            );
        }

        for (const npc of this.npcs) {
            // THE HEALTH BAR IS ONE BYTE EACH WAY. Client.java reads current and max with g1
            // and draws current * 30 / max, so an npc with more than 255 hitpoints wraps on the
            // wire. Zulrah's 500 arrives as 244 and its current health arrives as hp & 255,
            // which means the bar EMPTIES as the snake is taken from 500 down to 256 and springs
            // back to full the instant it crosses 255. That is exactly the "I drop it to zero,
            // it heals to full and carries on" this boss was reported for twice - the fight was
            // right the whole time and the bar was lying. Scale the pair into a byte instead,
            // which is all the bar wants: it only ever draws the two as a fraction of thirty
            // pixels. ceil so the scaled value never rounds a live boss down to zero - though
            // a thirty-pixel bar still draws nothing below a thirtieth of full, as it always did.
            const hp = npc.levels[NpcStat.HITPOINTS];
            const hpMax = npc.baseLevels[NpcStat.HITPOINTS];
            const barMax = hpMax > 255 ? 255 : hpMax;
            const barHp = hpMax > 255 ? Math.min(barMax, Math.ceil((hp * 255) / hpMax)) : hp;
            // facing (reorientEntity/reorient) runs in Npc.turn(), not here.
            rsbuf.computeNpc(
                npc.x,
                npc.level,
                npc.z,
                npc.nid,
                npc.type,
                npc.tele,
                npc.jump,
                npc.runDir,
                npc.walkDir,
                npc.isActive,
                npc.masks,
                npc.faceEntity,
                npc.faceSquareX,
                npc.faceSquareZ,
                npc.faceAngleX,
                npc.faceAngleZ,
                npc.hitmarkDamage,
                npc.hitmarkType,
                npc.hitmark2Damage,
                npc.hitmark2Type,
                barHp,
                barMax,
                npc.animId,
                npc.animDelay,
                npc.sayMessage,
                npc.spotanimId,
                npc.spotanimHeight,
                npc.spotanimTime
            );
        }
    }

    // - map update
    // - player info
    // - npc info
    // - zone updates
    // - inv changes
    // - stat changes
    // - afk zones changes
    // - flush packets
    private processClientsOut(): void {
        const start: number = Date.now();

        this.cycleStats[WorldStat.BANDWIDTH_OUT] = 0; // reset bandwidth counter
        this.cycleStats[WorldStat.PACKETS_OUT_MAX] = 0; // ...and the per-tick packet high-water mark

        for (const player of this.playerLoop.all()) {
            if (!isClientConnected(player)) {
                continue;
            }

            try {
                // - map update
                player.updateMap();
                // - player info
                player.updatePlayers();
                // - npc info
                player.updateNpcs();
                // - zone updates
                player.updateZones();
                // - inv changes
                player.updateInvs();
                // - stat changes
                player.updateStats();
                // - afk zones changes
                player.updateAfkZones();

                // - flush packets
                player.encodeOut();
            } catch (err) {
                console.error(err);
                if (isClientConnected(player)) {
                    player.logout();
                    player.client.close();
                }
            }
        }
        this.cycleStats[WorldStat.CLIENT_OUT] = Date.now() - start;
    }

    // - reset zones
    // - reset players
    // - reset npcs
    // - reset invs
    private processCleanup(): void {
        const start: number = Date.now();
        const tick: number = this.currentTick;

        // - reset zones
        this.zonesTracking.forEach(zone => zone.reset());
        this.zonesTracking.clear();

        // - reset players
        for (const player of this.playerLoop.all()) {
            player.resetEntity(false);

            // custom (2026-11-03) - HOW CLOSE THIS CLIENT CAME TO FALLING BEHIND. Counted here, at
            // the end of the tick, because messages are written throughout one (a script's say,
            // processClientsOut's info packets) and the figure is the tick's whole output.
            if (isClientConnected(player)) {
                const sent = player.packetsThisTick;
                player.packetsThisTick = 0;
                if (sent > this.cycleStats[WorldStat.PACKETS_OUT_MAX]) {
                    this.cycleStats[WorldStat.PACKETS_OUT_MAX] = sent;
                }
                if (Environment.NODE_PRODUCTION) {
                    trackPlayerPacketsPerTick.observe(sent);
                }
            }

            // - reset invs (players)
            for (const inv of player.invs.values()) {
                if (!inv) {
                    continue;
                }

                inv.resetTracking();
            }
        }

        // - reset npcs
        for (const npc of this.npcs) {
            npc.resetEntity(false);
        }

        // - reset invs (world)
        for (const inv of this.invs) {
            inv.resetTracking();

            // Increase or Decrease shop stock
            const invType = InvType.get(inv.type);

            if (!invType.restock || !invType.stockcount || !invType.stockrate) {
                continue;
            }

            for (let index: number = 0; index < inv.items.length; index++) {
                const item = inv.items[index];
                if (!item) {
                    continue;
                }
                // Item stock is under min.
                //
                // THIS WRITES THE SLOT RATHER THAN CALLING inv.add, and it has to. A shop slot is
                // seeded as { id: stockobj[i], count: stockcount[i] } whatever the obj's own
                // stackability (Inventory's constructor), and a slot bought down to zero KEEPS the
                // obj at count 0 - Inventory.remove deliberately leaves listed stock in place so
                // the shop still shows it. inv.add on a NON-STACKABLE obj then takes the
                // "find a null slot" branch, skips that count-0 placeholder because it is not
                // null, and restocks into some unrelated empty slot further down the grid - or,
                // in a shop with no spare slots, does nothing at all and the item is gone for the
                // lifetime of the world. Both the Vote clerk's single ring and Grace's nine
                // recolour kits were permanently buyable exactly once.
                if (item.count < invType.stockcount[index] && tick % invType.stockrate[index] === 0) {
                    inv.set(index, { id: item.id, count: item.count + 1 });
                    inv.update = true;
                    continue;
                }
                // Item stock is over min
                if (item.count > invType.stockcount[index] && tick % invType.stockrate[index] === 0) {
                    inv.remove(item.id, 1, index);
                    inv.update = true;
                    continue;
                }

                // Item stock is not listed, such as general stores
                // Tested on low and high player count worlds, ever 1 minute stock decreases.
                if (invType.allstock && !invType.stockcount[index] && tick % World.INV_STOCKRATE === 0) {
                    inv.remove(item.id, 1, index);
                    inv.update = true;
                }
            }
        }

        rsbuf.cleanup();

        this.cycleStats[WorldStat.CLEANUP] = Date.now() - start;
    }

    private processShutdown(): void {
        for (const player of this.playerLoop.all()) {
            if (isClientConnected(player)) {
                player.logout();
                player.client.close();
            }
        }

        const duration = this.currentTick - this.shutdownTick;
        if (duration >= 1024) {
            // force remove all players, they had their chances to finish processing
            for (const player of this.playerLoop.all()) {
                player.addSessionLog(LoggerEventType.ENGINE, 'Player force removed!');
                printError(`Player '${player.username}' force removed!`);
                this.removePlayer(player);
            }
        }

        // bots have nothing to save: they go at once
        for (const player of this.playerLoop.all()) {
            if (player.isBot) {
                this.removePlayer(player);
            }
        }

        const online = this.getTotalPlayers();
        if (online === 0 && this.logoutRequests.size === 0) {
            printInfo('Server shutdown complete');
            process.exit(0);
        }

        if (duration > 2) {
            // after 1 second, kick into high gear (need time to flush logout packets first)
            this.tickRate = 0;
        }
    }

    private savePlayers(): void {
        for (const player of this.playerLoop.all()) {
            if (player.isBot) {
                continue; // bots have no save file
            }
            this.loginThread.postMessage({
                type: 'player_autosave',
                username: player.username,
                save: player.save()
            });
        }
    }

    // One player, now, outside the 15-minute cycle. For anything that has moved their holdings somewhere
    // their save file cannot follow - the trading post above all - so a crash cannot roll the inventory
    // back to before a trade that has already been recorded elsewhere.
    autosavePlayer(player: Player): void {
        if (player.isBot) {
            return;
        }
        this.loginThread.postMessage({
            type: 'player_autosave',
            username: player.username,
            save: player.save()
        });
    }

    enqueueScript(script: ScriptState, delay: number = 0): void {
        this.queue.addTail(new EntityQueueState(script, delay + 1));
    }

    getInventory(inv: number): Inventory | null {
        if (inv === -1) {
            return null;
        }

        for (const inventory of this.invs) {
            if (inventory.type === inv) {
                return inventory;
            }
        }

        const inventory: Inventory = Inventory.fromType(inv);
        this.invs.add(inventory);
        return inventory;
    }

    addNpc(npc: Npc, duration: number, firstSpawn: boolean = true): void {
        if (firstSpawn) {
            rsbuf.addNpc(npc.nid, npc.type);
            this.npcs.set(npc.nid, npc);
        }

        npc.x = npc.startX;
        npc.z = npc.startZ;
        npc.isActive = true;

        const zone = this.gameMap.getZone(npc.x, npc.z, npc.level);
        zone.enter(npc);

        switch (npc.blockWalk) {
            case BlockWalk.NPC:
                changeNpcCollision(npc.width, npc.x, npc.z, npc.level, true);
                break;
            case BlockWalk.ALL:
                changeNpcCollision(npc.width, npc.x, npc.z, npc.level, true);
                changeBlockCollision(npc.width, npc.x, npc.z, npc.level, true);
                break;
        }

        npc.resetEntity(true);
        npc.playAnimation(-1, 0);

        // Queue spawn trigger
        const type = NpcType.get(npc.type);
        const script = ScriptProvider.getByTrigger(ServerTriggerType.AI_SPAWN, type.id, type.category);
        if (script) {
            this.npcEventQueue.addTail(new NpcEventRequest(NpcEventType.SPAWN, script, npc));
        }

        if (duration > -1) {
            npc.setLifeCycle(duration);
        }
    }

    removeNpc(npc: Npc, duration: number): void {
        if (!npc.isActive) {
            return;
        }

        const zone = this.gameMap.getZone(npc.x, npc.z, npc.level);
        const adjustedDuration = this.scaleByPlayerCount(duration);
        zone.leave(npc);
        npc.isActive = false;

        switch (npc.blockWalk) {
            case BlockWalk.NPC:
                changeNpcCollision(npc.width, npc.x, npc.z, npc.level, false);
                break;
            case BlockWalk.ALL:
                changeNpcCollision(npc.width, npc.x, npc.z, npc.level, false);
                changeBlockCollision(npc.width, npc.x, npc.z, npc.level, false);
                break;
        }

        if (npc.lifecycle === EntityLifeCycle.DESPAWN) {
            rsbuf.removeNpc(npc.nid);
            this.npcs.remove(npc.nid);
            npc.cleanup();
        } else if (npc.lifecycle === EntityLifeCycle.RESPAWN && duration > -1) {
            npc.setLifeCycle(adjustedDuration);
        }
    }

    getLoc(x: number, z: number, level: number, locId: number): Loc | null {
        return this.gameMap.getZone(x, z, level).getLoc(x, z, locId);
    }

    getObj(x: number, z: number, level: number, objId: number, receiver64: bigint): Obj | null {
        return this.gameMap.getZone(x, z, level).getObj(x, z, objId, receiver64);
    }

    getObjOfReceiver(x: number, z: number, level: number, objId: number, receiver64: bigint): Obj | null {
        return this.gameMap.getZone(x, z, level).getObjOfReceiver(x, z, objId, receiver64);
    }

    trackZone(zone: Zone): void {
        this.zonesTracking.add(zone);
    }

    addLoc(loc: Loc, duration: number): void {
        // printDebug(`[World] addLoc => name: ${LocType.get(loc.type).name}, duration: ${duration}`);
        const type: LocType = LocType.get(loc.type);
        if (type.blockwalk) {
            changeLocCollision(loc.shape, loc.angle, type.blockrange, type.length, type.width, type.active, loc.x, loc.z, loc.level, true);
        }

        const zone: Zone = this.gameMap.getZone(loc.x, loc.z, loc.level);
        zone.addLoc(loc);
        this.trackZone(zone);
        loc.setLifeCycle(duration);
    }

    changeLoc(loc: Loc, typeID: number, shape: number, angle: number, duration: number) {
        // If a dynamic loc is inactive, it should never return to the game world
        if (loc.lifecycle === EntityLifeCycle.DESPAWN && !loc.isValid()) {
            return;
        }

        // Remove previous collision from game world if loc is active
        if (loc.isActive) {
            const fromType: LocType = LocType.get(loc.type);
            if (fromType.blockwalk) {
                changeLocCollision(loc.shape, loc.angle, fromType.blockrange, fromType.length, fromType.width, fromType.active, loc.x, loc.z, loc.level, false);
            }
        }

        // Update loc to new type
        loc.change(typeID, shape, angle);

        // Add new collision to game world
        const type: LocType = LocType.get(typeID);
        if (type.blockwalk) {
            changeLocCollision(loc.shape, loc.angle, type.blockrange, type.length, type.width, type.active, loc.x, loc.z, loc.level, true);
        }

        // Notify zone that loc has been changed
        const zone: Zone = this.gameMap.getZone(loc.x, loc.z, loc.level);
        zone.changeLoc(loc);
        this.trackZone(zone);

        // If the loc is changed or dynamic, set the lifecycle
        if (loc.isChanged() || loc.lifecycle === EntityLifeCycle.DESPAWN) {
            loc.setLifeCycle(duration);
        }
        // If the loc is static and unchanged (i.e., the change didn't do anything)
        else {
            loc.setLifeCycle(-1);
        }
    }

    mergeLoc(loc: Loc, player: Player, startCycle: number, endCycle: number, south: number, east: number, north: number, west: number): void {
        // printDebug(`[World] mergeLoc => name: ${LocType.get(loc.type).name}`);
        const zone: Zone = this.gameMap.getZone(loc.x, loc.z, loc.level);
        zone.mergeLoc(loc, player, startCycle, endCycle, south, east, north, west);
        this.trackZone(zone);
    }

    animLoc(loc: Loc, seq: number): void {
        // printDebug(`[World] animLoc => name: ${LocType.get(loc.type).name}, seq: ${seq}`);
        const zone: Zone = this.gameMap.getZone(loc.x, loc.z, loc.level);
        zone.animLoc(loc, seq);
        this.trackZone(zone);
    }

    removeLoc(loc: Loc, duration: number): void {
        // Locs can only be removed if they are currently active
        if (!loc.isActive) {
            return;
        }

        const type: LocType = LocType.get(loc.type);
        if (type.blockwalk) {
            changeLocCollision(loc.shape, loc.angle, type.blockrange, type.length, type.width, type.active, loc.x, loc.z, loc.level, false);
        }

        const zone: Zone = this.gameMap.getZone(loc.x, loc.z, loc.level);
        zone.removeLoc(loc);
        this.trackZone(zone);

        // If the Loc is static, set a respawn duratio
        if (loc.lifecycle === EntityLifeCycle.RESPAWN) {
            loc.setLifeCycle(duration);
        }
        // Dynamic locs get removed permanently
        else {
            loc.setLifeCycle(-1);
        }
    }

    revertLoc(loc: Loc) {
        // Remove previous collision from game world
        const fromType: LocType = LocType.get(loc.type);
        if (fromType.blockwalk) {
            changeLocCollision(loc.shape, loc.angle, fromType.blockrange, fromType.length, fromType.width, fromType.active, loc.x, loc.z, loc.level, false);
        }

        // Update loc to new type
        loc.revert();

        // Add new collision to game world
        const type: LocType = LocType.get(loc.type);
        if (type.blockwalk) {
            changeLocCollision(loc.shape, loc.angle, type.blockrange, type.length, type.width, type.active, loc.x, loc.z, loc.level, true);
        }

        // Notify zone that loc has been changed
        const zone: Zone = this.gameMap.getZone(loc.x, loc.z, loc.level);
        zone.changeLoc(loc);
        loc.setLifeCycle(-1);
        this.trackZone(zone);
    }

    addObj(obj: Obj, receiver64: bigint, duration: number): void {
        // Dev note: This function is slightly messy. Perhaps this can be organized better
        // Check if we need to changeobj first
        if (ObjType.get(obj.type).stackable && obj.lifecycle === EntityLifeCycle.DESPAWN) {
            const existing = this.getObjOfReceiver(obj.x, obj.z, obj.level, obj.type, receiver64);
            if (existing && existing.lifecycle === EntityLifeCycle.DESPAWN) {
                const nextCount = obj.count + existing.count;
                if (nextCount <= Inventory.STACK_LIMIT) {
                    // If an obj of the same type exists and is stackable and have the same receiver, then we merge them.
                    this.changeObj(existing, nextCount);
                    // Set the lifecycle without all the extra logic surrounding it
                    existing.lifecycleTick = duration;
                    return;
                }
            }
        }

        const zone: Zone = this.gameMap.getZone(obj.x, obj.z, obj.level);
        zone.addObj(obj, receiver64);
        this.trackZone(zone);
        // If the obj is dropped to a specific person
        if (receiver64 !== Obj.NO_RECEIVER) {
            // objs with a receiver always attempt to reveal 100 ticks after being dropped.
            // items that can't be revealed (untradable, members obj in f2p) will be skipped in revealObj
            obj.setLifeCycle(duration);
            obj.receiver64 = receiver64;

            // Reveal Obj in 100 ticks
            obj.reveal = Obj.REVEAL;
        }
        // If the obj is dropped to all
        else {
            obj.reveal = -1;
            obj.setLifeCycle(duration);
        }
    }

    revealObj(obj: Obj): void {
        const zone: Zone = this.gameMap.getZone(obj.x, obj.z, obj.level);
        zone.revealObj(obj);
        this.trackZone(zone);
    }

    changeObj(obj: Obj, newCount: number): void {
        // printDebug(`[World] changeObj => name: ${ObjType.get(obj.type).name}, receiverId: ${receiverId}, newCount: ${newCount}`);
        const zone: Zone = this.gameMap.getZone(obj.x, obj.z, obj.level);
        zone.changeObj(obj, obj.count, newCount);
        this.trackZone(zone);
    }

    // Dev note: this function is slightly awkward, might need reworked
    removeObj(obj: Obj, duration: number): void {
        // Obj must be active to remove it from the world. An inactive Obj is already removed
        if (!obj.isActive) {
            return;
        }
        // printDebug(`[World] removeObj => name: ${ObjType.get(obj.type).name}, duration: ${duration}`);
        const zone: Zone = this.gameMap.getZone(obj.x, obj.z, obj.level);
        const adjustedDuration = this.scaleByPlayerCount(duration);
        zone.removeObj(obj);
        this.trackZone(zone);

        // If the duration is positive and the Obj is a static obj, queue the Obj to respawn
        if (duration > 0 && obj.lifecycle === EntityLifeCycle.RESPAWN) {
            obj.setLifeCycle(adjustedDuration);
        } else {
            obj.setLifeCycle(-1);
        }
    }

    animMap(level: number, x: number, z: number, spotanim: number, height: number, delay: number): void {
        const zone: Zone = this.gameMap.getZone(x, z, level);
        zone.animMap(x, z, spotanim, height, delay);
        this.trackZone(zone);
    }

    mapProjAnim(level: number, x: number, z: number, dstX: number, dstZ: number, target: number, spotanim: number, srcHeight: number, dstHeight: number, startDelay: number, endDelay: number, peak: number, arc: number): void {
        const zone: Zone = this.gameMap.getZone(x, z, level);
        zone.mapProjAnim(x, z, dstX, dstZ, target, spotanim, srcHeight, dstHeight, startDelay, endDelay, peak, arc);
        this.trackZone(zone);
    }

    // ----

    addFriend(player: Player, targetUsername37: bigint) {
        //printDebug(`[World] addFriend => player: ${player.username}, target: ${targetUsername37} (${fromBase37(targetUsername37)})`);
        this.friendThread.postMessage({
            type: 'player_friendslist_add',
            username: player.username,
            target: targetUsername37
        });
        ClanChat.addFriends(player, [targetUsername37]);
    }

    removeFriend(player: Player, targetUsername37: bigint) {
        //printDebug(`[World] removeFriend => player: ${player.username}, target: ${targetUsername37} (${fromBase37(targetUsername37)})`);
        this.friendThread.postMessage({
            type: 'player_friendslist_remove',
            username: player.username,
            target: targetUsername37
        });
        ClanChat.removeFriend(player, targetUsername37);
    }

    addIgnore(player: Player, targetUsername37: bigint) {
        //printDebug(`[World] addIgnore => player: ${player.username}, target: ${targetUsername37} (${fromBase37(targetUsername37)})`);
        this.friendThread.postMessage({
            type: 'player_ignorelist_add',
            username: player.username,
            target: targetUsername37
        });
    }

    removeIgnore(player: Player, targetUsername37: bigint) {
        //printDebug(`[World] removeIgnore => player: ${player.username}, target: ${targetUsername37} (${fromBase37(targetUsername37)})`);
        this.friendThread.postMessage({
            type: 'player_ignorelist_remove',
            username: player.username,
            target: targetUsername37
        });
    }

    sendPrivateChatModeToFriendsServer(player: Player): void {
        this.friendThread.postMessage({
            type: 'player_chat_setmode',
            username: player.username,
            chatModePrivate: player.privateChat
        });
    }

    logClanChat(player: Player, owner: string, channel: string, chat: string) {
        this.friendThread.postMessage({
            type: 'clan_message',
            session_uuid: player.session,
            coord: player.coord,
            owner,
            channel,
            chat
        });
    }

    logPublicChat(player: Player, chat: string) {
        this.friendThread.postMessage({
            type: 'public_message',
            session_uuid: player.session,
            coord: player.coord,
            chat
        });
    }

    removePlayer(player: Player): void {
        if (player.slot === -1) {
            return;
        }

        ClanChat.onLogout(player);

        // ONE LINE PER DEPARTURE, because there were none. Nothing in the login, logout or
        // socket-close paths printed anything, so a player reporting a crash left no trace at
        // all and the only record was on their own machine. The reason matters more than the
        // fact: "connection lost for 30s" is a dropped client, "no response for 60s" is one
        // that stopped answering while its socket stayed open, and a bare "quit" is somebody
        // using the logout button. Bots are skipped - a sim spawns hundreds.
        const connected = isClientConnected(player);
        if (!player.isBot) {
            printInfo(`logout ${player.username} at ${player.level},${player.x},${player.z}` + ` - ${player.logoutReason}${connected ? '' : ' (socket already gone)'}`);
        }

        if (connected) {
            player.logout();
            player.client.close();
        }

        rsbuf.removePlayer(player.slot);
        this.gameMap.getZone(player.x, player.z, player.level).leave(player);
        delete this.players[player.slot];
        player.unlink();
        changeNpcCollision(player.width, player.x, player.z, player.level, false);
        changePlayerOccCollision(player.width, player.x, player.z, player.level, false);
        player.cleanup();

        player.isActive = false;

        if (player.isBot) {
            // never saved, never announced to the friend server
            return;
        }

        player.addSessionLog(LoggerEventType.MODERATOR, 'Logged out');
        this.flushPlayer(player);

        this.friendThread.postMessage({
            type: 'player_logout',
            username: player.username
        });
    }

    // let the login server know this player can log in elsewhere, do not update save file
    forceLogout(player: Player, response = -1) {
        this.loginThread.postMessage({
            type: 'player_force_logout',
            username: player.username
        });

        if (isClientConnected(player)) {
            if (response !== -1) {
                player.client.send(Uint8Array.from([response]));
            }

            player.client.close();
        }
    }

    sendPrivateMessage(player: Player, targetUsername37: bigint, message: string): void {
        //printDebug(`[World] sendPrivateMessage => player: ${player.username}, target: ${targetUsername37} (${fromBase37(targetUsername37)}), message: '${message}'`);

        this.friendThread.postMessage({
            type: 'private_message',
            username: player.username,
            staffLvl: player.staffModLevel,
            // The icon to draw, which is NOT the staff level: Veteran and Helper are not staff
            // levels, and the friend server's own staff bookkeeping reads staffLvl. Two fields.
            crown: chatCrown(player.staffModLevel, player.veteran, player.helper),
            pmId: (Environment.NODE_ID << 24) + ((Math.random() * 0xff) << 16) + this.pmCount++,
            target: targetUsername37,
            message: message,
            coord: player.coord
        });
    }

    getNextPlayerSlot(): number {
        for (let i = 1; i < 2047; i++) {
            if (typeof this.players[i] === 'undefined') {
                return i;
            }
        }

        return -1;
    }

    getPlayer(slot: number): Player | undefined {
        return this.players[slot];
    }

    getPlayerByUid(uid: number): Player | null {
        const slot = uid & 0x7ff;
        const hash = (uid >> 11) & 0x1fffff;

        const player = this.getPlayer(slot);
        if (!player) {
            return null;
        }

        if (Number(player.username37 & 0x1fffffn) !== hash) {
            return null;
        }

        return player;
    }

    getPlayerByUsername(username: string): Player | undefined {
        const username37: bigint = toBase37(username);
        for (const player of this.playerLoop.all()) {
            if (player.username37 === username37) {
                return player;
            }
        }

        for (const player of this.newPlayers) {
            if (player.username37 === username37) {
                return player;
            }
        }

        return undefined;
    }

    getPlayerByHash64(hash64: bigint): Player | undefined {
        for (const player of this.playerLoop.all()) {
            if (player.hash64 === hash64) {
                return player;
            }
        }

        return undefined;
    }

    // todo: could cache this, or increment/decrement on add/remove
    getTotalPlayers(): number {
        let count = 0;

        for (let i = 1; i < 2047; i++) {
            if (typeof this.players[i] !== 'undefined') {
                count++;
            }
        }

        return count;
    }

    // custom (2026-09-27) - players online, not counting bots: what anyone is TOLD is online (the
    // playercount command, the quest tab's "Players online", the metrics). getTotalPlayers above still
    // counts bots, because the engine uses it to decide whether the world has anyone in it at all.
    getHumanPlayerCount(): number {
        let count = 0;

        for (let i = 1; i < 2047; i++) {
            const player = this.players[i];
            if (typeof player !== 'undefined' && !player.isBot) {
                count++;
            }
        }

        return count;
    }

    scaleByPlayerCount(rate: number): number {
        // not sure if it caps at 2k player count or not
        const playerCount = Math.min(this.getTotalPlayers(), 2000);
        return (((4000 - playerCount) * rate) / 4000) | 0; // assuming scale works the same way as the runescript one
    }

    getTotalNpcs(): number {
        return this.npcs.count;
    }

    getNpc(nid: number): Npc | undefined {
        return this.npcs.get(nid);
    }

    getNpcByUid(uid: number): Npc | null {
        const slot = uid & 0xffff;
        const type = (uid >> 16) & 0xffff;

        const npc = this.getNpc(slot);
        if (!npc || npc.type !== type) {
            return null;
        }

        return npc;
    }

    getNextNid(): number {
        return this.npcs.next();
    }

    private createDevThread() {
        this.devThread = spawnThread(new URL('../cache/DevThread.ts', import.meta.url));

        this.devThread.on('message', msg => {
            try {
                if (msg.type === 'dev_reload') {
                    this.reload();
                } else if (msg.type === 'dev_failure') {
                    if (msg.error) {
                        console.error(msg.error);

                        this.broadcastMes(msg.error.replaceAll(`${Environment.BUILD_SRC_DIR}/scripts/`, ''));
                        this.broadcastMes('Check the console for more information.');
                    }
                } else if (msg.type === 'dev_progress') {
                    if (msg.broadcast) {
                        printDebug(msg.broadcast);

                        this.broadcastMes(msg.broadcast);
                    } else if (msg.text) {
                        printInfo(msg.text);
                    }
                }
            } catch (err) {
                console.error(err);
            }
        });

        // todo: catch all cases where it might exit instead of throwing an error, so we aren't
        // re-initializing the file watchers after errors
        this.devThread.on('exit', () => {
            try {
                // todo: remove this mes after above the todo above is addressed
                this.broadcastMes('Error while rebuilding - see console for more info.');

                this.createDevThread();
            } catch (err) {
                console.error(err);
            }
        });
    }

    rebootTimer(duration: number): void {
        this.shutdownTick = this.currentTick + duration;

        for (const player of this.playerLoop.all()) {
            player.write(new UpdateRebootTimer(this.shutdownTick - this.currentTick));
        }
    }

    get isPendingShutdown(): boolean {
        return this.shutdownTicksRemaining > -1;
    }

    get shutdownTicksRemaining(): number {
        return this.shutdownTick - this.currentTick;
    }

    /**
     * A milestone announcement: broadcastMes, minus the players who have turned these off.
     *
     * The opt-out is a varp on the RECEIVER, which is why this cannot live in content - a script
     * runs as one player and has no way to walk the player list. option_milestones is 0 for on,
     * so an account that has never touched it hears them; ::milestones flips it.
     *
     * The varp id is looked up once and cached, the way Player does with xp_rate: a name lookup
     * per player per broadcast would be a map lookup for every online player every time anybody
     * hits a 99.
     */
    static milestoneVarp: number = -2;

    broadcastMilestone(message: string): void {
        if (World.milestoneVarp === -2) {
            World.milestoneVarp = VarPlayerType.getId('option_milestones');
        }

        for (const player of this.playerLoop.all()) {
            // As broadcastMes: a tutorial lesson turns every game message into a modal.
            if (player.modalTutorial !== -1) {
                continue;
            }
            if (World.milestoneVarp !== -1 && player.getVar(World.milestoneVarp) !== 0) {
                continue;
            }
            player.wrappedMessageGame(message);
        }
    }

    broadcastMes(message: string): void {
        for (const player of this.playerLoop.all()) {
            // Not to anyone with a tutorial lesson open. The lesson covers the chatbox, so the client
            // turns every game message that arrives into a modal "Click to continue" over the top of it
            // (Client.addMessage, guarded by stickyChatInterfaceId) - which is right for a message meant
            // for that player, and wrong for a yell or a rare drop from the other side of the world. A
            // player on Tutorial Island was getting one of those boxes per broadcast, each eating a mouse
            // click. modalTutorial is the server's side of the same interface, so this is exactly the set
            // of players the client would have modalled.
            if (player.modalTutorial !== -1) {
                continue;
            }
            if (message.includes('\n')) {
                message.split('\n').forEach(wrap => player.wrappedMessageGame(wrap));
            } else {
                player.wrappedMessageGame(message);
            }
        }
    }

    // custom (2026-10-19) - a socket that closes with its login still with the login thread. The request
    // used to stay in loginRequests for good (only a reply removed it), holding the socket's ~95 KB of
    // buffers - and a login that failed inside the thread never got a reply, so it could be repeated.
    onClientClosed(client: ClientSocket) {
        this.loginRequests.delete(client.uuid);
    }

    // custom (2026-11-03) - the latency probe. Every NODE_PING_TICKS ticks each connected client is
    // sent a sequence byte and answers with it (PongHandler), which is the only honest way to know
    // what a player's connection is actually costing them - a tunnel or a bad route shows up here and
    // nowhere else. The number travels back out on the next probe for the client to draw.
    private processPings(): void {
        if (Environment.NODE_PING_TICKS <= 0 || this.currentTick % Environment.NODE_PING_TICKS !== 0) {
            return;
        }

        const now = Date.now();
        for (const player of this.playerLoop.all()) {
            if (player.isBot || !isClientConnected(player)) {
                continue;
            }

            // the previous probe never came back - write it off rather than leave a stale number on
            // screen for ever, and rather than match a late answer to the wrong send
            if (player.pingSentAt !== -1) {
                player.pingMs = -1;
            }

            player.pingSeq = (player.pingSeq + 1) & 0xff;
            player.pingSentAt = now;
            player.write(new Ping(player.pingSeq, player.pingMs < 0 ? 0xffff : player.pingMs));
        }
    }

    rebuild() {
        if (this.devThread) {
            this.devThread.postMessage({
                type: 'world_rebuild'
            });
        }
    }

    onLoginMessage(msg: GenericLoginThreadResponse) {
        if (isPlayerLoginResponse(msg)) {
            const { socket } = msg;
            if (!this.loginRequests.has(socket)) {
                // custom (2026-10-19) - the socket closed while the login thread was working (onClientClosed).
                // A login server has marked the account logged in to this world by now; nobody is going to
                // play it, so hand it back, or it reads "already logged in" until the world restarts.
                if (Environment.LOGIN_SERVER && !LOGIN_FAILURE_REPLIES.has(msg.reply)) {
                    this.loginThread.postMessage({ type: 'player_force_logout', username: msg.username });
                }
                return;
            }

            const { reply } = msg;
            const client = this.loginRequests.get(socket)!;
            this.loginRequests.delete(socket);

            if (reply === -1) {
                // login server offline
                client.send(Uint8Array.from([8]));
                client.close();
                return;
            } else if (reply === 1) {
                // invalid username or password
                client.send(Uint8Array.from([3]));
                client.close();
                return;
            } else if (reply === 3) {
                // already logged in (on another world)
                client.send(Uint8Array.from([5]));
                client.close();
                return;
            } else if (reply === 5) {
                // account has been disabled (banned)
                client.send(Uint8Array.from([4]));
                client.close();
                return;
            } else if (reply === 6) {
                // login limit exceeded
                client.send(Uint8Array.from([9]));
                client.close();
                return;
            } else if (reply === 7) {
                // rejected
                client.send(Uint8Array.from([11]));
                client.close();
                return;
            } else if (reply === 8) {
                // too many attempts
                client.send(Uint8Array.from([16]));
                client.close();
                return;
            } else if (reply === 9) {
                // logging in to p2p on a f2p account
                client.send(Uint8Array.from([12]));
                client.close();
                return;
            } else if (reply === 11) {
                // custom (2026-09-27) - below NODE_MIN_STAFF_LEVEL on a staff-only world (LoginThread).
                // 7 is the 377 client's "This world is full. Please use a different world." - the
                // nearest thing it has to "not for you", and it sends them where they should go.
                client.send(Uint8Array.from([7]));
                client.close();
                return;
            } else if (reply === 10) {
                // hop timer
                const { remaining } = msg;
                client.send(Uint8Array.from([21, Math.min(255, remaining! / 1000)]));
                client.close();
                return;
            }

            const { username, lowMemory, reconnecting, staffmodlevel, veteran, helper, muted_until, members, messageCount } = msg;
            const save = msg.save ?? new Uint8Array();

            // if (reconnecting && !this.getPlayerByUsername(username)) {
            //     // rejected
            //     client.send(Uint8Array.from([11]));
            //     client.close();
            //     return;
            // } else
            if (!save && !reconnecting) {
                // rejected
                client.send(Uint8Array.from([11]));
                client.close();
                return;
            }

            try {
                const player = PlayerLoading.load(username, new Packet(save), client);

                player.session = client.uuid;
                player.reconnecting = reconnecting;
                // custom (2026-11-02) - a token the login thread just minted for this client.
                // Written in onLogin with the rest of the opening packets rather than here, where
                // the player has no outbound stream yet.
                player.loginToken = msg.token ?? null;
                // custom (2026-11-15) - the launcher's Discord sign-in, carried from the login
                // block on the socket. Sent on from Player.onLogin; see the note there.
                player.launcherSignIn = client.launcherSignIn.length > 0 ? client.launcherSignIn : null;
                player.staffModLevel = staffmodlevel ?? 0;
                player.veteran = (veteran ?? 0) > 0;
                player.helper = (helper ?? 0) > 0;
                player.lowMemory = lowMemory;
                player.muted_until = muted_until ? new Date(muted_until) : null;
                player.members = members;
                player.messageCount = messageCount ?? 0;

                if (this.logoutRequests.has(username)) {
                    // already logged in (on another world)
                    console.error(`[DEBUG-KICK] site=onLoginMessage-logoutRequests username=${username}`);
                    client.send(Uint8Array.from([5]));
                    client.close();
                    return;
                }

                if (!Environment.NODE_MEMBERS && !this.gameMap.isFreeToPlay(player.x, player.z)) {
                    // in a p2p zone when logging into f2p
                    if (player.members) {
                        client.send(Uint8Array.from([17]));
                        client.close();
                        this.loginThread.postMessage({
                            type: 'player_force_logout',
                            username: username
                        });
                        return;
                    }
                    player.teleport(3221, 3219, 0);
                }

                this.newPlayers.add(player);
                client.state = 1;
            } catch (err) {
                if (err instanceof Error) {
                    console.error(username, err.message);
                }

                // bad save :( the player won't be happy
                client.send(Uint8Array.from([13]));
                client.close();

                // todo: maybe we can tell the login thread to swap for the last-good save?
                this.loginThread.postMessage({
                    type: 'player_force_logout',
                    username: username
                });
            }
        } else if (isPlayerLogoutResponse(msg)) {
            const { username, success } = msg;
            if (!this.logoutRequests.has(username)) {
                return;
            }

            if (success) {
                this.logoutRequests.delete(username);
            }
        } else if (isForgetLoginsResponse(msg)) {
            const { username, count, ok } = msg;
            this.forgetLoginRequests.delete(username);

            const player = this.getPlayerByUsername(username);
            if (!player) {
                return;
            }

            if (!ok) {
                player.messageGame('Your saved logins could not be cancelled right now. Please try again later.');
            } else if (count === 0) {
                player.messageGame('You have no saved logins to cancel.');
            } else if (count === 1) {
                player.messageGame('Cancelled 1 saved login. You will have to type your password next time.');
            } else {
                player.messageGame(`Cancelled ${count} saved logins. You will have to type your password next time.`);
            }
        } else if (isVeteranResponse(msg)) {
            const { staff, username, result, veteran } = msg;
            this.veteranRequests.delete(username);

            // A player who is online gets it now rather than on their next login. The icon rides
            // the appearance block, so rebuilding that is the whole of showing it - without this
            // the account row is right and nobody can see it until they relog.
            const target = this.getPlayerByUsername(username);
            if (result === 'ok' && target) {
                target.veteran = veteran;
                // Only when an appearance has been built already. buildAppearance(-1) reads no
                // worn inventory at all, so rebuilding one that early would send everyone a
                // player with no equipment on; a player who has not got that far yet picks the
                // flag up from the first build instead, which is as soon as anyone could see it.
                if (target.appearanceInv !== -1) {
                    target.buildAppearance(target.appearanceInv);
                }
                this.veteranCape(target, veteran);
                target.messageGame(veteran ? 'You have been given the Veteran rank, for helping test the server.' : 'Your Veteran rank has been removed.');
            }

            const who = this.getPlayerByUsername(staff);
            if (!who) {
                return;
            }

            const name = toDisplayName(username);
            if (result === 'unknown') {
                who.messageGame(`veteran: there is no account called ${name}.`);
            } else if (result !== 'ok') {
                who.messageGame(`veteran: ${name} could not be changed right now. Please try again.`);
            } else if (veteran) {
                who.messageGame(`veteran: ${name} now has the Veteran rank.`);
            } else {
                who.messageGame(`veteran: ${name} no longer has the Veteran rank.`);
            }
        } else if (isHelperResponse(msg)) {
            const { staff, username, result, helper } = msg;
            this.helperRequests.delete(username);

            // Online players get it now rather than on their next login: the icon rides the
            // appearance block, so rebuilding that is the whole of showing it. No cape and no
            // powers to hand over - the icon IS the rank.
            const target = this.getPlayerByUsername(username);
            if (result === 'ok' && target) {
                target.helper = helper;
                // Only once an appearance exists. buildAppearance(-1) reads no worn inventory, so
                // rebuilding that early would send everyone a player wearing nothing.
                if (target.appearanceInv !== -1) {
                    target.buildAppearance(target.appearanceInv);
                }
                target.messageGame(helper ? 'You are now a Helper. Thanks for giving other players a hand.' : 'You are no longer a Helper.');
            }

            const who = this.getPlayerByUsername(staff);
            if (!who) {
                return;
            }

            const name = toDisplayName(username);
            if (result === 'unknown') {
                who.messageGame(`helper: there is no account called ${name}.`);
            } else if (result !== 'ok') {
                who.messageGame(`helper: ${name} could not be changed right now. Please try again.`);
            } else if (helper) {
                who.messageGame(`helper: ${name} is now a Helper.`);
            } else {
                who.messageGame(`helper: ${name} is no longer a Helper.`);
            }
        } else if (isChangePasswordResponse(msg)) {
            const { username, result } = msg;
            this.passwordChanges.delete(username);

            const player = this.getPlayerByUsername(username);
            if (!player) {
                return;
            }

            if (result === 'ok') {
                player.messageGame('Your password has been changed.');
            } else if (result === 'wrong') {
                player.messageGame('That is not your current password. Your password has not been changed.');
            } else {
                player.messageGame('Your password could not be changed right now. Please try again later.');
            }
        }
    }

    // custom (2026-09-27) - ::changepassword (ClientCheatHandler). The check and the new hash are done by
    // the login thread against the account table; the answer comes back through onLoginMessage.
    // One request at a time per account.
    passwordChanges: Set<string> = new Set();

    // custom (2026-11-02) - ::forgetlogins (ClientCheatHandler). One request at a time per account,
    // the same way a password change is held, and the answer comes back through onLoginMessage.
    forgetLoginRequests: Set<string> = new Set();

    requestForgetLogins(player: Player): boolean {
        if (this.forgetLoginRequests.has(player.username)) {
            return false;
        }

        this.forgetLoginRequests.add(player.username);
        this.loginThread.postMessage({
            type: 'player_forget_logins',
            username: player.username
        });
        return true;
    }

    // custom (2026-11-06) - ::veteran (ClientCheatHandler). One change at a time per account, the
    // way a password change is held. Keyed by the account being changed and not by the staff member
    // running it, so two administrators cannot race on the same name.
    veteranRequests: Set<string> = new Set();
    helperRequests: Set<string> = new Set();

    // custom (2026-11-06) - looked up once; -2 means "not looked up yet", which is distinct from
    // the -1 ObjType.getId returns for a build that does not have the cape in it.
    private static veteranCapeObj: number = -2;

    /**
     * custom (2026-11-08) - THE VETERAN CAPE CAN BE FUSED INTO A MAX CAPE, and that is what these
     * four ids are for. A veteran who fuses theirs owns no veteran_cape afterwards, so the "have
     * you got one" count below had to learn to see the variant: without it the server read the
     * fusion as a loss and handed out a free Veteran cape every single login.
     *
     * Taking the rank away has to see it too, and cannot simply delete it. The Max cape inside a
     * variant was earned with a level 99 in every skill that has a cape, and that is not this
     * rank's to take - so the variant is SPLIT, exactly as a knife splits it in game, and the
     * player keeps the Max cape and hood they earned.
     *
     * The lookups are lazy for the same reason veteranCapeObj's is: ObjType is not loaded when
     * this class is constructed, and a build without these records answers -1, which every use
     * below checks for.
     */
    private static veteranFuseObjs: number[] | null = null;

    /** veteran_max_cape, veteran_max_hood, max_cape, max_hood - or -1 each, looked up once. */
    private static veteranFused(): number[] {
        if (World.veteranFuseObjs === null) {
            World.veteranFuseObjs = ['veteran_max_cape', 'veteran_max_hood', 'max_cape', 'max_hood'].map((name: string): number => ObjType.getId(name));
        }
        return World.veteranFuseObjs;
    }

    /**
     * Give a veteran their cape, or take it back from somebody who is no longer one.
     *
     * Called at login as well as on the grant, so a cape that was dropped, destroyed or lost on
     * death costs a relog and nothing else. That is the whole reclaim mechanism: an untradeable
     * cosmetic that the server hands back is simpler than an npc to collect it from, and there is
     * nothing to exploit in being given a second copy of something nobody can trade.
     *
     * INTO THE BANK BY PREFERENCE. A cape added to a full inventory would fall on the floor -
     * which is how quest items have been lost here before - and a player logging in has no idea
     * it is coming. The bank cannot drop it, and the first login after a grant is not a moment to
     * be rummaging in somebody's backpack.
     */
    veteranCape(player: Player, give: boolean): void {
        if (World.veteranCapeObj === -2) {
            World.veteranCapeObj = ObjType.getId('veteran_cape');
        }
        const obj = World.veteranCapeObj;
        if (obj === -1) {
            return;
        }

        const bank = InvType.getId('bank');
        const held = [InvType.INV, InvType.WORN, bank].filter(inv => inv !== -1);
        const count = (what: number): number => (what === -1 ? 0 : held.reduce((n, inv) => n + player.invTotal(inv, what), 0));
        const [variant, variantHood, maxCape, maxHood] = World.veteranFused();

        // A FUSED CAPE STILL COUNTS AS HAVING ONE. See veteranFuseObjs.
        const have = count(obj) + count(variant);

        if (!give) {
            for (const inv of held) {
                const n = player.invTotal(inv, obj);
                if (n > 0) {
                    player.invDel(inv, obj, n);
                }
            }
            const split = this.veteranSplit(player, held, variant, variantHood, maxCape, maxHood);
            if (have > 0) {
                player.buildAppearance(player.appearanceInv);
                player.messageGame(split ? 'Your Veteran cape has been taken back; your Max cape and hood are whole again.' : 'Your Veteran cape has been taken back.');
            }
            return;
        }

        if (have > 0) {
            return;
        }

        if (bank !== -1 && player.invFreeSpace(bank) > 0) {
            player.invAdd(bank, obj, 1);
            player.messageGame('Your Veteran cape is in your bank.');
        } else if (player.invFreeSpace(InvType.INV) > 0) {
            player.invAdd(InvType.INV, obj, 1);
            player.messageGame('Your Veteran cape has been added to your inventory.');
        } else {
            // Nowhere safe to put it. Say so rather than dropping it, and try again next login.
            player.messageGame('Your Veteran cape could not be given to you - your bank and inventory are both full.');
        }
    }

    /**
     * custom (2026-11-08) - Turn a Veteran max cape back into a Max cape and hood, because the
     * player is no longer a veteran. This is the knife path in max_cape_variants.rs2, done by the
     * server: the variant and its hood go, the plain Max cape and hood come back.
     *
     * NOTHING IS DESTROYED IF THERE IS NOWHERE TO PUT THE REPLACEMENTS. The variant is left alone
     * and false is returned, and the next login tries again - veteranCape is called at login with
     * whatever the account's flag now says - so a player whose bank and inventory are both full
     * keeps the variant until there is room rather than losing a Max cape to a full bank.
     *
     * @returns whether a variant was actually split.
     */
    private veteranSplit(player: Player, held: number[], variant: number, variantHood: number, maxCape: number, maxHood: number): boolean {
        if (variant === -1 || maxCape === -1) {
            return false;
        }
        const total = (what: number): number => (what === -1 ? 0 : held.reduce((n, inv) => n + player.invTotal(inv, what), 0));
        const fused = total(variant);
        if (fused < 1) {
            return false;
        }

        // Where the replacements go. The bank first, for the same reason the cape itself prefers
        // it: a full inventory drops things on the floor, and this is not the player's doing. Two
        // slots per variant, because a cape and a hood both come back.
        const bank = InvType.getId('bank');
        const hoods = variantHood === -1 ? 0 : Math.min(fused, total(variantHood));
        const need = fused + hoods;
        const where = bank !== -1 && player.invFreeSpace(bank) >= need ? bank : player.invFreeSpace(InvType.INV) >= need ? InvType.INV : -1;
        if (where === -1) {
            player.messageGame('Your Veteran max cape could not be split - your bank and inventory are both full.');
            return false;
        }

        for (const inv of held) {
            const n = player.invTotal(inv, variant);
            if (n > 0) {
                player.invDel(inv, variant, n);
            }
            if (variantHood !== -1) {
                const h = player.invTotal(inv, variantHood);
                if (h > 0) {
                    player.invDel(inv, variantHood, h);
                }
            }
        }
        player.invAdd(where, maxCape, fused);
        if (hoods > 0 && maxHood !== -1) {
            player.invAdd(where, maxHood, hoods);
        }
        return true;
    }

    /** Returns the safe name the request was filed under, or null if one is already in flight. */
    requestVeteran(staff: string, username: string, veteran: boolean): string | null {
        // The account table stores the base37 round trip, which is also what ::veteran is likely to
        // be typed as - "Bob Smith" and "bob_smith" are the same account and both have to find it.
        const safeName = toSafeName(username);
        if (safeName.length === 0 || this.veteranRequests.has(safeName)) {
            return null;
        }

        this.veteranRequests.add(safeName);
        this.loginThread.postMessage({
            type: 'player_set_veteran',
            staff,
            username: safeName,
            veteran
        });
        return safeName;
    }

    requestHelper(staff: string, username: string, helper: boolean): string | null {
        // Same base37 round trip as requestVeteran: "Bob Smith" and "bob_smith" are one account
        // and ::helper is as likely to be typed either way.
        const safeName = toSafeName(username);
        if (safeName.length === 0 || this.helperRequests.has(safeName)) {
            return null;
        }

        this.helperRequests.add(safeName);
        this.loginThread.postMessage({
            type: 'player_set_helper',
            staff,
            username: safeName,
            helper
        });
        return safeName;
    }

    requestPasswordChange(player: Player, oldPassword: string, newPassword: string): boolean {
        if (this.passwordChanges.has(player.username)) {
            return false;
        }

        this.passwordChanges.add(player.username);
        this.loginThread.postMessage({
            type: 'player_change_password',
            username: player.username,
            oldPassword,
            newPassword
        });
        return true;
    }

    onFriendMessage(msg: FriendThreadMessage) {
        const { opcode, data } = msg;
        try {
            if (opcode === FriendsServerOpcodes.UPDATE_FRIENDLIST) {
                const username37 = BigInt(data.username37);

                // TODO make getPlayerByUsername37?
                const player = this.getPlayerByUsername(fromBase37(username37));
                if (!player) {
                    printError(`FriendThread: player ${fromBase37(username37)} not found`);
                    return;
                }

                for (let i = 0; i < data.friends.length; i++) {
                    const [world, friendUsername37] = data.friends[i];
                    player.write(new UpdateFriendList(BigInt(friendUsername37), world));
                }
                ClanChat.addFriends(
                    player,
                    data.friends.map(([, friend]: [number, string]) => BigInt(friend))
                );

                player.write(new FriendlistLoaded(2));
            } else if (opcode === FriendsServerOpcodes.UPDATE_IGNORELIST) {
                const username37 = BigInt(data.username37);

                // TODO make getPlayerByUsername37?
                const player = this.getPlayerByUsername(fromBase37(username37));
                if (!player) {
                    printError(`FriendThread: player ${fromBase37(username37)} not found`);
                    return;
                }

                const ignored: bigint[] = data.ignored.map((i: string) => BigInt(i));
                player.write(new UpdateIgnoreList(ignored));
            } else if (opcode == FriendsServerOpcodes.PRIVATE_MESSAGE) {
                // username37: username.toString(),
                // targetUsername37: target.toString(),
                // staffLvl,
                // pmId,
                // chat

                const fromPlayer = BigInt(data.username37);
                // A world still running the older build sends no crown, so fall back to the staff
                // level the way this did before - a staff crown rather than no icon at all.
                const fromPlayerCrown = typeof data.crown === 'number' ? data.crown : chatCrown(data.staffLvl);
                const pmId = data.pmId;
                const target = BigInt(data.targetUsername37);

                const player = this.getPlayerByUsername(fromBase37(target));
                if (!player) {
                    printError(`FriendThread: player ${fromBase37(target)} not found`);
                    return;
                }

                const chat = data.chat;

                player.write(new MessagePrivate(fromPlayer, pmId, fromPlayerCrown, chat));
            } else if (opcode === FriendsServerOpcodes.RELAY_MUTE) {
                const { username, muted_until } = data;

                const player = this.getPlayerByUsername(username);
                if (player) {
                    player.muted_until = muted_until ? new Date(muted_until) : null;
                }
            } else if (opcode === FriendsServerOpcodes.RELAY_KICK) {
                const { username } = data;

                const player = this.getPlayerByUsername(username);
                if (player) {
                    player.loggingOut = true;

                    if (isClientConnected(player)) {
                        player.logout();
                        player.client.close();
                    }
                }
            } else if (opcode === FriendsServerOpcodes.RELAY_BROADCAST) {
                const { message } = data;

                this.broadcastMes(message);
            } else if (opcode === FriendsServerOpcodes.RELAY_SHUTDOWN) {
                const { duration } = data;

                this.rebootTimer(duration);
            } else if (opcode === FriendsServerOpcodes.RELAY_TRACK) {
                const { username, state } = data;

                const player = this.getPlayerByUsername(username);
                if (player) {
                    player.input.active = state;
                }
            } else if (opcode === FriendsServerOpcodes.RELAY_RELOAD) {
                this.reload(false);
            } else if (opcode === FriendsServerOpcodes.RELAY_CLEARLOGINS) {
                this.loginRequests.clear();
            } else if (opcode === FriendsServerOpcodes.RELAY_CLEARLOGOUTS) {
                this.logoutRequests.clear();
            } else if (opcode === FriendsServerOpcodes.RELAY_QUEUESCRIPT) {
                const { scriptName, username } = data;

                const player = this.getPlayerByUsername(username);
                if (player) {
                    const script = ScriptProvider.getByName(`[queue,${scriptName}]`);

                    if (script) {
                        player.enqueueScript(script);
                    }
                }
            } else {
                printError('Unknown friend message: ' + opcode);
            }
        } catch (err) {
            console.log(err);
        }
    }

    static loginBuf = Packet.alloc(1);

    private isLoginRateLimited(client: ClientSocket): boolean {
        if (!Environment.NODE_PRODUCTION || Environment.NODE_RATELIMIT_ADDRESS_LOGIN <= 0) {
            return false;
        }

        const last = this.loginAddressAttempts.get(client.remoteAddress);
        const attempts = last ? last + 1 : 1;
        this.loginAddressAttempts.set(client.remoteAddress, attempts);

        if (attempts >= Environment.NODE_RATELIMIT_ADDRESS_LOGIN) {
            // login attempts exceeded
            client.send(Uint8Array.from([16]));
            client.close();
            return true;
        }

        return false;
    }

    onClientData(client: ClientSocket) {
        if (client.state !== 0) {
            // connection negotiation only
            return;
        }

        if (this.loginRequests.has(client.uuid)) {
            // custom (2026-09-27) - one login attempt per socket: the answer is on its way, and anything
            // sent meanwhile was a way to queue password guesses without reconnecting
            return;
        }

        if (client.available < 1) {
            return;
        }

        if (client.opcode === -1) {
            World.loginBuf.pos = 0;
            client.read(World.loginBuf.data, 0, 1);

            // todo: login encoders/decoders
            client.opcode = World.loginBuf.g1();

            if (client.opcode === 14) {
                client.waiting = 1;
            } else if (client.opcode === 16 || client.opcode === 18) {
                client.waiting = -1;
            } else {
                client.waiting = 0;
            }
        }

        // the length can arrive in a later TCP segment than the opcode - wait for it (the opcode is kept)
        if ((client.waiting === -1 && client.available < 1) || (client.waiting === -2 && client.available < 2)) {
            return;
        }

        if (client.waiting === -1) {
            World.loginBuf.pos = 0;
            client.read(World.loginBuf.data, 0, 1);

            client.waiting = World.loginBuf.g1();
        } else if (client.waiting === -2) {
            World.loginBuf.pos = 0;
            client.read(World.loginBuf.data, 0, 2);

            client.waiting = World.loginBuf.g2();
        }

        if (client.available < client.waiting) {
            return;
        }

        World.loginBuf.pos = 0;
        client.read(World.loginBuf.data, 0, client.waiting);

        if (client.opcode === 14) {
            client.send(Uint8Array.from([0, 0, 0, 0, 0, 0, 0, 0]));

            if (this.isLoginRateLimited(client)) {
                return;
            }

            const _loginServer = World.loginBuf.g1(); // jagex stores player saves on different servers
            client.send(Uint8Array.from([0]));

            const seed = new Packet(new Uint8Array(8));
            seed.p4(Math.floor(Math.random() * 0x00ffffff));
            seed.p4(Math.floor(Math.random() * 0xffffffff));
            client.send(seed.data);
        } else if (client.opcode === 16 || client.opcode === 18) {
            // custom (2026-09-27) - counted here too: nothing makes a client send 14 first (the seed it
            // returns is never checked), so a limit on 14 alone was skipped by sending 16 directly
            if (this.isLoginRateLimited(client)) {
                return;
            }

            let rev = World.loginBuf.g1();
            if (rev === 0xff) {
                rev = World.loginBuf.g2();
            }
            // custom (2026-11-02) - AND THE ONE BEFORE IT, for as long as 382 is the current one.
            //
            // The revision is how the engine and the client agree about the shape of what follows,
            // and every bump before this has been a flag day: deploy the engine and every client
            // still on the old one is turned away until its launcher fetches the new release, which
            // only exists after the client repo is pushed. One of those two has to go first, and
            // whichever it is there is a window where nobody can log in.
            //
            // 382 added two fields at the END of the login block and a packet going the other way.
            // An older client sends neither, which costs it saved logins and nothing else - so it
            // is let in, and the window disappears. The gate is read from the revision the client
            // announced, not guessed at: LOGIN_TOKEN_REVISION below is what decides whether those
            // two fields are there to read.
            if (rev !== Environment.ENGINE_REVISION && rev !== LOGIN_LEGACY_REVISION) {
                client.send(Uint8Array.from([6]));
                client.close();
                return;
            }

            const info = World.loginBuf.g1();
            const lowMemory = (info & 0x1) !== 0;
            client.legacyHitmarks = (info & 0x2) === 0;

            const crcs = new Uint8Array(9 * 4);
            World.loginBuf.gdata(crcs, 0, crcs.length);

            if (CrcBuffer32 !== Packet.getcrc(crcs, 0, crcs.length)) {
                client.send(Uint8Array.from([6]));
                client.close();
                return;
            }

            World.loginBuf.rsadec(priv);

            if (World.loginBuf.g1() !== 10) {
                // RSA error
                // sending out of date intentionally
                client.send(Uint8Array.from([6]));
                client.close();
                return;
            }

            const seed = [];
            for (let i = 0; i < 4; i++) {
                seed[i] = World.loginBuf.g4s();
            }
            client.decryptor = new Isaac(seed);

            for (let i = 0; i < 4; i++) {
                seed[i] += 50;
            }
            client.encryptor = new Isaac(seed);

            const uid = World.loginBuf.g4s();
            const username = World.loginBuf.gjstr();
            const password = World.loginBuf.gjstr();

            // custom (2026-11-02) - SAVED LOGINS, inside the same RSA envelope as the password and
            // for the same reason: a token is worth an account until it is cancelled, so it travels
            // exactly as a password does and never in the clear. The envelope had the room - a
            // 1024-bit key carries 127 bytes and the block was using 55 - so these are two more
            // fields rather than a second meaning for the password field, which would have left the
            // server guessing at which of the two it had been sent.
            //
            // `remember` asks for a token to keep; `token` is one being used. A client of this
            // revision sends both on every login, empty when it has nothing to say. One from before
            // them sends neither, and reading past what it wrote would be reading whatever was left
            // in the buffer - so the revision it announced is what decides, and an old client is
            // simply a login with no saved logins in it.
            //
            // custom (2026-11-15) - AND THE FLAG BYTE IS NOW A FLAG BYTE. Bit 0 is what it always
            // was, "mint me a saved login"; bit 1 says a launcher sign-in token follows the saved
            // one. A client that knows nothing about the launcher writes 0 or 1 exactly as before,
            // so bit 1 is never set and nothing is read past what it wrote.
            //
            // THAT IS WHY ENGINE_REVISION DID NOT MOVE for this. The revision check above accepts
            // exactly two values, so a bump would have met every client already out there with
            // "has been updated" the moment this deployed - for a field most logins do not carry.
            // A self-describing byte needs no announcement.
            const sendsToken = rev >= LOGIN_TOKEN_REVISION;
            const loginFlags = sendsToken ? World.loginBuf.g1() : 0;
            const remember = (loginFlags & 0x1) !== 0;
            const token = sendsToken ? World.loginBuf.gjstr() : '';
            const launcherSignIn = (loginFlags & 0x2) !== 0 ? World.loginBuf.gjstr() : '';

            if (Environment.NODE_PRODUCTION && Environment.NODE_RATELIMIT_DEVICE_LOGIN > 0) {
                const last = this.loginDeviceAttempts.get(`${uid}@${client.remoteAddress}`);
                const attempts = last ? last + 1 : 1;
                this.loginDeviceAttempts.set(`${uid}@${client.remoteAddress}`, attempts);

                if (attempts >= Environment.NODE_RATELIMIT_DEVICE_LOGIN) {
                    // login attempts exceeded
                    client.send(Uint8Array.from([16]));
                    client.close();
                    return;
                }
            }

            if (username.length < 1 || username.length > 12) {
                client.send(Uint8Array.from([3]));
                client.close();
                return;
            }

            // One of the two has to be there and be the right shape. A saved login sends no
            // password at all, so the old "a password is 1 to 20 characters" would have turned every
            // one of them away at the door.
            if (token.length > 0 ? !LoginToken.looksLikeToken(token) : password.length < 1 || password.length > 20) {
                client.send(Uint8Array.from([3]));
                client.close();
                return;
            }

            // custom (2026-11-15) - the launcher sign-in is the same shape as a saved login (the
            // website mints it with the same alphabet and length on purpose), so it is checked the
            // same way - but a malformed one costs the LINK and not the login. Being refused at the
            // door because a launcher wrote nonsense into a field that only saves you typing
            // ::discord would be the wrong trade by a long way.
            client.launcherSignIn = LoginToken.looksLikeToken(launcherSignIn) ? launcherSignIn : '';

            if (this.getTotalPlayers() > Environment.NODE_MAX_CONNECTED) {
                client.send(Uint8Array.from([7]));
                client.close();
                return;
            }

            if (this.logoutRequests.has(username)) {
                // still trying to log out from the last session on this world!
                client.send(Uint8Array.from([5]));
                client.close();
                return;
            }

            const safeName = toSafeName(username);

            this.loginRequests.set(client.uuid, client);
            this.loginThread.postMessage({
                type: 'player_login',
                socket: client.uuid,
                remoteAddress: client.remoteAddress,
                username: safeName,
                password,
                remember,
                token,
                sendsToken,
                uid,
                lowMemory,
                reconnecting: client.opcode === 18,
                hasSave: client.opcode === 18 ? typeof this.getPlayerByUsername(username) !== 'undefined' : false
            });
        } else if (client.opcode === 15) {
            client.state = 2;
            client.send(new Uint8Array(8));
        } else {
            client.terminate();
        }

        client.opcode = -1;
    }

    addSessionLog(event_type: LoggerEventType, session_uuid: string, coord: number, message: string, ...args: string[]) {
        this.sessionLogs.push({
            session_uuid,
            timestamp: Date.now(),
            coord,
            event: args.length ? message + ' ' + args.join(' ') : message,
            event_type
        });
        trackSessionEventsPublished.inc();
    }

    addWealthEvent(event: WealthEvent) {
        if (filteredEventTypes.includes(event.event_type) && Math.abs(event.account_value) < Environment.NODE_MINIMUM_WEALTH_VALUE_EVENT) {
            return;
        }

        const transaction: WealthTransactionEvent = {
            timestamp: Date.now(),
            ...event
        };

        if (!groupedEventTypes.includes(event.event_type)) {
            this.wealthTransactions.push(transaction);
            return;
        }

        const key = JSON.stringify({
            type: event.event_type,
            session: event.session_uuid,
            recipient: event.recipient_session,
            coord: event.coord,
            tick: this.currentTick
        });

        const entry = this.wealthTransactionGroup.get(key);
        if (entry) {
            entry.account_items.push(...event.account_items);
            entry.account_value += event.account_value;
        } else {
            this.wealthTransactionGroup.set(key, transaction);
        }
    }

    notifyPlayerBan(staff: string, username: string, until: number) {
        const other = this.getPlayerByUsername(username);
        if (other) {
            other.loggingOut = true;
            if (isClientConnected(other)) {
                other.logout();
                other.client.close();
            }
        }

        this.loginThread.postMessage({
            type: 'player_ban',
            staff,
            username,
            until
        });
    }

    notifyPlayerMute(staff: string, username: string, until: number) {
        const other = this.getPlayerByUsername(username);
        if (other) {
            other.muted_until = new Date(until);
        }

        this.loginThread.postMessage({
            type: 'player_mute',
            staff,
            username,
            until: until
        });
    }

    notifyPlayerReport(player: Player, offender: string, reason: ReportAbuseReason) {
        if (reason === ReportAbuseReason.MACROING || reason === ReportAbuseReason.BUG_ABUSE) {
            const offenderPlayer = this.getPlayerByUsername(offender);
            if (offenderPlayer) {
                // Immediately turn on tracking when a user is reported as macroing or abusing a bug.
                offenderPlayer.input.active = true;
            }
        }
        this.loggerThread.postMessage({
            type: 'report',
            session_uuid: player.session,
            coord: player.coord,
            offender,
            reason
        });
    }

    // custom (2026-11-04) - the session's input counts, once, as it ends. Five integers saying how
    // much the player did and how much the client reported a person doing it. See
    // InputTracking.mouseMoves for why that pair is the useful one, and tools/server/botcheck.ts
    // for what reads them.
    submitInputCounts(player: Player) {
        const input = player.input;
        if (input.userActions === 0 && input.telemetry === 0) {
            // nothing happened in this session - a connection that logged in and straight back out
            return;
        }

        this.loggerThread.postMessage({
            type: 'input_counts',
            session_uuid: player.session,
            timestamp: Date.now(),
            user_actions: input.userActions,
            mouse_moves: input.mouseMoves,
            mouse_clicks: input.mouseClicks,
            camera_moves: input.cameraMoves,
            focus_changes: input.focusChanges
        });
    }

    submitInputTracking(player: Player, buf: Uint8Array) {
        this.loggerThread.postMessage({
            type: 'input_track',
            session_uuid: player.session,
            timestamp: Date.now(),
            buf: Buffer.from(buf).toString('base64')
        });
    }

    // The crash path above. Every player still in the world, and every logout whose save the login
    // thread has not confirmed, written synchronously before the process exits. data/players/<profile>/
    // is where both the login thread (LOGIN_SERVER=false) and a login server on this machine keep them.
    private writeSavesForCrash(): void {
        const dir = `data/players/${Environment.NODE_PROFILE}`;
        const saves = new Map<string, Uint8Array>();

        for (const [username, request] of this.logoutRequests) {
            saves.set(username, request.save);
        }
        for (const player of this.playerLoop.all()) {
            if (player.isBot) {
                continue;
            }
            try {
                saves.set(player.username, player.save());
            } catch (err) {
                printError(`Could not build a save for ${player.username}: ${err instanceof Error ? err.message : err}`);
            }
        }

        let written = 0;
        try {
            fs.mkdirSync(dir, { recursive: true });
        } catch {
            // exists, or the writes below say why
        }
        for (const [username, save] of saves) {
            try {
                fs.writeFileSync(`${dir}/${username}.sav`, save);
                written++;
            } catch (err) {
                printError(`Could not write the save for ${username}: ${err instanceof Error ? err.message : err}`);
            }
        }
        printError(`Saved ${written} of ${saves.size} players before closing.`);
    }

    flushPlayer(player: Player) {
        const save = player.save();

        this.logoutRequests.set(player.username, {
            save,
            lastAttempt: -1,
            requestedAt: Date.now()
        });
    }
}

export default new World();
