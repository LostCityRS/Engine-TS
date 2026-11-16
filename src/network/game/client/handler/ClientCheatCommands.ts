import Environment from '#/util/Environment.js';
import Player from '#/engine/entity/Player.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import World from '#/engine/World.js';

// WHICH STAFF COMMANDS EXIST ON WHICH WORLD (2026-10-07).
//
// A world with NODE_PRODUCTION=false promotes every login to at least staff level 4 (LoginThread:
// "dev (destructive commands) - AT LEAST 4"), so on an OPEN development world the rank checks in
// ClientCheatHandler mean nothing, and the commands that reach other players or the whole world -
// teleto, teleother, giveother, setvarother, broadcast, reboot, ban, mute, kick - would belong to
// anyone who connected. Being production-only was standing in for that.
//
// A STAFF-ONLY WORLD IS NOT AN OPEN ONE. NODE_MIN_STAFF_LEVEL refuses anybody below it at login
// (LoginThread.belowStaffLevel) before the promotion ever happens, so everyone on the dev world was
// already staff, and a moderator there should have the moderator commands they have on live.
//
// Lives here rather than in the handler because ::commands has to answer for the same rule: a
// command the handler silently does not have must be a command ::commands does not list.
export const STAFF_WORLD = Environment.NODE_PRODUCTION || Environment.NODE_MIN_STAFF_LEVEL >= 2;

type Cheat = {
    /** Without the "::". */
    name: string;
    /** The arguments as they are typed, <required> and [optional]. */
    args?: string;
    /** One line, in the chatbox, for somebody who has never run it. */
    what: string;
    /** The staffModLevel the handler asks for. */
    rank: number;
    /** The lower rank a development world accepts, where the handler has one (the ::speed block). */
    devRank?: number;
    /** True for the commands withheld on an open development world - the STAFF_WORLD rule above. */
    staffWorld?: boolean;
    /** True where a Helper may run it too, whatever their staffModLevel - which for a Helper is 0. */
    helper?: boolean;
};

