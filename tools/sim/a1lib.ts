import CategoryType from '#/cache/config/CategoryType.js';
import { opHeldUAlternate } from '#/engine/script/OpHeldUTrigger.js';
// Shared helpers for the quest audit sim (audit1.ts): chat driving, loc/npc clicks with real routes,
// item-on-loc/npc, walkability floods and a dead-op scan over an area.
import * as H from './harness.js';
import World from '#/engine/World.js';
import LocType from '#/cache/config/LocType.js';
import NpcType from '#/cache/config/NpcType.js';
import ObjType from '#/cache/config/ObjType.js';
import InvType from '#/cache/config/InvType.js';
import Component from '#/cache/config/Component.js';
import ScriptState from '#/engine/script/ScriptState.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import ScriptPointer from '#/engine/script/ScriptPointer.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import { Interaction } from '#/engine/entity/Interaction.js';
import { PlayerQueueType } from '#/engine/entity/PlayerQueueRequest.js';
import { findPathToLoc, findPathToEntity, canTravel, isFlagged } from '#/engine/GameMap.js';
import { CollisionType, CollisionFlag } from '#/engine/routefinder/index.js';
import Player from '#/engine/entity/Player.js';
import Npc from '#/engine/entity/Npc.js';
import Loc from '#/engine/entity/Loc.js';
import { EntityLifeCycle } from '#/engine/entity/EntityLifeCycle.js';

export const R = { ok: 0, bad: 0 };
export const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

let bucket = 1;
/**
 * A logged-in player at a tile, or a throw saying why not.
 *
 * THE LOGIN IS CHECKED, because a login that quietly does not happen is indistinguishable from
 * the game being broken. mmaggro named its players 'human_' + npcName.slice(3, 14), which made
 * 'human_zombie_monk' out of BOTH mm_zombie_monkey_small and mm_zombie_monkey_large - seventeen
 * characters of a twelve-character username, and the same seventeen twice. The second login was
 * refused, and the sim reported it as an Ape Atoll monkey that would not attack a human standing
 * beside it. Nothing in its output mentioned the player at all.
 *
 * Every sim in this directory builds usernames out of whatever it is iterating over, so the check
 * belongs here rather than in any one of them.
 */
export function player(name: string, x: number, z: number, level = 0) {
    // the colliding-name half of this lives in H.fitName, which makePlayer calls for every sim
    const p = H.makePlayer(name, x, z, bucket++);
    H.tick(1);
    if (!p.isActive || !p.isValid()) {
        throw new Error(`"${name}" did not log in at ${x},${z} - isActive ${p.isActive}, isValid ${p.isValid()}` + ' (a duplicate username, or a tile in an unallocated zone)');
    }
    if (level) p.teleport(x, z, level);
    H.maxOut(p);
    H.clearInv(p);
    H.tick(1);
    return p;
}
export const at = (p: Player) => [p.x, p.z, p.level];
export const mesOf = (p: Player) => H.mesgs.filter(m => m.who === p.username).map(m => m.text);
export const lastMes = (p: Player) => mesOf(p).slice(-1)[0] ?? '';
export const mark = () => H.mesgs.length;
export const mesSince = (p: Player, from: number) =>
    H.mesgs
        .slice(from)
        .filter(m => m.who === p.username)
        .map(m => m.text);
export const said = (p: Player, from: number, s: string) => mesSince(p, from).some(m => m.includes(s));

