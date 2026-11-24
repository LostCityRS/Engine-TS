import { PlayerInfoProt, Visibility } from '#/network/rsbuf/index.js';
import { CollisionFlag } from '#/engine/routefinder/index.js';

import Component from '#/cache/config/Component.js';
import { chatCrown } from '#/engine/entity/ChatCrown.js';
import FontType from '#/cache/config/FontType.js';
import InvType from '#/cache/config/InvType.js';
import LocType from '#/cache/config/LocType.js';
import NpcType from '#/cache/config/NpcType.js';
import ObjType from '#/cache/config/ObjType.js';
import { TALK_TO_OP } from '#/cache/config/OpVisibility.js';
import { ParamHelper } from '#/cache/config/ParamHelper.js';
import ParamType from '#/cache/config/ParamType.js';
import ScriptVarType from '#/cache/config/ScriptVarType.js';
import SeqType from '#/cache/config/SeqType.js';
import VarPlayerType from '#/cache/config/VarPlayerType.js';
import { CoordGrid } from '#/engine/CoordGrid.js';
import { BlockWalk } from '#/engine/entity/BlockWalk.js';
import BuildArea from '#/engine/entity/BuildArea.js';
import CameraInfo from '#/engine/entity/CameraInfo.js';
import Entity from '#/engine/entity/Entity.js';
import { EntityLifeCycle } from '#/engine/entity/EntityLifeCycle.js';
import { EntityTimer, PlayerTimerType } from '#/engine/entity/EntityTimer.js';
import HeroPoints from '#/engine/entity/HeroPoints.js';
import Loc from '#/engine/entity/Loc.js';
import { ModalState } from '#/engine/entity/ModalState.js';
import { MoveSpeed } from '#/engine/entity/MoveSpeed.js';
import { MoveStrategy } from '#/engine/entity/MoveStrategy.js';
import { isClientConnected } from '#/engine/entity/NetworkPlayer.js';
import Npc from '#/engine/entity/Npc.js';
import Obj from '#/engine/entity/Obj.js';
import PathingEntity, { TargetOp } from '#/engine/entity/PathingEntity.js';
import { Interaction } from '#/engine/entity/Interaction.js';
import { PlayerLoading } from '#/engine/entity/PlayerLoading.js';
import { PlayerQueueRequest, PlayerQueueType, QueueType, ScriptArgument } from '#/engine/entity/PlayerQueueRequest.js';
import { PLAYER_STAT_COUNT, PlayerStat, PlayerStatEnabled, PlayerStatFree, PlayerStatNameMap } from '#/engine/entity/PlayerStat.js';
import InputTracking from '#/engine/entity/tracking/InputTracking.js';
import { WealthEventParams } from '#/engine/entity/tracking/WealthEvent.js';
import { changeNpcCollision, changePlayerOccCollision, findPathToEntity, reachedEntity, reachedLoc, reachedObj } from '#/engine/GameMap.js';
import { Inventory, InventoryListener } from '#/engine/Inventory.js';
import DeadOps from '#/engine/script/DeadOps.js';
import ScriptFile from '#/engine/script/ScriptFile.js';
import ScriptPointer from '#/engine/script/ScriptPointer.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import ScriptState from '#/engine/script/ScriptState.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import World from '#/engine/World.js';
import Packet from '#/io/Packet.js';
import ChatFilterSettings from '#/network/game/server/model/ChatFilterSettings.js';
import HintArrow from '#/network/game/server/model/HintArrow.js';
import IfClose from '#/network/game/server/model/IfClose.js';
import IfSetTab from '#/network/game/server/model/IfSetTab.js';
import LastLoginInfo from '#/network/game/server/model/LastLoginInfo.js';
import MessageGame from '#/network/game/server/model/MessageGame.js';
import MidiJingle from '#/network/game/server/model/MidiJingle.js';
import MidiSong from '#/network/game/server/model/MidiSong.js';
import ResetAnims from '#/network/game/server/model/ResetAnims.js';
import ResetClientVarCache from '#/network/game/server/model/ResetClientVarCache.js';
import SetLoginToken from '#/network/game/server/model/SetLoginToken.js';
import TutOpen from '#/network/game/server/model/TutOpen.js';
import UnsetMapFlag from '#/network/game/server/model/UnsetMapFlag.js';
import UpdateInvStopTransmit from '#/network/game/server/model/UpdateInvStopTransmit.js';
import UpdatePid from '#/network/game/server/model/UpdatePid.js';
import UpdateRebootTimer from '#/network/game/server/model/UpdateRebootTimer.js';
import UpdateRunEnergy from '#/network/game/server/model/UpdateRunEnergy.js';
import UpdateStat from '#/network/game/server/model/UpdateStat.js';
import VarpLarge from '#/network/game/server/model/VarpLarge.js';
import VarpBatch from '#/network/game/server/model/VarpBatch.js';
import VarpSmall from '#/network/game/server/model/VarpSmall.js';
import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';
import { LoggerEventType } from '#/server/logger/LoggerEventType.js';
import { ChatModePrivate, ChatModePublic, ChatModeTradeDuel } from '#/engine/entity/ChatModes.js';
import Environment from '#/util/Environment.js';
import { printWarning } from '#/util/Logger.js';
import { toDisplayName } from '#/util/JString.js';
import LinkList from '#/datastruct/LinkList.js';
import VarBitType from '#/cache/config/VarBitType.js';
import FriendlistLoaded from '#/network/game/server/model/FriendlistLoaded.js';
import UpdateIgnoreList from '#/network/game/server/model/UpdateIgnoreList.js';
import Midi from '#/cache/midi/Midi.js';

const levelExperience = new Int32Array(99);

let acc = 0;
for (let i = 0; i < 99; i++) {
    const level = i + 1;
    const delta = Math.floor(level + Math.pow(2.0, level / 7.0) * 300.0);
    acc += delta;
    levelExperience[i] = Math.floor(acc / 4) * 10;
}

export function getLevelByExp(exp: number) {
    for (let i = 98; i >= 0; i--) {
        if (exp >= levelExperience[i]) {
            return Math.min(i + 2, 99);
        }
    }

    return 1;
}

export function getExpByLevel(level: number) {
    return levelExperience[level - 2];
}

export default class Player extends PathingEntity {
    static readonly DESIGN_BODY_COLORS: number[][] = [
        [6798, 107, 10283, 16, 4797, 7744, 5799, 4634, 33697, 22433, 2983, 54193],
        [8741, 12, 64030, 43162, 7735, 8404, 1701, 38430, 24094, 10153, 56621, 4783, 1341, 16578, 35003, 25239],
        [25238, 8742, 12, 64030, 43162, 7735, 8404, 1701, 38430, 24094, 10153, 56621, 4783, 1341, 16578, 35003],
        [4626, 11146, 6439, 12, 4758, 10270],
        [4550, 4537, 5681, 5673, 5790, 6806, 8076, 4574]
    ];

    static readonly MALE_FEMALE_MAP = new Map<number, number>([
        [0, 45],
        [1, 47],
        [2, 48],
        [3, 49],
        [4, 50],
        [5, 51],
        [6, 52],
        [7, 53],
        [8, 54],
        [9, 55],
        [18, 56],
        [19, 56],
        [20, 56],
        [21, 56],
        [22, 56],
        [23, 56],
        [24, 56],
        [25, 56],
        [26, 61],
        [27, 63],
        [28, 62],
        [29, 65],
        [30, 64],
        [31, 63],
        [32, 66],
        [33, 67],
        [34, 68],
        [35, 69],
        [36, 70],
        [37, 71],
        [38, 72],
        [39, 76],
        [40, 75],
        [41, 78],
        [42, 79],
        [43, 80],
        [44, 81]
    ]);

    static readonly FEMALE_MALE_MAP = new Map<number, number>([
        [45, 0],
        [46, 0],
        [47, 1],
        [48, 2],
        [49, 3],
        [50, 4],
        [51, 5],
        [52, 6],
        [53, 7],
        [54, 8],
        [55, 9],
        [56, 18],
        [57, 18],
        [58, 18],
        [59, 18],
        [60, 18],
        [61, 26],
        [62, 27],
        [63, 28],
        [64, 29],
        [65, 29],
        [66, 32],
        [67, 33],
        [68, 34],
        [69, 35],
        [70, 36],
        [71, 37],
        [72, 38],
        [73, 36],
        [74, 36],
        [75, 40],
        [76, 39],
        [77, 36],
        [78, 41],
        [79, 42],
        [80, 43],
        [81, 44]
    ]);

    save() {
        const sav = Packet.alloc(2);
        sav.p2(PlayerLoading.SAV_MAGIC); // magic
        sav.p2(PlayerLoading.SAV_VERSION); // version

        sav.p2(this.x);
        sav.p2(this.z);
        sav.p1(this.level);
        for (let i = 0; i < 7; i++) {
            sav.p1(this.body[i]);
        }
        for (let i = 0; i < 5; i++) {
            sav.p1(this.colors[i]);
        }
        sav.p1(this.gender);
        sav.p2(this.runenergy);
        sav.p4(this.playtime);

        // v8+: the stat count is written first, so adding a stat later (Hunter) is not another
        // format change - PlayerLoading reads however many the file says and defaults the rest.
        sav.p1(PLAYER_STAT_COUNT);
        for (let i = 0; i < PLAYER_STAT_COUNT; i++) {
            sav.p4(this.stats[i]);
            sav.p1(this.levels[i]);
        }

        let saved = 0;
        for (let id = 0; id < this.vars.length; id++) {
            const varp = VarPlayerType.get(id);
            if (varp.scope === VarPlayerType.SCOPE_PERM && this.vars[id] !== 0) {
                saved++;
            }
        }
        sav.p2(saved);
        for (let id = 0; id < this.vars.length; id++) {
            const varp = VarPlayerType.get(id);
            if (varp.scope === VarPlayerType.SCOPE_PERM && this.vars[id] !== 0) {
                sav.p2(id);
                sav.pVarInt(this.vars[id]);
            }
        }

        let invCount = 0;
        const invStartPos = sav.pos;
        sav.p1(0); // placeholder for saved inventory count
        for (const [typeId, inventory] of this.invs) {
            const invType = InvType.get(typeId);
            if (invType.scope !== InvType.SCOPE_PERM) {
                continue;
            }

            sav.p2(typeId);
            sav.p2(inventory.capacity);
            for (let slot = 0; slot < inventory.capacity; slot++) {
                const obj = inventory.get(slot);
                if (!obj) {
                    sav.p2(0);
                    continue;
                }

                sav.p2(obj.id + 1);
                if (obj.count >= 255) {
                    sav.p1(255);
                    sav.p4(obj.count);
                } else {
                    sav.p1(obj.count);
                }
            }
            invCount++;
        }
        // set the total saved inv count as the placeholder
        sav.data[invStartPos] = invCount;

        // afk zones
        sav.p1(this.afkZones.length);
        for (let index: number = 0; index < this.afkZones.length; index++) {
            sav.p4(this.afkZones[index]);
        }
        sav.p2(this.lastAfkZone);

        // chat modes
        sav.p1((this.publicChat << 4) | (this.privateChat << 2) | this.tradeDuel);

        // last login info
        sav.p8(this.lastLoginTime);

        sav.p4(Packet.getcrc(sav.data, 0, sav.pos));
        return sav.data.subarray(0, sav.pos);
    }

    username: string;
    username37: bigint;
    hash64: bigint;
    displayName: string;
    body: number[] = [
        0, // hair
        10, // beard
        18, // body
        26, // arms
        33, // gloves
        36, // legs
        42 // boots
    ];
    colors: number[] = [0, 0, 0, 0, 0];
    gender: number = 0;
    run: number = 0;
    tempRun: number = 0;
    runenergy: number = 10000;
    lastRunEnergy: number = -1;
    runweight: number = 0;
    // Whole-percent bonus to NATURAL run energy recovery, summed from the energy_restore param
    // over worn equipment. Derived, never saved: calculateRunWeight() recomputes it from the
    // actual worn inv, so it cannot go stale the way a varp maintained by content would.
    runrestore: number = 0;
    playtime: number = 0;
    stats: Int32Array = new Int32Array(PLAYER_STAT_COUNT);
    levels: Uint8Array = new Uint8Array(PLAYER_STAT_COUNT);
    vars: Int32Array;
    varsString: string[];
    invs: Map<number, Inventory> = new Map<number, Inventory>();
    nextTarget: Entity | null = null;
    // where a player/npc target stood when the route to it was last worked out (pathToPathingTarget)
    routedTargetX: number = -1;
    routedTargetZ: number = -1;

    publicChat: ChatModePublic = ChatModePublic.ON;
    privateChat: ChatModePrivate = ChatModePrivate.ON;
    tradeDuel: ChatModeTradeDuel = ChatModeTradeDuel.ON;

    session: string = 'headless';
    input: InputTracking;

