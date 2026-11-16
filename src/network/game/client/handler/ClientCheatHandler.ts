import v8 from 'node:v8';

import { Visibility } from '#/network/rsbuf/index.js';
import { LocAngle, LocShape } from '#/engine/routefinder/index.js';

import Component from '#/cache/config/Component.js';
import IdkType from '#/cache/config/IdkType.js';
import InvType from '#/cache/config/InvType.js';
import LocType from '#/cache/config/LocType.js';
import NpcType from '#/cache/config/NpcType.js';
import ObjType from '#/cache/config/ObjType.js';
import ScriptVarType from '#/cache/config/ScriptVarType.js';
import SeqType from '#/cache/config/SeqType.js';
import SpotanimType from '#/cache/config/SpotanimType.js';
import VarBitType from '#/cache/config/VarBitType.js';
import VarPlayerType from '#/cache/config/VarPlayerType.js';

import { CoordGrid } from '#/engine/CoordGrid.js';
import InstanceMap from '#/engine/InstanceMap.js';
import World from '#/engine/World.js';
import VoteService from '#/engine/vote/VoteService.js';
import VoteSites from '#/engine/vote/VoteSites.js';
import { EntityLifeCycle } from '#/engine/entity/EntityLifeCycle.js';
import Loc from '#/engine/entity/Loc.js';
import { MoveStrategy } from '#/engine/entity/MoveStrategy.js';
import { isClientConnected } from '#/engine/entity/NetworkPlayer.js';
import Npc from '#/engine/entity/Npc.js';
import Player, { getExpByLevel } from '#/engine/entity/Player.js';
import { PlayerStat, PlayerStatEnabled, PlayerStatMap } from '#/engine/entity/PlayerStat.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';

import ClientGameMessageHandler from '#/network/game/client/ClientGameMessageHandler.js';
import ClientCheat from '#/network/game/client/model/ClientCheat.js';

import { LoggerEventType } from '#/server/logger/LoggerEventType.js';
import { queueBugReport } from '#/server/tickets/TicketInbox.js';

import Environment from '#/util/Environment.js';
import handleBotCommand from '#/engine/bot/BotCommands.js';
import handleCoverageCommand from '#/engine/script/ScriptCoverageCommands.js';
import handleDeadOpsCommand from '#/engine/script/DeadOpsCommands.js';
import handleCommandsCommand, { STAFF_WORLD } from '#/network/game/client/handler/ClientCheatCommands.js';
import handleFaultsCommand from '#/engine/script/ScriptFaultCommands.js';
import { printDebug } from '#/util/Logger.js';
import { tryParseInt } from '#/util/TryParse.js';
import ChatText from '#/wordenc/ChatText.js';

// custom (2026-09-27) - ::yell reaches every player on the world, so a player gets one every
// YELL_COOLDOWN_TICKS (10 seconds). Staff (2+) are not held to it. Keyed weakly so a logged-out
// player's entry goes with them.
const YELL_COOLDOWN_TICKS = 17;
const lastYell: WeakMap<Player, number> = new WeakMap();