export let chatLog: string[] = [];
/** Let a script run out, clicking through any chat pages and taking `picks` at menus (1-based). */
export function drive(p: Player, picks: (number | string)[] = [], guardTicks = 3): string[] {
    const from = H.ifaces.length;
    let idle = 0;
    for (let guard = 0; guard < 600 && idle < guardTicks; guard++) {
        const s = p.activeScript;
        if (!s || s.execution !== ScriptState.PAUSEBUTTON) {
            // A WORLD_SUSPENDED SCRIPT IS NOT THE PLAYER'S BUSINESS. world_delay parks a script
            // for later - lighting a fire parks one for the whole burn, a hundred ticks and more -
            // and counting that as "still working" meant drive() ran its 600-tick guard out every
            // time. Sea Slug lit a fire, warmed nothing over it and reported no fire there: it had
            // burned out inside the step that lit it.
            const parked = !!s && s.execution === ScriptState.WORLD_SUSPENDED;
            // AND NEITHER IS A SCRIPT THAT HAS ALREADY ENDED. A player script that calls
            // npc_delay is handed to the npc (Player.executeScript sets npc.activeScript), and when
            // the npc runs it to the end only the NPC's reference is cleared - the player's still
            // points at it, FINISHED. The engine never acts on that (it only resumes SUSPENDED and
            // dialog states), so a real player is fine, but this loop read it as "still working".
            // Shilo Village's dolmen summons Nazastarool that way: the boss stood next to the
            // player for its whole 500-tick life while the touch step ran out its 600-tick guard,
            // and the fight step after it found nothing (tracker issue 18).
            const ended = !!s && (s.execution === ScriptState.FINISHED || s.execution === ScriptState.ABORTED);
            if ((!s || parked || ended) && !p.delayed && [...p.queue.all()].length === 0 && !p.target) idle++;
            else idle = 0;
            H.tick(1);
            continue;
        }
        idle = 0;
        const names = p.resumeButtons.map((id: number) => Component.get(id).comName ?? '');
        const open = p.modalChat === -1 ? '' : (Component.get(p.modalChat).comName ?? '');
        // A MAKE-X PANEL IS NOT AN OPTION LIST. skillmulti1..5 are their own interfaces with their
        // own Make X / 10 / 5 / 1 buttons, and resuming them without pressing one closes them - so
        // spinning wool looked like it had worked and produced nothing. A numeric pick here is the
        // button's own com number (6 is Make 1 on a one-product panel); a string matches its name.
        if (open.startsWith('skillmulti')) {
            const pick = picks.shift();
            if (pick === undefined) throw new Error('unexpected make-x panel: ' + open + ': ' + names.filter(Boolean).join(' | '));
            const com = typeof pick === 'number' ? `${open}:com_${pick}` : names.find((n: string) => n.toLowerCase().includes(String(pick).toLowerCase()));
            if (!com) throw new Error(`no button "${pick}" on ${open}: ${names.filter(Boolean).join(' | ')}`);
            H.choose(p, com);
            continue;
        }
        const multi = open.startsWith('multi') ? names.find((n: string) => n.startsWith(open + ':')) : null;
        if (multi) {
            let pick = picks.shift();
            const root = multi.split(':')[0];
            const opts: string[] = [];
            for (let i = 1; i <= 5; i++) {
                const id = Component.getId(`${root}:com_${i}`);
                const t = [...H.ifaces].reverse().find(f => f.who === p.username && f.kind === 'text' && f.com === id);
                opts.push(t?.text ?? '');
            }
            if (typeof pick === 'string') {
                // ONE PICK, SEVERAL ACCEPTABLE ANSWERS, separated by ||. A courting round in Throne
                // of Miscellania asks one of nine questions at random and each has its own flattering
                // answer, so "the right option" is not a fixed string and not a fixed slot either -
                // it is whichever of the nine happens to be on the menu. A single substring cannot
                // say that; a list of them can, and every other use of a string pick is unaffected.
                const wants = pick
                    .split('||')
                    .map(w => w.trim().toLowerCase())
                    .filter(Boolean);
                const idx = opts.findIndex(o => wants.some(w => o.toLowerCase().includes(w)));
                if (idx === -1) throw new Error(`no option "${pick}" in ${root}: ${opts.filter(Boolean).join(' | ')}`);
                pick = idx + 1;
            }
            if (pick === undefined) throw new Error('unexpected menu: ' + root + ': ' + opts.filter(Boolean).join(' | '));
            H.choose(p, `${root}:com_${pick}`);
        } else {
            p.executeScript(s, true, true);
        }
    }
    if (picks.length) throw new Error('menus not reached: ' + picks.join(','));
    const out = H.ifaces
        .slice(from)
        .filter(i => i.who === p.username && i.kind === 'text' && i.text && i.text.length > 1)
        .map(i => i.text!);
    chatLog = out;
    return out;
}
export const saw = (lines: string[], s: string) => lines.some(l => l.includes(s));