    slot: number = -1;
    uid: number = -1;
    reconnecting: boolean = false;
    lowMemory: boolean = false;
    webClient: boolean = false;
    combatLevel: number = 3;
    skillLevel: number = 0;
    headicons: number = 0;
    baseLevels = new Uint8Array(PLAYER_STAT_COUNT);
    lastStats: Int32Array = new Int32Array(PLAYER_STAT_COUNT); // we track this so we know to flush stats only once a tick on changes
    lastLevels: Uint8Array = new Uint8Array(PLAYER_STAT_COUNT); // we track this so we know to flush stats only once a tick on changes
    originX: number = -1;
    originZ: number = -1;
    buildArea: BuildArea = new BuildArea(this);
    animProtect: number = 0;
    invListeners: InventoryListener[] = [];
    allowDesign: boolean = false;
    afkEventReady: boolean = false;
    moveClickRequest: boolean = false;

    requestLogout: boolean = false;
    requestIdleLogout: boolean = false;
    // the tick of this player's last real input - an action, chat, a click or a camera move (NetworkPlayer.read).
    // -1 until the world first looks at it. World.processLogouts logs out on it (2026-10-19).
    lastUserInput: number = -1;

    // custom (2026-11-03) - the round trip to this client, measured by ServerGameProt.PING and
    // PongHandler. -1 until the first answer comes back, and again whenever one goes unanswered.
    pingMs: number = -1;
    pingSeq: number = 0;
    pingSentAt: number = -1;
    loggingOut: boolean = false;
    preventLogoutMessage: string | null = null;
    preventLogoutUntil: number = -1;

    lastResponse: number = -1;
    lastConnected: number = -1;

    logMessage: string | null = null;

    // ---

    // script variables
    queue: LinkList<PlayerQueueRequest> = new LinkList();
    weakQueue: LinkList<PlayerQueueRequest> = new LinkList();
    engineQueue: LinkList<PlayerQueueRequest> = new LinkList();
    cameraPackets: LinkList<CameraInfo> = new LinkList();
    timers: Map<number, EntityTimer> = new Map();
    tabs: number[] = new Array(14).fill(-1);
    modalState = ModalState.NONE;
    modalMain = -1;
    lastModalMain = -1;
    modalChat = -1;
    lastModalChat = -1;
    modalSide = -1;
    lastModalSide = -1;
    modalTutorial = -1;
    overlay = -1;
    lastOverlay = -1;
    refreshModal = false;
    refreshModalClose = false;
    requestModalClose = false;

    protect: boolean = false; // whether protected access is available
    activeScript: ScriptState | null = null;
    resumeButtons: number[] = [];

    lastItem: number = -1; // opheld, opheldu, opheldt, inv_button
    lastSlot: number = -1; // opheld, opheldu, opheldt, inv_button, inv_buttond
    lastUseItem: number = -1; // opheldu, opobju, oplocu, opnpcu, opplayeru
    lastUseSlot: number = -1; // opheldu, opobju, oplocu, opnpcu, opplayeru

    // THE OPHELDU HAND-OVER, both of them live for one packet and are never saved.
    // "Use a on b" picks ONE of the two items' triggers - b's, the one clicked second - so a script
    // that does not know the pair has to be able to pass the click to the other half, or the same
    // two items do something one way round and nothing the other way round. The content asks with
    // opheldu_decline (see ~displaymessage) and OpHeldUHandler does the passing.
    opheldUHandoverAvailable: boolean = false;
    opheldUHandoverAsked: boolean = false;
    lastTargetSlot: number = -1; // inv_buttond
    lastDragMode: number = -1; // inv_buttond - 0 swap, 1 insert, 100+n dropped on bank tab n
    lastCom: number = -1; // if_button

    staffModLevel: number = 0;
    // custom (2026-11-06) - helped test before launch, and carries the grey emblem for it. Set
    // from the account row at login (World.onLoginMessage), never from the save: the launch wipe
    // moves saves away and keeps accounts, so the account is the half that survives.
    //
    // Not a staffModLevel, and deliberately a boolean so that no "at least" check can be written
    // against it by accident. It grants nothing.
    veteran: boolean = false;
    // custom (2026-11-11) - the Helper rank. Appearance only, like veteran: see ChatCrown.
    helper: boolean = false;
    visibility: Visibility = Visibility.DEFAULT;
    // custom (2026-09-27) - a server-side bot (engine/bot/BotPlayer.ts). Never saved, never counted as
    // online, never announced to the friend server or a clan channel; see the isBot checks in World.
    isBot: boolean = false;

    heroPoints: HeroPoints = new HeroPoints(16); // be sure to reset when stats are recovered/reset

    afkZones: Int32Array = new Int32Array(2);
    lastAfkZone: number = 0;

    // movement triggers
    lastMapZone: number = -1;
    lastZone: number = -1;

    muted_until: Date | null = null;
    members: boolean = true;
    messageCount: number = 0;

    // custom (2026-11-02) - a saved-login token this login minted, waiting to be handed to the
    // client. Set by World.onLoginMessage and cleared the moment it is written: it belongs to the
    // login, not to the player, and nothing saves it anywhere on this side.
    loginToken: string | null = null;

    // custom (2026-11-15) - the launcher sign-in token this login arrived with, waiting to be sent
    // to the Discord relay once the player is actually in the world. Set by World.onLoginMessage
    // from the client socket and cleared the moment it is used, for the same reason loginToken is:
    // it belongs to the login and there is nowhere on this side it should outlive it.
    launcherSignIn: string | null = null;

    socialProtect: boolean = false; // social packet spam protection
    reportAbuseProtect: boolean = false; // social packet spam protection

    lastLoginTime: bigint = 0n;

    // info updates
    appearanceInv: number = -1;
    appearanceBuf: Uint8Array | null = null;
    lastAppearance: number = 0;
    readyanim: number = -1;
    turnanim: number = -1;
    walkanim: number = -1;
    walkanim_b: number = -1;
    walkanim_l: number = -1;
    walkanim_r: number = -1;
    runanim: number = -1;
    chatMessage: Uint8Array | null = null;
    chatColour: number | null = null;
    chatEffect: number | null = null;
    chatRights: number | null = null;
    // clan chat (engine/clan/ClanChat.ts): the owner of the channel this player is in, and their friend list
    // as the friend server has sent it - the engine keeps no other copy
    clanOwner: string | null = null;
    friends37: Set<bigint> | null = null;
    npcId: number = -1;

    constructor(username: string, username37: bigint, hash64: bigint) {
        super(
            0,
            3094,
            3106, // tutorial island
            1,
            1,
            EntityLifeCycle.FOREVER,
            BlockWalk.PLAYER,
            Environment.NODE_CLIENT_ROUTEFINDER ? MoveStrategy.NAIVE : MoveStrategy.SMART,
            PlayerInfoProt.FACE_COORD,
            PlayerInfoProt.FACE_ENTITY
        );

        this.username = username;
        this.username37 = username37;
        this.hash64 = hash64;
        this.displayName = toDisplayName(username);
        this.vars = new Int32Array(VarPlayerType.count);
        this.varsString = new Array(VarPlayerType.count);
        this.lastStats.fill(-1);
        this.lastLevels.fill(-1);
        this.input = new InputTracking(this);

        for (let i = 0; i < this.vars.length; i++) {
            const varp = VarPlayerType.get(i);
            if (varp.type === ScriptVarType.STRING) {
                // todo: "null"? another value?
                continue;
            } else {
                this.vars[i] = varp.type === ScriptVarType.INT ? 0 : -1;
            }
        }
    }

    cleanup(): void {
        this.slot = -1;
        this.uid = -1;
        this.activeScript = null;
        this.resumeButtons = [];
        this.invListeners.length = 0;
        this.resumeButtons.length = 0;
        this.queue.clear();
        this.weakQueue.clear();
        this.engineQueue.clear();
        this.cameraPackets.clear();
        this.timers.clear();
        this.heroPoints.clear();
        this.buildArea.clear(false);
        this.appearanceInv = -1;
        this.lastAppearance = 0;
        this.appearanceBuf = null;
        this.isActive = false;
        this.input.flush();
        World.submitInputCounts(this);
    }

    resetEntity(respawn: boolean) {
        if (respawn) {
            this.unfocus();
        }
        super.resetPathingEntity();
        this.repathed = false;
        this.protect = false;
        this.chatColour = null;
        this.chatEffect = null;
        this.chatRights = null;
        this.chatMessage = null;
        this.logMessage = null;
        this.socialProtect = false;
        this.reportAbuseProtect = false;
    }

    // ----

    onLogin() {
        // confirmed order:
        // - rebuild_normal
        // - chat_filter_settings
        // - varp_reset
        // - varps
        // - invs
        // - interfaces
        // - stats
        // - runweight
        // - runenergy
        // - reset anims
        // - social

        this.buildArea.rebuildNormal();
        this.write(new ChatFilterSettings(this.publicChat, this.privateChat, this.tradeDuel));

        // custom (2026-11-02) - the saved login the client asked for, if it earned one. Cleared as
        // it goes out, so a reconnect in this same session cannot send it twice.
        if (this.loginToken !== null) {
            this.write(new SetLoginToken(this.loginToken));
            this.loginToken = null;
        }

        // custom (2026-11-15) - and the link this login earns, if it came from a launcher signed in
        // to Discord. HERE rather than in World.onLoginMessage, where the token arrives: the relay
        // answers asynchronously and the reply is delivered with getPlayerByUsername, which cannot
        // find a player still sitting in newPlayers. Said at the point the player is in the world
        // and can be written to, so the line telling them it happened reaches them.
        if (this.launcherSignIn !== null) {
            World.discordLauncherLink(this.username, this.launcherSignIn);
            this.launcherSignIn = null;
        }

        // todo: exact order
        if (Environment.FRIEND_SERVER) {
            this.write(new FriendlistLoaded(1));
        } else {
            this.write(new FriendlistLoaded(2));
            this.write(new UpdateIgnoreList([]));
        }

        this.write(new IfClose());
        this.write(new UpdatePid(this.slot, this.members));
        this.write(new ResetClientVarCache());
        this.writeAllVarps();
        this.write(new ResetAnims());

        const loginTrigger = ScriptProvider.getByTriggerSpecific(ServerTriggerType.LOGIN, -1, -1);
        if (loginTrigger) {
            this.executeScript(ScriptRunner.init(loginTrigger, this), true);
        }

        this.lastStepX = this.x - 1;
        this.lastStepZ = this.z;
        this.isActive = true;
    }

    onReconnect() {
        // - varp_reset
        // - varps
        // - rebuild_normal
        // - invs
        // - stats
        // - runweight
        // - runenergy
        // - reset_anims
        // - socials
        this.write(new ResetClientVarCache());
        this.writeAllVarps();
        // reload entity info (overkill? does the client have some logic around this?)
        this.buildArea.clear(true);
        // rebuild scene later this tick (note: rebuild won't run on the client if you're in the same zone!)
        this.buildArea.rebuildNormal(true);
        // in case of pending update
        if (World.isPendingShutdown) {
            const ticksBeforeShutdown = World.shutdownTicksRemaining;
            this.write(new UpdateRebootTimer(ticksBeforeShutdown));
        }
        this.closeModal();
        // tabs could have been updated while reconnecting, make sure we sync them now
        for (let i = 0; i < this.tabs.length; i++) {
            this.write(new IfSetTab(this.tabs[i], i));
        }
        this.refreshInvs();
        for (let i = 0; i < this.stats.length; i++) {
            this.write(new UpdateStat(i, this.stats[i], this.levels[i]));
        }
        this.write(new UpdateRunEnergy(this.runenergy));
        this.write(new ResetAnims());
        this.masks |= this.entitymask; // resync face_entity
        this.masks |= PlayerInfoProt.APPEARANCE; // resync appearance (todo: is it possible to do this for the local observer only?)
        this.moveSpeed = MoveSpeed.INSTANT;
        this.tele = true;
        this.jump = true;
    }

    triggerMapzone(x: number, z: number) {
        // todo: getByTrigger needs more bits to lookup by coord
        const trigger = ScriptProvider.getByName(`[mapzone,0_${x >> 6}_${z >> 6}]`);
        if (trigger) {
            this.enqueueScript(trigger, PlayerQueueType.ENGINE);
        }
    }

    triggerMapzoneExit(x: number, z: number) {
        const trigger = ScriptProvider.getByName(`[mapzoneexit,0_${x >> 6}_${z >> 6}]`);
        if (trigger) {
            this.enqueueScript(trigger, PlayerQueueType.ENGINE);
        }
    }

    triggerZone(level: number, x: number, z: number) {
        const mx = x >> 6;
        const mz = z >> 6;
        const lx = ((x & 0x3f) >> 3) << 3;
        const lz = ((z & 0x3f) >> 3) << 3;
        const trigger = ScriptProvider.getByName(`[zone,${level}_${mx}_${mz}_${lx}_${lz}]`);
        if (trigger) {
            this.enqueueScript(trigger, PlayerQueueType.ENGINE);
        }
    }