// custom (2026-09-27) - ::changepassword: one try every 5 seconds, so a logged-in session left open
// cannot be used to guess the current password quickly. The characters are the ones the login
// screen lets you type (Client.CHARSET), less space and backtick - a password you cannot type there
// would lock you out.
const PASSWORD_COOLDOWN_TICKS = 8;
const lastPasswordChange: WeakMap<Player, number> = new WeakMap();
const PASSWORD_CHARS = /^[a-z0-9!"$%^&*()\-_=+[{\]};:'@#~,<.>/?\\|]+$/;

// custom (2026-09-27) - ::bug goes to the staff as a Discord ticket, so one a minute per account.
// Keyed by username rather than Player so logging out and back in does not reset it.
const BUG_COOLDOWN_MS = 60_000;
const lastBugReport: Map<string, number> = new Map();

// custom (2026-11-11) - ::home and ::sz are the two free teleports, and a free teleport is a free
// escape: out of a fight, out of the Wilderness, out of an instance that is counting on its own way
// out being used. Both commands ask the same three questions, so they ask them here rather than
// each keeping its own copy to drift from. The rule, the dates and the reasoning are ::home's own,
// moved rather than rewritten; only the destination in the message is a parameter.
//
// (2026-09-27) Anything that stops a logout (combat, for 16 ticks after the last hit:
// p_preventlogout) stops the teleport too, and so does the Wilderness. Administrators (3) and up
// are not held to it - this is called under that check, not instead of it.
//
// (2026-10-19) Fight Cave, solo Pest Control, Zulrah, a house: each has its own way out, which is
// what ends the instance and gives it back to the pool - ::home walked out of them and left the
// slot taken, and the minigame's own state half-finished.
function freeTeleportRefusal(player: Player, where: string): string | null {
    if (World.currentTick < player.preventLogoutUntil) {
        return `You can't teleport ${where} until 10 seconds after the end of combat.`;
    }

    if (player.isInWilderness()) {
        return `You can't teleport ${where} from the Wilderness.`;
    }

    if (InstanceMap.at(player.x, player.z) !== null) {
        return `You can't teleport ${where} from here. Use the way out.`;
    }

    return null;
}

export default class ClientCheatHandler extends ClientGameMessageHandler<ClientCheat> {
    handle(message: ClientCheat, player: Player): boolean {
        if (message.input.length > 80) {
            return false;
        }

        const { input: cheat } = message;

        const args: string[] = cheat.toLowerCase().split(' ');
        const cmd: string | undefined = args.shift();
        if (cmd === undefined || cmd.length <= 0) {
            return false;
        }

        if (cmd === 'home') {
            // custom (Corey, 2026-09-04) - available to all players, not staff-gated. Destination is
            // Edgeville (coord 0_48_54_14_35), the spot Corey picked in-game on 2026-09-05.
            player.closeModal();

            if (!player.canAccess()) {
                player.messageGame('Please finish what you are doing first.');
                return false;
            }

            // custom (2026-09-27) - not a free escape; freeTeleportRefusal above is the rule, and
            // ::sz is held to the same one. Administrators and up are not held to it.
            if (player.staffModLevel < 3) {
                const refusal: string | null = freeTeleportRefusal(player, 'home');
                if (refusal !== null) {
                    player.messageGame(refusal);
                    return false;
                }
            }

            player.clearInteraction();
            player.unsetMapFlag();

            // (2026-10-19) The teleport itself is content's (misc/scripts/home_teleport.rs2), so it is
            // refused wherever any teleport is - a duel, Castle Wars, the trawler, a random event, the
            // quests that forbid it - and the rum and plague sample are lost as on any other. This used to
            // teleJump straight to Edgeville, which skipped all of that.
            const script = ScriptProvider.getByName('[proc,home_teleport]');
            if (!script) {
                // a content build from before home_teleport.rs2
                player.messageGame("You can't teleport home right now.");
                return false;
            }
            player.executeScript(ScriptRunner.init(script, player), true);
            return true;
        }

        if (cmd === 'forgetlogins') {
            // custom (2026-11-02) - the saved logins on the login screen are server-issued tokens
            // (LoginToken), so cancelling one is the server's job and not the client's. Handled
            // before the staff session log below for the same reason ::changepassword is: it is a
            // player's own account business, not a cheat anybody needs a record of.
            //
            // All of them, with no way to pick: a player reaching for this has lost track of where
            // they are signed in, and "which of these four is the laptop I sold" is a question they
            // cannot answer. Typing the password again is the cost, once per computer they keep.
            if (!World.requestForgetLogins(player)) {
                player.messageGame('Your last request is still being processed.');
            }
            return true;
        }

        if (cmd === 'milestones') {
            // custom (2026-11-16) - a player's own setting, so it is handled before the staff
            // "Ran cheat" log below along with ::changepassword and ::forgetlogins.
            //
            // IT IS A COMMAND AND NOT A BUTTON ON THE OPTIONS TAB because there is no room on the
            // tab: options.if is 190x261, the six-button grid fills it to y=246, and the level-up
            // popup line already takes thirteen of the fifteen rows that leaves. That is written
            // down in the interface itself, next to the component.
            //
            // 0 is on, so an account that has never run this hears them.
            const varp = VarPlayerType.getByName('option_milestones');
            if (!varp) {
                player.messageGame('Milestone announcements are not available on this world.');
                return true;
            }

            const hidden = player.getVar(varp.id) !== 0;
            player.setVar(varp.id, hidden ? 0 : 1);
            player.messageGame(hidden ? 'Milestone announcements are now shown. ::milestones hides them again.' : 'Milestone announcements are now hidden. ::milestones shows them again.');
            return true;
        }

        if (cmd === 'changepassword') {
            // custom (2026-09-27) - handled before the staff "Ran cheat" session log below, which would
            // otherwise write a moderator's passwords into the logs. Available to all players.
            // ::changepassword <current> <new> <new again> - lowercase, like every password here.
            const [oldPassword, newPassword, confirm] = args;
            if (!oldPassword || !newPassword || !confirm || args.length !== 3) {
                player.messageGame('Usage: ::changepassword current new new');
                return true;
            }

            const last = lastPasswordChange.get(player);
            if (last !== undefined && World.currentTick - last < PASSWORD_COOLDOWN_TICKS) {
                player.messageGame('Please wait a few seconds before trying again.');
                return true;
            }
            lastPasswordChange.set(player, World.currentTick);

            if (newPassword !== confirm) {
                player.messageGame('The two new passwords do not match.');
            } else if (newPassword.length < 5 || newPassword.length > 20) {
                player.messageGame('Your new password must be 5 to 20 characters long.');
            } else if (!PASSWORD_CHARS.test(newPassword)) {
                player.messageGame('Your new password can only use letters, numbers and symbols you can type at the login screen.');
            } else if (newPassword === oldPassword) {
                player.messageGame('Your new password must be different from your current one.');
            } else if (newPassword === player.username.replaceAll('_', ' ') || newPassword === player.username) {
                player.messageGame('Your password cannot be your username.');
            } else if (!World.requestPasswordChange(player, oldPassword, newPassword)) {
                player.messageGame('Your last password change is still being processed.');
            } else {
                player.messageGame('Checking your password...');
            }
            return true;
        }

        if (cmd === 'discord') {
            // custom (2026-09-21) - link this account to Discord for trading post DMs. Available to all
            // players. See server/discord/DiscordThread.ts.
            if (!World.discordEnabled) {
                player.wrappedMessageGame('Discord alerts are not set up on this server.');
                return true;
            }

            if (args[0] === 'unlink') {
                World.discordUnlink(player);
                return true;
            }

            // Two short lines, the code in dark red so it stands out on the chatbox's parchment.
            // (@col@ tags in game messages need the client from 2026-09-21 on; an older client prints
            // them as text.)
            const code = World.discordCode(player);
            player.wrappedMessageGame(`Your Discord link code is @dre@${code}@bla@ - it works once, for 10 minutes.`);
            player.wrappedMessageGame(`In our Discord, type @dre@/link ${code}@bla@. To stop alerts later: ::discord unlink`);
            return true;
        }

        if (cmd === 'bug') {
            // custom (2026-09-27) - report a bug from where it happened. Available to all players.
            // It is filed as a private bug report in our Discord by the ticket bot, a process of its
            // own that may be down: the report waits in the inbox until it is back - see
            // server/tickets/TicketInbox.ts. Where the player stands goes with it.
            const text = cheat.substring(cmd.length).trim();
            if (text.length < 10) {
                player.wrappedMessageGame('Type ::bug followed by what went wrong, e.g. ::bug the cook in Lumbridge will not talk to me');
                return true;
            }

            const last = lastBugReport.get(player.username);
            if (last !== undefined && Date.now() - last < BUG_COOLDOWN_MS) {
                player.messageGame('You can only send one bug report a minute.');
                return true;
            }

            if (queueBugReport({ username: player.username, text, x: player.x, z: player.z, level: player.level }) === null) {
                player.messageGame('Your bug report could not be sent just now. Please try again in a moment.');
                return true;
            }
            lastBugReport.set(player.username, Date.now());

            player.messageGame('Thanks - your bug report has been sent to the staff.');
            if (World.discordEnabled) {
                player.wrappedMessageGame('If your account is linked to our Discord (::discord), you will be added to its ticket there to follow it up.');
            }
            return true;
        }

        if (cmd === 'commands') {
            // custom (2026-10-07) - what you can run, at your rank, on this world. Available to all
            // players, and deliberately the first thing above the staff blocks: the whole point is
            // that a command you do not have answers nothing, so the one that explains that has to
            // answer everybody. ClientCheatCommands.ts keeps the list and the two rank rules.
            return handleCommandsCommand(player, args);
        }

        if (cmd === 'yell') {
            // custom (Corey, 2026-09-04) - global broadcast chat, available to all players (like
            // ::home, not staff-gated).
            //
            // (2026-09-23) THE ENGINE ONLY DECIDES WHETHER; CONTENT DECIDES HOW IT LOOKS. The line is
            // built by [proc,yell] in content/scripts/general/scripts/broadcast.rs2, next to the rare
            // drop broadcasts, so a yell and a drop share one ~broadcast_name - the rank crown, the
            // XP-mode badge and the name - instead of this file and the drop tables each keeping a
            // copy of the rules for which crown a mod level earns.
            if (player.muted_until !== null && player.muted_until > new Date()) {
                return false;
            }

            // No markup from players. A chat line's colours and icons are all "@xxx@" tags, so what a
            // player typed would otherwise be drawn: "@cr2@" in a yell put the administrator's gold
            // crown in front of whatever followed it. (2026-09-27) The yell is chat, so it takes chat's
            // characters and case (ChatText.format), and every '@' is sent as ChatText.LITERAL_AT, which
            // the client draws as '@' but never reads as a tag - "@cr2@" now prints as typed.
            const text = ChatText.literal(ChatText.format(cheat.substring(cmd.length + 1)));
            if (text.length <= 0 || text.length > 100) {
                return false;
            }

            if (player.staffModLevel < 2) {
                const last = lastYell.get(player);
                if (last !== undefined && World.currentTick - last < YELL_COOLDOWN_TICKS) {
                    player.messageGame('You can only yell once every 10 seconds.');
                    return false;
                }
                lastYell.set(player, World.currentTick);
            }

            const script = ScriptProvider.getByName('[proc,yell]');
            if (!script) {
                // a content build from before broadcast.rs2 - still say it, just plainly
                World.broadcastMes(`[Yell] ${player.displayName}: ${text}`);
                return true;
            }
            player.executeScript(ScriptRunner.init(script, player, null, [text]), false);
            return true;
        }

        if (player.staffModLevel >= 2) {
            player.addSessionLog(LoggerEventType.MODERATOR, 'Ran cheat', cheat);
        }

        if (player.staffModLevel >= 4) {
            // developer and above, ON LIVE TOO - which is the whole reason this sits above the
            // block below rather than in it. ::godmode was asked for (2026-10-03) for testing boss
            // rotations on the real server, and a [debugproc,] cannot do that: debugprocs are
            // owner-only on a live world. It cannot be used against players: while it is on, content's
            // [proc,pvp_is_attackable] refuses attacking a player and being attacked by one (2026-10-19).

            if (cmd === 'godmode') {
                // The switch itself is content - misc/scripts/godmode.rs2 - so what it restores and
                // what it refuses is readable and editable there rather than buried in the engine.
                //
                // protect=true, like ::bank above: the proc writes %godmode and %sa_energy, both
                // protected varps, and running it unprotected is "requires protected access" and a
                // dropped client.
                if (!player.canAccess()) {
                    player.messageGame('Please finish what you are doing first.');
                    return false;
                }

                const script = ScriptProvider.getByName('[proc,godmode_toggle]');
                if (!script) {
                    // a content build from before godmode.rs2
                    return false;
                }

                player.executeScript(ScriptRunner.init(script, player), true);
                return true;
            }
        }

        if (player.staffModLevel >= 5 || (!Environment.NODE_PRODUCTION && player.staffModLevel >= 4)) {
            // developer commands. On live only the owners have them (5, red crown; 6, blue and gold) -
            // ::speed, ::snapshot, ::reload and the rest can stop or wreck the world, so a developer (4)
            // gets them on a dev server only, and an owner's password is the one that has to be strong.

            if (cmd[0] === Environment.NODE_DEBUGPROC_CHAR) {
                // debugprocs are NOT allowed on live ;)
                const script = ScriptProvider.getByName(`[debugproc,${cmd.slice(1)}]`);
                if (!script) {
                    return false;
                }

                const params = new Array(script.info.parameterTypes.length).fill(-1);
                for (let i = 0; i < script.info.parameterTypes.length; i++) {
                    const type = script.info.parameterTypes[i];

                    try {
                        switch (type) {
                            case ScriptVarType.STRING: {
                                const value = args.shift();
                                params[i] = value ?? '';
                                break;
                            }
                            case ScriptVarType.INT: {
                                const value = args.shift();
                                params[i] = parseInt(value ?? '0', 10) | 0;
                                break;
                            }
                            case ScriptVarType.OBJ:
                            case ScriptVarType.NAMEDOBJ: {
                                const name = args.shift();
                                params[i] = ObjType.getId(name ?? '');
                                break;
                            }
                            case ScriptVarType.NPC: {
                                const name = args.shift();
                                params[i] = NpcType.getId(name ?? '');
                                break;
                            }
                            case ScriptVarType.LOC: {
                                const name = args.shift();
                                params[i] = LocType.getId(name ?? '');
                                break;
                            }
                            case ScriptVarType.SEQ: {
                                const name = args.shift();
                                params[i] = SeqType.getId(name ?? '');
                                break;
                            }
                            case ScriptVarType.STAT: {
                                const name = args.shift() ?? '';
                                params[i] = PlayerStatMap.get(name.toUpperCase());
                                break;
                            }
                            case ScriptVarType.INV: {
                                const name = args.shift();
                                params[i] = InvType.getId(name ?? '');
                                break;
                            }
                            case ScriptVarType.COORD: {
                                const args2 = cheat.split('_');

                                const level = parseInt(args2[0].slice(6));
                                const mx = parseInt(args2[1]);
                                const mz = parseInt(args2[2]);
                                const lx = parseInt(args2[3]);
                                const lz = parseInt(args2[4]);

                                params[i] = CoordGrid.packCoord(level, (mx << 6) + lx, (mz << 6) + lz);
                                break;
                            }
                            case ScriptVarType.INTERFACE: {
                                const name = args.shift();
                                params[i] = Component.getId(name ?? '');
                                break;
                            }
                            case ScriptVarType.SPOTANIM: {
                                const name = args.shift();
                                params[i] = SpotanimType.getId(name ?? '');
                                break;
                            }
                            case ScriptVarType.IDKIT: {
                                const name = args.shift();
                                params[i] = IdkType.getId(name ?? '');
                                break;
                            }
                        }
                    } catch (_) {
                        // invalid arguments
                        return false;
                    }
                }

                player.executeScript(ScriptRunner.init(script, player, null, params), false);
            } else if (cmd === 'wipebankother' && STAFF_WORLD) {
                // custom (2026-11-15) - ::wipebankother <username> [confirm], the other-player half
                // of ::wipebank (administrator, in the block below).
                //
                // OWNER, AND IN THIS BLOCK RATHER THAN THAT ONE. Every other command here can stop
                // or wreck the world it is run on and is recoverable by restarting it; this one
                // destroys another player's property and nothing gives it back. An administrator
                // can already hand out items and rewrite another account's varps, but nothing until
                // now could delete somebody else's. STAFF_WORLD on top of the rank, like
                // ::teleother and ::giveother: on an open development world every login is promoted
                // to 4, so without it this would belong to anyone who connected.
                //
                // ONLINE ONLY. The bank lives in the player's loaded inventories, so this reaches
                // the account only while it is logged in. Wiping an offline bank would mean editing
                // the save, which is a different job with different risks.
                // The NAME, not args.length. A trailing space - "::wipebankother " - splits into one
                // empty argument rather than none, so a length check alone let that through to the
                // lookup below and answered " is not logged in.", which reads like a bug in the
                // command. (::teleother and ::giveother check the length; they have the same gap.)
                const want = args[0] ?? '';
                if (want.length === 0) {
                    player.messageGame('Usage: ::wipebankother <username> [confirm]');
                    return false;
                }

                const other = World.getPlayerByUsername(want);
                if (!other) {
                    player.messageGame(`${want} is not logged in.`);
                    return false;
                }

                const otherBank = other.getInventory(InvType.getId('bank'));
                if (!otherBank) {
                    return false;
                }

                const items = otherBank.capacity - otherBank.freeSlotCount;
                if (items === 0) {
                    player.messageGame(`${other.displayName}'s bank is already empty.`);
                    return false;
                }

                // NOT ONE TYPO AWAY FROM THE WRONG BANK. ::wipebank asks its question in a Yes/No
                // box, which cannot be done here: the box would open on the player whose items are
                // going and they would be the one answering it. So the confirmation is the word,
                // and the command without it reports what it WOULD delete instead of deleting it -
                // which doubles as the way to read a bank's size before touching it.
                if (args[1] !== 'confirm') {
                    player.messageGame(`${other.displayName}'s bank holds ${items} item${items === 1 ? '' : 's'}.`);
                    player.messageGame(`Type ::wipebankother ${want} confirm to delete all of it. This cannot be undone.`);
                    return true;
                }

                // The same two steps as ::teleother, for the same reasons: a modal open on the
                // target may be the bank grid itself, full of items that are about to stop
                // existing, and closeModal unbinds it (content's [if_close,bank_main] ->
                // @closebank) as well as making canAccess answerable. Without the canAccess check
                // the executeScript below would be refused for a delayed player and the command
                // would do nothing at all, silently.
                other.closeModal();

                if (!other.canAccess()) {
                    player.messageGame(`${want} is busy right now.`);
                    return false;
                }

                const wipe = ScriptProvider.getByName('[proc,bank_wipe_force]');
                if (!wipe) {
                    // a content build from before bank_wipe.rs2
                    return false;
                }

                // Run on the TARGET with protected access, so content's one copy of "what a bank is
                // made of" does the work for this command as well as for ::wipebank: the list, the
                // eight tab counts and the viewed tab. The target's own bank PIN is not asked for,
                // and should not be - this is staff acting on the account, not somebody sitting at
                // its keyboard.
                other.executeScript(ScriptRunner.init(wipe, other), true);

                player.messageGame(`Wiped ${other.displayName}'s bank: ${items} items deleted.`);
                // Said to them because a bank that empties itself with no explanation is a bug
                // report, and because they are going to notice either way.
                other.messageGame('Your bank has been emptied by a staff member.');
                return true;
            } else if (cmd === 'reload') {
                World.reload();
            } else if (cmd === 'rebuild') {
                player.messageGame('Rebuilding scripts...');
                World.rebuild();
            } else if (cmd === 'speed') {
                if (args.length < 1) {
                    player.messageGame('Usage: ::speed <ms>');
                    return false;
                }

                const speed: number = tryParseInt(args.shift(), 20);
                if (speed < 20) {
                    player.messageGame('::speed input was too low.');
                    return false;
                }

                player.messageGame(`World speed was changed to ${speed}ms`);
                World.tickRate = speed;
            } else if (cmd === 'fly') {
                if (player.moveStrategy === MoveStrategy.FLY) {
                    player.moveStrategy = MoveStrategy.SMART;
                } else {
                    player.moveStrategy = MoveStrategy.FLY;
                }

                player.messageGame(`Changed move strategy: ${player.moveStrategy === MoveStrategy.FLY ? 'fly' : 'smart'}`);
            } else if (cmd === 'naive') {
                if (player.moveStrategy === MoveStrategy.NAIVE) {
                    player.moveStrategy = MoveStrategy.SMART;
                } else {
                    player.moveStrategy = MoveStrategy.NAIVE;
                }

                player.messageGame(`Naive move strategy: ${player.moveStrategy === MoveStrategy.NAIVE ? 'naive' : 'smart'}`);
            } else if (cmd === 'random') {
                player.afkEventReady = true;
            }
        }

        if (player.staffModLevel >= 3) {
            // admin commands (potentially destructive for a live economy)

            // custom (2026-09-27) - server-side bots (engine/bot/BotCommands.ts). They only exist
            // where NODE_BOTS=true, the dev world; anywhere else these say so.
            if (cmd === 'bots' || cmd === 'bot') {
                return handleBotCommand(player, cmd, args);
            }

            // custom (2026-09-29) - the script fault reporter (engine/script/ScriptFaults.ts). A
            // script error aborts the whole trigger stack, so a fault buried in a gosub can eat a
            // drop table in silence; this is how staff read what has been thrown without journalctl.
            if (cmd === 'faults') {
                return handleFaultsCommand(player, args);
            }

            // custom (2026-11-04) - turn the input capture on for somebody, which until now
            // NOTHING COULD DO. InputTracking has recorded the cursor, clicks, camera and focus
            // into input_report since long before any of this, gated on input.active - and the
            // only thing that ever set it was a player being reported (World.processReport). The
            // RELAY_TRACK opcode exists, the friend server relays it, and no caller was ever
            // written: so a suspect found by ::botcheck's counts could not be watched.
            //
            // It costs about a megabyte per player-hour, which is why it is per-player and off by
            // default rather than on for the world. ::track with no name lists who is being
            // watched, so it cannot be left on by accident and forgotten.
            if (cmd === 'track' || cmd === 'untrack') {
                const want = args.join('_').toLowerCase();

                if (cmd === 'track' && want.length === 0) {
                    const on: string[] = [];
                    for (const other of World.playerLoop.all()) {
                        if (isClientConnected(other) && other.input.active) {
                            on.push(other.displayName);
                        }
                    }
                    player.messageGame(on.length > 0 ? `Capturing input for: ${on.join(', ')}` : 'Capturing input for nobody.');
                    return true;
                }

                const target = World.getPlayerByUsername(want);
                if (!target || !isClientConnected(target)) {
                    player.messageGame(`${want} is not online.`);
                    return true;
                }

                target.input.active = cmd === 'track';
                player.messageGame(`${cmd === 'track' ? 'Capturing' : 'No longer capturing'} input for ${target.displayName}.`);
                return true;
            }

            // custom (2026-09-29) - which of the build's triggers have ever run
            // (engine/script/ScriptCoverage.ts). The never-reached list is a to-do list nobody can
            // write by hand: there is no way to read off the source which triggers a player can
            // actually get to.
            if (cmd === 'coverage') {
                return handleCoverageCommand(player, args);
            }

            // custom (2026-11-02) - the other half of coverage (engine/script/DeadOps.ts). Coverage
            // says which triggers nothing reached; this says which CLICKS reached nothing, which is
            // the list of options a player can right-click and be told nothing happens.
            if (cmd === 'deadops') {
                return handleDeadOpsCommand(player, args);
            }

            if (cmd === 'bank') {
                // ::bank - open the bank from anywhere.
                //
                // executeScript's second argument is `protect`, and it has to be true here.
                // openbank falls through to the bank PIN keypad when a PIN is set, and
                // bankpin_start_entry's first statement writes %bankpin_flow, a protected varp.
                // Running it unprotected threw "pop_varp %bankpin_flow requires protected
                // access" and dropped the client. (The debugproc dispatch above passes false
                // deliberately - that is why every debugproc calls p_finduid(uid) itself.)
                //
                // Routed via openbank rather than the bankpin_open_bank_real proc it guards, so
                // a set bank PIN is enforced instead of being sidestepped by the cheat.
                if (!player.canAccess()) {
                    player.messageGame('Please finish what you are doing first.');
                    return false;
                }

                const openbank = ScriptProvider.getByName('[label,openbank]');
                if (!openbank) {
                    return false;
                }

                player.executeScript(ScriptRunner.init(openbank, player), true);
                return true;
            }

            // custom (2026-11-15) - ::wipebank, which empties the whole bank instead of making
            // somebody withdraw and drop a few hundred items by hand. Administrator and up, next
            // to ::bank, because the alternative was ::~clearinv bank and a debugproc is
            // owner-only on a live world (the block below) - so an administrator testing on live
            // had no way to do this at all.
            //
            // closeModal FIRST, like ::home. The bank window is a main modal, so it makes
            // canAccess false and the command would have answered "finish what you are doing" to
            // somebody who is looking at the bank they want emptied - which is when this gets
            // typed. Closing it also runs content's [if_close,bank_main] -> @closebank, so the
            // grid is unbound before anything is deleted out from under it, and it leaves the
            // chatbox free for the Yes/No confirm.
            //
            // The work is content's (interface_bank/scripts/bank_wipe.rs2) for the same reason
            // ::bank's is: what has to be reset alongside the inv - the eight tab counts, the
            // viewed tab - is bank interface knowledge and belongs next to the code that
            // maintains it. protect=true because inv_clear on the bank inv is "$inv requires
            // protected access" without it.
            if (cmd === 'wipebank') {
                player.closeModal();

                if (!player.canAccess()) {
                    player.messageGame('Please finish what you are doing first.');
                    return false;
                }

                const wipebank = ScriptProvider.getByName('[proc,bank_wipe]');
                if (!wipebank) {
                    // a content build from before bank_wipe.rs2
                    return false;
                }

                // "::wipebank confirm" skips the confirm box - the repeat case while testing.
                player.executeScript(ScriptRunner.init(wipebank, player, null, [args[0] === 'confirm' ? 1 : 0]), true);
                return true;
            }

            if (cmd === 'setvar') {
                // authentic
                if (args.length < 2) {
                    // ::setvar <variable> <value>
                    // Sets variable to specified value
                    return false;
                }

                const debugname = args[0];
                const value = Math.max(-0x80000000, Math.min(tryParseInt(args[1], 0), 0x7fffffff));

                let varp: VarPlayerType | null = null;
                const varbit = VarBitType.getByName(debugname);
                if (varbit) {
                    varp = VarPlayerType.get(varbit.basevar);

                    if (varp.protect) {
                        player.closeModal();

                        if (!player.canAccess()) {
                            player.messageGame('Please finish what you are doing first.');
                            return false;
                        }

                        player.clearInteraction();
                        player.unsetMapFlag();
                    }
                } else {
                    varp = VarPlayerType.getByName(debugname);
                }

                if (!varp) {
                    return false;
                }

                if (varp.protect) {
                    player.closeModal();

                    if (!player.canAccess()) {
                        player.messageGame('Please finish what you are doing first.');
                        return false;
                    }

                    player.clearInteraction();
                    player.unsetMapFlag();
                }

                if (varbit) {
                    player.setVarBit(varbit.id, value);
                    player.messageGame('set ' + varbit.debugname + ': to ' + value);
                } else {
                    player.setVar(varp.id, value);
                    player.messageGame('set ' + varp.debugname + ': to ' + value);
                }
            } else if (cmd === 'setvarother' && STAFF_WORLD) {
                // custom
                if (args.length < 3) {
                    // ::setvarother <username> <name> <value>
                    return false;
                }

                const other = World.getPlayerByUsername(args[0]);
                if (!other) {
                    player.messageGame(`${args[0]} is not logged in.`);
                    return false;
                }

                const varp = VarPlayerType.getByName(args[1]);
                if (!varp) {
                    return false;
                }

                if (varp.protect) {
                    other.closeModal();

                    if (!other.canAccess()) {
                        player.messageGame(`${args[0]} is busy right now.`);
                        return false;
                    }

                    other.clearInteraction();
                    other.unsetMapFlag();
                }

                const value = Math.max(-0x80000000, Math.min(tryParseInt(args[2], 0), 0x7fffffff));
                other.setVar(varp.id, value);
                player.messageGame('set ' + args[1] + ': to ' + value + ' on ' + other.username);
            } else if (cmd === 'getvar') {
                // authentic
                if (args.length < 1) {
                    // ::getvar <variable>
                    // Displays value of specified variable
                    return false;
                }

                const debugname = args[0];

                let varp: VarPlayerType | null = null;
                const varbit = VarBitType.getByName(debugname);
                if (varbit) {
                    varp = VarPlayerType.get(varbit.basevar);

                    if (varp.protect) {
                        player.closeModal();

                        if (!player.canAccess()) {
                            player.messageGame('Please finish what you are doing first.');
                            return false;
                        }

                        player.clearInteraction();
                        player.unsetMapFlag();
                    }
                } else {
                    varp = VarPlayerType.getByName(debugname);
                }

                if (!varp) {
                    return false;
                }

                if (varbit) {
                    const value = player.getVarBit(varbit.id);
                    player.messageGame('get ' + varbit.debugname + ': ' + value);
                } else {
                    const value = player.getVar(varp.id);
                    player.messageGame('get ' + varp.debugname + ': ' + value);
                }
            } else if (cmd === 'getvarother' && STAFF_WORLD) {
                // custom
                if (args.length < 2) {
                    // ::getvarother <username> <variable>
                    return false;
                }

                const other = World.getPlayerByUsername(args[0]);
                if (!other) {
                    player.messageGame(`${args[0]} is not logged in.`);
                    return false;
                }

                const varp = VarPlayerType.getByName(args[1]);
                if (!varp) {
                    return false;
                }

                const value = other.getVar(varp.id);
                player.messageGame('get ' + varp.debugname + ': ' + value + ' on ' + other.username);
            } else if (cmd === 'give') {
                // authentic
                if (args.length < 1) {
                    // ::give <item> (amount)
                    // Adds the items(s) to your inventory
                    return false;
                }

                const obj = ObjType.getId(args[0]);
                if (obj === -1) {
                    return false;
                }

                const count = Math.max(1, Math.min(tryParseInt(args[1], 1), 0x7fffffff));
                player.invAdd(InvType.INV, obj, count);
            } else if (cmd === 'voteledger') {
                // custom (2026-10-27) - credit a vote as if a site had reported one, for testing
                // the claim path with no site configured and for making good a vote a site lost.
                // It goes through the ledger like any other, so it is in the audit trail, it is
                // delivered the same way, and it cannot be claimed twice.
                //
                // ::voteledger                     what the ledger knows about you
                // ::voteledger <username> [count]  credit that player, as the site "staff"
                //
                // IT WAS ::vote UNTIL 16 NOVEMBER 2026, and the name went to the players: bare
                // ::vote now opens the website's voting page in a browser, with the player's name
                // already in it, which is what somebody typing it almost always wanted. An
                // administrator command had the better name and the smaller audience. Renamed
                // rather than kept as an alias on purpose - two spellings of a command that credits
                // tickets is one more than anybody needs to know about.
                if (args.length < 1) {
                    const owed = VoteService.owed(player.username);
                    const sites = VoteSites.count();
                    player.messageGame(`vote: ${sites} site(s) configured, ${owed} ticket(s) owed to you`);
                    for (const row of VoteService.ledger().history(player.username, 5)) {
                        player.messageGame(`  ${new Date(row.cast_at).toISOString()} ${row.site} x${row.tickets}`);
                    }
                    return true;
                }

                const who = args[0];
                const count = Math.max(1, Math.min(tryParseInt(args[1], 1), 1000));
                const ref = `staff:${player.username}:${Date.now()}`;
                VoteService.ledger().credit('staff', ref, who, count, Date.now(), 0);
                VoteService.deliver(who);
                player.messageGame(`vote: credited ${count} to ${who}`);
            } else if (cmd === 'veteran') {
                // custom (2026-11-06) - the rank for the players who tested before launch. The
                // account does not have to be logged in: the list is worked through after the
                // wipe, when most of them will not be.
                //
                // ::veteran <username>      give it
                // ::veteran <username> off  take it back
                if (args.length < 1) {
                    player.messageGame('Usage: ::veteran <username> [off]');
                    return false;
                }

                // The name is everything except a trailing "off", because a display name with a
                // space in it has already been split into two arguments by the time it gets here.
                // ::ban and ::mute take args[0] alone and quietly act on the wrong name when one
                // is typed that way; this is given out by hand from a list of display names, so it
                // takes "Bob Smith" and "bob_smith" alike.
                const grant = args[args.length - 1] !== 'off';
                const name = (grant ? args : args.slice(0, -1)).join(' ');
                if (name.length === 0) {
                    player.messageGame('Usage: ::veteran <username> [off]');
                    return false;
                }

                const filed = World.requestVeteran(player.username, name, grant);
                if (filed === null) {
                    player.messageGame(`veteran: ${name} is already being changed, or is not a name.`);
                } else {
                    player.messageGame(`veteran: ${grant ? 'granting' : 'removing'}...`);
                }
            } else if (cmd === 'helper') {
                // custom (2026-11-11) - the Helper rank: a player who answers other players'
                // questions. It grants nothing, which is the point - it can be given out freely
                // and taken back without it being a demotion.
                //
                // ::helper <username>      make them one
                // ::helper <username> off  take it back
                //
                // The name is everything except a trailing "off", for the reason ::veteran above
                // gives: a display name with a space in it arrives here already split in two.
                if (args.length < 1) {
                    player.messageGame('Usage: ::helper <username> [off]');
                    return false;
                }

                const grant = args[args.length - 1] !== 'off';
                const name = (grant ? args : args.slice(0, -1)).join(' ');
                if (name.length === 0) {
                    player.messageGame('Usage: ::helper <username> [off]');
                    return false;
                }

                const filed = World.requestHelper(player.username, name, grant);
                if (filed === null) {
                    player.messageGame(`helper: ${name} is already being changed, or is not a name.`);
                } else {
                    player.messageGame(`helper: ${grant ? 'granting' : 'removing'}...`);
                }
            } else if (cmd === 'giveother' && STAFF_WORLD) {
                // custom
                if (args.length < 2) {
                    // ::giveother <username> <item> (amount)
                    return false;
                }

                const other = World.getPlayerByUsername(args[0]);
                if (!other) {
                    player.messageGame(`${args[0]} is not logged in.`);
                    return false;
                }

                const obj = ObjType.getId(args[1]);
                if (obj === -1) {
                    return false;
                }

                const count = Math.max(1, Math.min(tryParseInt(args[2], 1), 0x7fffffff));
                other.invAdd(InvType.INV, obj, count);
            } else if (cmd === 'givecrap') {
                // authentic (we don't know the exact specifics of this...)

                // Fills your inventory with random items
                for (let i = 0; i < 28; i++) {
                    let random = -1;
                    while (random === -1) {
                        random = Math.trunc(Math.random() * ObjType.count);
                        const obj = ObjType.get(random);
                        if ((!Environment.NODE_MEMBERS && obj.members) || obj.dummyitem !== 0 || obj.certtemplate !== -1) {
                            random = -1;
                        }
                    }

                    player.invAdd(InvType.INV, random, 1);
                }
            } else if (cmd === 'givemany') {
                // authentic
                if (args.length < 1) {
                    // ::givemany <item>
                    // Adds up to 1000 of the item to your inventory
                    return false;
                }

                const obj = ObjType.getId(args[0]);
                if (obj === -1) {
                    return false;
                }

                player.invAdd(InvType.INV, obj, 1000);
            } else if (cmd === 'broadcast' && STAFF_WORLD) {
                // custom - a staff announcement to every player. (2026-09-23) Built by
                // [proc,broadcast_staff] in content, beside the drops and ::yell, so it carries the
                // sender's crown and the announcement styling. Staff text keeps its @col@ tags - the
                // rank check above is the trust. The old guard, args.length < 0, could never be true,
                // so an empty ::broadcast sent every player a blank line.
                const text = cheat.substring(cmd.length + 1).trim();
                if (text.length <= 0) {
                    return false;
                }

                const script = ScriptProvider.getByName('[proc,broadcast_staff]');
                if (script) {
                    player.executeScript(ScriptRunner.init(script, player, null, [text]), false);
                } else {
                    World.broadcastMes(text);
                }
            } else if (cmd === 'reboot' && STAFF_WORLD) {
                // semi-authentic - we actually just shut down for maintenance

                // Reboots the game world, applying packed changes
                World.rebootTimer(0);
            } else if (cmd === 'slowreboot' && STAFF_WORLD) {
                // semi-authentic - we actually just shut down for maintenance
                if (args.length < 1) {
                    // ::slowreboot <seconds>
                    // Reboots the game world, with a timer
                    return false;
                }

                World.rebootTimer(Math.ceil((tryParseInt(args[0], 30) * 1000) / 600));
            } else if (cmd === 'serverdrop') {
                // testing reconnection behavior
                player.terminate();
            } else if (cmd === 'teleother' && STAFF_WORLD) {
                // custom
                if (args.length < 1) {
                    // ::teleother <username>
                    return false;
                }

                const other = World.getPlayerByUsername(args[0]);
                if (!other) {
                    player.messageGame(`${args[0]} is not logged in.`);
                    return false;
                }

                other.closeModal();

                if (!other.canAccess()) {
                    player.messageGame(`${args[0]} is busy right now.`);
                    return false;
                }

                other.clearInteraction();
                other.unsetMapFlag();

                other.teleJump(player.x, player.z, player.level);
            } else if (cmd === 'setstat') {
                // authentic
                if (args.length < 2) {
                    // ::setstat <skill> <level>
                    // Sets the skill to specified level
                    return false;
                }

                const stat = PlayerStatMap.get(args[0].toUpperCase());
                if (typeof stat === 'undefined') {
                    return false;
                }

                // Before the stat moves, so the milestone this would have caused is already
                // suppressed when it lands - Player.markMilestonesCheated.
                player.markMilestonesCheated();
                player.setLevel(stat, parseInt(args[1]));
            } else if (cmd === 'advancestat') {
                // authentic
                if (args.length < 1) {
                    // ::advancestat <skill> <level>
                    // Advances skill to specified level, generates level up message etc.
                    return false;
                }

                const stat = PlayerStatMap.get(args[0].toUpperCase());
                if (typeof stat === 'undefined') {
                    return false;
                }

                player.markMilestonesCheated();
                player.stats[stat] = 0;
                player.baseLevels[stat] = 1;
                player.levels[stat] = 1;
                player.addXp(stat, getExpByLevel(parseInt(args[1])), false);
            } else if (cmd === 'minme') {
                // like maxme debugproc, but in engine because xp goes down
                player.markMilestonesCheated();
                for (let i = 0; i < PlayerStatEnabled.length; i++) {
                    if (i === PlayerStat.HITPOINTS) {
                        player.setLevel(i, 10);
                    } else {
                        player.setLevel(i, 1);
                    }
                }
            } else if (cmd === 'locadd') {
                // authentic - https://youtu.be/E6tQ3b3vzro?t=3194
                if (args.length < 1) {
                    return false;
                }
                const name: string = args[0];
                const type: LocType | null = LocType.getByName(name);
                if (!type) {
                    return false;
                }
                World.addLoc(new Loc(player.level, player.x, player.z, type.width, type.length, EntityLifeCycle.DESPAWN, type.id, LocShape.CENTREPIECE_STRAIGHT, LocAngle.WEST), 500);
                player.messageGame(`Loc Added: ${name} (ID: ${type.id})`);
            } else if (cmd === 'npcadd') {
                // authentic - https://youtu.be/E6tQ3b3vzro?t=3412
                if (args.length < 1) {
                    return false;
                }
                const name: string = args[0];
                const type: NpcType | null = NpcType.getByName(name);
                if (!type) {
                    return false;
                }
                World.addNpc(new Npc(player.level, player.x, player.z, type.size, type.size, EntityLifeCycle.DESPAWN, World.getNextNid(), type.id, type.blockwalk), 500);
            } else if (cmd === 'openmain') {
                if (args.length < 1) {
                    return false;
                }

                const name: string = args[0];
                const type: Component | null = Component.getByName(name);

                if (!type || type.rootLayer !== type.id) {
                    return false;
                }

                player.openMainModal(type.id);
            } else if (cmd === 'openoverlay') {
                if (args.length < 1) {
                    return false;
                }

                const name: string = args[0];
                const type: Component | null = Component.getByName(name);

                if (!type || type.rootLayer !== type.id) {
                    return false;
                }

                player.openMainOverlay(type.id);
            } else if (cmd === 'closeoverlay') {
                player.openMainOverlay(-1);
            } else if (cmd === 'snapshot') {
                const heap = v8.writeHeapSnapshot();
                printDebug(`Heap snapshot written to: ${heap}`);
            }
        }

        // custom (2026-11-14) - HELPERS GET THE STAFF ZONE, which is why this sits in a gate of
        // its own rather than in the moderator block below. A Helper is not a staffModLevel: it is
        // a flag on Player set from the login server, and their level is 0 - inside that block they
        // would never be reached at all.
        //
        // WORTH KNOWING WHAT IT COSTS. ::helper's own comment says the rank "grants nothing, which
        // is the point - it can be given out freely and taken back without it being a demotion".
        // After this it grants one thing, so handing it out becomes a decision about who may stand
        // in the staff zone. Asked for on 14 November; written here because the comment it
        // contradicts is two files away.
        if (player.staffModLevel >= 2 || player.helper) {
            if (cmd === 'sz') {
                // custom (2026-11-11) - the staff zone: map square 22_56, which nothing on the map
                // borders and no path reaches. Content builds the square (content/tools/genstaffzone.py)
                // and owns the teleport (content/scripts/staff_zone/scripts/staff_zone.rs2); what the
                // engine owns is who may type this, which is the block it sits in - moderator and above.
                // ::home is the way out, from in there like from anywhere else.
                //
                // The other half of "staff only" is content's [proc,staffzone_login]: ::teleother can put
                // a player in there, and a rank can be taken away from an account logged out in there,
                // and neither of those goes through this command.
                player.closeModal();

                if (!player.canAccess()) {
                    player.messageGame('Please finish what you are doing first.');
                    return false;
                }

                // A moderator is held to the same rule as on ::home - a staff zone two keystrokes away
                // is a way out of a fight otherwise. An administrator is not.
                if (player.staffModLevel < 3) {
                    const refusal: string | null = freeTeleportRefusal(player, 'to the staff zone');
                    if (refusal !== null) {
                        player.messageGame(refusal);
                        return false;
                    }
                }

                player.clearInteraction();
                player.unsetMapFlag();

                const script = ScriptProvider.getByName('[proc,staffzone_teleport]');
                if (!script) {
                    // a content build from before staff_zone.rs2
                    player.messageGame("You can't teleport to the staff zone right now.");
                    return false;
                }

                player.executeScript(ScriptRunner.init(script, player), true);
                return true;
            }
        }

        if (player.staffModLevel >= 2) {
            // "super-moderator" commands (similar to a jmod but we don't know their command capabilities on live)

            if (cmd === 'getcoord') {
                // authentic

                // Displays current coordinate
                player.messageGame(CoordGrid.formatString(player.level, player.x, player.z, ','));
            } else if (cmd === 'tele') {
                // authentic - https://youtu.be/60Y3y375VYA?t=980
                if (args.length < 1) {
                    // ::tele x,xx,xx[,xx,xx]
                    // Teleports you to the coordinate. In order, the parts are level, horizontal map square, vertical map square, horizontal tile, vertical tile.
                    return false;
                }

                const coord = args[0].split(',');
                if (coord.length < 3) {
                    return false;
                }

                player.closeModal();

                if (!player.canAccess()) {
                    player.messageGame('Please finish what you are doing first.');
                    return false;
                }

                player.clearInteraction();
                player.unsetMapFlag();

                const level = tryParseInt(coord[0], 0);
                const mx = tryParseInt(coord[1], 50);
                const mz = tryParseInt(coord[2], 50);
                const lx = tryParseInt(coord[3], 32);
                const lz = tryParseInt(coord[4], 32);

                if (level < 0 || level > 3 || mx < 0 || mx > 255 || mz < 0 || mz > 255 || lx < 0 || lx > 63 || lz < 0 || lz > 63) {
                    return false;
                }

                player.teleJump((mx << 6) + lx, (mz << 6) + lz, level);
            } else if (cmd === 'teleto' && STAFF_WORLD) {
                // custom
                if (args.length < 1) {
                    return false;
                }

                // ::teleto <username>
                const other = World.getPlayerByUsername(args[0]);
                if (!other) {
                    player.messageGame(`${args[0]} is not logged in.`);
                    return false;
                }

                player.closeModal();

                if (!player.canAccess()) {
                    player.messageGame('Please finish what you are doing first.');
                    return false;
                }

                player.clearInteraction();
                player.unsetMapFlag();

                player.teleJump(other.x, other.z, other.level);
            } else if (cmd === 'setvis' && STAFF_WORLD) {
                // authentic
                if (args.length < 1) {
                    // ::setvis <level>
                    return false;
                }

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
            } else if (cmd === 'ban' && STAFF_WORLD) {
                // custom
                if (args.length < 2) {
                    // ::ban <username> <minutes>
                    player.messageGame('Usage: ::ban <username> <minutes>');
                    return false;
                }

                const username = args[0];
                const minutes = Math.max(0, tryParseInt(args[1], 60));

                World.notifyPlayerBan(player.username, username, Date.now() + minutes * 60 * 1000);
                player.messageGame(`Player '${args[0]}' has been banned for ${minutes} minutes.`);
            } else if (cmd === 'mute' && STAFF_WORLD) {
                // custom
                if (args.length < 2) {
                    // ::mute <username> <minutes>
                    player.messageGame('Usage: ::mute <username> <minutes>');
                    return false;
                }

                const username = args[0];
                const minutes = Math.max(0, tryParseInt(args[1], 60));

                World.notifyPlayerMute(player.username, username, Date.now() + minutes * 60 * 1000);
                player.messageGame(`Player '${args[0]}' has been muted for ${minutes} minutes.`);
            } else if (cmd === 'kick' && STAFF_WORLD) {
                // custom
                if (args.length < 1) {
                    // ::kick <username>
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
                    player.messageGame(`Player '${args[0]}' has been kicked from the game.`);
                } else {
                    player.messageGame(`Player '${args[0]}' does not exist or is not logged in.`);
                }
            }
        }

        return true;
    }
}