/**
 * The nearest npc of a type - and `walking` decides what "nearest" is allowed to mean, because
 * the two callers of this want opposite things and there is no geometry that serves both.
 *
 * THE TELEPORTING CALLER WANTS THE NEAREST ACROSS FLOORS. Captain Bentley is the case: there is
 * one on each dock, "both this config" - Pirates' Cove up on the ship's deck at 2224,3800 on
 * LEVEL 2, and Lunar Isle at 2114,3893 on level 0. A player standing on the Cove at 2202,3806 is
 * 22 tiles from one and 88 from the other, and taking the first FLOOR that had one - p.level,
 * then 0, 1, 2, 3 - handed back the one 88 tiles away. `talk` teleports to whatever it is given,
 * so the sim sailed the player across the sea and got the conversation for somebody already on
 * Lunar Isle, which is exactly what Bentley should say to somebody standing on Lunar Isle.
 *
 * THE WALKING CALLER CANNOT CROSS A PLANE AT ALL, so for it the nearest across floors is worse
 * than useless. The Myreque hideout is the case, and it is the same shape turned inside out:
 * there is a Veliaf Hurtz in the chamber on plane 3 and another in the same chamber on plane 0,
 * three tiles away in two dimensions. A player standing on plane 3 was handed the plane-0 one and
 * walked at it for twenty ticks, and the step reported "3 tiles off" - the smaller, more innocent
 * of the two numbers - about an npc no route could ever reach. Two quest runs lost themselves
 * there, one at step 23 and one at step 1.
 *
 * So `walking` prefers the player's own plane and only leaves it when that plane has none.
 */
export function findNpc(npcName: string, p: Player, walking = false): Npc {
    const nearestOn = (level: number) => {
        const npc = H.npcNear(npcName, p.x, p.z, level);
        return npc ? ([npc, Math.max(Math.abs(npc.x - p.x), Math.abs(npc.z - p.z))] as const) : null;
    };
    if (walking) {
        const here = nearestOn(p.level);
        if (here) return here[0];
    }
    let best: Npc | null = null;
    let bestD = Infinity;
    for (const level of [p.level, 0, 1, 2, 3]) {
        const got = nearestOn(level);
        if (got && got[1] < bestD) {
            bestD = got[1];
            best = got[0];
        }
    }
    if (!best) throw new Error('no npc ' + npcName);
    return best;
}
/**
 * Talk to the nearest npc of a type, standing next to it first.
 *
 * WITH teleport FALSE IT HAS TO BE AN NPC ON THIS FLOOR, and that is what findNpc's `walking`
 * argument is for. This called findNpc(npcName, p) in both cases, so the npc was chosen on x and z
 * alone with the level ignored - fine when the caller is about to teleport onto that level, and
 * never right when it is not, because opNpc paths on the player's OWN level.
 *
 * Measured, standing where tools/sim/batch1012.ts stands at 0:3658,3517: there are three
 * ahoy_disciples, and the any-floor search returned the one at 1:3655,3514 - three tiles away and
 * one floor UP - over the one at 0:3653,3516, five tiles away on the player's own floor. The walk
 * went nowhere, the click was aimed through a ceiling, and the sim asked for its ecto-tokens and
 * got silence (DeathPlateau-Bugs#90).
 *
 * So it can now pick a FURTHER npc than it used to, and that is the whole point: one on this floor
 * is a better place to walk to than a nearer one through a ceiling. It falls back to the old
 * any-floor search when this floor has none, so a caller that really did mean "wherever it is"
 * still works.
 */