    triggerZoneExit(level: number, x: number, z: number) {
        const mx = x >> 6;
        const mz = z >> 6;
        const lx = ((x & 0x3f) >> 3) << 3;
        const lz = ((z & 0x3f) >> 3) << 3;
        const trigger = ScriptProvider.getByName(`[zoneexit,${level}_${mx}_${mz}_${lx}_${lz}]`);
        if (trigger) {
            this.enqueueScript(trigger, PlayerQueueType.ENGINE);
        }
    }

    calculateRunWeight() {
        this.runweight = 0;
        // Recomputed in the same pass as the weight, because it changes at exactly the same
        // moments and over exactly the same data. The param is looked up by name every time
        // rather than cached: this runs on an inventory change, not on a tick, and a cache
        // would be one more thing to invalidate. -1 means no content tree defines it, in which
        // case every player's bonus is 0 and the engine behaves as it did before.
        this.runrestore = 0;
        const restoreParam = ParamType.getId('energy_restore');

        const invs = this.invs.values();
        for (let i = 0; i < this.invs.size; i++) {
            const inv = invs.next().value;
            if (!inv) {
                continue;
            }

            const invType = InvType.get(inv.type);
            if (!invType || !invType.runweight) {
                continue;
            }

            for (let slot = 0; slot < inv.capacity; slot++) {
                const item = inv.get(slot);
                if (!item) {
                    continue;
                }

                const type = ObjType.get(item.id);
                if (!type) {
                    continue;
                }

                // WORN ONLY, which is the one way this differs from the weight below: a Graceful
                // hood in your backpack does not help you catch your breath. Note this rides on
                // the outer loop's runweight filter - an inv marked runweight=no is not visited
                // at all, and worn is marked runweight=yes in player.inv.
                if (inv.type === InvType.WORN && restoreParam !== -1) {
                    this.runrestore += ParamHelper.getIntParam(restoreParam, type, 0);
                }

                if (type.stackable) {
                    continue;
                }

                this.runweight += type.weight * item.count;
            }
        }
    }

    /**
     * WHY THIS PLAYER LEFT, for the one line World.removePlayer prints when they do.
     *
     * A player who says "I crashed and got disconnected" is indistinguishable from one who
     * quit, unless the server wrote down which it was at the moment it decided. processLogouts
     * knows - it is the code that tells a dropped socket from a timed-out one - and by the time
     * removePlayer runs that knowledge is gone. So it is recorded here on the way past.
     */
    logoutReason: string = 'quit';

    addSessionLog(event_type: LoggerEventType, message: string, ...args: string[]): void {
        if (this.isBot) {
            // a bot has no session and no account for a moderator to look up
            return;
        }
        World.addSessionLog(event_type, this.session, CoordGrid.packCoord(this.level, this.x, this.z), message, ...args);
    }

    addWealthEvent(event: WealthEventParams) {
        World.addWealthEvent({
            coord: CoordGrid.packCoord(this.level, this.x, this.z),
            session_uuid: this.session,
            ...event
        });
    }

    processEngineQueue() {
        for (const request of this.engineQueue.all()) {
            const delay = request.delay--;
            if (this.canAccess() && delay <= 0) {
                const script = ScriptRunner.init(request.script, this, null, request.args);
                this.executeScript(script, true);

                request.unlink();
            }
        }
    }

    // ----

    updateMovement(): boolean {
        // players cannot walk if they have a modal open *and* something in their queue, confirmed as far back as 2005
        if (this.moveClickRequest && this.busy() && (this.queue.head() != null || this.engineQueue.head() != null)) {
            return false;
        }

        if (this.moveSpeed !== MoveSpeed.INSTANT) {
            this.moveSpeed = this.defaultMoveSpeed();
            if (this.runanim === -1) {
                this.moveSpeed = MoveSpeed.WALK;
            } else if (this.tempRun) {
                this.moveSpeed = MoveSpeed.RUN;
            }
        }

        if (!super.processMovement()) {
            // todo: this is running every idle tick
            this.tempRun = 0;
        }

        if (this.stepsTaken > 0) {
            this.lastMovement = World.currentTick + 1;
        }

        return this.stepsTaken > 0;
    }

    updateEnergy() {
        if (this.delayed) {
            return;
        }
        // UNLIMITED RUN (owner, 2026-09-29): nobody's energy drains, so nobody is ever forced to
        // walk. Held AT the maximum rather than merely left alone, because a player who is part way
        // down when this is switched on would otherwise keep that number for as long as they kept
        // running, and the orb would sit at whatever they happened to have. The client is only told
        // when the value crosses a whole percent (NetworkPlayer, lastRunEnergy), so pinning it costs
        // one comparison a tick and no packets.
        //
        // The admin branch below is left exactly as it was: it is the same rule for staff and it
        // should keep working if this is ever turned off again.
        if (Environment.NODE_UNLIMITED_RUN) {
            if (this.runenergy < 10000) {
                this.runenergy = 10000;
            }
            return;
        }
        if (this.stepsTaken < 2) {
            const natural = ((this.baseLevels[PlayerStat.AGILITY] / 6) | 0) + 8;
            // The energy_restore bonus applies to NATURAL recovery and nowhere else, which is why
            // it is here rather than in HEALENERGY: an energy potion is not you catching your
            // breath, and OSRS does not scale it either. runrestore is 0 unless worn equipment
            // carries the param, so this is the old line for everybody else.
            const recovered = natural + (((natural * this.runrestore) / 100) | 0);
            this.runenergy = Math.min(this.runenergy + recovered, 10000);
        } else if (this.staffModLevel < 3) {
            // Admins (staffModLevel >= 3) and above never deplete run energy - left off the regen
            // branch above deliberately too, so their energy just holds wherever it already was
            // (typically full) rather than needing to be re-topped-up every tick.
            const weightKg = this.runweight / 1000;
            const clampWeight = Math.min(Math.max(weightKg, 0), 64);
            const loss = (67 + (67 * clampWeight) / 64) | 0;
            this.runenergy = Math.max(this.runenergy - loss, 0);
        }

        if (this.runenergy === 0) {
            this.run = 0;
            // todo: better way to sync engine varp
            this.setVar(VarPlayerType.RUN, this.run);
        }
        if (this.runenergy < 100) {
            this.tempRun = 0;
        }
    }

    blockWalkFlag(): CollisionFlag {
        return CollisionFlag.BLOCK_NPC_AND_PLAYERS;
    }

    defaultMoveSpeed(): MoveSpeed {
        return this.run ? MoveSpeed.RUN : MoveSpeed.WALK;
    }

    // ----

    closeTutorial() {
        if (this.modalTutorial !== -1) {
            const closeTrigger = ScriptProvider.getByTrigger(ServerTriggerType.IF_CLOSE, this.modalTutorial);
            if (closeTrigger) {
                this.executeScript(ScriptRunner.init(closeTrigger, this), false);
            }

            this.modalTutorial = -1;
            this.write(new TutOpen(-1));
        }
    }

    clearComListeners(root: number) {
        if (root == -1) {
            return;
        }

        for (let i = 0; i < this.invListeners.length; i++) {
            const { com } = this.invListeners[i];
            if (Component.get(com).rootLayer === root) {
                this.invStopListenOnCom(com);
            }
        }
    }

    closeModal(clearWeakQueue: boolean = true) {
        if (clearWeakQueue) {
            this.weakQueue.clear();
        }
        if (!this.delayed) {
            this.protect = false;
        }

        if (this.modalState === ModalState.NONE) {
            return;
        }

        this.modalState = ModalState.NONE;

        // close any input dialogue suspended scripts.
        if (this.activeScript?.execution === ScriptState.COUNTDIALOG || this.activeScript?.execution === ScriptState.NAMEDIALOG || this.activeScript?.execution === ScriptState.PAUSEBUTTON) {
            this.activeScript = null;
            this.resumeButtons = [];
        }

        // close any main viewport interface
        if (this.modalMain !== -1) {
            const closeTrigger = ScriptProvider.getByTrigger(ServerTriggerType.IF_CLOSE, this.modalMain);
            if (closeTrigger) {
                this.executeScript(ScriptRunner.init(closeTrigger, this), false);
            }

            this.clearComListeners(this.modalMain);
            this.modalMain = -1;
        }

        // close any chatbox interface
        if (this.modalChat !== -1) {
            const closeTrigger = ScriptProvider.getByTrigger(ServerTriggerType.IF_CLOSE, this.modalChat);
            if (closeTrigger) {
                this.executeScript(ScriptRunner.init(closeTrigger, this), false);
            }

            this.clearComListeners(this.modalChat);
            this.modalChat = -1;
        }

        // close any sidebar tabs interface
        if (this.modalSide !== -1) {
            const closeTrigger = ScriptProvider.getByTrigger(ServerTriggerType.IF_CLOSE, this.modalSide);
            if (closeTrigger) {
                this.executeScript(ScriptRunner.init(closeTrigger, this), false);
            }

            this.clearComListeners(this.modalSide);
            this.modalSide = -1;
        }

        this.refreshModalClose = true;
    }

    /**
     * Is a chatbox input prompt waiting on this player right now?
     *
     * The client's IF_CLOSE handler clears chatbackInputOpen, so an IF_CLOSE that lands AFTER a
     * P_COUNTDIALOG cancels the prompt on the same tick it appeared. P_COUNTDIALOG is written while
     * the script runs; IF_CLOSE is written at the END of the tick, from NetworkPlayer.encodeOut -
     * so any script shaped `if_close; p_countdialog;` opened an amount prompt the player could not
     * answer, and it vanished before they could type into it. Make X on every skillmultiN panel was
     * exactly that shape: fletching's Make X did nothing at all, while Make All / 10 / 5 / 1 on the
     * same panel worked, and cooking's own Make X (cookx, which has no if_close) worked too.
     */
    awaitingChatboxInput(): boolean {
        const execution = this.activeScript?.execution;
        return execution === ScriptState.COUNTDIALOG || execution === ScriptState.NAMEDIALOG;
    }

    /**
     * Must this tick's end-of-tick IF_CLOSE be held back? NetworkPlayer.encodeOut asks before
     * writing one. Holding costs nothing: refreshModalClose and the lastModal* trackers are left
     * as they are, so the first tick on which no prompt is waiting sends the close instead.
     */
    holdingModalClose(): boolean {
        return this.refreshModalClose && this.awaitingChatboxInput();
    }

    containsModalInterface() {
        // main or chat is open
        return (this.modalState & (ModalState.MAIN | ModalState.CHAT)) !== ModalState.NONE;
    }

    busy() {
        return this.delayed || this.containsModalInterface();
    }

    canAccess() {
        if (World.shutdown) {
            // once the world has gone past shutting down, no protection rules apply
            return true;
        } else {
            return !this.protect && !this.busy();
        }
    }

    /**
     *
     * @param script
     * @param {QueueType} type
     * @param delay
     * @param args
     */
    enqueueScript(script: ScriptFile, type: QueueType = PlayerQueueType.NORMAL, delay = 0, args: ScriptArgument[] = []) {
        const request = new PlayerQueueRequest(type, script, args, delay);
        if (type === PlayerQueueType.ENGINE) {
            request.delay = 0;
            this.engineQueue.addTail(request);
        } else if (type === PlayerQueueType.WEAK) {
            this.weakQueue.addTail(request);
        } else {
            this.queue.addTail(request);
        }
    }

    unlinkQueuedScript(scriptId: number, type: QueueType = PlayerQueueType.NORMAL) {
        if (type === PlayerQueueType.ENGINE) {
            for (const request of this.engineQueue.all()) {
                if (request.script.id === scriptId) {
                    request.unlink();
                }
            }
        } else {
            for (const request of this.queue.all()) {
                if (request.script.id === scriptId) {
                    request.unlink();
                }
            }
            for (const request of this.weakQueue.all()) {
                if (request.script.id === scriptId) {
                    request.unlink();
                }
            }
        }
    }

    processQueues() {
        // the presence of a strong script closes modals before queue runs
        for (const request of this.queue.all()) {
            if (request.type === PlayerQueueType.STRONG) {
                this.requestModalClose = true;
                break;
            }
        }
        if (this.requestModalClose) {
            this.requestModalClose = false;
            this.closeModal();
        }

        this.processQueue();
        this.processWeakQueue();
    }

