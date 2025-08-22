/***************************************************************************************************
 *  ClientCheatHandler.ts - 2004Scape Server
 *
 *  NOTE: All legacy comments were preserved where helpful.
 ***************************************************************************************************/

/* -------- External packages -------- */
import { Visibility } from '@2004scape/rsbuf';
import { LocAngle, LocShape } from '@2004scape/rsmod-pathfinder';

/* -------- Internal modules (single group) -------- */
import Component from '#/cache/config/Component.js';
import IdkType from '#/cache/config/IdkType.js';
import InvType from '#/cache/config/InvType.js';
import LocType from '#/cache/config/LocType.js';
import NpcType from '#/cache/config/NpcType.js';
import ObjType from '#/cache/config/ObjType.js';
import ScriptVarType from '#/cache/config/ScriptVarType.js';
import SeqType from '#/cache/config/SeqType.js';
import SpotanimType from '#/cache/config/SpotanimType.js';
import VarPlayerType from '#/cache/config/VarPlayerType.js';
import { CoordGrid } from '#/engine/CoordGrid.js';
import { EntityLifeCycle } from '#/engine/entity/EntityLifeCycle.js';
import Loc from '#/engine/entity/Loc.js';
import { MoveStrategy } from '#/engine/entity/MoveStrategy.js';
import { isClientConnected } from '#/engine/entity/NetworkPlayer.js';
import Npc from '#/engine/entity/Npc.js';
import Player, { getExpByLevel } from '#/engine/entity/Player.js';
import { PlayerStat, PlayerStatEnabled, PlayerStatMap } from '#/engine/entity/PlayerStat.js';
import { Inventory } from '#/engine/Inventory.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import World from '#/engine/World.js';
import { setBlinkWalk } from '#/engine/script/handlers/PlayerOps.js';
import MessageHandler from '#/network/game/client/handler/MessageHandler.js';
import ClientCheat from '#/network/game/client/model/ClientCheat.js';
import { LoggerEventType } from '#/server/logger/LoggerEventType.js';
import Environment from '#/util/Environment.js';
import ActionDebugger from '#/util/ActionDebugger.js';
import { tryParseInt } from '#/util/TryParse.js';

/* ---- Helper types ---- */
interface CheatFlags {
    godModeEnabled?: boolean;
    infinitePrayer?: boolean;
    infiniteRun?: boolean;
    infiniteRunes?: boolean;
    /** Toggle for guaranteed maximum hits */
    maxHitDebug?: boolean;
    _originalUpdateEnergy?: () => void;
}

const CHEAT_FLAGS = new WeakMap<Player, CheatFlags>();
function getCheat(player: Player): CheatFlags {
    let flags = CHEAT_FLAGS.get(player);
    if (!flags) {
        flags = {};
        CHEAT_FLAGS.set(player, flags);
    }
    return flags;
}

/**
 * ExtendedPlayer: adds optional fields for "god mode" and original updateEnergy references
 * to avoid any casts on Player.
 */