export function talk(p: Player, npcName: string, picks: (number | string)[] = [], op = 1, teleport = true): string[] {
    const npc = findNpc(npcName, p, !teleport);
    if (!teleport) {
        H.opNpc(p, npc, op);
        for (let t = 0; t < 40 && !p.activeScript; t++) H.tick(1);
        return drive(p, picks);
    }
    for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [-1, -1],
        [2, 0],
        [0, 2],
        [-2, 0],
        [0, -2]
    ]) {
        p.teleport(npc.x + dx, npc.z + dz, npc.level);
        H.tick(1);
        H.opNpc(p, npc, op);
        for (let t = 0; t < 10 && !p.activeScript; t++) H.tick(1);
        if (p.activeScript) break;
    }
    return drive(p, picks);
}
function slotOf(p: Player, objName: string) {
    const obj = ObjType.getId(objName);
    if (obj === -1) throw new Error('no such obj ' + objName);
    const inv = p.getInventory(InvType.INV)!;
    for (let i = 0; i < inv.capacity; i++) if (inv.get(i)?.id === obj) return { obj, slot: i };
    throw new Error('not carrying ' + objName);
}
/** "Use" an inventory item on a loc: OpLocUHandler, with the route a client would send. */
export function useOn(p: Player, x: number, z: number, locName: string, objName: string, picks: (number | string)[] = []) {
    const id = LocType.getId(locName);
    const loc = World.getLoc(x, z, p.level, id);
    if (!loc) throw new Error(`no ${locName} at ${x},${z},${p.level}`);
    const { obj, slot } = slotOf(p, objName);
    p.clearPendingAction();
    p.queueWaypoints(findPathToLoc(p.level, p.x, p.z, loc.x, loc.z, p.width, loc.width, loc.length, loc.angle, loc.shape, LocType.get(id).forceapproach));
    p.lastUseItem = obj;
    p.lastUseSlot = slot;
    p.setInteraction(Interaction.ENGINE, loc, ServerTriggerType.APLOCU);
    (p as unknown as { opcalled: boolean }).opcalled = true;
    return drive(p, picks);
}
/**
 * "Use" an inventory item on a ground obj: OpObjUHandler. The route goes to the obj's own TILE,
 * not beside it, because that is where a ground obj is reached from - the same reason
 * harness.opObj takes a walk flag. Zogre Flesh Eaters' cup of tea is the only thing in the pass
 * that needs it: the potion goes into a cup standing on Sithik's drawers, not into Sithik.
 */