    processQueue() {
        // there is a quirk with their LinkList impl that results in a queue speedup bug:
        // in .head() the next link is cached. on the next iteration, next() will use this cached value, even if it's null
        // regardless of whether the end of the list has been reached (i.e. the previous iteration added to the end of the list)
        // - thank you De0 for the explanation
        // essentially, if a script is before the end of the list, it can be processed this tick and result in inconsistent queue timing (authentic)
        for (const request of this.queue.all()) {
            if (this.loggingOut && request.type === PlayerQueueType.LONG && request.args[0] === 0) {
                // ^accelerate
                request.delay = 0;
            }

            // One decrement per tick, however many passes see this request. World.processPlayers
            // runs the queues twice - once in each player's own turn and once after every player's
            // turn is over - so that a queue entry added during this tick still gets its chance in
            // this tick. Without this guard the second pass would count every waiting entry down
            // twice and fire it early.
            if (request.lastTick === World.currentTick) {
                continue;
            }
            request.lastTick = World.currentTick;
            const delay = request.delay--;
            if (this.canAccess() && delay <= 0) {
                request.unlink();

                if (request.type === PlayerQueueType.LONG) {
                    request.args.shift();
                }
                const script = ScriptRunner.init(request.script, this, null, request.args);
                this.executeScript(script, true);
            }
        }
    }

    processWeakQueue() {
        for (const request of this.weakQueue.all()) {
            if (request.lastTick === World.currentTick) {
                // see processQueue
                continue;
            }
            request.lastTick = World.currentTick;
            const delay = request.delay--;
            if (this.canAccess() && delay <= 0) {
                request.unlink();

                const script = ScriptRunner.init(request.script, this, null, request.args);
                this.executeScript(script, true);
            }
        }
    }

    setTimer(type: PlayerTimerType, script: ScriptFile, args: ScriptArgument[] = [], interval: number) {
        const timerId = script.id;
        const timer = {
            type,
            script,
            args,
            interval,
            clock: World.currentTick
        };

        this.timers.set(timerId, timer);
    }

    clearTimer(timerId: number) {
        this.timers.delete(timerId);
    }

    processTimers(type: PlayerTimerType) {
        for (const timer of this.timers.values()) {
            if (type !== timer.type) {
                continue;
            }

            // only execute if it's time and able
            // soft timers can execute while busy, normal cannot
            if (World.currentTick >= timer.clock + timer.interval && (timer.type === PlayerTimerType.SOFT || this.canAccess())) {
                // set clock back to interval
                timer.clock = World.currentTick;

                const script = ScriptRunner.init(timer.script, this, null, timer.args);
                this.executeScript(script, timer.type === PlayerTimerType.NORMAL);
            }
        }
    }

    // clear current interaction and walk queue
    stopAction() {
        this.clearPendingAction();
        this.unsetMapFlag();
    }

    // clear current interaction but leave walk queue intact
    clearPendingAction() {
        this.clearInteraction();
        this.closeModal();
    }

    hasInteraction() {
        if (!this.target) {
            return false;
        }
        // The follow interaction doesn't do anything
        if (this.targetOp === ServerTriggerType.APPLAYER3 || this.targetOp === ServerTriggerType.OPPLAYER3) {
            return false;
        }
        return true;
    }

    getOpTrigger() {
        if (!this.target) {
            return null;
        }

        let typeId = -1;
        let categoryId = -1;

        // prio trigger details by target<type<com
        if (this.target instanceof Npc || this.target instanceof Loc || this.target instanceof Obj) {
            let type: NpcType | LocType | ObjType | null = null;

            if (this.target instanceof Npc) {
                type = NpcType.get(this.target.type);
            } else if (this.target instanceof Loc) {
                type = LocType.get(this.target.type);
            } else if (this.target instanceof Obj) {
                type = ObjType.get(this.target.type);
            }

            if (!type) {
                return null;
            }

            typeId = type.id;
            categoryId = type.category;
        }
        if (this.targetSubject.com !== -1) {
            typeId = this.targetSubject.com;
        }

        return ScriptProvider.getByTrigger(this.targetOp + 7, typeId, categoryId) ?? null;
    }

    getApTrigger() {
        if (!this.target) {
            return null;
        }

        let typeId = -1;
        let categoryId = -1;

        // prio trigger details by target<type<com
        if (this.target instanceof Npc || this.target instanceof Loc || this.target instanceof Obj) {
            let type: NpcType | LocType | ObjType | null = null;

            if (this.target instanceof Npc) {
                type = NpcType.get(this.target.type);
            } else if (this.target instanceof Loc) {
                type = LocType.get(this.target.type);
            } else if (this.target instanceof Obj) {
                type = ObjType.get(this.target.type);
            }

            if (!type) {
                return null;
            }

            typeId = type.id;
            categoryId = type.category;
        }
        if (this.targetSubject.com !== -1) {
            typeId = this.targetSubject.com;
        }

        return ScriptProvider.getByTrigger(this.targetOp, typeId, categoryId) ?? null;
    }

    setInteraction(interaction: Interaction, target: Entity, op: TargetOp, com?: number): boolean {
        // a new interaction routes afresh (the route in hand is the client's, or for another target)
        this.routedTargetX = -1;
        this.routedTargetZ = -1;
        return super.setInteraction(interaction, target, op, com);
    }

    pathToPathingTarget(): void {
        if (!(this.target instanceof PathingEntity)) {
            return;
        }

        // Follow walks in the followed player's footsteps (the tile they last stepped off), not up to them.
        if (this.targetOp === ServerTriggerType.APPLAYER3 || this.targetOp === ServerTriggerType.OPPLAYER3) {
            if (this.isLastWaypoint()) {
                this.queueWaypoint(this.target.followX, this.target.followZ);
            }
            return;
        }

        if (!this.canAccess()) {
            return;
        }

        if (this.moveStrategy === MoveStrategy.FLY) {
            if (this.isLastWaypoint()) {
                this.pathToTarget();
            }
            return;
        }

        // Walking up to a player or an npc is the server's route, as in Old School: the smart
        // pathfinder to a tile beside the target's whole footprint, worked out again whenever the
        // target has moved since (or the route has run out short of it).
        //
        // It used to keep the route the client sent with the click, and only when the target had
        // wandered more than a tile from that route's end fall back to a straight-line step towards
        // it - with the target treated as 1x1 at its south-west tile. The 377 client routes to an npc
        // the same way (Client.tryMove with a 1x1 target, npcs not in its collision map), so for
        // anything bigger than 1x1 the route ENDED ON THE NPC: the player ran onto a cow or a demon,
        // then random-walked a tile a tick until it happened to come out - "runs towards it, then
        // back, then towards it again". And a straight line into a fence stood the player at the
        // fence for good. The server knows the npc's size and every wall, so it routes.
        const target = this.target;
        if (!this.hasWaypoints() || target.x !== this.routedTargetX || target.z !== this.routedTargetZ || target.level !== this.level) {
            this.queueWaypoints(findPathToEntity(this.level, this.x, this.z, target.x, target.z, this.width, target.width, target.length));
            this.routedTargetX = target.x;
            this.routedTargetZ = target.z;
        }
    }

    // https://youtu.be/_NmFftkMm0I?si=xSgb8GCydgUXUayR&t=79
    // to allow p_walk (sets player destination tile) during walktriggers
    // we process walktriggers from regular movement in client input,
    // and for each interaction.
    processWalktrigger() {
        if (this.walktrigger !== -1 && !this.protect && !this.delayed) {
            const trigger = ScriptProvider.get(this.walktrigger);
            this.walktrigger = -1;
            if (trigger) {
                const script = ScriptRunner.init(trigger, this);
                this.runScript(script, true);
            }
        }
    }

    defaultOp() {
        const opTrigger = this.getOpTrigger();
        const apTrigger = this.getApTrigger();

        if (!Environment.NODE_PRODUCTION && !opTrigger && !apTrigger) {
            let debugname = '_';
            if (this.target instanceof Npc) {
                const type = NpcType.get(this.target.type);
                debugname = type.debugname ?? this.target.type.toString();
            } else if (this.target instanceof Loc) {
                const type = LocType.get(this.target.type);
                debugname = type.debugname ?? this.target.type.toString();
            } else if (this.target instanceof Obj) {
                debugname = ObjType.get(this.target.type)?.debugname ?? this.target.type.toString();
            } else if ((this.targetSubject.com !== -1 && this.targetOp === ServerTriggerType.APNPCT) || this.targetOp === ServerTriggerType.APPLAYERT || this.targetOp === ServerTriggerType.APLOCT || this.targetOp === ServerTriggerType.APOBJT) {
                debugname = Component.get(this.targetSubject.com)?.comName ?? this.targetSubject.toString();
            } else if (this.targetSubject.type !== -1) {
                debugname = ObjType.get(this.targetSubject.type)?.debugname ?? this.targetSubject.toString();
            }

            this.messageGame(`No trigger for [${ServerTriggerType[this.targetOp + 7].toLowerCase()},${debugname}]`);
            // custom (2026-11-02) - and keep it. This message is the only record anywhere of an
            // option the cache offers that the content never answered, and until now it was printed
            // to one player and forgotten. DeadOps collects every one, so a fuzz run, a sim or an
            // afternoon on the dev world all leave the same to-do list behind. Inside the same
            // !NODE_PRODUCTION guard: a live world collects nothing and pays nothing.
            DeadOps.record(ServerTriggerType[this.targetOp + 7].toLowerCase(), debugname, this.username, this.x, this.z, this.level);
        }

        this.messageGame(this.defaultOpMessage());
        this.clearWaypoints();
    }

    /**
     * custom (2026-11-18) - what a player is told when nothing answered their click.
     *
     * "Nothing interesting happens." for everything, EXCEPT Talk-to on an npc, which gets
     * "<name> is not interested in talking." - the sentence the content already writes by hand for
     * Jonny the Beard, the bandit camp leaders, Billy Rehnison and the beggar in Camelot.
     *
     * WHY. `npm run opsweep` counts 307 npcs the map places that advertise Talk-to with nothing
     * behind it: forty-two fairies in Zanaris, twenty-seven ugthanki in the desert, every HAM
     * civilian under Lumbridge, Alice the camel by the Al Kharid gate. Walking up to a fairy and
     * being told "Nothing interesting happens." reads like a broken game. Being told she is not
     * interested in talking reads like a character who does not want to talk, which is the same
     * amount of unwritten dialogue and a tenth of the bug reports.
     *
     * WHY HERE AND NOT A GLOBAL [opnpc1,_] IN THE CONTENT, WHICH IS WHAT I WROTE FIRST AND IS
     * WRONG, TWICE OVER.
     *   1. Player.interact prefers an op trigger over an ap trigger whenever the player is in
     *      operable distance, and ScriptProvider.getByTrigger falls back type -> category ->
     *      global. So a global [opnpc1,_] does not fill the gaps, it BEATS the fifteen npcs whose
     *      Talk-to is written as [apnpc1,x] with no opnpc1 beside it - every banker, Hengrad,
     *      Eadgar, Godric, the three fight slaves - for anyone who clicks from an adjacent tile.
     *      A global [apnpc1,_] has the mirror problem: it fires on the way in, at ap range, ahead
     *      of the specific opnpc1 that was going to run on arrival.
     *   2. A script cannot read an op's LABEL, so a content global cannot tell Talk-to from the
     *      five op1s that are something else - "Take" on the Haunted Mine's bronze pickaxes,
     *      "Pet" on Sophanem's plagued cows, "Kick" on the Wise Old Man's bed - and would have
     *      told the player a pickaxe was not interested in talking. Here the label is in hand.
     *
     * defaultOp only runs when nothing claimed the click, so this can preempt nothing, and the
     * DeadOps row and the dev-world `No trigger for [opnpc1,fairy]` line above are untouched: the
     * 307 stay on the to-do list in opsweep's report exactly as they are. This is a better sentence
     * for an unwritten npc, not an implementation of one.
     */
    private defaultOpMessage(): string {
        if (this.target instanceof Npc && this.targetOp + 7 === ServerTriggerType.OPNPC1) {
            const type = NpcType.get(this.target.type);
            if (type && type.name && TALK_TO_OP.test(type.op?.[0] ?? '')) {
                return `${type.name} is not interested in talking.`;
            }
        }
        return 'Nothing interesting happens.';
    }

    inOperableDistance(target: Entity): boolean {
        if (target.level !== this.level) {
            return false;
        }
        if (target instanceof PathingEntity) {
            return reachedEntity(this.level, this.x, this.z, target.x, target.z, target.width, target.length, this.width);
        } else if (target instanceof Loc) {
            const forceapproach = LocType.get(target.type).forceapproach;
            return reachedLoc(this.level, this.x, this.z, target.x, target.z, target.width, target.length, this.width, target.angle, target.shape, forceapproach);
        }
        // instanceof Obj
        return reachedEntity(this.level, this.x, this.z, target.x, target.z, target.width, target.length, this.width) || reachedObj(this.level, this.x, this.z, target.x, target.z, target.width, target.length, this.width);
    }

