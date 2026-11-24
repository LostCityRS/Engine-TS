// A PvP/PvM simulation harness that drives the REAL engine: real World.cycle(), real compiled
// content scripts, real map. Nothing here models the engine - it boots it and steps it by hand.
import World from '#/engine/World.js';
import Player from '#/engine/entity/Player.js';
import Npc from '#/engine/entity/Npc.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import ScriptPointer from '#/engine/script/ScriptPointer.js';
import ScriptState from '#/engine/script/ScriptState.js';
import ObjType from '#/cache/config/ObjType.js';
import { isHiddenOp, locCanOp } from '#/cache/config/OpVisibility.js';
import ParamType from '#/cache/config/ParamType.js';
import LocType from '#/cache/config/LocType.js';
import CategoryType from '#/cache/config/CategoryType.js';
import NpcType from '#/cache/config/NpcType.js';
import InvType from '#/cache/config/InvType.js';
import VarPlayerType from '#/cache/config/VarPlayerType.js';
import VarBitType from '#/cache/config/VarBitType.js';
import VarNpcType from '#/cache/config/VarNpcType.js';
import Component from '#/cache/config/Component.js';
import SynthSound from '#/network/game/server/model/SynthSound.js';
import IfOpenMain from '#/network/game/server/model/IfOpenMain.js';
import IfSetText from '#/network/game/server/model/IfSetText.js';
import IfSetInvOp from '#/network/game/server/model/IfSetInvOp.js';
import IfSetObject from '#/network/game/server/model/IfSetObject.js';
import IfSetRotation from '#/network/game/server/model/IfSetRotation.js';
import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';
import fs from 'fs';
import Environment from '#/util/Environment.js';
import { NpcMode } from '#/engine/entity/NpcMode.js';
import { PlayerStatMap } from '#/engine/entity/PlayerStat.js';
import { toBase37 } from '#/util/JString.js';
import { EntityLifeCycle } from '#/engine/entity/EntityLifeCycle.js';
import { Interaction } from '#/engine/entity/Interaction.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import OpHeldU from '#/network/game/client/model/OpHeldU.js';
import OpHeldUHandler from '#/network/game/client/handler/OpHeldUHandler.js';
import { findPathToEntity, findPathToLoc, isMapBlocked, reachedEntity } from '#/engine/GameMap.js';
import JavaRandom from '#/util/JavaRandom.js';

// 'nid' is the npc's own index, so a hit can be attributed to ONE npc rather than to every npc
// sharing its debugname. Without it a sim measuring "how often does my target get poisoned per
// hit" counted hits on every npc in the world: huntpolish read 53 poisons in "1345 hits" - 3.9%
// against a real rate of about 25% - because 1,200 ticks of a live world is full of other npcs
// hitting each other. It is optional so nothing that only wants `who` has to change.
export type Hit = { tick: number; who: string; damage: number; type: number; nid?: number };
export type Say = { tick: number; who: string; text: string };
export type Sound = { tick: number; who: string; synth: string; loops: number; delay: number };
// 'invop' is an if_setinvop: the server rewriting one right-click option of a server-side
// inventory grid. Only the bank and the trading post use it, and it is the only way to see
// from the server side which options a grid is actually offering.
export type Iface = { tick: number; who: string; kind: 'open' | 'text' | 'invop' | 'obj' | 'spin'; com: number; text?: string; op?: number; obj?: number; xspeed?: number; yspeed?: number };

export const hits: Hit[] = [];
export const anims: { tick: number; who: string; seq: number }[] = [];
// Every spotanim the server puts on a player. Like an anim it is a per-tick mask, so two in one
// tick means the client only ever sees the second - which is exactly the failure this exists to
// catch. A spotanim is also the half of a teleport or a spell that a config reader cannot see:
// the seq can be right and the effect missing, and the only earlier way to tell was to log in.
export const spotanims: { tick: number; who: string; spotanim: number; height: number }[] = [];
// ...and the same for npcs. Whether a monster PLAYED its attack, block or death animation was
// unanswerable from a sim until this existed - the params can all be present and correct and still
// never reach the client, and a config reader cannot tell the difference.
export const npcAnims: { tick: number; who: string; seq: number }[] = [];
// AND AN NPC'S SPOTANIMS, which is how you see what a monster CAST rather than what landed. A spell
// that misses plays the target's splash instead of its own impact graphic, so a cast read off the
// player shows up as nothing at all - and "the Jungle Demon alternates between all four wave
// spells" then looks like it skips, because a quarter of its casts miss. The spotanim the server
// puts on the NPC is the spell it chose, hit or miss (magic_spell_table:spotanim_origin, played by
// ~npc_spell_cast before any roll).
export const npcSpotanims: { tick: number; who: string; spotanim: number; height: number }[] = [];
export const mesgs: Say[] = [];
export const sounds: Sound[] = [];
export const ifaces: Iface[] = [];
/** Overhead text, with the tick it was said on. `who` is the username for a player and the
 * debugname for an npc. */
export const says: Say[] = [];
/** Every hitsplat an npc takes, as `hits` is for players; `who` is the npc's debugname. */
export const npcHits: Hit[] = [];

let booted = false;

// id -> name straight out of the content's pack file, so sounds print as names rather than numbers.
let synthNames: Map<number, string> | null = null;
function synthName(id: number): string {
    if (!synthNames) {
        synthNames = new Map();
        try {
            for (const line of fs.readFileSync(`${Environment.BUILD_SRC_DIR}/pack/synth.pack`, 'ascii').split(/\r?\n/)) {
                const eq = line.indexOf('=');
                if (eq > 0) synthNames.set(parseInt(line.slice(0, eq)), line.slice(eq + 1));
            }
        } catch {
            // no pack file reachable - ids will do
        }
    }
    return synthNames.get(id) ?? String(id);
}