export function useOnObj(p: Player, x: number, z: number, objName: string, useName: string, picks: (number | string)[] = []) {
    const id = ObjType.getId(objName);
    if (id === -1) throw new Error('no such obj: ' + objName);
    const ground = World.getObj(x, z, p.level, id, p.hash64) ?? World.getObj(x, z, p.level, id, -1n);
    if (!ground) throw new Error(`no ${objName} on the ground at ${x},${z},${p.level}`);
    const { obj, slot } = slotOf(p, useName);
    p.clearPendingAction();
    p.queueWaypoints(findPathToEntity(p.level, p.x, p.z, x, z, p.width, 1, 1));
    p.lastUseItem = obj;
    p.lastUseSlot = slot;
    p.setInteraction(Interaction.ENGINE, ground, ServerTriggerType.APOBJU);
    (p as unknown as { opcalled: boolean }).opcalled = true;
    return drive(p, picks);
}
/** "Use" an inventory item on an npc: OpNpcUHandler. */
export function useOnNpc(p: Player, npcName: string, objName: string, picks: (number | string)[] = []) {
    const npc = findNpc(npcName, p);
    const { obj, slot } = slotOf(p, objName);
    p.clearPendingAction();
    p.queueWaypoints(findPathToEntity(p.level, p.x, p.z, npc.x, npc.z, p.width, npc.width, npc.length));
    p.lastUseItem = obj;
    p.lastUseSlot = slot;
    p.setInteraction(Interaction.ENGINE, npc, ServerTriggerType.APNPCU);
    (p as unknown as { opcalled: boolean }).opcalled = true;
    return drive(p, picks);
}
/** Use one held item on another: OpHeldUHandler's lookup order, swaps included. */
export function useHeld(p: Player, useName: string, onName: string, picks: (number | string)[] = []) {
    const a = slotOf(p, useName);
    const b = slotOf(p, onName);
    p.lastItem = b.obj;
    p.lastSlot = b.slot;
    p.lastUseItem = a.obj;
    p.lastUseSlot = a.slot;
    const objType = ObjType.get(b.obj);
    const useObjType = ObjType.get(a.obj);
    p.clearPendingAction();
    p.closeModal();
    const swap = () => {
        [p.lastItem, p.lastUseItem] = [p.lastUseItem, p.lastItem];
        [p.lastSlot, p.lastUseSlot] = [p.lastUseSlot, p.lastSlot];
    };
    // THE SAME LOOKUP THE ENGINE DOES, which this was three things short of.
    // (OpHeldUHandler.ts is the original; this used to be a paraphrase of it.)
    //
    //   1. It swapped WHETHER OR NOT the lookup found anything, so a miss left last_item and
    //      last_useitem the wrong way round for everything after it.
    //   2. It passed objType.category straight in, where the engine resolves it through
    //      CategoryType.get(...).id first.
    //   3. And it had no HANDOVER, which is the one that matters. Both halves of a use can
    //      declare [opheldu,...], only the one clicked second runs, and if that script does not
    //      know the pair it declines - which ~displaymessage does at all 787 of its "Nothing
    //      interesting happens." call sites - and the engine then gives the OTHER half a go.
    //      The engine's own note puts a number on it: a sweep found 963 pairs of items that
    //      worked one way round only without this.
    //
    //      Saradomin's light on a staff of the dead is one of them. Both declare a trigger, the
    //      staff's is reached first, it declines, and this file stopped there and reported
    //      "Nothing interesting happens" - so the combine's confirmation box never opened and
    //      gwdstaves read it as "menus not reached".
    let script = ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPHELDU, objType.id, -1);
    if (!script) {
        script = ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPHELDU, useObjType.id, -1);
        if (script) swap();
    }
    const objCategory = objType.category !== -1 ? CategoryType.get(objType.category) : null;
    if (!script && objCategory) script = ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPHELDU, -1, objCategory.id);
    const useObjCategory = useObjType.category !== -1 ? CategoryType.get(useObjType.category) : null;
    if (!script && useObjCategory) {
        script = ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPHELDU, -1, useObjCategory.id);
        if (script) swap();
    }
    if (!script) {
        p.messageGame('Nothing interesting happens.');
        return [];
    }
    const anyP = p as unknown as { opheldUHandoverAvailable: boolean; opheldUHandoverAsked: boolean; activeScript: unknown };
    anyP.opheldUHandoverAvailable = opHeldUAlternate(p) !== null;
    anyP.opheldUHandoverAsked = false;
    p.executeScript(ScriptRunner.init(script, p), true);
    anyP.opheldUHandoverAvailable = false;
    if (anyP.opheldUHandoverAsked) {
        anyP.opheldUHandoverAsked = false;
        const other = opHeldUAlternate(p);
        if (other && !anyP.activeScript) {
            swap();
            p.executeScript(ScriptRunner.init(other, p), true);
        }
    }
    return drive(p, picks);
}
export function op(p: Player, x: number, z: number, locName: string, n = 1, picks: (number | string)[] = []) {
    H.opLoc(p, x, z, locName, n);
    return drive(p, picks);
}
export function held(p: Player, objName: string, n = 1, picks: (number | string)[] = []) {
    H.opheld(p, objName, n);
    return drive(p, picks);
}
/** Is (tx,tz) reachable on foot from (x,z)? A flood over the real collision map. */
export function connected(level: number, x: number, z: number, tx: number, tz: number, radius = 160): boolean {
    const seen = new Set<string>([x + ',' + z]);
    const q = [[x, z]];
    while (q.length) {
        const [cx, cz] = q.pop()!;
        if (Math.abs(cx - tx) + Math.abs(cz - tz) === 0) return true;
        for (const [dx, dz] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1]
        ]) {
            const nx = cx + dx,
                nz = cz + dz,
                k = nx + ',' + nz;
            if (seen.has(k) || Math.abs(nx - x) > radius || Math.abs(nz - z) > radius) continue;
            if (canTravel(level, cx, cz, dx, dz, 1, 0, CollisionType.NORMAL)) {
                seen.add(k);
                q.push([nx, nz]);
            }
        }
    }
    return false;
}
/** Can a player standing on (x,z) reach an interaction position next to the loc? */
export function reachLoc(level: number, x: number, z: number, locName: string, lx: number, lz: number, _radius = 160) {
    const id = LocType.getId(locName);
    const loc = World.getLoc(lx, lz, level, id);
    if (!loc) return false;
    const path = findPathToLoc(level, x, z, loc.x, loc.z, 1, loc.width, loc.length, loc.angle, loc.shape, LocType.get(id).forceapproach);
    // AN EMPTY PATH MEANS YOU ARE ALREADY THERE, not that you cannot get there. findPathToLoc
    // returns nothing for a player standing on a valid interaction tile - no steps are needed -
    // and reading that as a refusal made every tile beside a loc report 'cannot click it' while
    // tiles four squares away reported fine. It said the God Wars boulder was unusable from both
    // of its own sides. So fall back to the player's own tile and run the same footprint test.
    const last = path.length ? path[path.length - 1] : (x << 14) | z;
    const px = (last >> 14) & 0x3fff,
        pz = last & 0x3fff;
    // the route ends next to the loc (or on it for ground decor); compare against the loc's footprint
    const d = Math.max(Math.max(loc.x - px, 0, px - (loc.x + loc.width - 1)), Math.max(loc.z - pz, 0, pz - (loc.z + loc.length - 1)));
    return d <= 1;
}
export function walkable(level: number, x: number, z: number) {
    return !isFlagged(x, z, level, CollisionFlag.WALK_BLOCKED);
}
export function enqueue(p: Player, name: string, args: number[] = []) {
    const s = ScriptProvider.getByName(name);
    if (!s) throw new Error('no script ' + name);
    p.enqueueScript(s, PlayerQueueType.NORMAL, 0, args);
}