    tryInteract(allowOpScenery: boolean): boolean {
        if (!this.target || !this.hasInteraction() || !this.canAccess()) {
            return false;
        }

        const opTrigger = this.getOpTrigger();
        const apTrigger = this.getApTrigger();

        // Run the opTrigger if it exists and Player is within range
        // allowOpScenery controls if Locs and Objs can be op'd
        if (opTrigger && (this.target instanceof PathingEntity || allowOpScenery) && this.inOperableDistance(this.target)) {
            const target = this.target;

            this.target = null;
            this.clearWaypoints();

            this.executeScript(ScriptRunner.init(opTrigger, this, target), true);

            // If p_opnpc was called, remember it for later
            // For now, keep the current target
            this.nextTarget = this.target;
            this.target = target;
            return true;
        }

        // Run the apTrigger if it exists and Player is within range
        else if (apTrigger && this.inApproachDistance(this.apRange, this.target)) {
            // Reset apRangeCalled
            this.apRangeCalled = false;

            // Store initial values
            const wayPoints = this.waypoints;
            const waypointIndex = this.waypointIndex;
            const target = this.target;

            this.target = null;
            this.clearWaypoints();

            this.executeScript(ScriptRunner.init(apTrigger, this, target), true);

            // If p_opnpc was called, remember it for later
            // For now, keep the current target
            this.nextTarget = this.target;
            this.target = target;

            // If p_opnpc was called, make sure destination is not set
            if (this.nextTarget) {
                this.clearWaypoints();
            }
            // if aprange was called then we did not interact.
            else if (this.apRangeCalled) {
                this.waypoints = wayPoints;
                this.waypointIndex = waypointIndex;
                this.target = target;
                return false;
            }
            return true;
        }

        // Run the default apTrigger. This is the ap analog to the "NIH" default op
        else if (this.inApproachDistance(this.apRange, this.target)) {
            this.apRange = -1;
            return false;
        }

        // Run the default opTrigger if within range
        else if (this.target && (this.target instanceof PathingEntity || allowOpScenery) && this.inOperableDistance(this.target)) {
            this.defaultOp();
            return true;
        }
        return false;
    }

    // custom (2026-11-24) - SAY WHY A TARGET WAS DROPPED. processInteraction calls this and, when it
    // is false, calls clearInteraction() and returns - with no message to the player and no record
    // anywhere. So a player's fishing, woodcutting or mining can stop dead mid-trip and the only
    // evidence is that the fish stopped arriving, which is why "fishing is slow" could not be told
    // apart from "fishing keeps stopping" (Corey, 2026-11-24: 27 tuna in 20-30 minutes where the
    // measured rate says 14).
    //
    // Of the engine's 21 clearInteraction() calls, exactly one says anything to the player ("I can't
    // reach that!"). These three are silent, and the middle one is reachable in ordinary play: the
    // whirlpool random event runs npc_changetype on the fishing spot, which is a type change, which
    // drops the interaction here.
    validateTarget(): boolean {
        // Validate that the target is on the same floor
        if (this.target?.level !== this.level) {
            this.reportTargetDropped('on another level');
            return false;
        }

        // This is effectively checking if the Npc or Loc did a changetype
        if ((this.target instanceof Npc || this.target instanceof Loc) && this.targetSubject.type !== this.target.type) {
            this.reportTargetDropped(`changed type (was ${this.targetSubject.type}, now ${this.target.type})`);
            return false;
        }

        if (!this.target.isValid(this.hash64)) {
            this.reportTargetDropped('no longer valid');
            return false;
        }

        return true;
    }

    /** What the dropped target was, for the journal: a name where there is one, else the kind and id. */
    private targetDescription(): string {
        const t = this.target;
        if (t instanceof Npc) {
            return `npc ${NpcType.get(t.type).debugname ?? t.type}`;
        }
        if (t instanceof Loc) {
            return `loc ${LocType.get(t.type).debugname ?? t.type}`;
        }
        if (t instanceof Obj) {
            return `obj ${ObjType.get(t.type).debugname ?? t.type}`;
        }
        if (t instanceof Player) {
            return `player ${t.username}`;
        }
        return 'nothing';
    }

    // ONE LINE EVERY 30 SECONDS, NOT ONE PER DROP, and with the counts of what was swallowed in
    // between - the same shape as the slow-tick warning, and for the same reason: a world where this
    // fires constantly would otherwise write a line a tick and make the journal part of the problem.
    // The breakdown by reason is what makes it diagnostic; the example names the last player and
    // target so there is something to go and look at.
    private static targetDropCounts: Map<string, number> = new Map();
    private static targetDropExample: string = '';
    private static lastTargetDropReport: number = 0;
    private static readonly TARGET_DROP_REPORT_INTERVAL: number = 30000;

    private reportTargetDropped(reason: string): void {
        Player.targetDropCounts.set(reason, (Player.targetDropCounts.get(reason) ?? 0) + 1);
        Player.targetDropExample = `${this.username} op${this.targetOp} on ${this.targetDescription()} - ${reason}`;

        const now = Date.now();
        if (now - Player.lastTargetDropReport < Player.TARGET_DROP_REPORT_INTERVAL) {
            return;
        }
        Player.lastTargetDropReport = now;
        let total = 0;
        const parts: string[] = [];
        for (const [why, count] of Player.targetDropCounts) {
            total += count;
            parts.push(`${count} ${why}`);
        }
        Player.targetDropCounts.clear();
        printWarning(`interaction dropped silently ${total} time${total === 1 ? '' : 's'} in the last 30s: ${parts.join(', ')}. last: ${Player.targetDropExample}`);
    }

    processInteraction() {
        this.followX = this.lastStepX;
        this.followZ = this.lastStepZ;
        this.nextTarget = null;

        const followOp = this.targetOp === ServerTriggerType.APPLAYER3 || this.targetOp === ServerTriggerType.OPPLAYER3;

        let interacted = false;

        // If there is a target and p_access is available, try to interact before movement
        if (this.target && this.canAccess()) {
            // Clear the interaction if target validation does not pass
            if (!this.validateTarget()) {
                this.clearInteraction();
                this.unsetMapFlag();
                return;
            }

            if (Environment.NODE_CLIENT_ROUTEFINDER && !followOp) {
                this.processWalktrigger();
            }

            interacted = this.tryInteract(false);
        }

        // This block won't run if the initial interaction attempt was successful
        if (!interacted) {
            // Recalc path
            this.pathToPathingTarget();

            // Process walktrigger if there is waypoints
            if (this.hasWaypoints() && this.canAccess()) {
                this.processWalktrigger();
            }

            // If a stun clears the Player's waypoints, clear the interaction
            if (!this.hasWaypoints() && followOp) {
                this.clearInteraction();
            }

            this.updateMovement();
            // If there's a target and p_access is available, try to interact after moving
            if (this.target && this.canAccess() && !followOp) {
                interacted = this.tryInteract(this.stepsTaken === 0);

                // If Player did not interact, has no path, and did not move this cycle, terminate the interaction
                if (!interacted && !this.apRangeCalled && !this.hasWaypoints() && this.stepsTaken === 0) {
                    this.messageGame("I can't reach that!");
                    this.clearInteraction();
                }
            }
        }

        // If a script called p_op*, then nextTarget is prepped for next cycle
        if (this.nextTarget) {
            this.target = this.nextTarget;
        }

        // Otherwise, the interaction ran
        else if (interacted && !this.apRangeCalled) {
            this.clearInteraction();
        }

        // Remove mapflag if there are no waypoints
        if (!this.hasWaypoints() && this.stepsTaken > 0) {
            this.unsetMapFlag();
        }
    }

    processInputTracking(): void {
        this.input.onCycle();
    }

    // ----

    getAppearanceInSlot(slot: number) {
        let part = -1;
        if (slot === 8) {
            part = this.body[0];
        } else if (slot === 11) {
            part = this.body[1];
        } else if (slot === 4) {
            part = this.body[2];
        } else if (slot === 6) {
            part = this.body[3];
        } else if (slot === 9) {
            part = this.body[4];
        } else if (slot === 7) {
            part = this.body[5];
        } else if (slot === 10) {
            part = this.body[6];
        }

        if (part === -1) {
            return 0;
        } else {
            return 0x100 + part;
        }
    }

    getCombatLevel() {
        const base = 0.25 * (this.baseLevels[PlayerStat.DEFENCE] + this.baseLevels[PlayerStat.HITPOINTS] + Math.floor(this.baseLevels[PlayerStat.PRAYER] / 2));
        const melee = 0.325 * (this.baseLevels[PlayerStat.ATTACK] + this.baseLevels[PlayerStat.STRENGTH]);
        const range = 0.325 * (Math.floor(this.baseLevels[PlayerStat.RANGED] / 2) + this.baseLevels[PlayerStat.RANGED]);
        const magic = 0.325 * (Math.floor(this.baseLevels[PlayerStat.MAGIC] / 2) + this.baseLevels[PlayerStat.MAGIC]);
        return Math.floor(base + Math.max(melee, range, magic));
    }

    generateAppearance(): Uint8Array {
        const stream = Packet.alloc(0);

        stream.p1(this.gender);

        // this.headicons bit layout (see player/configs/headicon.constant): 0=skull, 1=multicombat, 2=hint,
        // 3=protect from melee, 4=protect from missiles, 5=protect from magic, 6=duel, 7=hint2,
        // 8=retribution, 9=smite, 10=redemption.
        // The client reads two separate overhead-icon slots here (ClientPlayer.method574): the first byte
        // indexes the "headicons_pk" sprite sheet (skull), the second indexes "headicons_prayer" (the
        // three protect prayers and retribution/smite/redemption) - multicombat/hint/duel/hint2 aren't shown
        // through this packet.
        let pkIcon = 0xff;
        if (this.headicons & 0x1) {
            pkIcon = 0;
        }

        let prayerIcon = 0xff;
        if (this.headicons & 0x8) {
            prayerIcon = 0; // protect from melee
        } else if (this.headicons & 0x10) {
            prayerIcon = 1; // protect from missiles
        } else if (this.headicons & 0x20) {
            prayerIcon = 2; // protect from magic
        } else if (this.headicons & 0x100) {
            prayerIcon = 3; // retribution (headicon bit 8)
        } else if (this.headicons & 0x200) {
            prayerIcon = 4; // smite (bit 9)
        } else if (this.headicons & 0x400) {
            prayerIcon = 5; // redemption (bit 10)
        }
        // 3-5 were in 377's headicons_prayer all along - the client just never got sent them

        stream.p1(pkIcon);
        stream.p1(prayerIcon);

        const skippedSlots = [];

        let worn = this.getInventory(this.appearanceInv);
        if (!worn) {
            worn = new Inventory(InvType.WORN, 0);
        }

        for (let i = 0; i < worn.capacity; i++) {
            const equip = worn.get(i);
            if (!equip) {
                continue;
            }

            const config = ObjType.get(equip.id);

            if (config.wearpos2 !== -1) {
                if (skippedSlots.indexOf(config.wearpos2) === -1) {
                    skippedSlots.push(config.wearpos2);
                }
            }

            if (config.wearpos3 !== -1) {
                if (skippedSlots.indexOf(config.wearpos3) === -1) {
                    skippedSlots.push(config.wearpos3);
                }
            }
        }

        for (let slot = 0; slot < 12; slot++) {
            if (this.npcId != -1) {
                stream.p2(-1);
                stream.p2(this.npcId);
                break;
            }

            if (skippedSlots.indexOf(slot) !== -1) {
                stream.p1(0);
                continue;
            }

            const equip = worn.get(slot);
            if (!equip) {
                const appearanceValue = this.getAppearanceInSlot(slot);
                if (appearanceValue < 1) {
                    stream.p1(0);
                } else {
                    stream.p2(appearanceValue);
                }
            } else {
                stream.p2(0x200 + equip.id);
            }
        }

        for (let i = 0; i < this.colors.length; i++) {
            stream.p1(this.colors[i]);
        }

        stream.p2(this.readyanim);
        stream.p2(this.turnanim);
        stream.p2(this.walkanim);
        stream.p2(this.walkanim_b);
        stream.p2(this.walkanim_l);
        stream.p2(this.walkanim_r);
        stream.p2(this.runanim);

        stream.p8(this.username37);
        stream.p1(this.combatLevel);
        stream.p2(this.skillLevel);
        stream.p1(this.chatIcons());

        const appearance: Uint8Array = new Uint8Array(stream.pos);
        stream.pos = 0;
        stream.gdata(appearance, 0, appearance.length);
        stream.release();

        this.lastAppearance = World.currentTick;
        this.appearanceBuf = appearance;
        return appearance;
    }

    // ----

    refreshInvs() {
        for (let i: number = 0; i < this.invListeners.length; i++) {
            const listener = this.invListeners[i];
            if (!listener) {
                continue;
            }
            listener.firstSeen = true;
        }
    }

    getInventoryFromListener(listener: InventoryListener | undefined) {
        if (!listener) {
            return null;
        } else if (listener.source === -1) {
            return World.getInventory(listener.type);
        } else {
            const player = World.getPlayerByUid(listener.source);
            if (!player) {
                return null;
            }

            return player.getInventory(listener.type);
        }
    }