// EVERY SIM USED TO ROLL A FRESH DICE, and that is why this suite could not be trusted. Two CI
// dispatches of the SAME engine commit disagreed about which sims failed - quest_ikov_run failed in
// one and passed in the next, gwdskirmish the other way round - with nothing changed in between. A
// suite like that is not measuring the game, it is sampling it, and a known-failing list built from
// it can never converge because the thing it records keeps moving.
//
// There are exactly two sources of it, and both are reachable from here:
//
//   1. The content's `random` and `randominc` ops, which go through ONE module-global JavaRandom
//      (src/util/JavaRandom.ts) that seeds itself off Math.random the moment it is imported.
//   2. The engine's own rolls, which call Math.random directly - an npc picking a wander step or a
//      hunt target (Npc.ts), an entity shoved aside when its square is taken (PathingEntity.ts),
//      the fallback step in NaivePathFinder.
//
// Seed both and a sim run is reproducible. The number that made this concrete: gwdskirmish counted
// "52 npcs, 22 kinds" in the god chamber on one run and 50 on the next, because two of the
// wanderers happened to drift over the boundary. Nothing was wrong either time.
//
// SIM_SEED=<n> re-runs a sim on a different dice, which is how to tell a real failure from one
// specific unlucky roll. SIM_SEED=random restores the old free-running behaviour. Neither is needed
// for an ordinary run: the default seed is fixed, so the default run is repeatable.
function seedTheDice(): void {
    const want = process.env.SIM_SEED ?? '1';
    if (want === 'random') return;
    const seed = Number(want);
    if (!Number.isInteger(seed) || seed < 0) {
        throw new Error(`SIM_SEED must be a non-negative whole number or "random", not ${JSON.stringify(want)}`);
    }
    JavaRandom.setSeed(seed);
    // mulberry32, four lines and good enough for a dice no player ever sees. It is deliberately NOT
    // JavaRandom: the two sources stay independent, so seeding one cannot shift the other's stream.
    let s = seed | 0;
    Math.random = () => {
        s = (s + 0x6d2b79f5) | 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export async function boot() {
    if (booted) return;
    // BEFORE World.start, because starting the world spawns 12,666 static npcs and rolls for them.
    seedTheDice();
    await World.start(false, false);
    booted = true;

    // Record every hitsplat at the moment it is applied. applyDamage is the single chokepoint for
    // player damage in the engine (Player.applyDamage), so this catches melee, ranged, magic,
    // specials, poison and burns alike, with the tick it actually landed on.
    const origApply = (Player.prototype as any).applyDamage;
    // What the splat shows: applyDamage clamps a hit to the hitpoints it lands on, so a 20 on 5 is a 5.
    (Player.prototype as any).applyDamage = function (damage: number, type: number) {
        hits.push({ tick: World.currentTick, who: this.username, damage: Math.min(damage, this.levels[3]), type });
        return origApply.call(this, damage, type);
    };
    const origNpcApply = (Npc.prototype as any).applyDamage;
    (Npc.prototype as any).applyDamage = function (damage: number, type: number) {
        npcHits.push({ tick: World.currentTick, who: NpcType.get(this.type).debugname ?? String(this.type), damage: Math.min(damage, this.levels[3]), type, nid: this.nid });
        return origNpcApply.call(this, damage, type);
    };
    const origSay = (Player.prototype as any).say;
    (Player.prototype as any).say = function (text: string) {
        says.push({ tick: World.currentTick, who: this.username, text });
        return origSay.call(this, text);
    };
    // AND AN NPC'S OWN overhead text, under its debugname. npc_say was the one thing a talking
    // random does that nothing here could see - the sandwich lady's "Thief! Thief! Thief!" is said
    // this way, not through a chat interface, so a test could only have asserted it by eye.
    const origNpcSay = (Npc.prototype as any).say;
    (Npc.prototype as any).say = function (text: string) {
        says.push({ tick: World.currentTick, who: NpcType.get(this.type).debugname ?? String(this.type), text });
        return origNpcSay.call(this, text);
    };
    const origAnim = (Player.prototype as any).playAnimation;
    (Player.prototype as any).playAnimation = function (seq: number, delay: number) {
        if (seq !== -1) anims.push({ tick: World.currentTick, who: this.username, seq });
        return origAnim.call(this, seq, delay);
    };
    const origSpotanim = (Player.prototype as any).spotanim;
    (Player.prototype as any).spotanim = function (spotanim: number, height: number, delay: number) {
        if (spotanim !== -1) spotanims.push({ tick: World.currentTick, who: this.username, spotanim, height });
        return origSpotanim.call(this, spotanim, height, delay);
    };
    const origNpcSpotanim = (Npc.prototype as any).spotanim;
    (Npc.prototype as any).spotanim = function (spotanim: number, height: number, delay: number) {
        if (spotanim !== -1) npcSpotanims.push({ tick: World.currentTick, who: NpcType.get(this.type).debugname ?? String(this.type), spotanim, height });
        return origNpcSpotanim.call(this, spotanim, height, delay);
    };
    const origNpcAnim = (Npc.prototype as any).playAnimation;
    (Npc.prototype as any).playAnimation = function (seq: number, delay: number) {
        if (seq !== -1) npcAnims.push({ tick: World.currentTick, who: NpcType.get(this.type).debugname ?? String(this.type), seq });
        return origNpcAnim.call(this, seq, delay);
    };
    // WARM UP PAST TICK 8. Half the combat guards in the content are of the form
    // `if (add(%lastcombat, 8) > map_clock)`, and on a world that has only just started map_clock
    // is 0-4 - so an untouched player reads as "in combat two seconds ago" and monsters refuse to
    // engage them. Real worlds are never in that state; a warm-up puts the clock where it belongs.
    for (let i = 0; i < 30; i++) World.cycle();

    // Every sound the server asks a client to play. Player.write is called before its
    // not-connected early return, so this catches them even with no socket on the other end.
    const origWrite = (Player.prototype as any).write;
    (Player.prototype as any).write = function (message: ServerGameMessage) {
        if (message instanceof IfOpenMain) {
            ifaces.push({ tick: World.currentTick, who: this.username, kind: 'open', com: message.component });
        }
        if (message instanceof IfSetText) {
            ifaces.push({ tick: World.currentTick, who: this.username, kind: 'text', com: message.component, text: message.text });
        }
        // WHAT A MODEL SLOT WAS FILLED WITH. ~multiobj* puts objs in components with
        // if_setobject, and without this a test driving one can only click blindly: the whole
        // point of the Quiz Master is that the answers are pictures and have no text.
        if (message instanceof IfSetObject) {
            ifaces.push({ tick: World.currentTick, who: this.username, kind: 'obj', com: message.component, obj: message.obj });
        }
        // WHETHER A MODEL SLOT WAS TOLD TO TURN. if_setrotation is how the gravedigger's
        // headstone, the prison lever's balloon animal and the certer's object are made readable -
        // a 377 model held at one angle is a silhouette - and without this hook a test cannot tell
        // a spinning panel from a still one.
        if (message instanceof IfSetRotation) {
            ifaces.push({ tick: World.currentTick, who: this.username, kind: 'spin', com: message.component, xspeed: message.xAngleSpeed, yspeed: message.yAngleSpeed });
        }
        if (message instanceof IfSetInvOp) {
            ifaces.push({ tick: World.currentTick, who: this.username, kind: 'invop', com: message.component, op: message.op, text: message.text });
        }
        if (message instanceof SynthSound) {
            sounds.push({
                tick: World.currentTick,
                who: this.username,
                synth: synthName(message.synth),
                loops: message.loops,
                delay: message.delay
            });
        }
        return origWrite.call(this, message);
    };

    const origMes = (Player.prototype as any).messageGame;
    (Player.prototype as any).messageGame = function (msg: string) {
        mesgs.push({ tick: World.currentTick, who: this.username, text: msg });
        return origMes.call(this, msg);
    };
}

export function clearLogs() {
    ifaces.length = 0;
    sounds.length = 0;
    hits.length = 0;
    npcHits.length = 0;
    says.length = 0;
    anims.length = 0;
    spotanims.length = 0;
    npcAnims.length = 0;
    npcSpotanims.length = 0;
    mesgs.length = 0;
}

import { fitName } from './fitname.js';
export { fitName };

/**
 * Create a maxed player standing at (x, z). `ip` decides their bucket in World.playerLoop.
 *
 * The name is put through fitName first, so two labels can never quietly become one account.
 */
/**
 * A SIM STARTS FROM NOTHING, and until this it did not.
 *
 * LoginServer keeps an account at data/players/<profile>/<username>.sav and writes it back as the
 * player logs out, so the SECOND run of a sim loads whatever the first one left behind. A run that
 * died partway leaves a half-finished quest on disk, and every run after it starts from there - a
 * different stage, a different step list, a different answer, for ever, with nothing on screen to
 * say so.
 *
 * It cost a day to find (DeathPlateau-Bugs#101). quest_biohazard_run failed the same check three
 * runs out of three and passed on a tree one commit away, so the commit looked responsible; it was
 * a stale biorun.sav from an earlier run that had been killed in a parallel batch. The real sim
 * passes on both trees once the save is gone. Worse, the false result was reported as a regression
 * against a pull request that never had one.
 *
 * CI never saw any of it, because data/players/ is gitignored and a fresh checkout has none - which
 * is exactly why a local run has to start the same way.
 */
function clearSave(username: string) {
    const path = `data/players/${Environment.NODE_PROFILE}/${username}.sav`;
    try {
        if (fs.existsSync(path)) fs.unlinkSync(path);
    } catch {
        // A save we cannot remove is not worth stopping a sim for; it only risks the staleness
        // above, which is what the comment is for.
    }
}

export function makePlayer(name: string, x: number, z: number, ip: number = 2130706433): Player {
    const username = fitName(name);
    clearSave(username);
    const p = new Player(username, toBase37(username), BigInt(Math.floor(Math.random() * 1e9)));
    p.teleport(x, z, 0);
    (p as any).__ip = ip;
    World.newPlayers.add(p);
    return p;
}

/** World.processLogins buckets by IP; this forces a known bucket so loop order is controllable. */
export function loginOrder(...players: Player[]) {
    // players are logged in by the order they were added to newPlayers, but bucketed by ip.
    // We patch playerLoop.add via the ip we stashed on the player.
    const orig = (World.playerLoop as any).add.bind(World.playerLoop);
    (World.playerLoop as any).add = (key: bigint, value: any) => {
        const ip = (value as any).__ip;
        orig(typeof ip === 'number' ? BigInt(ip) : key, value);
    };
    void players;
}

export function maxOut(p: Player) {
    for (const [, stat] of PlayerStatMap) {
        p.setLevel(stat, 99);
    }
}

export function equip(p: Player, slots: Record<string, string>) {
    const wearpos: Record<string, number> = {
        hat: 0,
        back: 1,
        front: 2,
        rhand: 3,
        torso: 4,
        lhand: 5,
        arms: 6,
        legs: 7,
        head: 8,
        hands: 9,
        feet: 10,
        jaw: 11,
        ring: 12,
        quiver: 13
    };
    for (const [slot, objName] of Object.entries(slots)) {
        const obj = ObjType.getId(objName);
        if (obj === -1) throw new Error('no such obj: ' + objName);
        p.invSet(InvType.WORN, obj, 1, wearpos[slot]);
    }
}

/** Every obj debugname that carries the named param - for sweeping a whole content family. */
export function objNamesByParam(paramName: string): string[] {
    const param = ParamType.getId(paramName);
    if (param === -1) throw new Error('no such param: ' + paramName);
    const out: string[] = [];
    for (const [name, id] of ObjType.configNames) {
        if (ObjType.get(id).params?.has(param)) out.push(name);
    }
    return out.sort();
}

/** Is this loc wired for cooking - by category, or by a trigger of its own? */
export function locCookInfo(locName: string): { category: string | null; cooks: boolean; ownHandler: boolean } {
    const id = LocType.getId(locName);
    if (id === -1) throw new Error('no such loc: ' + locName);
    const type = LocType.get(id);
    const category = type.category === -1 ? null : (CategoryType.get(type.category)?.debugname ?? String(type.category));
    const own = ScriptProvider.getByTriggerSpecific(ServerTriggerType.APLOCU, id, -1) !== undefined || ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPLOCU, id, -1) !== undefined;
    const byCategory = ScriptProvider.getByTrigger(ServerTriggerType.OPLOCU, id, type.category) !== undefined;
    return { category, cooks: own || byCategory, ownHandler: own };
}

/** The npc currently in this player's follower slot, if any. */
export function followerOf(p: Player): Npc | null {
    const v = VarPlayerType.getByName('follower_uid');
    if (!v) throw new Error('no follower_uid varp');
    const uid = p.getVar(v.id) as number;
    for (const npc of World.npcs) {
        if (npc && npc.uid === uid && npc.isActive) return npc;
    }
    return null;
}

export function clearInv(p: Player) {
    const inv = p.getInventory(InvType.INV)!;
    for (let i = 0; i < inv.capacity; i++) {
        if (inv.get(i)) p.invDelSlot(InvType.INV, i);
    }
}

/**
 * The debugname of whatever is worn in a wearpos, or null for an empty slot. The equip side of
 * invCount: a check about a fight can then name the weapon it was fought with instead of taking
 * it on trust, which is how an unarmed player once got reported as an unkillable boss.
 */
export function wornName(p: Player, wearpos: number): string | null {
    const obj = p.getInventory(InvType.WORN)?.get(wearpos);
    return obj ? (ObjType.get(obj.id).debugname ?? null) : null;
}

export function give(p: Player, objName: string, count = 1) {
    const obj = ObjType.getId(objName);
    if (obj === -1) throw new Error('no such obj: ' + objName);
    p.invAdd(InvType.INV, obj, count);
}

/** How many of an obj the player is carrying, counting every slot. */
export function invCount(p: Player, objName: string) {
    const obj = ObjType.getId(objName);
    if (obj === -1) throw new Error('no such obj: ' + objName);
    const inv = p.getInventory(InvType.INV)!;
    let n = 0;
    for (let i = 0; i < inv.capacity; i++) {
        const slot = inv.get(i);
        if (slot && slot.id === obj) n += slot.count;
    }
    return n;
}

/** Pack every remaining slot with a distinct unstackable, so inv_freespace reads 0. */
export function fillInv(p: Player) {
    const inv = p.getInventory(InvType.INV)!;
    for (let i = 0; i < inv.capacity; i++) {
        if (!inv.get(i)) p.invSet(InvType.INV, ObjType.getId('bronze_arrow'), 1, i);
    }
}

/**
 * Run a proc by name, as `[proc,name]`.
 *
 * PROTECTED ACCESS: a transmitted varp can only be written by a script that has it, and every
 * op trigger does - so a proc that writes one works in game and throws "requires protected access"
 * here, which is a difference in the CALLER and not a bug in the proc. Pass protect to stand in for
 * the trigger. (Mourning's End Part II's door table is the case that found this: ~m2_doors writes
 * the fourteen mourning_door_* bits, and testing it any other way means solving the light puzzle
 * from the inside five times over.)
 */
export function runProc(p: Player, name: string, args: any[] = [], secondary?: Player, protect = false): number[] {
    const script = ScriptProvider.getByName(name);
    if (!script) throw new Error('no such script: ' + name);
    const state = ScriptRunner.init(script, p, secondary ?? null, args);
    if (protect) {
        state.pointerAdd(ScriptPointer.ProtectedActivePlayer);
        state.pointerAdd(ScriptPointer.ProtectedActivePlayer2);
    }
    ScriptRunner.execute(state);
    return (state as any).intStack.slice(0, (state as any).isp);
}

/**
 * What the client's "Attack" click does: OpPlayerHandler, minus the visibility checks.
 * Returns false when the click is thrown away, which is what the real handler does to any click
 * made while the player is delayed.
 */
export function attack(p: Player, target: Player) {
    if (p.delayed) return false;
    p.clearPendingAction();
    // OpPlayerHandler sends APPLAYER1 + (op - 1); the engine derives the op trigger from it as
    // targetOp + 7. Passing OPPLAYER2 here instead looks right and is not: it makes getOpTrigger
    // look up trigger 102, which does not exist.
    p.setInteraction(Interaction.ENGINE, target, ServerTriggerType.APPLAYER1 + 1);
    (p as unknown as { opcalled: boolean }).opcalled = true;
    return true;
}

export function attackNpc(p: Player, target: Npc) {
    if (p.delayed) return false;
    p.clearPendingAction();
    p.setInteraction(Interaction.ENGINE, target, ServerTriggerType.APNPC1 + 1);
    (p as unknown as { opcalled: boolean }).opcalled = true;
    return true;
}

/**
 * opheld WITHOUT the "could a client send this?" check, for a test whose whole point is that it
 * could not.
 *
 * There is exactly one of these, and it is a fair use rather than a loophole. tools/sim/mutagens.ts
 * sends iop4 to a plain serpentine_helm, which declares [null,"Wear","Check",null,"Uncharge"] and
 * so has no iop4 at all - while tanzanite_helm and magma_helm declare iop4=Restore and share a
 * CATEGORY trigger with it. The test is that the shared handler leaves the un-mutated helm untouched
 * if it is ever reached with one, which is a defensive path by definition: no client can get there.
 *
 * Making opheld strict broke that test, and the two wrong ways out were obvious and worth naming.
 * Returning false instead of throwing would have left the sim's own assertions passing against a
 * click that never happened - a test that cannot fail. Relaxing opheld for everyone would reopen
 * the door this closed, which is sims clicking options no player has.
 *
 * So: a separate function with an ugly name, so the exception is legible where it is used.
 */
export function opheldUnclickable(p: Player, objName: string, op: number) {
    if (p.delayed) return false;
    const id = ObjType.getId(objName);
    if (id === -1) throw new Error('no such obj: ' + objName);
    const inv = p.getInventory(InvType.INV)!;
    let slot = -1;
    for (let i = 0; i < inv.capacity; i++) {
        if (inv.get(i)?.id === id) {
            slot = i;
            break;
        }
    }
    if (slot === -1) throw new Error('not carrying ' + objName);
    const obj = ObjType.get(id);
    p.lastItem = id;
    p.lastSlot = slot;
    p.closeModal();
    p.moveClickRequest = false;
    const script = ScriptProvider.getByTrigger(ServerTriggerType.OPHELD1 + (op - 1), obj.id, obj.category);
    if (!script) throw new Error('no opheld' + op + ' trigger for ' + objName);
    p.executeScript(ScriptRunner.init(script, p), true);
    return true;
}

/** What the client's inventory right-click does: OpHeldHandler, minus the client validation. */
export function opheld(p: Player, objName: string, op: number) {
    if (p.delayed) return false; // OpHeldHandler: "normal: cannot interact while delayed"
    const id = ObjType.getId(objName);
    if (id === -1) throw new Error('no such obj: ' + objName);
    // The fourth of these, and the last: opLoc, opObj and opNpc all reached setInteraction without
    // asking whether the option exists, and so did this. OpHeldHandler refuses an iop the obj does
    // not declare, so a sim that clicks one is testing something no client can send.
    //
    // opheldUnclickable is the way past this, for the one case where clicking an impossible op is
    // the point of the test rather than a mistake. See its own note.
    const iops = ObjType.get(id).iop;
    if (isHiddenOp(iops?.[op - 1])) {
        throw new Error(`${objName} has no iop${op} (${JSON.stringify(iops)}), so no client could send this click. If that is deliberate, H.opheldUnclickable says so at the call site.`);
    }
    const inv = p.getInventory(InvType.INV)!;
    let slot = -1;
    for (let i = 0; i < inv.capacity; i++) {
        if (inv.get(i)?.id === id) {
            slot = i;
            break;
        }
    }
    if (slot === -1) throw new Error('not carrying ' + objName);
    const obj = ObjType.get(id);
    p.lastItem = id;
    p.lastSlot = slot;
    p.closeModal();
    p.moveClickRequest = false;
    const trigger = ServerTriggerType.OPHELD1 + (op - 1);
    const script = ScriptProvider.getByTrigger(trigger, obj.id, obj.category);
    if (!script) throw new Error('no opheld' + op + ' trigger for ' + objName);
    p.executeScript(ScriptRunner.init(script, p), true);
    return true;
}

/**
 * What "Use A on B" does in the inventory: the REAL OpHeldUHandler, fed the packet the client
 * sends. Client.java's opcode 903 writes the item CLICKED SECOND as obj/slot and the one selected
 * FIRST as useObj/useSlot, so `useName` is the one you picked up and `onName` the one you dropped
 * it on - and swapping those two arguments is the whole of what "the other way round" means.
 *
 * EVERY OTHER SIM IN THIS DIRECTORY RE-IMPLEMENTED THE HANDLER'S TRIGGER LOOKUP BY HAND, seven of
 * them, each with the comment "OpHeldUHandler's lookup, swaps included". That is why none of them
 * could ever see the handler swap last_item on a lookup that MISSED: a copy of the engine cannot
 * disagree with the engine. Use this instead.
 */
export function useHeldOn(p: Player, useName: string, onName: string): boolean {
    const inv = p.getInventory(InvType.INV)!;
    const find = (name: string, skip: number): { obj: number; slot: number } => {
        const id = ObjType.getId(name);
        if (id === -1) throw new Error('no such obj: ' + name);
        for (let i = 0; i < inv.capacity; i++) {
            if (i !== skip && inv.get(i)?.id === id) return { obj: id, slot: i };
        }
        throw new Error('not carrying ' + name);
    };
    const a = find(useName, -1);
    const b = find(onName, a.slot); // two stacks of the same obj still have to be two slots
    const listener = p.invListeners.find(l => l.type === InvType.INV);
    if (!listener) throw new Error('no inventory listener: the player never logged in');
    p.closeModal();
    return new OpHeldUHandler().handle(new OpHeldU(b.obj, b.slot, listener.com, a.obj, a.slot, listener.com), p);
}

/**
 * What a minimap/step click does. World.processClientsIn throws the whole path away when the
 * player is delayed ("player.unsetMapFlag(); continue;"), so this does too - that discard IS the
 * "can't move after eating" bug, and a harness that quietly walks anyway cannot show it.
 */
export function walkTo(p: Player, x: number, z: number) {
    if (p.delayed) {
        p.unsetMapFlag();
        return false;
    }
    p.clearPendingAction();
    p.queueWaypoint(x, z);
    p.moveClickRequest = !p.busy();
    return true;
}

export function setVar(p: Player, varpName: string, value: number) {
    const v = VarPlayerType.getByName(varpName);
    if (!v) throw new Error('no such varp: ' + varpName);
    p.setVar(v.id, value);
}

/** Run a script with an npc as the active npc and a player as the active player. */
/** As runProc, but with the npc active - and it hands back what the proc returned, as runProc does. */
export function runNpcProc(npc: Npc, name: string, player: Player | null = null, args: any[] = []): number[] {
    const script = ScriptProvider.getByName(name);
    if (!script) throw new Error('no such script: ' + name);
    const state = ScriptRunner.init(script, npc, player, args);
    ScriptRunner.execute(state);
    return (state as any).intStack.slice(0, (state as any).isp);
}

/** What clicking a component does: IfButtonHandler, minus the visibility check. */
export function ifButton(p: Player, comName: string) {
    const comId = Component.getId(comName);
    if (comId === -1) throw new Error('no such component: ' + comName);
    const com = Component.get(comId);
    p.lastCom = comId;
    const script = ScriptProvider.getByTriggerSpecific(ServerTriggerType.IF_BUTTON, comId, -1);
    if (!script) throw new Error('no if_button trigger for ' + comName);
    const root = Component.get(com.rootLayer);
    p.executeScript(ScriptRunner.init(script, p), root.overlay == false);
    return true;
}

/**
 * What clicking one of a component's inventory options does - Make 1, Make 5, Make 10 on a crafting
 * panel, which is an INV_BUTTON and not an IF_BUTTON. ifButton cannot reach these: the trigger type
 * is different, and a panel slot that looks like a button to the player is an inv.
 */
export function invButton(p: Player, comName: string, op = 1, slot = 0) {
    const comId = Component.getId(comName);
    if (comId === -1) throw new Error('no such component: ' + comName);
    p.lastCom = comId;
    p.lastSlot = slot;
    const trigger = ServerTriggerType.INV_BUTTON1 + (op - 1);
    const script = ScriptProvider.getByTriggerSpecific(trigger, comId, -1);
    if (!script) throw new Error('no inv_button' + op + ' trigger for ' + comName);
    const com = Component.get(comId);
    const root = Component.get(com.rootLayer);
    p.executeScript(ScriptRunner.init(script, p), root.overlay == false);
    return true;
}

/**
 * What "Cast on" a player does: OpPlayerTHandler, minus the visibility checks - the spell's
 * component rides with the interaction and the engine fires [applayert,<com>] / [opplayert,<com>].
 */
export function castOnPlayer(p: Player, target: Player, comName: string) {
    if (p.delayed) return false;
    const comId = Component.getId(comName);
    if (comId === -1) throw new Error('no such component: ' + comName);
    p.clearPendingAction();
    p.setInteraction(Interaction.ENGINE, target, ServerTriggerType.APPLAYERT, comId);
    (p as unknown as { opcalled: boolean }).opcalled = true;
    return true;
}

/** The queue entries of one script waiting on a player, with the ticks each has left. */
export function queued(p: Player, scriptName: string): { delay: number; args: unknown[] }[] {
    const out: { delay: number; args: unknown[] }[] = [];
    for (const r of (p as any).queue.all()) {
        if (r.script.name === scriptName) out.push({ delay: r.delay, args: r.args });
    }
    return out;
}

/** What clicking an op on a loc does: OpLocHandler, minus the visibility checks. */
export function opLoc(p: Player, x: number, z: number, locName: string, op: number) {
    if (p.delayed) return false;
    const id = LocType.getId(locName);
    if (id === -1) throw new Error('no such loc: ' + locName);
    const loc = World.getLoc(x, z, p.level, id);
    if (!loc) throw new Error(`no ${locName} at ${x},${z}`);
    // custom (2026-11-03) - THE CHECK OpLocHandler MAKES, which this did not.
    //
    // This function reaches setInteraction directly rather than going through the handler, and the
    // one thing the handler does that matters here is refuse an op the loc does not have:
    //
    //     if (!locType.op || isHiddenOp(locType.op[message.op - 1])) -> "bad client", refused
    //
    // Without it a sim can click an option no client would ever draw and no packet would ever be
    // accepted, and the content behind it runs - so the sim passes and the game is unplayable. That
    // is the exact failure this directory's quest runner was built to catch ("a player who blinks
    // into Zanaris never finds out that the gate has no handler"), reintroduced by its own click.
    //
    // Found from the other end, by tools/sim/orphans.ts: Desert Treasure's four obelisks declare no
    // ops at all, on the shell or on either multiloc variant, while [oploc1,desert_treasure_oblix1]
    // places the diamond that finishes the quest. quest_dt_run.ts reported 114 of 114 checks passing.
    //
    // A `hidden` op is NOT refused, here or by the handler: p_oploc re-enters those from script and
    // the content uses that deliberately. Only a slot the cache leaves empty is refused.
    // locCanOp, not LocType.get(id).op: a multiloc shell's ops come from whichever variant the
    // varbit is showing, and the client sends that variant's op. Checking the shell alone called 60
    // working sim steps broken - see the note in OpVisibility.ts.
    if (!locCanOp(id, op)) {
        throw new Error(`${locName} has no op${op} on itself or any multiloc variant (${JSON.stringify(LocType.get(id).op)}), so no client could send this click`);
    }
    p.clearPendingAction();
    // the route: a real client sends one with the click, and a player with none goes nowhere
    p.queueWaypoints(findPathToLoc(p.level, p.x, p.z, loc.x, loc.z, p.width, loc.width, loc.length, loc.angle, loc.shape, LocType.get(id).forceapproach));
    p.setInteraction(Interaction.ENGINE, loc, ServerTriggerType.APLOC1 + (op - 1));
    (p as unknown as { opcalled: boolean }).opcalled = true;
    return true;
}

/**
 * What using a carried item ON a loc does: OpLocUHandler, minus the client validation. This is the
 * only way to test cooking, which is all [oplocu,_cooking_fire] / [oplocu,_cooking_oven] - there is
 * no op on a fire to click, you put the food on it.
 */
export function useHeldOnLoc(p: Player, useName: string, x: number, z: number, locName: string): boolean {
    if (p.delayed) return false;
    const useObj = ObjType.getId(useName);
    const locId = LocType.getId(locName);
    if (useObj === -1) throw new Error('no such obj: ' + useName);
    if (locId === -1) throw new Error('no such loc: ' + locName);
    const loc = World.getLoc(x, z, p.level, locId);
    if (!loc) throw new Error(`no ${locName} at ${x},${z}`);
    const inv = p.getInventory(InvType.INV)!;
    let slot = -1;
    for (let i = 0; i < inv.capacity; i++)
        if (inv.get(i)?.id === useObj) {
            slot = i;
            break;
        }
    if (slot === -1) throw new Error('not carrying ' + useName);
    p.clearPendingAction();
    p.lastUseItem = useObj;
    p.lastUseSlot = slot;
    // the route, as opLoc does it: a real client sends one with the click
    p.queueWaypoints(findPathToLoc(p.level, p.x, p.z, loc.x, loc.z, p.width, loc.width, loc.length, loc.angle, loc.shape, LocType.get(locId).forceapproach));
    p.setInteraction(Interaction.ENGINE, loc, ServerTriggerType.APLOCU);
    (p as unknown as { opcalled: boolean }).opcalled = true;
    return true;
}

/** Is a loc of this type standing on that square right now? For door stages and loc_change. */
export function locAt(level: number, x: number, z: number, locName: string): boolean {
    const id = LocType.getId(locName);
    if (id === -1) throw new Error('no such loc: ' + locName);
    return World.getLoc(x, z, level, id) !== null;
}

/** Where a loc of this type is placed, nearest first to (x, z) on that level. */
export function locsNear(locName: string, x: number, z: number, level = 0): { x: number; z: number; level: number }[] {
    const id = LocType.getId(locName);
    if (id === -1) throw new Error('no such loc: ' + locName);
    const out: { x: number; z: number; level: number }[] = [];
    for (const zone of (World.gameMap as unknown as { zonemap: { zones: Map<number, { getAllLocsUnsafe(): { type: number; x: number; z: number; level: number }[] }> } }).zonemap.zones.values()) {
        for (const loc of zone.getAllLocsUnsafe()) {
            if (loc.type === id && loc.level === level) out.push({ x: loc.x, z: loc.z, level: loc.level });
        }
    }
    return out.sort((a, b) => Math.max(Math.abs(a.x - x), Math.abs(a.z - z)) - Math.max(Math.abs(b.x - x), Math.abs(b.z - z)));
}

/**
 * What clicking an op on a ground obj does: OpObjHandler, minus the visibility checks.
 *
 * NOT a1lib's take(), which lifts the obj straight into the inventory and never runs a script.
 * Op 3 is the ground "Take" - ObjType defaults op[2] to it - so this is what content hooks with
 * [opobj3,...], and the only way to test one.
 */
export function opObj(p: Player, x: number, z: number, objName: string, op: number, walk = true) {
    if (p.delayed) return false;
    const id = ObjType.getId(objName);
    if (id === -1) throw new Error('no such obj: ' + objName);
    const obj = World.getObj(x, z, p.level, id, p.hash64) ?? World.getObj(x, z, p.level, id, -1n);
    if (!obj) throw new Error(`no ${objName} at ${x},${z}`);
    // The check OpObjHandler makes, for the same reason opLoc below has one. An obj's ground menu
    // defaults to op3="Take" and nothing else, so a sim clicking op1 on a ground obj that declares
    // no op1 is asking for something no client could send.
    const groundOps = ObjType.get(id).op;
    if (isHiddenOp(groundOps?.[op - 1])) {
        throw new Error(`${objName} has no ground op${op} (${JSON.stringify(groundOps)}), so no client could send this click`);
    }
    p.clearPendingAction();
    // THE ROUTE GOES TO A TILE NEXT TO IT, which is wrong for a ground obj: you pick one up from
    // its own tile. A caller already standing on it passes walk=false, because otherwise the route
    // walks the player back OFF the obj and the pickup never lands.
    if (walk) p.queueWaypoints(findPathToEntity(p.level, p.x, p.z, x, z, p.width, 1, 1));
    p.setInteraction(Interaction.ENGINE, obj, ServerTriggerType.APOBJ1 + (op - 1));
    (p as unknown as { opcalled: boolean }).opcalled = true;
    return true;
}

/** What clicking an op on an npc does: OpNpcHandler, minus the visibility checks. */
/**
 * The op word a PLAYER would see on this npc right now, or null when the menu has not got one.
 *
 * A multinpc is one id whose ops live on a child the varbit picks, and OpNpcHandler resolves that
 * child before it will accept a click - "bad client: not a valid npc option" otherwise. So an op
 * the cache puts on a later state is one a player cannot reach yet, which is a quest that stops.
 * Resolved the same way and in the same order as the handler, because the handler is the thing
 * being stood in for.
 */
export function npcOpWord(p: Player, npc: Npc, op: number): string | null {
    let type = NpcType.get(npc.type);
    if (type.multivarp !== -1) {
        const state = p.getVar(type.multivarp) as number;
        if (state >= 0 && state < type.multinpc.length && type.multinpc[state] !== -1) {
            type = NpcType.get(type.multinpc[state]);
        }
    } else if (type.multivarbit !== -1) {
        const state = p.getVarBit(type.multivarbit);
        if (state >= 0 && state < type.multinpc.length && type.multinpc[state] !== -1) {
            type = NpcType.get(type.multinpc[state]);
        }
    }
    const word = type.op?.[op - 1] ?? null;
    return word === 'hidden' ? null : word;
}

export function opNpc(p: Player, npc: Npc, op: number) {
    if (p.delayed) return false;
    // THE MENU DECIDES, as it does for a player. This used to go straight to setInteraction, so a
    // sim could click an option nobody can see: The Feud granted the villagers' Knock-Out state
    // only after a villager had been knocked out, and the sim walked through the quest anyway.
    if (!npcOpWord(p, npc, op)) {
        throw new Error(`op${op} is not on ${NpcType.get(npc.type).debugname ?? npc.type}'s menu - a player could not click it here`);
    }
    p.clearPendingAction();
    p.queueWaypoints(findPathToEntity(p.level, p.x, p.z, npc.x, npc.z, p.width, npc.width, npc.length));
    p.setInteraction(Interaction.ENGINE, npc, ServerTriggerType.APNPC1 + (op - 1));
    (p as unknown as { opcalled: boolean }).opcalled = true;
    return true;
}

/**
 * ONE PLAYER USING AN ITEM ON ANOTHER: OpPlayerUHandler, mirrored rather than called.
 *
 * The one check that cannot be called is rsbuf.hasPlayer(player.slot, other.slot) - the server fills
 * that list only for a CONNECTED client, and a harness player has no socket, so the real handler
 * refuses every one of these before it reaches the content. That is the same reason
 * src/engine/bot/BotInput.ts mirrors opPlayer, opNpc and castOnPlayer instead of calling them.
 * Here it is mirrored as what it stands for: the other player is within a client's view distance on
 * the same level.
 *
 * EVERY OTHER CHECK IS KEPT, including the one that looks like it is in the way:
 *
 *     if (other.isBot) { "... is a bot - it doesn't take items." }
 *
 * A bot does not take items, deliberately, so players cannot lose them into one. That is why
 * [opplayeru] and [applayeru] - ten triggers in this build - are out of a fuzzer's reach and want a
 * sim with two real players (tools/sim/jarshare.ts).
 */
export function useOnPlayer(p: Player, other: Player, objName: string): boolean {
    if (p.delayed) return false;
    const id = ObjType.getId(objName);
    if (id === -1) throw new Error('no such obj: ' + objName);
    const listener = p.invListeners.find(l => l.type === InvType.INV && l.source === p.uid);
    const com = listener ? Component.get(listener.com) : undefined;
    if (!listener || !com || !com.usable || !p.isComponentVisible(com)) return false;
    const inv = p.getInventoryFromListener(listener);
    if (!inv) return false;
    const slot = inv.getItemIndex(id);
    if (slot === -1 || !inv.validSlot(slot) || !inv.hasAt(slot, id)) return false;
    if (!other.isActive || other.slot === -1 || World.getPlayer(other.slot) !== other) return false;
    if (other.isBot) return false; // the handler's own rule, kept
    if (other.level !== p.level || Math.abs(p.x - other.x) > 15 || Math.abs(p.z - other.z) > 15) return false;
    p.clearPendingAction();
    if (ObjType.get(id).members && !Environment.NODE_MEMBERS) return false;
    (p as unknown as { lastUseItem: number; lastUseSlot: number }).lastUseItem = id;
    (p as unknown as { lastUseItem: number; lastUseSlot: number }).lastUseSlot = slot;
    p.setInteraction(Interaction.ENGINE, other, ServerTriggerType.APPLAYERU, id);
    (p as unknown as { opcalled: boolean }).opcalled = true;
    return true;
}

/** The nearest live npc of a type to (x, z) on this level, or null. */
/**
 * PUT THE PLAYER SOMEWHERE THIS NPC CAN ACTUALLY BE TALKED TO FROM, and say whether there was
 * anywhere. Returns false without moving the player when every side of it is blocked or walled off.
 *
 * `p.teleport(npc.x + 1, npc.z, npc.level)` is written in thirty sims and it is a guess twice over.
 * An npc WANDERS, so the tile read a moment ago is not where it is standing now; and a teleport
 * ignores collision, so the tile east of it can be the far side of a counter or a cellar wall. The
 * engine then answers "I can't reach that!" - one line in the log after three successful ones - the
 * conversation never starts, and the check above it reports working content as broken. Two of the
 * nine sims failing on 377-wip were exactly this: the Rod of Ivandis "refused" by Veliaf, who
 * stands on nineteen different tiles over 120 ticks, and both halves of the Magic Guild robe shop,
 * whose keeper stands behind his counter.
 *
 * So ask the same question the route finder answers for a real click, around the npc as it is now,
 * and take the first side that says yes.
 */
export function standBeside(p: Player, npc: Npc): boolean {
    const w = npc.width;
    const l = npc.length;
    const spots: [number, number][] = [];
    for (let dx = 0; dx < w; dx++) {
        spots.push([npc.x + dx, npc.z - 1], [npc.x + dx, npc.z + l]);
    }
    for (let dz = 0; dz < l; dz++) {
        spots.push([npc.x - 1, npc.z + dz], [npc.x + w, npc.z + dz]);
    }
    for (const [x, z] of spots) {
        if (isMapBlocked(x, z, npc.level)) continue;
        if (!reachedEntity(npc.level, x, z, npc.x, npc.z, w, l, 1)) continue;
        p.teleport(x, z, npc.level);
        return true;
    }
    return false;
}

export function npcNear(npcName: string, x: number, z: number, level = 0): Npc | null {
    const id = NpcType.getId(npcName);
    let best: Npc | null = null;
    let bestD = Infinity;
    for (const npc of World.npcs) {
        if (!npc || !npc.isActive || npc.type !== id || npc.level !== level) continue;
        const d = Math.max(Math.abs(npc.x - x), Math.abs(npc.z - z));
        if (d < bestD) {
            bestD = d;
            best = npc;
        }
    }
    return best;
}

/** Pick an option in an open chat menu (p_choiceN): IfButtonHandler's resume branch. */
export function choose(p: Player, comName: string) {
    const comId = Component.getId(comName);
    if (comId === -1) throw new Error('no such component: ' + comName);
    p.lastCom = comId;
    if (p.resumeButtons.indexOf(comId) === -1 || !p.activeScript || p.activeScript.execution !== ScriptState.PAUSEBUTTON) return false;
    p.executeScript(p.activeScript, true, true);
    return true;
}

/**
 * Type a number into the chatbox amount prompt: ResumePCountDialogHandler, minus the network. A
 * script parked on p_countdialog is the only thing this can answer, and saying so is the point -
 * a Make X that never reached the prompt returns false here rather than quietly being counted as
 * answered.
 */
export function typeCount(p: Player, amount: number) {
    if (!p.activeScript || p.activeScript.execution !== ScriptState.COUNTDIALOG) return false;
    p.activeScript.lastInt = amount;
    p.executeScript(p.activeScript, true, true);
    return true;
}

/** Is the player's script parked on the amount prompt right now? */
export function awaitingCount(p: Player) {
    return !!p.activeScript && p.activeScript.execution === ScriptState.COUNTDIALOG;
}

/** "Cast on" an inventory item: OpHeldTHandler, minus the client validation. */
export function castOnHeld(p: Player, objName: string, comName: string) {
    if (p.delayed) return false;
    const id = ObjType.getId(objName);
    const comId = Component.getId(comName);
    if (id === -1 || comId === -1) throw new Error(`no ${objName} / ${comName}`);
    const inv = p.getInventory(InvType.INV)!;
    let slot = -1;
    for (let i = 0; i < inv.capacity; i++)
        if (inv.get(i)?.id === id) {
            slot = i;
            break;
        }
    if (slot === -1) throw new Error('not carrying ' + objName);
    p.lastItem = id;
    p.lastSlot = slot;
    p.clearPendingAction();
    const script = ScriptProvider.getByTrigger(ServerTriggerType.OPHELDT, comId, -1);
    if (!script) throw new Error('no opheldt trigger for ' + comName);
    p.executeScript(ScriptRunner.init(script, p), true);
    return true;
}

/** "Cast on" a loc: OpLocTHandler, with the route a client would send. */
export function castOnLoc(p: Player, x: number, z: number, locName: string, comName: string) {
    if (p.delayed) return false;
    const id = LocType.getId(locName);
    const comId = Component.getId(comName);
    const loc = World.getLoc(x, z, p.level, id);
    if (!loc || comId === -1) throw new Error(`no ${locName} at ${x},${z} / ${comName}`);
    p.clearPendingAction();
    p.queueWaypoints(findPathToLoc(p.level, p.x, p.z, loc.x, loc.z, p.width, loc.width, loc.length, loc.angle, loc.shape, LocType.get(id).forceapproach));
    p.setInteraction(Interaction.ENGINE, loc, ServerTriggerType.APLOCT, comId);
    (p as unknown as { opcalled: boolean }).opcalled = true;
    return true;
}

/** "Cast on" an npc: OpNpcTHandler, with the route a client would send. */
export function castOnNpc(p: Player, npc: Npc, comName: string) {
    if (p.delayed) return false;
    const comId = Component.getId(comName);
    if (comId === -1) throw new Error('no such component: ' + comName);
    p.clearPendingAction();
    p.queueWaypoints(findPathToEntity(p.level, p.x, p.z, npc.x, npc.z, p.width, npc.width, npc.length));
    p.setInteraction(Interaction.ENGINE, npc, ServerTriggerType.APNPCT, comId);
    (p as unknown as { opcalled: boolean }).opcalled = true;
    return true;
}

export function hasScript(name: string) {
    return ScriptProvider.getByName(name) !== undefined;
}

/** npc_setmode's own behaviour: set the mode and target the active player. */
export function setNpcMode(npc: Npc, mode: 'OPPLAYER2' | 'APPLAYER2', target: Player) {
    npc.setInteraction(Interaction.SCRIPT, target, mode === 'OPPLAYER2' ? NpcMode.OPPLAYER2 : NpcMode.APPLAYER2);
}

export function setNpcVar(npc: Npc, name: string, value: number) {
    const v = VarNpcType.getByName(name);
    if (!v) throw new Error('no such varn: ' + name);
    npc.setVar(v.id, value);
}

export function setVarBit(p: Player, name: string, value: number) {
    const v = VarBitType.getByName(name);
    if (!v) throw new Error('no such varbit: ' + name);
    p.setVarBit(v.id, value);
}

export function getVarBit(p: Player, name: string): number {
    const v = VarBitType.getByName(name);
    if (!v) throw new Error('no such varbit: ' + name);
    return p.getVarBit(v.id);
}

export function getVar(p: Player, varpName: string): number {
    const v = VarPlayerType.getByName(varpName);
    if (!v) throw new Error('no such varp: ' + varpName);
    return p.getVar(v.id) as number;
}

export function addNpc(npcName: string, x: number, z: number): Npc {
    return addNpcAt(npcName, x, z, 0);
}

export function addNpcAt(npcName: string, x: number, z: number, level: number): Npc {
    const id = NpcType.getId(npcName);
    if (id === -1) throw new Error('no such npc: ' + npcName);
    const type = NpcType.get(id);
    const npc = new Npc(level, x, z, type.size, type.size, EntityLifeCycle.DESPAWN, World.getNextNid(), type.id, type.blockwalk);
    World.addNpc(npc, 5000);
    return npc;
}

/** Take a player out of the world immediately - logout() is only a request. */
export function despawn(...players: Player[]) {
    for (const p of players) {
        World.removePlayer(p);
    }
}

export function tick(n = 1) {
    for (let i = 0; i < n; i++) {
        // A sim player has no socket, so to the engine it has lost its connection since the tick it
        // was made, and World.processLogouts asks it to idle-logout after TIMEOUT_NO_CONNECTION (50
        // ticks). Anything longer than half a minute would quietly lose its players - clicks on a
        // player with no slot just do nothing - so every tick counts as heard from.
        for (const p of World.playerLoop.all()) {
            p.lastConnected = World.currentTick;
            p.lastResponse = World.currentTick;
            // AND NO RANDOM EVENT IS OWED. World sets afkEventReady on a coin flip every 500
            // ticks, and content reads it through `afk_event` at the top of the things a macroer
            // would be doing - cooking, thieving, spinning, crafting jewellery - where the pattern
            // is "if the event is owed, spawn it AND RETURN". The action is dropped on the floor.
            //
            // For a player that is the game working. For a sim it is one action in a long run
            // silently doing nothing, at a tick nothing chose, and the 131 manifests that set the
            // `macro_event` varp do not help: that varp stops the SPAWN, and the early return
            // happens either way. Family Crest lost its perfect ruby ring to exactly this and
            // stalled at stage 7 - the necklace a few steps later worked, because the first press
            // had eaten the flag (tracker issue 21).
            //
            // randomevents.ts drives the spawn procs directly with runProc and never reads this,
            // so nothing that tests macro events loses anything by it being off here.
            p.afkEventReady = false;
        }
        World.cycle();
    }
}

export function soundsFor(name: string) {
    return sounds.filter(s => s.who === name);
}

export function saysFor(name: string) {
    return says.filter(s => s.who === name);
}

export function npcHitsFor(debugname: string) {
    return npcHits.filter(h => h.who === debugname);
}

export function hitsFor(name: string) {
    return hits.filter(h => h.who === name);
}

export function timeline(names: string[], from: number, to: number): string[] {
    const out: string[] = [];
    for (let t = from; t <= to; t++) {
        const parts: string[] = [];
        for (const n of names) {
            const hs = hits.filter(h => h.tick === t && h.who === n);
            if (hs.length) parts.push(`${n}<-${hs.map(h => h.damage).join('+')}`);
        }
        if (parts.length) out.push(`  t${String(t).padStart(3)}  ${parts.join('   ')}`);
    }
    return out;
}