/** Every loc in an area whose right-click options have no trigger of their own (type or category). */
export function deadLocOps(x1: number, z1: number, x2: number, z2: number, levels = [0, 1, 2, 3]) {
    const out = new Map<string, string[]>();
    for (const level of levels) {
        for (let zx = x1 & ~7; zx <= x2; zx += 8) {
            for (let zz = z1 & ~7; zz <= z2; zz += 8) {
                const zone = World.gameMap.getZone(zx, zz, level);
                for (const loc of zone.getAllLocsUnsafe()) {
                    if (loc.x < x1 || loc.x > x2 || loc.z < z1 || loc.z > z2) continue;
                    const t = LocType.get(loc.type);
                    const variants = [t, ...t.multiloc.filter(i => i >= 0).map(i => LocType.get(i))];
                    for (let o = 0; o < 5; o++) {
                        const labels = variants.map(v => v.op?.[o]).filter(l => l && l !== 'hidden');
                        if (!labels.length) continue;
                        const has = ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPLOC1 + o, t.id, -1) || (t.category !== -1 && ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPLOC1 + o, -1, t.category));
                        if (has) continue;
                        const k = `${t.debugname} op${o + 1}=${[...new Set(labels)].join('/')}`;
                        if (!out.has(k)) out.set(k, []);
                        out.get(k)!.push(`${loc.x},${loc.z},${level}`);
                    }
                }
            }
        }
    }
    return out;
}
export function deadNpcOps(x1: number, z1: number, x2: number, z2: number) {
    const out = new Map<string, string[]>();
    for (const npc of World.npcs) {
        if (!npc || npc.x < x1 || npc.x > x2 || npc.z < z1 || npc.z > z2) continue;
        const t = NpcType.get(npc.type);
        const variants = [t, ...t.multinpc.filter(i => i >= 0).map(i => NpcType.get(i))];
        for (let o = 0; o < 5; o++) {
            const labels = variants.map(v => v.op?.[o]).filter(l => l && l !== 'hidden');
            if (!labels.length) continue;
            if (labels.every(l => /attack/i.test(l!))) continue;
            const has = ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPNPC1 + o, t.id, -1) || (t.category !== -1 && ScriptProvider.getByTriggerSpecific(ServerTriggerType.OPNPC1 + o, -1, t.category));
            if (has) continue;
            const k = `${t.debugname} op${o + 1}=${[...new Set(labels)].join('/')}`;
            if (!out.has(k)) out.set(k, []);
            out.get(k)!.push(`${npc.x},${npc.z},${npc.level}`);
        }
    }
    return out;
}
export function printDead(title: string, x1: number, z1: number, x2: number, z2: number, levels = [0, 1, 2, 3]) {
    console.log(`-- dead ops: ${title}`);
    for (const [k, v] of deadLocOps(x1, z1, x2, z2, levels)) console.log(`   loc ${k}  x${v.length} ${v.slice(0, 4).join(' ')}`);
    for (const [k, v] of deadNpcOps(x1, z1, x2, z2)) console.log(`   npc ${k}  x${v.length} ${v.slice(0, 4).join(' ')}`);
}
export function locsNamed(name: string, x1: number, z1: number, x2: number, z2: number, levels = [0, 1, 2, 3]) {
    const id = LocType.getId(name);
    const out: number[][] = [];
    for (const level of levels)
        for (let zx = x1 & ~7; zx <= x2; zx += 8)
            for (let zz = z1 & ~7; zz <= z2; zz += 8) for (const loc of World.gameMap.getZone(zx, zz, level).getAllLocsUnsafe()) if (loc.type === id && loc.x >= x1 && loc.x <= x2 && loc.z >= z1 && loc.z <= z2) out.push([loc.x, loc.z, level]);
    return out;
}
export { H, World, LocType, NpcType, ObjType, ScriptProvider, ServerTriggerType, Player, Npc };
/** An ASCII picture of an area: '#' blocked tile, 'o' reached on foot from (sx,sz), '.' free but not reached. */
export function ascii(level: number, x1: number, z1: number, x2: number, z2: number, sx: number, sz: number) {
    const seen = new Set<string>([sx + ',' + sz]);
    const q = [[sx, sz]];
    while (q.length) {
        const [cx, cz] = q.pop()!;
        for (const [dx, dz] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1]
        ]) {
            const nx = cx + dx,
                nz = cz + dz,
                k = nx + ',' + nz;
            if (seen.has(k) || nx < x1 - 20 || nx > x2 + 20 || nz < z1 - 20 || nz > z2 + 20) continue;
            if (canTravel(level, cx, cz, dx, dz, 1, 0, CollisionType.NORMAL)) {
                seen.add(k);
                q.push([nx, nz]);
            }
        }
    }
    const rows: string[] = [];
    for (let z = z2; z >= z1; z--) {
        let row = String(z).padStart(5) + ' ';
        for (let x = x1; x <= x2; x++) row += seen.has(x + ',' + z) ? 'o' : walkable(level, x, z) ? '.' : '#';
        rows.push(row);
    }
    rows.push('      ' + Array.from({ length: x2 - x1 + 1 }, (_, i) => String((x1 + i) % 10)).join(''));
    return rows.join('\n');
}