    getInventory(inv: number): Inventory | null {
        if (inv === -1) {
            return null;
        }

        const invType = InvType.get(inv);
        let container = null;

        if (!invType) {
            return null;
        }

        if (invType.scope === InvType.SCOPE_SHARED) {
            container = World.getInventory(inv);
        } else {
            container = this.invs.get(inv);

            if (!container) {
                container = Inventory.fromType(inv);
                this.invs.set(inv, container);
            }
        }

        return container;
    }

    invListenOnCom(inv: number, com: number, source: number) {
        if (inv === -1) {
            return;
        }

        const sameTypeCom = this.invListeners.findIndex(l => l.type === inv && l.com === com);
        if (sameTypeCom !== -1) {
            return;
        }

        const sameCom = this.invListeners.findIndex(l => l.com === com);
        if (sameCom !== -1) {
            this.invListeners.splice(sameCom, 1);
        }

        const invType = InvType.get(inv);
        if (invType.scope === InvType.SCOPE_SHARED) {
            source = -1;
        }

        this.invListeners.push({ type: inv, com, source, firstSeen: true });
    }

    invStopListenOnCom(com: number) {
        const index = this.invListeners.findIndex(l => l.com === com);
        if (index === -1) {
            return;
        }

        this.invListeners.splice(index, 1);
        this.write(new UpdateInvStopTransmit(com));
    }

    invGetSlot(inv: number, slot: number) {
        const container = this.getInventory(inv);
        if (!container) {
            throw new Error('invGetSlot: Invalid inventory type: ' + inv);
        }

        if (!container.validSlot(slot)) {
            throw new Error('invGetSlot: Invalid slot: ' + slot);
        }

        return container.get(slot);
    }

    invClear(inv: number) {
        const container = this.getInventory(inv);
        if (!container) {
            throw new Error('invClear: Invalid inventory type: ' + inv);
        }

        container.removeAll();
    }

    invAdd(inv: number, obj: number, count: number): number {
        const container = this.getInventory(inv);
        if (!container) {
            throw new Error('invAdd: Invalid inventory type: ' + inv);
        }

        return container.add(obj, count, -1);
    }

    invSet(inv: number, obj: number, count: number, slot: number) {
        const container = this.getInventory(inv);
        if (!container) {
            throw new Error('invSet: Invalid inventory type: ' + inv);
        }

        if (!container.validSlot(slot)) {
            throw new Error('invSet: Invalid slot: ' + slot);
        }

        container.set(slot, { id: obj, count });
    }

    invDel(inv: number, obj: number, count: number, beginSlot: number = -1): number {
        const container = this.getInventory(inv);
        if (!container) {
            throw new Error('invDel: Invalid inventory type: ' + inv);
        }

        // has to start at -1
        if (beginSlot < -1 || beginSlot >= this.invSize(inv)) {
            throw new Error('invDel: Invalid beginSlot: ' + beginSlot);
        }

        return container.remove(obj, count, beginSlot);
    }

    invDelSlot(inv: number, slot: number) {
        const container = this.getInventory(inv);
        if (!container) {
            throw new Error('invDelSlot: Invalid inventory type: ' + inv);
        }

        if (!container.validSlot(slot)) {
            throw new Error('invDelSlot: Invalid slot: ' + slot);
        }

        container.delete(slot);
    }

    invSize(inv: number): number {
        const container = this.getInventory(inv);
        if (!container) {
            throw new Error('invSize: Invalid inventory type: ' + inv);
        }

        return container.capacity;
    }

    invTotal(inv: number, obj: number): number {
        const container = this.getInventory(inv);
        if (!container) {
            throw new Error('invTotal: Invalid inventory type: ' + inv);
        }

        return container.getItemCount(obj);
    }

    invFreeSpace(inv: number): number {
        const container = this.getInventory(inv);
        if (!container) {
            throw new Error('invFreeSpace: Invalid inventory type: ' + inv);
        }

        return container.freeSlotCount;
    }

    invItemSpace(inv: number, obj: number, count: number, size: number): number {
        const container = this.getInventory(inv);
        if (!container) {
            throw new Error('invItemSpace: Invalid inventory type: ' + inv);
        }

        const objType = ObjType.get(obj);

        // oc_uncert
        let uncert = obj;
        if (objType.certtemplate >= 0 && objType.certlink >= 0) {
            uncert = objType.certlink;
        }
        if (objType.stackable || uncert != obj || container.stackType == Inventory.ALWAYS_STACK) {
            const stockObj = InvType.get(inv).stockobj?.includes(obj) === true;
            // "is there already a slot for this obj", not "do I have any of it". The two are the
            // same everywhere except a bank placeholder, which is a slot holding the obj with a
            // count of zero: invTotal reads 0 for it, so a full bank used to refuse a deposit back
            // into the player's own stub even though Inventory.add would have stacked straight
            // into it - getItemIndex is what add itself uses to find the stack.
            if (container.getItemIndex(obj) === -1 && this.invFreeSpace(inv) == 0 && !stockObj) {
                return count;
            }
            return Math.max(0, count - (Inventory.STACK_LIMIT - this.invTotal(inv, obj)));
        }
        return Math.max(0, count - (this.invFreeSpace(inv) - (this.invSize(inv) - size)));
    }

    // Write a zero-count entry - a "placeholder" - into a slot, or clear the slot when obj is -1.
    //
    // Inventory has exactly one way to say "nothing here", items[slot] = null, and remove() goes
    // out of its way to produce it: `if (curItem.count == 0 && !stockObj) this.items[i] = null`.
    // A placeholder is the other kind of empty - the slot is spoken for, it draws its obj, but it
    // holds none of it - and nothing in the engine creates one on its own. This is the only way
    // in, so an inv has placeholders exactly if its content scripts put them there, and every
    // other inv in the game is untouched.
    //
    // The accessors already agree on what a zero-count entry means, which is why this needs no
    // flag: nextFreeSlot and freeSlotCount test for null, so a placeholder occupies its slot;
    // getItemCount sums counts, so you have none of it; and getItemIndex finds it, so add() of
    // the same obj stacks straight back into it - which is what makes a deposit land in its own
    // placeholder rather than on the end of the list.
    invPlaceholder(inv: number, slot: number, obj: number) {
        const container = this.getInventory(inv);
        if (!container) {
            throw new Error('invPlaceholder: Invalid inventory type: ' + inv);
        }

        if (!container.validSlot(slot)) {
            throw new Error('invPlaceholder: Invalid slot: ' + slot);
        }

        container.set(slot, obj === -1 ? null : { id: obj, count: 0 });
    }

    invMoveToSlot(fromInv: number, toInv: number, fromSlot: number, toSlot: number) {
        const from = this.getInventory(fromInv);
        if (!from) {
            throw new Error('invMoveToSlot: Invalid inventory type: ' + fromInv);
        }

        if (!from.validSlot(fromSlot)) {
            throw new Error('invMoveToSlot: Invalid from slot: ' + fromSlot);
        }

        const to = this.getInventory(toInv);
        if (!to) {
            throw new Error('invMoveToSlot: Invalid inventory type: ' + toInv);
        }

        if (!to.validSlot(toSlot)) {
            throw new Error('invMoveToSlot: Invalid to slot: ' + toSlot);
        }

        const fromObj = this.invGetSlot(fromInv, fromSlot);
        const toObj = this.invGetSlot(toInv, toSlot);

        if (fromObj) {
            this.invSet(toInv, fromObj.id, fromObj.count, toSlot);
        } else {
            this.invDelSlot(toInv, toSlot);
        }
        if (toObj) {
            this.invSet(fromInv, toObj.id, toObj.count, fromSlot);
        } else {
            this.invDelSlot(fromInv, fromSlot);
        }
    }

    invMoveFromSlot(fromInv: number, toInv: number, fromSlot: number) {
        const from = this.getInventory(fromInv);
        if (!from) {
            throw new Error('invMoveFromSlot: Invalid inventory type: ' + fromInv);
        }

        const to = this.getInventory(toInv);
        if (!to) {
            throw new Error('invMoveFromSlot: Invalid inventory type: ' + toInv);
        }

        if (!from.validSlot(fromSlot)) {
            throw new Error('invMoveFromSlot: Invalid from slot: ' + fromSlot);
        }

        const fromObj = this.invGetSlot(fromInv, fromSlot);
        if (!fromObj) {
            throw new Error(`invMoveFromSlot: Invalid from obj was null. This means the obj does not exist at this slot: ${fromSlot}`);
        }

        this.invDelSlot(fromInv, fromSlot);

        return {
            overflow: fromObj.count - this.invAdd(toInv, fromObj.id, fromObj.count),
            fromObj: fromObj.id
        };
    }

    invTotalCat(inv: number, category: number): number {
        const container = this.getInventory(inv);
        if (!container) {
            throw new Error('invTotalCat: Invalid inventory type: ' + inv);
        }

        return container.itemsFiltered.filter(obj => ObjType.get(obj.id).category == category).reduce((count, obj) => count + obj.count, 0);
    }

    private _invTotalParam(inv: number, param: number, stack: boolean): number {
        const container = this.getInventory(inv);
        if (!container) {
            throw new Error('invTotalParam: Invalid inventory type: ' + inv);
        }

        const paramType: ParamType = ParamType.get(param);

        let total: number = 0;
        for (let slot: number = 0; slot < container.capacity; slot++) {
            const item = container.items[slot];
            if (!item || item.id < 0 || item.id >= ObjType.count) {
                continue;
            }

            const obj: ObjType = ObjType.get(item.id);
            const value: number = ParamHelper.getIntParam(paramType.id, obj, paramType.defaultInt);

            if (stack) {
                total += item.count * value;
            } else {
                total += value;
            }
        }

        return total;
    }

    invTotalParam(inv: number, param: number): number {
        return this._invTotalParam(inv, param, false);
    }

    invTotalParamStack(inv: number, param: number): number {
        return this._invTotalParam(inv, param, true);
    }

    // ----

    getVar(id: number) {
        const varp = VarPlayerType.get(id);
        if (!varp) {
            return 0;
        }

        return varp.type === ScriptVarType.STRING ? this.varsString[varp.id] : this.vars[varp.id];
    }

    setVar(id: number, value: number | string) {
        const varp = VarPlayerType.get(id);
        if (!varp) {
            return;
        }

        if (varp.type === ScriptVarType.STRING && typeof value === 'string') {
            this.varsString[varp.id] = value;
        } else if (typeof value === 'number') {
            this.vars[varp.id] = value;

            if (varp.transmit) {
                this.writeVarp(id, value);
            }

            // The XP-mode badge is part of the appearance everyone else is sent (chatIcons).
            if (Player.xpRateVarp === -2) {
                Player.xpRateVarp = VarPlayerType.getId('xp_rate');
            }
            if (varp.id === Player.xpRateVarp) {
                this.buildAppearance(this.appearanceInv);
            }
        }
    }

    /**
     * The icons other players see beside this player's name, packed into one byte at the end of the
     * appearance block: the rank crown in the low nibble (chatCrown's 0-6) and the XP-mode badge in
     * the high one - 0 none, 1 Realism, 2 5x, 3 10x. The client puts them in front of the name on
     * public chat lines and in the right-click menu; content's ~broadcast_name draws the same two
     * from the same thresholds for broadcasts.
     *
     * It rides in the appearance rather than the chat mask so the menu has it before the player has
     * said anything. A client from before it stops reading at the skill level and never sees it.
     */
    chatIcons(): number {
        const rate = this.xpRate();
        const badge = rate >= 10 ? 3 : rate >= 5 ? 2 : 1;
        return chatCrown(this.staffModLevel, this.veteran, this.helper) | (badge << 4);
    }

    getVarBit(id: number) {
        const varbit = VarBitType.get(id);
        if (!varbit) {
            return 0;
        }

        const { basevar, startbit, endbit } = varbit;
        const mask = Packet.bitmask[endbit - startbit + 1];

        return (this.vars[basevar] >> startbit) & mask;
    }

    setVarBit(id: number, value: number) {
        const varbit = VarBitType.get(id);
        if (!varbit) {
            return 0;
        }

        const { basevar, startbit, endbit } = varbit;
        let mask = Packet.bitmask[endbit - startbit + 1];

        if (value < 0 || value > mask) {
            value = 0;
        }

        mask <<= startbit;
        this.setVar(basevar, (mask & (value << startbit)) | (this.vars[basevar] & ~mask));
    }

    /**
     * Send every transmitted varp, in one packet.
     *
     * One packet per varp was 371 of the 536 a login sent, and the 377 client parses five a loop
     * iteration - about 2.2 seconds of catching up before it was level with the world. The count
     * does not depend on the player: it is every varp the content marks transmit, so a new
     * character and a maxed one pay the same. See VarpBatch, and tools/sim/loginspike.ts for how
     * the figure was arrived at.
     *
     * Every varp still goes, zeros included. The client reverts varps to varCache on
     * RESET_CLIENT_VARCACHE rather than zeroing them and frees neither on logout, so a player who
     * logs out to the login screen and back in holds the last session's values and a varp now 0
     * would keep its old one.
     */
    private writeAllVarps(): void {
        const small: number[][] = [];
        const large: number[][] = [];

        for (let varp = 0; varp < this.vars.length; varp++) {
            if (!VarPlayerType.get(varp).transmit) {
                continue;
            }

            const value = this.vars[varp];
            if (value >= -128 && value <= 127) {
                small.push([varp, value]);
            } else {
                large.push([varp, value]);
            }
        }

        this.write(new VarpBatch(small, large));
    }