// EVERY COMMAND ClientCheatHandler DISPATCHES, and nothing else. The handler is the authority on
// what runs; this is the authority on what is said about it, and the two drift apart the moment
// somebody adds a command and not a line here - which is what tools/sim/commandslist.ts is for: it
// reads the handler's own "cmd === '...'" dispatch out of the source and fails if the two disagree,
// in either direction, including over which ones carry the STAFF_WORLD flag.
export const CHEATS: Cheat[] = [
    // ANYBODY. Players use these; they are not staff tools and most of them are ours, not Jagex's.
    { name: 'home', what: 'teleport to Edgeville - not in combat, not from the Wilderness', rank: 0 },
    { name: 'changepassword', args: '<current> <new> <new again>', what: 'change your password, all lowercase', rank: 0 },
    { name: 'forgetlogins', what: 'cancel every saved login for your account, on every computer', rank: 0 },
    { name: 'discord', args: '[unlink]', what: 'a code to link this account to our Discord, for trading post alerts', rank: 0 },
    { name: 'bug', args: '<what went wrong>', what: 'report a bug from where it happened - it reaches the staff', rank: 0 },
    { name: 'yell', args: '<message>', what: 'a line to every player on the world, once every 10 seconds', rank: 0 },
    { name: 'commands', args: '[name|debug]', what: 'this list, or what one command does', rank: 0 },

    // MODERATOR.
    { name: 'sz', what: 'teleport to the staff zone - ::home is the way out of it', rank: 2, helper: true },
    { name: 'getcoord', what: 'print the coordinate you are standing on', rank: 2 },
    { name: 'tele', args: '<level,mx,mz[,lx,lz]>', what: 'teleport to a coordinate, as ::getcoord prints it', rank: 2 },
    { name: 'teleto', args: '<username>', what: 'teleport yourself to a player', rank: 2, staffWorld: true },
    { name: 'setvis', args: '<0|1|2>', what: 'who can see you: 0 everyone, 2 nobody (1 is not implemented)', rank: 2, staffWorld: true },
    { name: 'ban', args: '<username> <minutes>', what: 'ban an account for a while', rank: 2, staffWorld: true },
    { name: 'mute', args: '<username> <minutes>', what: 'stop an account talking for a while', rank: 2, staffWorld: true },
    { name: 'kick', args: '<username>', what: 'drop a player from the game', rank: 2, staffWorld: true },

    // ADMINISTRATOR. Destructive for a live economy, so these stop at 3 and do not promote.
    { name: 'bots', args: '[on|off]', what: "the dev world's bots: what they are all doing, or stop them", rank: 3 },
    { name: 'bot', args: '<spawn|despawn|goto|info|kits|fuzz>', what: 'one bot - spawn it, follow it, read it', rank: 3 },
    // The other half of ::bot fuzz: its counts name a suspect, and these two watch one. They are
    // here because the handler runs them and this list is what tells anybody they exist - without
    // these entries an administrator had both commands and no way to find out, which is what
    // commandslist caught. The rank is the handler's own (staffModLevel >= 3, the block they sit
    // in), and there is no staffWorld flag because the handler does not ask for one.
    { name: 'track', args: '[username]', what: "start capturing a player's input, or list who is being captured", rank: 3 },
    { name: 'untrack', args: '<username>', what: "stop capturing that player's input", rank: 3 },
    { name: 'faults', args: '[sig|clear]', what: 'the script errors this world has thrown, worst first', rank: 3 },
    { name: 'coverage', args: '[never|write|clear]', what: "which of the build's triggers have ever run", rank: 3 },
    { name: 'deadops', args: '[list|write|clear]', what: 'options that answered "Nothing interesting happens." - the to-do list', rank: 3 },
    { name: 'bank', what: 'open your bank from anywhere (your bank PIN still applies)', rank: 3 },
    { name: 'wipebank', args: '[confirm]', what: 'delete everything in your own bank - asks first, unless you type confirm', rank: 3 },
    { name: 'setvar', args: '<variable> <value>', what: 'write one of your own varps or varbits', rank: 3 },
    { name: 'getvar', args: '<variable>', what: 'read one of your own varps or varbits', rank: 3 },
    { name: 'setvarother', args: '<username> <variable> <value>', what: "write a varp on somebody else's account", rank: 3, staffWorld: true },
    { name: 'getvarother', args: '<username> <variable>', what: "read a varp on somebody else's account", rank: 3, staffWorld: true },
    { name: 'give', args: '<item> [amount]', what: 'put an item in your inventory', rank: 3 },
    { name: 'giveother', args: '<username> <item> [amount]', what: "put an item in a player's inventory", rank: 3, staffWorld: true },
    { name: 'givecrap', what: 'fill your inventory with 28 random items', rank: 3 },
    { name: 'givemany', args: '<item>', what: '1000 of an item', rank: 3 },
    // ::vote ITSELF BELONGS TO THE PLAYERS NOW (2026-11-16): bare ::vote is handled in the client
    // and opens the website's voting page with the player's name in it. This is the ledger half,
    // which is what an administrator actually wants and which nobody types by accident.
    { name: 'voteledger', args: '[username] [count]', what: 'what the vote ledger knows, or credit a player a vote', rank: 3 },
    // No staffWorld flag, unlike ::ban and ::mute, which also write an account row. That flag is
    // for commands that could be used AGAINST somebody on an open development world, where every
    // login is promoted to 4; this one only adds a chat icon, and a development world's accounts
    // are its own database anyway.
    { name: 'veteran', args: '<username> [off]', what: 'give a player the Veteran rank, or take it back', rank: 3 },
    { name: 'helper', args: '<username> [off]', what: 'make a player a Helper, or take it back', rank: 3 },
    { name: 'broadcast', args: '<message>', what: 'a staff announcement to every player, with your crown', rank: 3, staffWorld: true },
    { name: 'reboot', what: 'shut the world down now, applying packed changes', rank: 3, staffWorld: true },
    { name: 'slowreboot', args: '<seconds>', what: 'the same, after a countdown every client can see', rank: 3, staffWorld: true },
    { name: 'teleother', args: '<username>', what: 'teleport a player to you', rank: 3, staffWorld: true },
    { name: 'serverdrop', what: 'drop your own connection, to test reconnecting', rank: 3 },
    { name: 'setstat', args: '<skill> <level>', what: 'set one of your levels, up or down', rank: 3 },
    { name: 'advancestat', args: '<skill> <level>', what: 'the experience for a level, as experience', rank: 3 },
    { name: 'minme', what: 'every level back to 1 (hitpoints 10)', rank: 3 },
    { name: 'locadd', args: '<loc>', what: 'put a scenery object where you stand, for 500 ticks', rank: 3 },
    { name: 'npcadd', args: '<npc>', what: 'put an npc where you stand, for 500 ticks', rank: 3 },
    { name: 'openmain', args: '<interface>', what: 'open an interface as a main modal', rank: 3 },
    { name: 'openoverlay', args: '<interface>', what: 'open an interface as an overlay', rank: 3 },
    { name: 'closeoverlay', what: 'close that overlay again', rank: 3 },
    { name: 'snapshot', what: "write a V8 heap snapshot in the server's working directory", rank: 3 },

    // DEVELOPER, ON LIVE TOO. Nothing here touches another player or the economy.
    { name: 'godmode', what: 'stop taking damage and keep every stat up, for testing a boss', rank: 4 },

    // OWNER on a live world; a DEVELOPER has them on a development world. Any of these can stop or
    // wreck the world it is run on - and the first one destroys another player's property, which
    // nothing else at any rank does.
    { name: 'wipebankother', args: '<username> [confirm]', what: "delete everything in another player's bank - they must be online, and it cannot be undone", rank: 5, devRank: 4, staffWorld: true },
    { name: 'reload', what: 'reload the packed content build without a reboot', rank: 5, devRank: 4 },
    { name: 'rebuild', what: 'rebuild the scripts from source, then reload them', rank: 5, devRank: 4 },
    { name: 'speed', args: '<ms>', what: "the world's tick rate in milliseconds (600 is normal)", rank: 5, devRank: 4 },
    { name: 'fly', what: 'walk through everything, or stop', rank: 5, devRank: 4 },
    { name: 'naive', what: 'the naive pathfinder instead of the real one, or stop', rank: 5, devRank: 4 },
    { name: 'random', what: 'arm your next random event (::~random_event is the one that spawns one)', rank: 5, devRank: 4 }
];