/** Fight an npc to the death with real combat. Returns whether it died. */
/**
 * Attack an npc until it dies, or until maxTicks runs out.
 *
 * IT WATCHES THE NPC'S HITPOINTS, NOT JUST THE PLAYER'S TARGET. The re-attack below only fires
 * while the player has no target at all, and a target that is SET but out of reach never lands a
 * blow - so against anything that walks away (a wanderrange and a maxrange are enough) the loop
 * could spin out its whole budget with the npc barely scratched and then report a healthy npc as
 * "does not die to a real fight". That is what the Culinaromancer and the Big Snake in the monkey
 * pit were doing, both 120 hitpoints, about one run in five each, and it is the shape of every
 * boss-kill flake in these sims.
 *
 * So: if the npc's hitpoints have not moved for twelve ticks, close the distance and attack again.
 * It does nothing at all while damage is landing, which is why it is safe to put under every
 * caller rather than copied into the ones that happened to be flaky.
 */
export function fight(p: Player, npc: Npc, maxTicks = 600): boolean {
    if (Math.max(Math.abs(p.x - npc.x), Math.abs(p.z - npc.z)) > 2 || p.level !== npc.level) {
        p.teleport(npc.x + npc.width, npc.z, npc.level);
        H.tick(1);
    }
    H.attackNpc(p, npc);
    let lastHp = npc.levels[3];
    let stale = 0;
    for (let t = 0; t < maxTicks; t++) {
        H.tick(1);
        if (!npc.isActive || npc.levels[3] === 0) {
            H.tick(3);
            return true;
        }
        if (!p.target && !p.delayed && t % 6 === 5) H.attackNpc(p, npc);
        if (p.levels[3] < 50) p.levels[3] = 99;
        if (npc.levels[3] < lastHp) {
            lastHp = npc.levels[3];
            stale = 0;
        } else if (++stale > 12) {
            if (Math.max(Math.abs(p.x - npc.x), Math.abs(p.z - npc.z)) > 1 || p.level !== npc.level) {
                p.teleport(npc.x + npc.width, npc.z, npc.level);
                H.tick(1);
            }
            H.attackNpc(p, npc);
            stale = 0;
        }
    }
    return false;
}
/**
 * Pick up a ground obj at the player's feet or next to it (the take op, minus the route).
 *
 * IT WAITS FOR THE DROP. A kill's loot is not on the floor the instant the npc's hitpoints reach
 * zero: fight() returns as soon as levels[3] hits 0 and ticks three more, while the death script
 * runs its animation and its queue before anything is added. Looking once, on whichever tick the
 * caller happens to be on, is a race - and it is the race behind "the crab dies to a real fight:
 * true" followed by "crab meat: false" and an exception on the next line. Ten ticks of looking
 * costs nothing when the obj is already there, which is the usual case.
 */