    private writeVarp(id: number, value: number): void {
        if (value >= -128 && value <= 127) {
            this.write(new VarpSmall(id, value));
        } else {
            this.write(new VarpLarge(id, value));
        }
    }

    // -2 = not looked up yet, -1 = the content has no such varp. Resolved lazily because the
    // configs are not loaded when this class is.
    private static xpRateVarp: number = -2;

    /**
     * The player's own XP multiplier, from the content varp `xp_rate`, which holds the RATE
     * itself (1, 5 or 10) rather than a mode number - so the three values live in
     * gamemodes/configs/gamemode.constant and nowhere else, and this needs no table of modes.
     *
     * This is the only place a per-player rate could go. There are 288 stat_advance call sites
     * across 122 content files and no wrapper proc they all pass through, so anything content-side
     * would have to be added to every one of them and would be missed by the next skill written.
     *
     * 0 means never chosen and reads as 1 - the authentic rate, which is what the server did
     * before this existed, so every character that already exists is unaffected and a player who
     * closes the chooser without picking is not penalised. A missing varp reads as 1 for the same
     * reason: the wrong answer here is "nobody gains any experience".
     */
    xpRate(): number {
        if (Player.xpRateVarp === -2) {
            Player.xpRateVarp = VarPlayerType.getId('xp_rate');
        }
        if (Player.xpRateVarp < 0) {
            return 1;
        }
        const rate = this.vars[Player.xpRateVarp];
        if (!rate || rate < 1) {
            return 1;
        }
        // A safety rail, not a game rule: the rate is a perm varp and a bad write would otherwise
        // be unbounded. The modes the content offers are 1, 5 and 10.
        return Math.min(rate, 100);
    }

    // -2 = not looked up yet, -1 = the content has no such varp. Same lazy resolve as xp_rate.
    private static xpLockedVarp: number = -2;

    // The tick each stat last told the player it was locked. NOT saved and deliberately not a
    // varp: it is throttling, not state, and it should start clean every login.
    private xpLockWarned: Int32Array = new Int32Array(PLAYER_STAT_COUNT);

    /**
     * Whether this skill refuses experience, from the content varp `xp_locked` - a bitmask with
     * one bit per stat AT THE STAT'S OWN ID, so this needs no table and the content side's
     * ^xplock_* constants are the only place the layout is written down.
     *
     * Same reasoning as xpRate for living here: there is no wrapper proc the 290 stat_advance
     * call sites pass through, and a lock that has to be added to each of them is a lock the next
     * skill written will not have.
     *
     * A missing varp reads as "nothing is locked". The wrong answer here is the one that stops a
     * player gaining any experience at all.
     */
    xpLocked(stat: number): boolean {
        if (Player.xpLockedVarp === -2) {
            Player.xpLockedVarp = VarPlayerType.getId('xp_locked');
        }
        if (Player.xpLockedVarp < 0 || stat < 0 || stat >= PLAYER_STAT_COUNT) {
            return false;
        }
        return ((this.vars[Player.xpLockedVarp] >>> stat) & 1) === 1;
    }

    /**
     * Say so, at most once a minute per skill. Training a locked skill is a normal thing to do on
     * purpose - a message per log cut would be unusable - but a quest handing over ten thousand
     * experience that silently goes nowhere is exactly the case this exists for.
     */
    private warnXpLocked(stat: number): void {
        const last = this.xpLockWarned[stat];
        if (last !== 0 && World.currentTick - last < 100) {
            return;
        }
        this.xpLockWarned[stat] = World.currentTick;
        const name = PlayerStatNameMap.get(stat) ?? 'that';
        this.messageGame(`Your ${name.charAt(0)}${name.slice(1).toLowerCase()} experience is locked.`);
    }

    addXp(stat: number, xp: number, allowMulti: boolean = true) {
        // require xp is >= 0. there is no reason for a requested addXp to be negative.
        if (xp < 0) {
            throw new Error(`Invalid xp parameter for addXp call: Stat was: ${stat}, Exp was: ${xp}`);
        }

        // if the xp arg is 0, then we do not have to change anything or send an unnecessary stat packet.
        if (xp == 0) {
            return;
        }

        // A locked skill refuses EARNED experience and nothing else. allowMulti is false only for
        // ::setlevel, which is not the player earning anything - it sets a level, and it should
        // keep working on a locked skill. The action that earned this still happened: the caller
        // has already handed over the log, the ore or the quest's reward, and the quest has
        // already completed. A lock never touches a level, so every requirement that reads
        // stat(...) still reads the same number it did before.
        if (allowMulti && this.xpLocked(stat)) {
            this.warnXpLocked(stat);
            return;
        }

        const multi = allowMulti ? Environment.NODE_XPRATE * this.xpRate() : 1;
        const xpBefore = this.stats[stat];
        this.stats[stat] += xp * multi;

        // cap to 200m, this is represented as "2 billion" because we use 32-bit signed integers and divide by 10 to give us a decimal point
        if (this.stats[stat] > 2_000_000_000) {
            this.stats[stat] = 2_000_000_000;
        }

        this.checkXpMilestone(stat, xpBefore);

        const before = this.baseLevels[stat];
        if (this.levels[stat] === this.baseLevels[stat]) {
            // only update if no buff/debuff is active
            this.levels[stat] = getLevelByExp(this.stats[stat]);
        }
        this.baseLevels[stat] = getLevelByExp(this.stats[stat]);

        if (this.baseLevels[stat] > before) {
            if (this.levels[stat] < before) {
                // replenish stat
                this.levels[stat] += this.baseLevels[stat] - before;
            }

            this.changeStat(stat);

            // fun logging for players :)
            this.addSessionLog(LoggerEventType.ADVENTURE, 'Levelled up ' + PlayerStatNameMap.get(stat)?.toLowerCase() + ' from ' + before + ' to ' + this.baseLevels[stat]);

            let total = 0;
            let freeTotal = 0;
            for (let stat = 0; stat < this.baseLevels.length; stat++) {
                if (!PlayerStatEnabled[stat]) {
                    continue;
                }

                total += this.baseLevels[stat];

                if (PlayerStatFree[stat]) {
                    freeTotal += this.baseLevels[stat];
                }
            }

            const milestone = 250; // Level milestones = multiple of this number (should be >= 100)
            const prevMilestone = ((total - (this.baseLevels[stat] - before)) / milestone) | 0;
            const currMilestone = (total / milestone) | 0;
            if (currMilestone > prevMilestone) {
                this.addSessionLog(LoggerEventType.ADVENTURE, `Reached total level ${currMilestone * milestone}`);
            }
            // was a hardcoded 1881 (19 enabled stats x 99); derived now that the enabled set changed
            const maxTotal = PlayerStatEnabled.filter(enabled => enabled).length * 99;
            if (total === maxTotal) {
                this.addSessionLog(LoggerEventType.ADVENTURE, `Reached total level ${maxTotal} - you beat p2p!`);
            }
            if (freeTotal === 1485) {
                this.addSessionLog(LoggerEventType.ADVENTURE, 'Reached total level 1485 - you beat f2p!');
            }

            const script = ScriptProvider.getByTriggerSpecific(ServerTriggerType.ADVANCESTAT, stat, -1);
            if (script) {
                this.enqueueScript(script, PlayerQueueType.ENGINE);
            }
        }

        if (this.combatLevel != this.getCombatLevel()) {
            this.combatLevel = this.getCombatLevel();
            this.buildAppearance(this.appearanceInv);
        }
    }

    /**
     * 50m / 100m / 150m / 200m experience in one skill - the milestone announcements above 99.
     *
     * WHY THIS IS HERE AND NOT IN CONTENT. Every other milestone in general/scripts/milestones.rs2
     * hangs off a level-up, and a skill at 99 never changes level again: [advancestat] and
     * [changestat] both fire on a level change, so past 99 content has no hook left. The only
     * content-side alternative was a softtimer walking 23 skills a minute for every player on the
     * world to catch four events in an account's lifetime. addXp already has the number.
     *
     * The thresholds live here beside the cap deliberately. Experience is stored x10 - 200m is the
     * 2,000,000,000 clamp above - so a content constant would have to repeat the x10 and could
     * drift from the very cap it names.
     *
     * Only the HIGHEST tier a single gain crosses is announced, so a jump that clears several (a
     * ::setstat, an xp rate change) cannot fire four lines at once. The wording is content's:
     * [proc,milestone_xp] in general/scripts/milestones.rs2 builds the line, because the rank and
     * XP-mode icons every broadcast carries are ~broadcast_name's and live there.
     */
    private static readonly xpMilestones: number[] = [500_000_000, 1_000_000_000, 1_500_000_000, 2_000_000_000];

    /**
     * %milestone_cheated, resolved once. -2 is "not looked up yet" and -1 "this build has no such
     * varp", the same two-step World.milestoneVarp uses for the opt-out.
     */
    private static cheatedVarp: number = -2;

    milestonesCheated(): boolean {
        if (Player.cheatedVarp === -2) {
            Player.cheatedVarp = VarPlayerType.getId('milestone_cheated');
        }
        return Player.cheatedVarp !== -1 && this.getVar(Player.cheatedVarp) !== 0;
    }

    /**
     * Mark this account as one a staff command gave its progress to, so no milestone of its is ever
     * announced again. Called by ::setstat, ::advancestat and ::minme BEFORE they touch a stat, so
     * the announcement that change would have caused is already suppressed when it lands.
     *
     * The content-side doors set the same varp themselves through [proc,milestone_mark_cheated] -
     * ~sl, ~hunter, ~droptest and the quest debugprocs. The experience ones cannot be caught here:
     * they hand out experience with stat_advance, which is the same op every fishing spot in the
     * game uses, and addXp has nothing in it to tell them apart.
     *
     * general/configs/milestones.varp has why this is the whole account rather than the one skill,
     * and why it does not expire. It is said out loud the first time, because a setting that turns
     * itself on and never mentions it is a setting nobody knows they have.
     */
    markMilestonesCheated(): void {
        if (this.milestonesCheated() || Player.cheatedVarp === -1) {
            return;
        }
        this.setVar(Player.cheatedVarp, 1);
        this.messageGame('Your progress was set by a command, so your milestones are no longer announced.');
    }

    private checkXpMilestone(stat: number, xpBefore: number): void {
        const xpNow = this.stats[stat];
        if (xpNow < Player.xpMilestones[0] || xpNow === xpBefore) {
            return;
        }
        // Nothing an account whose stats were set by a staff command does is announced - and the
        // check is here, before the script is enqueued, rather than at the broadcast: [proc,
        // milestone_xp] claims the server first before it announces anything, and a silently
        // burned claim is worse than the announcement it was meant to stop.
        if (this.milestonesCheated()) {
            return;
        }
        let tier = -1;
        for (let i = 0; i < Player.xpMilestones.length; i++) {
            if (xpBefore < Player.xpMilestones[i] && xpNow >= Player.xpMilestones[i]) {
                tier = i;
            }
        }
        if (tier === -1) {
            return;
        }
        const script = ScriptProvider.getByName('[proc,milestone_xp]');
        if (script) {
            this.enqueueScript(script, PlayerQueueType.ENGINE, 0, [stat, tier]);
        }
    }

    changeStat(stat: number) {
        const script = ScriptProvider.getByTrigger(ServerTriggerType.CHANGESTAT, stat, -1);
        if (script) {
            this.enqueueScript(script, PlayerQueueType.ENGINE);
        }
    }

    setLevel(stat: number, level: number) {
        level = Math.min(99, Math.max(1, level));

        this.baseLevels[stat] = level;
        this.levels[stat] = level;
        this.stats[stat] = getExpByLevel(level);

        if (this.combatLevel != this.getCombatLevel()) {
            this.combatLevel = this.getCombatLevel();
            this.buildAppearance(this.appearanceInv);
        }
    }

    buildAppearance(inv: number): void {
        this.appearanceInv = inv;
        this.masks |= PlayerInfoProt.APPEARANCE;
    }

    playAnimation(anim: number, delay: number) {
        if (anim >= SeqType.count || this.animProtect) {
            return;
        }

        if (anim == -1 || this.animId == -1 || SeqType.get(anim).priority >= SeqType.get(this.animId).priority) {
            this.animId = anim;
            this.animDelay = delay;
            this.masks |= PlayerInfoProt.ANIM;
        }
    }

    spotanim(spotanim: number, height: number, delay: number) {
        this.spotanimId = spotanim;
        this.spotanimHeight = height;
        this.spotanimTime = delay;
        this.masks |= PlayerInfoProt.SPOT_ANIM;
    }