const RANK_NAMES = ['player', 'player moderator', 'moderator', 'administrator', 'developer', 'owner'];

export function rankName(level: number): string {
    return RANK_NAMES[Math.min(Math.max(level, 0), RANK_NAMES.length - 1)];
}

/** The rank this world asks for - a development world lets a developer have the owner commands. */
function bar(cheat: Cheat): number {
    return !Environment.NODE_PRODUCTION && cheat.devRank !== undefined ? cheat.devRank : cheat.rank;
}

/** True when the world, not the rank, is what is stopping it: the STAFF_WORLD rule. */
function withheld(cheat: Cheat): boolean {
    return cheat.staffWorld === true && !STAFF_WORLD;
}

export function cheatAllowed(cheat: Cheat, staffModLevel: number, helper: boolean = false): boolean {
    return (staffModLevel >= bar(cheat) || (cheat.helper === true && helper)) && !withheld(cheat);
}

/** ::~<name> for every [debugproc,] in the content build, in the order they would be typed. */
export function debugprocNames(): string[] {
    const names: string[] = [];
    for (let id = 0; id < ScriptProvider.count; id++) {
        const name = ScriptProvider.get(id)?.name;
        if (name !== undefined && name.startsWith('[debugproc,')) {
            names.push(name.slice('[debugproc,'.length, -1));
        }
    }
    return names.sort();
}

/** The handler's own bar for the debugproc prefix and the ::speed block. */
function hasDebugprocs(staffModLevel: number): boolean {
    return staffModLevel >= 5 || (!Environment.NODE_PRODUCTION && staffModLevel >= 4);
}

function line(cheat: Cheat): string {
    return `::${cheat.name}${cheat.args ? ' ' + cheat.args : ''} - ${cheat.what}`;
}