export function take(p: Player, objName: string, radius = 3, waitTicks = 10): boolean {
    const id = ObjType.getId(objName);
    const look = () => {
        for (let dx = -radius; dx <= radius; dx++)
            for (let dz = -radius; dz <= radius; dz++) {
                const o = World.getObj(p.x + dx, p.z + dz, p.level, id, p.hash64 ?? -1n) ?? World.getObj(p.x + dx, p.z + dz, p.level, id, -1n);
                if (o) return o;
            }
        return null;
    };
    for (let t = 0; t <= waitTicks; t++) {
        const o = look();
        if (o) {
            World.removeObj(o, 0);
            H.give(p, objName, o.count);
            return true;
        }
        if (t < waitTicks) H.tick(1);
    }
    return false;
}
/** Run a proc the way an op script would: with protected access to the player. */
/** Returns what the proc returned, the same way H.runProc does - several of these have outputs. */
export function runProcProtected(p: Player, name: string, args: any[] = []): number[] {
    const script = ScriptProvider.getByName(name);
    if (!script) throw new Error('no such script: ' + name);
    const state = ScriptRunner.init(script, p, null, args);
    state.pointerAdd(ScriptPointer.ProtectedActivePlayer);
    p.protect = true;
    ScriptRunner.execute(state);
    p.protect = false;
    return (state as any).intStack.slice(0, (state as any).isp);
}
/** Put a loc into the world (a fire to cook on, say). */
export function addLoc(name: string, x: number, z: number, level = 0, shape = 10, duration = 500) {
    const t = LocType.get(LocType.getId(name));
    const loc = new Loc(level, x, z, t.width, t.length, EntityLifeCycle.DESPAWN, t.id, shape, 0);
    World.addLoc(loc, duration);
    return loc;
}