    applyDamage(damage: number, type: number) {
        const current = this.levels[PlayerStat.HITPOINTS];
        if (current - damage <= 0) {
            this.levels[PlayerStat.HITPOINTS] = 0;
            damage = current;
        } else {
            this.levels[PlayerStat.HITPOINTS] = current - damage;
        }

        if (this.hitmarkSlot % 2 === 1) {
            this.hitmark2Damage = damage;
            this.hitmark2Type = type;
            this.masks |= PlayerInfoProt.DAMAGE2;
        } else {
            this.hitmarkDamage = damage;
            this.hitmarkType = type;
            this.masks |= PlayerInfoProt.DAMAGE;
        }
        this.hitmarkSlot++;
    }

    setVisibility(visibility: Visibility) {
        if (visibility === Visibility.SOFT) {
            this.messageGame(`vis: ${visibility} (not implemented - you are still on vis: ${this.visibility})`);
            return;
        }
        // This doesn't actually cancel interactions, source: https://youtu.be/ARS7eO3_Z8U?si=OkYfjW0sVhkQmQ8y&t=293
        this.visibility = visibility;
        if (visibility === Visibility.DEFAULT) {
            this.blockWalk = BlockWalk.PLAYER;
            changePlayerOccCollision(this.width, this.x, this.z, this.level, true);
        } else {
            this.blockWalk = BlockWalk.NONE;
            changeNpcCollision(this.width, this.x, this.z, this.level, false);
            changePlayerOccCollision(this.width, this.x, this.z, this.level, false);
        }
        this.messageGame(`vis: ${visibility}`);
    }

    say(message: string) {
        this.sayMessage = message;
        this.masks |= PlayerInfoProt.SAY;
    }

    faceSquare(x: number, z: number) {
        this.focus(CoordGrid.fine(x, 1), CoordGrid.fine(z, 1), true);
    }

    playSong(id: number) {
        this.write(new MidiSong(id));
    }

    playJingle(id: number): void {
        this.write(new MidiJingle(id, Midi.getLength(id)));
    }

    openMainModal(com: number) {
        if ((this.modalState & ModalState.CHAT) !== ModalState.NONE) {
            // close chat modal if we're opening a new main modal
            this.write(new IfClose());
            this.modalState &= ~ModalState.CHAT;
            this.modalChat = -1;
        }

        if ((this.modalState & ModalState.SIDE) !== ModalState.NONE) {
            // close side modal if we're opening a new main modal
            this.write(new IfClose());
            this.modalState &= ~ModalState.SIDE;
            this.modalSide = -1;
        }

        this.modalState |= ModalState.MAIN;
        this.modalMain = com;
        this.refreshModal = true;

        // clear old suspended scripts
        if (this.activeScript?.execution === ScriptState.COUNTDIALOG || this.activeScript?.execution === ScriptState.NAMEDIALOG || this.activeScript?.execution === ScriptState.PAUSEBUTTON) {
            this.activeScript = null;
            this.resumeButtons = [];
        }
    }

    openMainOverlay(com: number) {
        if (this.overlay === com) {
            return;
        }

        if (com === -1) {
            this.clearComListeners(this.overlay);
        }

        this.overlay = com;
    }

    openChatModal(com: number) {
        if ((this.modalState & ModalState.MAIN) !== ModalState.NONE) {
            this.write(new IfClose());
            this.modalState &= ~ModalState.MAIN;
            this.modalChat = -1;
        }

        if ((this.modalState & ModalState.SIDE) !== ModalState.NONE) {
            this.write(new IfClose());
            this.modalState &= ~ModalState.SIDE;
            this.modalChat = -1;
        }

        this.modalState |= ModalState.CHAT;
        this.modalChat = com;
        this.refreshModal = true;

        // clear old suspended scripts
        if (this.activeScript?.execution === ScriptState.COUNTDIALOG || this.activeScript?.execution === ScriptState.NAMEDIALOG || this.activeScript?.execution === ScriptState.PAUSEBUTTON) {
            this.activeScript = null;
            this.resumeButtons = [];
        }
    }

    openSideModal(com: number) {
        if ((this.modalState & ModalState.MAIN) !== ModalState.NONE) {
            this.write(new IfClose());
            this.modalState &= ~ModalState.MAIN;
            this.modalChat = -1;
        }

        if ((this.modalState & ModalState.CHAT) !== ModalState.NONE) {
            this.write(new IfClose());
            this.modalState &= ~ModalState.CHAT;
            this.modalSide = -1;
        }

        this.modalState |= ModalState.SIDE;
        this.modalSide = com;
        this.refreshModal = true;

        // clear old suspended scripts
        if (this.activeScript?.execution === ScriptState.COUNTDIALOG || this.activeScript?.execution === ScriptState.NAMEDIALOG || this.activeScript?.execution === ScriptState.PAUSEBUTTON) {
            this.activeScript = null;
            this.resumeButtons = [];
        }
    }

    openTutorial(com: number) {
        this.write(new TutOpen(com));
        this.modalState |= ModalState.TUT;
        this.modalTutorial = com;
    }

    openMainSideModal(top: number, side: number) {
        if ((this.modalState & ModalState.CHAT) !== ModalState.NONE) {
            this.write(new IfClose());
            this.modalState &= ~ModalState.CHAT;
            this.modalChat = -1;
        }

        this.modalState |= ModalState.MAIN;
        this.modalMain = top;
        this.modalState |= ModalState.SIDE;
        this.modalSide = side;
        this.refreshModal = true;

        // clear old suspended scripts
        if (this.activeScript?.execution === ScriptState.COUNTDIALOG || this.activeScript?.execution === ScriptState.NAMEDIALOG || this.activeScript?.execution === ScriptState.PAUSEBUTTON) {
            this.activeScript = null;
            this.resumeButtons = [];
        }
    }

    exactMove(startX: number, startZ: number, endX: number, endZ: number, startCycle: number, endCycle: number, direction: number) {
        this.teleport(endX, endZ, this.level);
        this.exactStartX = startX;
        this.exactStartZ = startZ;
        this.exactEndX = endX;
        this.exactEndZ = endZ;
        this.exactMoveStart = startCycle;
        this.exactMoveEnd = endCycle;
        this.exactMoveFacing = direction;
        this.masks |= PlayerInfoProt.EXACT_MOVE;
    }

    setTab(com: number, tab: number) {
        this.tabs[tab] = com;
        this.write(new IfSetTab(com, tab));
    }

    isComponentVisible(com: Component) {
        return this.modalMain === com.rootLayer || this.modalChat === com.rootLayer || this.modalSide === com.rootLayer || this.tabs.findIndex(l => l === com.rootLayer) !== -1 || this.modalTutorial === com.rootLayer;
    }

    updateAfkZones(): void {
        this.lastAfkZone = Math.min(1000, this.lastAfkZone + 1);
        if (this.withinAfkZone()) {
            return;
        }
        const coord: number = CoordGrid.packCoord(0, this.x - 10, this.z - 10); // level doesn't matter.
        if (this.moveSpeed === MoveSpeed.INSTANT && this.jump) {
            this.afkZones[1] = coord;
        } else {
            this.afkZones[1] = this.afkZones[0];
        }
        this.afkZones[0] = coord;
        this.lastAfkZone = 0;
    }

    zonesAfk(): boolean {
        return this.lastAfkZone === 1000;
    }

    private withinAfkZone(): boolean {
        const size: number = 21;
        for (let index: number = 0; index < this.afkZones.length; index++) {
            const coord: CoordGrid = CoordGrid.unpackCoord(this.afkZones[index]);
            if (CoordGrid.intersects(this.x, this.z, this.width, this.length, coord.x, coord.z, size, size)) {
                return true;
            }
        }
        return false;
    }

    // copied from client
    isInWilderness(): boolean {
        if (this.x >= 2944 && this.x < 3392 && this.z >= 3520 && this.z < 6400) {
            return true;
        } else if (this.x >= 2944 && this.x < 3392 && this.z >= 9920 && this.z < 12800) {
            return true;
        } else {
            return false;
        }
    }

    // ----

    runScript(script: ScriptState, protect: boolean = false, force: boolean = false) {
        if (!force && protect && (this.protect || this.delayed)) {
            // can't get protected access, bye-bye
            // printDebug('No protected access:', script.script.name, protect, this.protect);
            return -1;
        }

        if (protect) {
            script.pointerAdd(ScriptPointer.ProtectedActivePlayer);
            this.protect = true;
        }

        const state = ScriptRunner.execute(script);

        if (protect) {
            this.protect = false;
        }

        if (script.pointerGet(ScriptPointer.ProtectedActivePlayer) && script._activePlayer) {
            script.pointerRemove(ScriptPointer.ProtectedActivePlayer);
            script._activePlayer.protect = false;
        }

        if (script.pointerGet(ScriptPointer.ProtectedActivePlayer2) && script._activePlayer2) {
            script.pointerRemove(ScriptPointer.ProtectedActivePlayer2);
            script._activePlayer2.protect = false;
        }

        return state;
    }

    executeScript(script: ScriptState, protect: boolean = false, force: boolean = false) {
        // printDebug('Executing', script.script.name);

        const state = this.runScript(script, protect, force);
        if (state === -1) {
            // printDebug('Script did not run', script.script.name, protect, this.protect);
            return;
        }

        if (state !== ScriptState.FINISHED && state !== ScriptState.ABORTED) {
            if (state === ScriptState.WORLD_SUSPENDED) {
                World.enqueueScript(script, script.popInt());
            } else if (state === ScriptState.NPC_SUSPENDED) {
                script.activeNpc.activeScript = script;
            } else {
                script.activePlayer.activeScript = script;
                script.activePlayer.protect = protect; // preserve protected access when delayed
            }
        } else if (script === this.activeScript) {
            this.activeScript = null;
            this.resumeButtons = [];

            if ((this.modalState & ModalState.MAIN) === ModalState.NONE) {
                // close chat dialogues automatically and leave main modals alone
                this.closeModal(false);
            }
        }
    }

    wrappedMessageGame(mes: string) {
        const font = FontType.get(1);
        const lines = font.split(mes, 456);
        for (const line of lines) {
            this.messageGame(line);
        }
    }

    write(message: ServerGameMessage) {
        if (!isClientConnected(this)) {
            return;
        }

        this.writeInner(message);
    }

    unsetMapFlag() {
        this.clearWaypoints();
        this.write(new UnsetMapFlag());
    }

    hintNpc(nid: number) {
        this.write(new HintArrow(1, nid, 0, 0, 0, 0));
    }

    hintTile(offset: number, x: number, z: number, height: number) {
        this.write(new HintArrow(offset, 0, 0, x, z, height));
    }

    hintPlayer(playerSlot: number) {
        this.write(new HintArrow(10, 0, playerSlot, 0, 0, 0));
    }

    stopHint() {
        this.write(new HintArrow(-1, 0, 0, 0, 0, 0));
    }

    lastLoginInfo() {
        const lastDate: bigint = this.lastLoginTime === 0n ? BigInt(Date.now()) : this.lastLoginTime;
        const nextDate: bigint = BigInt(Date.now());

        // The client counts days from RuneScape's own day 0, 27 Feb 2002 - day 11745 since 1970
        // (Client.getDateString) - and works out "last logged in N days ago" as currentDay minus the
        // DAY the last login fell on. Sending days since 1970 and the gap itself read as "20720 days ago".
        const MS_PER_DAY = 1000 * 60 * 60 * 24;
        const RUNEDAY_ZERO = 11745;
        const currentDay: number = ((Number(nextDate) / MS_PER_DAY) | 0) - RUNEDAY_ZERO;
        const previousLoginDay: number = ((Number(lastDate) / MS_PER_DAY) | 0) - RUNEDAY_ZERO;

        // No address is kept for the last login, so none is sent (0), and the client leaves "from" off
        // rather than printing 127.0.0.1. The welcome screen's other panels (password, recovery
        // questions, messages, member credit) were Jagex's website's; the client no longer draws them
        // from these, so they are sent as nothing.
        const lastIp = 0;
        const daysSincePasswordChanged = 0;
        const daysSinceRecoveriesChanged = 0;
        const unreadMessageCount = 0;
        const membersCreditDays = 0;

        this.write(new LastLoginInfo(lastIp, currentDay, previousLoginDay, daysSincePasswordChanged, daysSinceRecoveriesChanged, unreadMessageCount, membersCreditDays));
        this.lastLoginTime = nextDate;
    }

    logout(): void {
        // to be overridden
    }

    terminate(): void {
        // to be overridden
    }

    messageGame(msg: string) {
        this.write(new MessageGame(msg));
    }

    isValid(_hash64?: bigint): boolean {
        if (this.loggingOut) {
            return false;
        }

        if (this.visibility !== Visibility.DEFAULT) {
            return false;
        }

        return super.isValid();
    }
}