export default class ClientCheatHandler extends MessageHandler<ClientCheat> {
    /* Main entry (TS2366: must always return boolean) */
    handle(message: ClientCheat, player: Player): boolean {
        // Flood-protection
        if (message.input.length > 80) return false;

        const cheat = message.input.trim();
        const args = cheat.toLowerCase().split(' ');
        // Action debugging: log raw cheat input
        if (ActionDebugger.isEnabled(player)) {
            ActionDebugger.log(player, `ClientCheat input: ${cheat}`);
        }
        const cmd = args.shift() ?? '';
        if (!cmd) return false;

        // If staffModLevel >= 2, log the command
        if (player.staffModLevel >= 2) {
            player.addSessionLog(LoggerEventType.MODERATOR, 'Ran cheat', cheat);
        }

        // Toggle max hit debug for staffModLevel >= 4 (available in all envs)
        if (cmd === 'maxhit') {
            if (player.staffModLevel < 4) return false;
            const cheatFlags = getCheat(player);
            cheatFlags.maxHitDebug = !cheatFlags.maxHitDebug;
            player.messageGame(
                cheatFlags.maxHitDebug
                    ? 'Maxhit debug on, you will now always hit your max hit.'
                    : 'Maxhit debug off.'
            );
            return true;
        }

        /* -------- Developer commands: staffModLevel >= 4, not in production -------- */
        if (!Environment.NODE_PRODUCTION && player.staffModLevel >= 4) {
            if (cmd[0] === Environment.NODE_DEBUGPROC_CHAR) {
                // debugprocs are NOT allowed on live
                // e.g. [debugproc,whatever]
                const scriptName = `[debugproc,${cmd.slice(1)}]`;
                const script = ScriptProvider.getByName(scriptName);
                if (!script) return false;

                // Prepare script parameters
                const params: Array<number | string> = new Array(script.info.parameterTypes.length).fill(-1);
                for (let i = 0; i < script.info.parameterTypes.length; i++) {
                    const type = script.info.parameterTypes[i];
                    try {
                        switch (type) {
                            case ScriptVarType.STRING:
                                params[i] = args.shift() ?? '';
                                break;
                            case ScriptVarType.INT:
                                params[i] = tryParseInt(args.shift() ?? '0', 0);
                                break;
                            case ScriptVarType.OBJ:
                            case ScriptVarType.NAMEDOBJ:
                                params[i] = ObjType.getId(args.shift() ?? '');
                                break;
                            case ScriptVarType.NPC:
                                params[i] = NpcType.getId(args.shift() ?? '');
                                break;
                            case ScriptVarType.LOC:
                                params[i] = LocType.getId(args.shift() ?? '');
                                break;
                            case ScriptVarType.SEQ:
                                params[i] = SeqType.getId(args.shift() ?? '');
                                break;
                            case ScriptVarType.STAT:
                                params[i] = PlayerStatMap.get((args.shift() ?? '').toUpperCase()) ?? -1;
                                break;
                            case ScriptVarType.INV:
                                params[i] = InvType.getId(args.shift() ?? '');
                                break;
                            case ScriptVarType.COORD: {
                                // Note: This logic is from the original code
                                const seg = cheat.split('_');
                                params[i] = CoordGrid.packCoord(
                                    Number.parseInt(seg[0].slice(6), 10),
                                    (Number.parseInt(seg[1], 10) << 6) + Number.parseInt(seg[3], 10),
                                    (Number.parseInt(seg[2], 10) << 6) + Number.parseInt(seg[4], 10)
                                );
                                break;
                            }
                            case ScriptVarType.INTERFACE:
                                params[i] = Component.getId(args.shift() ?? '');
                                break;
                            case ScriptVarType.SPOTANIM:
                                params[i] = SpotanimType.getId(args.shift() ?? '');
                                break;
                            case ScriptVarType.IDKIT:
                                params[i] = IdkType.getId(args.shift() ?? '');
                                break;
                            default:
                                break;
                        }
                    } catch {
                        // invalid arguments
                        return false;
                    }
                }

                // Execute debug script
                player.executeScript(ScriptRunner.init(script, player, null, params), false);
                return true;
            }

            // ::bank / ::morph helper scripts
            if (cmd === 'bank' || cmd === 'morph') {
                const script = ScriptProvider.getByName(`[command,${cmd}]`);
                if (!script) {
                    player.messageGame(`Missing ::${cmd} script.`);
                    return false;
                }
                player.executeScript(ScriptRunner.init(script, player), true, true);
                return true;
            }

            // Quick server toggles
            if (cmd === 'reload' && Environment.STANDALONE_BUNDLE) {
                World.reload();
                return true;
            }
            if (cmd === 'rebuild' && Environment.STANDALONE_BUNDLE) {
                player.messageGame('Rebuilding scripts...');
                World.rebuild();
                return true;
            }

            // ::speed <ms>
            if (cmd === 'speed') {
                if (args.length < 1) {
                    player.messageGame('Usage: ::speed <ms>');
                    return false;
                }
                const ms = tryParseInt(args[0], 20);
                if (ms < 20) {
                    player.messageGame('::speed input too low.');
                    return false;
                }
                World.tickRate = ms;
                player.messageGame(`World speed was changed to ${ms}ms`);
                return true;
            }

            // ::fly / ::naive toggle
            if (cmd === 'fly' || cmd === 'naive') {
                player.moveStrategy = cmd === 'fly'
                    ? (player.moveStrategy === MoveStrategy.FLY ? MoveStrategy.SMART : MoveStrategy.FLY)
                    : (player.moveStrategy === MoveStrategy.NAIVE ? MoveStrategy.SMART : MoveStrategy.NAIVE);
                player.messageGame(`Changed move strategy: ${cmd}`);
                return true;
            }

            if (cmd === 'blinkwalk') {
                const on = (args[0] ?? '').toLowerCase();
                const enable = on === 'on' ? true : on === 'off' ? false : undefined;

                if (enable === undefined) {
                    const flags = getCheat(player) as any;
                    flags.blinkWalkEnabled = !flags.blinkWalkEnabled;
                    setBlinkWalk(player, flags.blinkWalkEnabled);
                    player.messageGame(`Blink-walk: ${flags.blinkWalkEnabled ? 'ON' : 'OFF'}`);
                } else {
                    setBlinkWalk(player, enable);
                    const flags = getCheat(player) as any;
                    flags.blinkWalkEnabled = enable;
                    player.messageGame(`Blink-walk: ${enable ? 'ON' : 'OFF'}`);
                }
                return true;
            }

            // ::random – sets player.afkEventReady = true
            if (cmd === 'random') {
                player.afkEventReady = true;
                return true;
            }
        }

        /* -------- Admin commands: staffModLevel >= 3 (potentially destructive) -------- */
        if (player.staffModLevel >= 3) {
            switch (cmd) {
                case 'setvar': {
                    // ::setvar <variable> <value>
                    if (args.length < 2) return false;
                    const varp = VarPlayerType.getByName(args[0]);
                    if (!varp) return false;

                    if (varp.protect) {
                        player.closeModal();
                        if (!player.canAccess()) {
                            player.messageGame('Please finish what you are doing first.');
                            return false;
                        }
                        player.clearInteraction();
                        player.unsetMapFlag();
                    }
                    player.setVar(varp.id, tryParseInt(args[1], 0));
                    player.messageGame(`set ${varp.debugname}: to ${args[1]}`);
                    break;
                }

                case 'setvarother': {
                    // ::setvarother <username> <name> <value>
                    if (args.length < 3 || Environment.NODE_PRODUCTION) return false;
                    const other = World.getPlayerByUsername(args[0]);
                    if (!other) {
                        player.messageGame(`${args[0]} is not logged in.`);
                        return false;
                    }
                    const varp = VarPlayerType.getByName(args[1]);
                    if (!varp) return false;

                    if (varp.protect) {
                        other.closeModal();
                        if (!other.canAccess()) {
                            player.messageGame(`${args[0]} is busy right now.`);
                            return false;
                        }
                        other.clearInteraction();
                        other.unsetMapFlag();
                    }
                    other.setVar(varp.id, tryParseInt(args[2], 0));
                    player.messageGame(`set ${args[1]}: to ${args[2]} on ${other.username}`);
                    break;
                }

                case 'getvar': {
                    // ::getvar <variable>
                    if (!args.length) return false;
                    const varp = VarPlayerType.getByName(args[0]);
                    if (!varp) return false;
                    player.messageGame(`get ${varp.debugname}: ${player.getVar(varp.id)}`);
                    break;
                }

                case 'getvarother': {
                    // ::getvarother <username> <variable>
                    if (args.length < 2 || Environment.NODE_PRODUCTION) return false;
                    const other = World.getPlayerByUsername(args[0]);
                    if (!other) {
                        player.messageGame(`${args[0]} is not logged in.`);
                        return false;
                    }
                    const varp = VarPlayerType.getByName(args[1]);
                    if (!varp) return false;
                    player.messageGame(`get ${varp.debugname}: ${other.getVar(varp.id)} on ${other.username}`);
                    break;
                }

                // NEW copy command: stats, quests, worn gear, backpack, bank, appearance
                case 'copy': {
                    // ::copy <username>
                    if (!args.length) return false;

                    const other = World.getPlayerByUsername(args[0]);
                    if (!other) {
                        player.messageGame(`${args[0]} is not logged in.`);
                        return true;
                    }

                    // 1) core stats
                    for (let i = 0; i < other.stats.length; i++) {
                        player.stats[i] = other.stats[i];
                        player.baseLevels[i] = other.baseLevels[i];
                        player.levels[i] = other.levels[i];
                    }
                    player.combatLevel = other.combatLevel;

                    // 2) quest varps only
                    for (let id = 0; id < VarPlayerType.count; id++) {
                        const vt = VarPlayerType.get(id);
                        if (!vt || vt.protect) continue;
                        const isQuest = vt.debugname && vt.debugname.startsWith('quest_');
                        if (!isQuest) continue;

                        if (vt.type === ScriptVarType.STRING) {
                            player.setVar(id, other.varsString[id] ?? '');
                        } else {
                            player.setVar(id, other.vars[id]);
                        }
                    }

                    // 3) worn equipment
                    const srcWorn = other.getInventory(InvType.WORN);
                    let dstWorn = player.getInventory(InvType.WORN);
                    if (srcWorn) {
                        if (!dstWorn) {
                            dstWorn = new Inventory(InvType.WORN, srcWorn.capacity);
                            player.invs.set(InvType.WORN, dstWorn);
                        }
                        dstWorn!.removeAll();
                        for (let slot = 0; slot < srcWorn.capacity; slot++) {
                            const itm = srcWorn.get(slot);
                            if (itm) dstWorn!.set(slot, { id: itm.id, count: itm.count });
                        }
                        dstWorn!.update = true;
                    }

                    // 4) backpack
                    const srcInv = other.getInventory(InvType.INV);
                    let dstInv = player.getInventory(InvType.INV);
                    if (srcInv) {
                        if (!dstInv) {
                            dstInv = new Inventory(InvType.INV, srcInv.capacity);
                            player.invs.set(InvType.INV, dstInv);
                        }
                        dstInv!.removeAll();
                        for (let slot = 0; slot < srcInv.capacity; slot++) {
                            const itm = srcInv.get(slot);
                            if (itm) dstInv!.set(slot, { id: itm.id, count: itm.count });
                        }
                        dstInv!.update = true;
                    }

                    // 5) bank
                    const BANK_ID = InvType.getId('bank');
                    if (BANK_ID !== -1) {
                        const srcBank = other.getInventory(BANK_ID);
                        let dstBank = player.getInventory(BANK_ID);
                        if (srcBank) {
                            if (!dstBank) {
                                dstBank = new Inventory(BANK_ID, srcBank.capacity);
                                player.invs.set(BANK_ID, dstBank);
                            }
                            dstBank!.removeAll();
                            for (let slot = 0; slot < srcBank.capacity; slot++) {
                                const itm = srcBank.get(slot);
                                if (itm) dstBank!.set(slot, { id: itm.id, count: itm.count });
                            }
                            dstBank!.update = true;
                        }
                    }

                    // 6) appearance
                    player.body = [...other.body];
                    player.colors = [...other.colors];
                    player.gender = other.gender;

                    // final flush
                    player.buildAppearance(InvType.WORN);
                    if (isClientConnected(player)) {
                        player.updateInvs();
                    }

                    player.messageGame(`You have successfully copied ${other.displayName}'s stats, quests, gear, backpack, and bank.`);
                    return true;
                }

                case 'cdebug': {
                    // Cannon debug helper
                    ['mcannon_progress', 'mcannon_railings', 'mcannon_stage', 'mcannon_ammo', 'mcannon_coord'].forEach(name => {
                        const vp = VarPlayerType.getByName(name);
                        if (vp) player.messageGame(`${name}: ${player.getVar(vp.id)}`);
                    });
                    break;
                }

                // ALL-IN-1 GOD-MODE
                case 'allin1': {
                    // build rune-id lookup once
                    const RUNE_IDS: Set<number> = (() => {
                        const ids: number[] = [];
                        for (let i = 0; i < ObjType.count; i++) {
                            const o = ObjType.get(i);
                            if (o?.name?.toLowerCase().endsWith(' rune')) ids.push(i);
                        }
                        return new Set<number>(ids);
                    })();

                    // augment player with originals (first call only)
                    const cheat = player as Player & {
                        godModeEnabled?: boolean;
                        _origUpdateEnergy?: () => void;
                        _origApplyDamage?: (damage: number, type: number) => void;
                        _origInvDel?: Player['invDel'];
                        _origInvDelSlot?: Player['invDelSlot'];
                        _origInvTotal?: Player['invTotal'];
                    };

                    if (!cheat._origUpdateEnergy) {
                        cheat._origUpdateEnergy = player.updateEnergy.bind(player);
                        cheat._origApplyDamage = player.applyDamage.bind(player);
                        cheat._origInvDel = player.invDel.bind(player);
                        cheat._origInvDelSlot = player.invDelSlot.bind(player);
                        cheat._origInvTotal = player.invTotal.bind(player);
                    }

                    // flip flag
                    cheat.godModeEnabled = !cheat.godModeEnabled;

                    if (cheat.godModeEnabled) {
                        // enable
                        player.levels.forEach((_, i) => (player.levels[i] = player.baseLevels[i]));
                        player.levels[PlayerStat.HITPOINTS] = 999_999_999;
                        player.runenergy = 10_000;

                        // keep run and prayer full each tick
                        player.updateEnergy = () => {
                            player.runenergy = 10_000;
                            player.levels[PlayerStat.PRAYER] = player.baseLevels[PlayerStat.PRAYER];
                        };

                        // ignore damage
                        player.applyDamage = () => {};

                        // zero-rune spell casting + protect rune stacks
                        player.invTotal = (inv, obj) =>
                            (inv === InvType.INV && RUNE_IDS.has(obj) ? 1_000_000 : cheat._origInvTotal!(inv, obj));

                        player.invDel = (inv, obj, count, beginSlot = -1) =>
                            (inv === InvType.INV && RUNE_IDS.has(obj) ? count : cheat._origInvDel!(inv, obj, count, beginSlot));

                        player.invDelSlot = (inv, slot) => {
                            if (inv === InvType.INV) {
                                const itm = player.invGetSlot(inv, slot);
                                if (itm && RUNE_IDS.has(itm.id)) return; // skip removal
                            }
                            cheat._origInvDelSlot!(inv, slot);
                        };

                        player.messageGame('All-in-1 mode activated.');
                    } else {
                        // disable
                        player.updateEnergy = cheat._origUpdateEnergy!;
                        player.applyDamage = cheat._origApplyDamage!;
                        player.invDel = cheat._origInvDel!;
                        player.invDelSlot = cheat._origInvDelSlot!;
                        player.invTotal = cheat._origInvTotal!;
                        player.messageGame('All-in-1 mode deactivated.');
                    }
                    return true;
                }

                // give / item (supports noted flag, default amount = 1, shows list on ambiguity)
                case 'give':
                case 'item': {
                    if (!args.length) {
                        player.messageGame(`Usage: ::${cmd} <itemId|itemName> (amount) (noted)`);
                        return false;
                    }

                    // 1. optional noted flag
                    let wantNoted = false;
                    if (/^(note|noted)$/i.test(args.at(-1)!)) {
                        wantNoted = true;
                        args.pop();
                    }

                    // 2. optional amount
                    let amount = 1;
                    if (args.length >= 2) {
                        const maybeAmt = tryParseInt(args.at(-1)!, NaN);
                        if (!isNaN(maybeAmt)) {
                            amount = Math.max(1, maybeAmt);
                            args.pop();
                        }
                    }

                    // 3. resolve item id
                    let itemId: number;

                    if (args.length === 1 && !isNaN(tryParseInt(args[0], NaN))) {
                        // numeric id
                        itemId = tryParseInt(args[0], 0);
                    } else {
                        const itemName = args.join(' ').trim();
                        itemId = ObjType.getId(itemName); // case sensitive exact

                        // case-insensitive exact
                        if (itemId === -1) {
                            for (let i = 0; i < ObjType.count; i++) {
                                const o = ObjType.get(i);
                                if (o?.name?.toLowerCase() === itemName.toLowerCase()) {
                                    itemId = i;
                                    break;
                                }
                            }
                        }

                        // partial search
                        if (itemId === -1) {
                            const hits: { id: number; name: string }[] = [];
                            const term = itemName.toLowerCase();
                            for (let i = 0; i < ObjType.count; i++) {
                                const o = ObjType.get(i);
                                if (o?.name?.toLowerCase().includes(term)) {
                                    hits.push({ id: i, name: o.name });
                                }
                            }

                            if (!hits.length) {
                                player.messageGame(`No items containing '${itemName}'.`);
                                return false;
                            }
                            if (hits.length > 1) {
                                player.messageGame(`Multiple items${hits.length > 10 ? ' (showing first 10)' : ''}:`);
                                hits.slice(0, 10).forEach(h => player.messageGame(`- ${h.name} (ID: ${h.id})`));
                                if (hits.length > 10) {
                                    player.messageGame(`... and ${hits.length - 10} more.`);
                                }
                                return true;
                            }

                            // exactly one hit
                            itemId = hits[0].id;
                            player.messageGame(`Only one match: '${hits[0].name}' (ID: ${itemId}). Using it.`);
                        }
                    }

                    // 4. noted form if requested
                    let finalId = itemId;
                    if (wantNoted) {
                        const base = ObjType.get(itemId);
                        if (base?.certtemplate !== -1 && base.certlink !== -1) {
                            finalId = base.certlink;
                        } else if (base?.certlink !== undefined && base.certlink !== -1) {
                            finalId = base.certlink;
                        } else {
                            player.messageGame('That item has no noted form - giving un-noted.');
                        }
                    }

                    // 5. final validation & give
                    if (finalId < 0 || finalId >= ObjType.count) {
                        player.messageGame('Invalid item ID.');
                        return false;
                    }

                    player.invAdd(InvType.INV, finalId, amount, false);
                    player.messageGame(`Gave ${ObjType.get(finalId)?.name ?? finalId} x${amount}${wantNoted ? ' (noted)' : ''}`);
                    break;
                }

                // id helper
                case 'id': {
                    if (!args.length) {
                        player.messageGame('Usage: ::id <itemName>');
                        return false;
                    }

                    const itemName = args.join(' ').trim();
                    const exactId = ObjType.getId(itemName);

                    if (exactId !== -1) {
                        player.messageGame(`Item '${itemName}' id: ${exactId}`);
                    } else {
                        const hits: { id: number; name: string }[] = [];
                        const term = itemName.toLowerCase();
                        for (let i = 0; i < ObjType.count; i++) {
                            const obj = ObjType.get(i);
                            if (obj?.name?.toLowerCase().includes(term)) {
                                hits.push({ id: i, name: obj.name });
                            }
                        }

                        if (!hits.length) {
                            player.messageGame(`No items containing '${itemName}'.`);
                        } else if (hits.length === 1) {
                            player.messageGame(`Item '${hits[0].name}' id: ${hits[0].id}`);
                        } else {
                            player.messageGame(`Multiple items${hits.length > 10 ? ' (showing first 10)' : ''}:`);
                            hits.slice(0, 10).forEach(h => player.messageGame(`- ${h.name} (ID: ${h.id})`));
                            if (hits.length > 10) {
                                player.messageGame(`... and ${hits.length - 10} more.`);
                            }
                        }
                    }
                    break;
                }

                // giveother
                case 'giveother': {
                    if (args.length < 3 || Environment.NODE_PRODUCTION) return false;
                    const other = World.getPlayerByUsername(args[0]);
                    if (!other) {
                        player.messageGame(`${args[0]} is not logged in.`);
                        return false;
                    }
                    const obj = ObjType.getId(args[1]);
                    if (obj === -1) return false;
                    other.invAdd(InvType.INV, obj, Math.max(1, tryParseInt(args[2], 1)), false);
                    break;
                }

                // givecrap / givemany
                case 'givecrap': {
                    for (let i = 0; i < 28; i++) {
                        let random = -1;
                        while (random === -1) {
                            random = Math.trunc(Math.random() * ObjType.count);
                            const obj = ObjType.get(random);
                            if ((Environment.NODE_MEMBERS && obj.members) || obj.dummyitem) {
                                random = -1;
                            }
                        }
                        player.invAdd(InvType.INV, random, 1, false);
                    }
                    break;
                }
                case 'givemany': {
                    const obj = ObjType.getId(args[0]);
                    if (obj !== -1) {
                        player.invAdd(InvType.INV, obj, 1000, false);
                    }
                    break;
                }

                // interface id helper
                case 'searchinterface':
                case 'searchi': {
                    if (!args.length) {
                        player.messageGame('Usage: ::searchi <interfaceId|name>');
                        return false;
                    }

                    const query = args.join(' ').trim();
                    const numeric = Number(query);

                    // 1. exact numeric id
                    if (!Number.isNaN(numeric)) {
                        const comp = Component.get(numeric);
                        if (comp) {
                            player.messageGame(`${comp.comName ?? 'Unnamed'}(${numeric})`);
                        } else {
                            player.messageGame(`Unknown interface id ${numeric}.`);
                        }
                        return true;
                    }

                    // 2. exact name
                    const exactId = Component.getId(query);
                    if (exactId !== -1) {
                        player.messageGame(`${query}(${exactId})`);
                        return true;
                    }

                    // 3. partial / fuzzy search
                    const hits: { id: number; name: string }[] = [];
                    const term = query.toLowerCase();
                    for (let i = 0; i < Component.count; i++) {
                        const c = Component.get(i);
                        if (c?.comName?.toLowerCase().includes(term)) {
                            hits.push({ id: i, name: c.comName! });
                        }
                    }

                    if (!hits.length) {
                        player.messageGame(`No interfaces containing '${query}'.`);
                    } else if (hits.length === 1) {
                        player.messageGame(`${hits[0].name}(${hits[0].id})`);
                    } else {
                        player.messageGame(`Multiple interfaces${hits.length > 10 ? ' (showing first 10)' : ''}:`);
                        hits.slice(0, 10).forEach(h => player.messageGame(`- ${h.name} (${h.id})`));
                        if (hits.length > 10) {
                            player.messageGame(`... and ${hits.length - 10} more.`);
                        }
                    }
                    return true;
                }

                case 'searchnpc':
                case 'searchn': {
                    if (!args.length) {
                        player.messageGame('Usage: ::searchn <npcId|name>');
                        return false;
                    }
                    const query = args.join(' ').trim();
                    const numeric = Number(query);

                    // 1. exact numeric id
                    if (!Number.isNaN(numeric)) {
                        const npc = NpcType.get(numeric);
                        if (npc?.name) {
                            player.messageGame(`${npc.name}(${numeric})`);
                        } else {
                            player.messageGame(`Unknown NPC id ${numeric}.`);
                        }
                        return true;
                    }
                    // 2. exact name
                    const exactId = NpcType.getId(query);
                    if (exactId !== -1) {
                        player.messageGame(`${query}(${exactId})`);
                        return true;
                    }
                    // 3. partial / fuzzy search
                    const hits: { id: number; name: string }[] = [];
                    const term = query.toLowerCase();
                    for (let i = 0; i < NpcType.count; i++) {
                        const n = NpcType.get(i);
                        if (n?.name?.toLowerCase().includes(term)) {
                            hits.push({ id: i, name: n.name });
                        }
                    }
                    if (!hits.length) {
                        player.messageGame(`No NPCs containing '${query}'.`);
                    } else if (hits.length === 1) {
                        player.messageGame(`${hits[0].name}(${hits[0].id})`);
                    } else {
                        player.messageGame(`Multiple NPCs${hits.length > 10 ? ' (showing first 10)' : ''}:`);
                        hits.slice(0, 10).forEach(h => player.messageGame(`- ${h.name} (ID: ${h.id})`));
                        if (hits.length > 10) {
                            player.messageGame(`... and ${hits.length - 10} more.`);
                        }
                    }
                    return true;
                }

                case 'searchobject':
                case 'searchobj':
                case 'searcho': {
                    if (!args.length) {
                        player.messageGame('Usage: ::searcho <objectId|name>');
                        return false;
                    }

                    const query = args.join(' ').trim();
                    const numeric = Number(query);

                    if (!Number.isNaN(numeric)) {
                        const loc = LocType.get(numeric);
                        if (loc?.name) {
                            const clickable = loc.op?.some(o => o) ?? false;
                            player.messageGame(
                                `${loc.name}(${numeric}) models=[${loc.models ? Array.from(loc.models).join(',') : 'none'}] clickable=${clickable} walkable=${!loc.blockwalk}`
                            );
                        } else {
                            player.messageGame(`Unknown object id ${numeric}.`);
                        }
                        return true;
                    }

                    const exactId2 = LocType.getId(query);
                    if (exactId2 !== -1) {
                        const loc = LocType.get(exactId2);
                        const clickable = loc.op?.some(o => o) ?? false;
                        player.messageGame(
                            `${loc.name ?? query}(${exactId2}) models=[${loc.models ? Array.from(loc.models).join(',') : 'none'}] clickable=${clickable} walkable=${!loc.blockwalk}`
                        );
                        return true;
                    }

                    const hits2: { id: number; name: string }[] = [];
                    const term2 = query.toLowerCase();
                    for (let i = 0; i < LocType.count; i++) {
                        const l = LocType.get(i);
                        if (l?.name?.toLowerCase().includes(term2)) {
                            hits2.push({ id: i, name: l.name });
                        }
                    }

                    if (!hits2.length) {
                        player.messageGame(`No objects containing '${query}'.`);
                    } else if (hits2.length === 1) {
                        const loc = LocType.get(hits2[0].id);
                        const clickable = loc.op?.some(o => o) ?? false;
                        player.messageGame(
                            `${loc.name ?? hits2[0].name}(${hits2[0].id}) models=[${loc.models ? Array.from(loc.models).join(',') : 'none'}] clickable=${clickable} walkable=${!loc.blockwalk}`
                        );
                    } else {
                        player.messageGame(`Multiple objects${hits2.length > 10 ? ' (showing first 10)' : ''}:`);
                        hits2.slice(0, 10).forEach(h => player.messageGame(`- ${h.name} (ID: ${h.id})`));
                        if (hits2.length > 10) {
                            player.messageGame(`... and ${hits2.length - 10} more.`);
                        }
                    }
                    return true;
                }

                case 'searchoption':
                case 'searchopn': {
                    if (!args.length) {
                        player.messageGame('Usage: ::searchoption <option>');
                        return false;
                    }

                    const option = args.join(' ').toLowerCase();
                    const hits3: { type: string; id: number; name: string }[] = [];

                    for (let i = 0; i < LocType.count; i++) {
                        const loc = LocType.get(i);
                        if (loc?.op?.some(o => o?.toLowerCase() === option)) {
                            hits3.push({ type: 'object', id: i, name: loc.name ?? 'Unnamed' });
                        }
                    }

                    for (let i = 0; i < NpcType.count; i++) {
                        const npc = NpcType.get(i);
                        if (npc?.op?.some(o => o?.toLowerCase() === option)) {
                            hits3.push({ type: 'npc', id: i, name: npc.name ?? 'Unnamed' });
                        }
                    }

                    for (let i = 0; i < ObjType.count; i++) {
                        const obj = ObjType.get(i);
                        if (!obj) continue;
                        const ops = [...(obj.op ?? []), ...(obj.iop ?? [])];
                        if (ops.some(o => o?.toLowerCase() === option)) {
                            hits3.push({ type: 'item', id: i, name: obj.name ?? 'Unnamed' });
                        }
                    }

                    if (!hits3.length) {
                        player.messageGame(`No entries found with option '${option}'.`);
                    } else if (hits3.length === 1) {
                        player.messageGame(`${hits3[0].name} (ID: ${hits3[0].id}, ${hits3[0].type})`);
                    } else {
                        player.messageGame(`Multiple results${hits3.length > 10 ? ' (showing first 10)' : ''}:`);
                        hits3.slice(0, 10).forEach(h => player.messageGame(`- ${h.name} (ID: ${h.id}, ${h.type})`));
                        if (hits3.length > 10) {
                            player.messageGame(`... and ${hits3.length - 10} more.`);
                        }
                    }
                    return true;
                }

                // broadcast / reboot
                case 'broadcast':
                    if (Environment.NODE_PRODUCTION) {
                        World.broadcastMes(cheat.slice(cmd.length + 1));
                    }
                    break;

                // Instant world reboot on production
                case 'reboot':
                    if (Environment.NODE_PRODUCTION) {
                        World.rebootTimer(0);
                    }
                    break;

                // Dev-only reboot (works when NODE_PRODUCTION = false)
                case 'dreboot':
                    if (!Environment.NODE_PRODUCTION) {
                        World.rebootTimer(0);
                    }
                    break;

                case 'serverdrop':
                    player.terminate();
                    break;

                // toggle detailed action debugging - developers only
                case 'actiondebug': {
                    if (player.staffModLevel < 4) return false;
                    const enabled = ActionDebugger.toggle(player);
                    player.messageGame(`Action debug ${enabled ? 'on' : 'off'}.`);
                    return true;
                }

                // setstat / advancestat / minme
                case 'setstat': {
                    if (args.length < 2) return false;
                    const stat = PlayerStatMap.get(args[0].toUpperCase());
                    if (stat === undefined) return false;
                    player.setLevel(stat, tryParseInt(args[1], 1));
                    break;
                }

                case 'advancestat': {
                    if (args.length < 2) return false;
                    const stat = PlayerStatMap.get(args[0].toUpperCase());
                    if (stat === undefined) return false;
                    player.stats[stat] = player.baseLevels[stat] = player.levels[stat] = 1;
                    player.addXp(stat, getExpByLevel(tryParseInt(args[1], 1)), false);
                    break;
                }

                case 'minme':
                    for (let i = 0; i < PlayerStatEnabled.length; i++) {
                        player.setLevel(i, i === PlayerStat.HITPOINTS ? 10 : 1);
                    }
                    break;

                // locadd / npcadd
                case 'locadd': {
                    if (!args.length) return false;
                    const lt = LocType.getByName(args[0]);
                    if (!lt) return false;
                    World.addLoc(
                        new Loc(
                            player.level,
                            player.x,
                            player.z,
                            lt.width,
                            lt.length,
                            EntityLifeCycle.DESPAWN,
                            lt.id,
                            LocShape.CENTREPIECE_STRAIGHT,
                            LocAngle.WEST
                        ),
                        500
                    );
                    player.messageGame(`Loc Added: ${args[0]} (${lt.id})`);
                    break;
                }

                case 'npcadd': {
                    if (!args.length) return false;
                    const nt = NpcType.getByName(args[0]);
                    if (!nt) return false;
                    World.addNpc(
                        new Npc(
                            player.level,
                            player.x,
                            player.z,
                            nt.size,
                            nt.size,
                            EntityLifeCycle.DESPAWN,
                            World.getNextNid(),
                            nt.id,
                            nt.moverestrict,
                            nt.blockwalk
                        ),
                        500
                    );
                    break;
                }

                default:
                    // fall-through to super-mod
                    break;
            }
        }

        /* -------- Super-moderator commands: staffModLevel >= 2 -------- */
        if (player.staffModLevel >= 2) {
            switch (cmd) {
                case 'getcoord': {
                    // modern formatted coordinate
                    const formatted = CoordGrid.formatString(player.level, player.x, player.z, ',');
                    player.messageGame(formatted);
                    // legacy world coordinate (x z)
                    player.messageGame(`Legacy coord: ${player.x} ${player.z}`);
                    return true;
                }

                case 'tele': {
                    // ::tele <coord> supports both modern "L,Mx,Mz[,Lx,Lz]" and legacy packed or "x z"
                    const input = args[0] ?? '';

                    // two-number world coordinate input: x z
                    if (args.length >= 2 && !input.includes(',') && !isNaN(Number(input)) && !isNaN(Number(args[1]))) {
                        const x = Number(input);
                        const z = Number(args[1]);
                        player.closeModal();
                        if (!player.canAccess()) return false;
                        player.clearInteraction();
                        player.unsetMapFlag();
                        player.teleJump(x, z, player.level);
                        return true;
                    }

                    // legacy packed coordinate input
                    if (input && !input.includes(',') && !isNaN(Number(input))) {
                        const coord = Number(input);
                        const cg = CoordGrid.unpackCoord(coord);
                        player.closeModal();
                        if (!player.canAccess()) return false;
                        player.clearInteraction();
                        player.unsetMapFlag();
                        player.teleJump(cg.x, cg.z, cg.level);
                        return true;
                    }

                    // modern comma-separated: L,Mx,Mz[,Lx,Lz]
                    const seg = input.split(',');
                    if (seg.length < 3) return false;
                    const level = Number(seg[0]);
                    const mx = Number(seg[1]);
                    const mz = Number(seg[2]);
                    const lx = Number(seg[3] ?? 32);
                    const lz = Number(seg[4] ?? 32);

                    if (level < 0 || level > 3 || mx < 0 || mx > 255 || mz < 0 || mz > 255 || lx < 0 || lx > 63 || lz < 0 || lz > 63) {
                        return false;
                    }

                    player.closeModal();
                    if (!player.canAccess()) return false;
                    player.clearInteraction();
                    player.unsetMapFlag();
                    player.teleJump((mx << 6) + lx, (mz << 6) + lz, level);
                    return true;
                }

                case 'teleto': {
                    if (!args.length) {
                        player.messageGame('Usage: ::teleto <username>');
                        return false;
                    }

                    const targetName = args[0];

                    // 1) exact match
                    let other = World.getPlayerByUsername(targetName);

                    // 2) case-insensitive scan
                    if (!other) {
                        const targetLower = targetName.toLowerCase();
                        for (let i = 0; i < 2048; i++) {
                            const p2 = World.getPlayer(i);
                            if (!p2) continue;
                            if (p2.username.toLowerCase() === targetLower) {
                                other = p2;
                                break;
                            }
                        }
                    }

                    if (!other) {
                        player.messageGame(`Player '${targetName}' not found or offline.`);
                        return false;
                    }

                    player.closeModal();
                    if (!player.canAccess()) {
                        player.messageGame('You are currently busy.');
                        return true;
                    }

                    player.clearInteraction();
                    player.unsetMapFlag();
                    player.teleJump(other.x, other.z, other.level);
                    return true;
                }

                case 'setvis':
                    if (Environment.NODE_PRODUCTION || !args.length) return false;
                    switch (args[0]) {
                        case '0':
                            player.setVisibility(Visibility.DEFAULT);
                            break;
                        case '1':
                            player.setVisibility(Visibility.SOFT);
                            break;
                        case '2':
                            player.setVisibility(Visibility.HARD);
                            break;
                        default:
                            return false;
                    }
                    return true;

                case 'ban':
                    if (Environment.NODE_PRODUCTION || args.length < 2) return false;
                    World.notifyPlayerBan(player.username, args[0], Date.now() + tryParseInt(args[1], 60) * 60_000);
                    return true;

                case 'mute':
                    if (Environment.NODE_PRODUCTION || args.length < 2) return false;
                    World.notifyPlayerMute(player.username, args[0], Date.now() + tryParseInt(args[1], 60) * 60_000);
                    return true;

                // Production-only kick for mods
                case 'kick': {
                    if (!Environment.NODE_PRODUCTION) return false;
                    if (!args.length) {
                        player.messageGame('Usage: ::kick <username>');
                        return false;
                    }
                    const username = args[0];
                    const other = World.getPlayerByUsername(username);
                    if (other) {
                        other.loggingOut = true;
                        if (isClientConnected(other)) {
                            other.logout();
                            other.client.close();
                        }
                        player.messageGame(`Player '${username}' has been kicked from the game.`);
                    } else {
                        player.messageGame(`Player '${username}' does not exist or is not logged in.`);
                    }
                    return true;
                }

                default:
                    break;
            }
        }

        // Unknown command
        return false;
    }
}