// custom (2026-10-07) - ::commands, for every player.
//
// Asked for (Corey) because a command you do not have says NOTHING AT ALL: the handler falls out of
// the rank block and the message is never answered, which is indistinguishable from a typo, from a
// command that was renamed, and from the bug above where eleven of them did not exist on the dev
// world at all. One command that says what you have answers all three.
//
// It lists what the player can actually run on THIS world, through the same two functions the
// handler is held to - so an open development world does not list ::ban, and a live world does not
// list ::speed to a developer. What is missing is said out loud rather than left out silently,
// because "why is this not here" is the question that sent us here in the first place.
export default function handleCommandsCommand(player: Player, args: string[]): boolean {
    const level = player.staffModLevel;
    const sub = args[0];

    if (sub === 'debug') {
        if (!hasDebugprocs(level)) {
            player.wrappedMessageGame('Debugprocs need owner (5) on a live world, developer (4) on a development one.');
            player.wrappedMessageGame(`You are ${rankName(level)} (${level}).`);
            return true;
        }
        const names = debugprocNames();
        if (names.length === 0) {
            player.messageGame('This build has no debugprocs.');
            return true;
        }
        player.wrappedMessageGame(`${names.length} debugprocs, each run as ::${Environment.NODE_DEBUGPROC_CHAR}name:`);
        player.wrappedMessageGame(names.join(', '));
        return true;
    }

    if (sub !== undefined && sub.length > 0) {
        // ::commands <name>, however it was typed: "::commands ::teleto" and "::commands ~maxme" are
        // both somebody asking about a command they have seen written down.
        const name = sub.replace(/^:+/, '').replace(new RegExp(`^${Environment.NODE_DEBUGPROC_CHAR}`), '');
        const cheat = CHEATS.find(c => c.name === name);

        if (cheat) {
            player.wrappedMessageGame(line(cheat));
            const need = bar(cheat);
            if (withheld(cheat)) {
                // Two short lines rather than one long one: the chatbox wraps at 456 pixels, and a
                // sentence that wraps mid-clause is read as two halves of nothing.
                player.wrappedMessageGame(`Not on this world: NODE_MIN_STAFF_LEVEL is ${Environment.NODE_MIN_STAFF_LEVEL}.`);
                player.wrappedMessageGame('Every login here is promoted, so this would belong to anyone.');
            } else if (level >= need) {
                player.wrappedMessageGame(need === 0 ? 'Every player can use this.' : `Needs ${rankName(need)} (${need}) - you have it.`);
            } else {
                player.wrappedMessageGame(`Needs ${rankName(need)} (${need}) - you are ${rankName(level)} (${level}).`);
            }
            return true;
        }

        // Not an engine command. It may still be a content debugproc, which is the other half of
        // what anybody means by "a command" - and ::random against ::~random_event is the exact
        // confusion this answers.
        if (ScriptProvider.getByName(`[debugproc,${name}]`)) {
            const how = `::${Environment.NODE_DEBUGPROC_CHAR}${name} is a content debugproc.`;
            player.wrappedMessageGame(hasDebugprocs(level) ? `${how} You have it - mind the ${Environment.NODE_DEBUGPROC_CHAR}.` : `${how} Needs owner (5) on a live world, developer (4) on a development world.`);
            return true;
        }

        player.wrappedMessageGame(`There is no ::${name}. ::commands for what you have.`);
        return true;
    }

    // One line, which is why it is this short: the chatbox wraps at 456 pixels and an administrator's
    // name and world together would have run onto a second message before a single command was named.
    const world = Environment.NODE_PRODUCTION ? 'this world' : STAFF_WORLD ? 'a staff-only development world' : 'an open development world';
    player.wrappedMessageGame(`Commands for ${rankName(level)} (rights ${level}) on ${world}:`);

    // Grouped by the rank that unlocks them, which is how somebody reads their own list: the first
    // group is theirs as a player, and everything under it came with a promotion.
    const mine = CHEATS.filter(c => cheatAllowed(c, level, player.helper));
    const bars = [...new Set(mine.map(bar))].sort((a, b) => a - b);
    for (const need of bars) {
        const group = mine
            .filter(c => bar(c) === need)
            .map(c => `::${c.name}`)
            .sort();
        const label = need === 0 ? 'Everyone' : `${rankName(need).charAt(0).toUpperCase()}${rankName(need).slice(1)} (${need})`;
        player.wrappedMessageGame(`${label}: ${group.join(', ')}`);
    }

    if (hasDebugprocs(level)) {
        player.wrappedMessageGame(`Content: ::${Environment.NODE_DEBUGPROC_CHAR}name runs a debugproc - ::commands debug lists all ${debugprocNames().length} of them.`);
    }

    // What is NOT in the list, and why - said only to staff, who are the ones who would otherwise go
    // looking for it in the source.
    if (level >= 2) {
        const byWorld = CHEATS.filter(c => withheld(c) && level >= bar(c)).map(c => `::${c.name}`);
        if (byWorld.length > 0) {
            player.wrappedMessageGame('Off on an open development world, where every login is promoted:');
            player.wrappedMessageGame(byWorld.sort().join(', '));
        }

        const higher = CHEATS.filter(c => !withheld(c) && level < bar(c));
        if (higher.length > 0) {
            player.wrappedMessageGame(`${higher.length} more at a higher rank.`);
        }
    }

    if (!World.discordEnabled) {
        player.messageGame('(::discord does nothing here - this world has no Discord.)');
    }

    player.wrappedMessageGame('::commands <name> for what one does and what it needs - try ::commands yell.');
    return true;
}
