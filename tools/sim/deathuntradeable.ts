// WHAT HAPPENS TO AN UNTRADEABLE WHEN YOU DIE, outside the Wilderness and inside it.
//
// Until 2026-11-19 the answer was the same in both places: it was dropped, and because INV_DROPALL
// and BOTH_DROPSLOT give an untradeable to its owner while Zone.revealObj refuses to reveal one at
// all, it sat on the floor private to the dead player for its whole 200-tick life and then
// vanished. So a quest item or a fire cape was lost to a green dragon exactly as it was lost to a
// player killer, and the only difference between a safe area and the Wilderness was who could pick
// the REST of your kit up.
//
// Now (Corey, 2026-11-19) an untradeable is KEPT on any death outside the Wilderness. The three
// exceptions are deliberate and tested below: objs flagged param=destroy_death, god capes (which
// have that flag and are reclaimed at the Mage Arena), and a looting bag's contents.
//
// Inside the Wilderness nothing changed, and the old engine behaviour above is still tested here -
// it is what a Wilderness death now relies on.
//
//   npx tsx tools/sim/deathuntradeable.ts
import * as H from './harness.ts';
import { check, R, player } from './a1lib.ts';
import InvType from '#/cache/config/InvType.js';
import ObjType from '#/cache/config/ObjType.js';
import Obj from '#/engine/entity/Obj.js';
import Player from '#/engine/entity/Player.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptPointer from '#/engine/script/ScriptPointer.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import World from '#/engine/World.js';
import Environment from '#/util/Environment.js';
import { EntityLifeCycle } from '#/engine/entity/EntityLifeCycle.js';
import fs from 'fs';

await H.boot();

// map_live reads Environment.NODE_PRODUCTION when the script runs, and a development world takes
// nothing at all on death (deathitems.ts covers that rule). Everything below is about the LIVE
// rules, so the whole run stands in the live world.
Environment.NODE_PRODUCTION = true;

function runScript(p: Player, name: string, killer?: Player): void {
    const script = ScriptProvider.getByName(name);
    if (!script) throw new Error('no such script: ' + name);
    const state = ScriptRunner.init(script, p, killer ?? null, []);
    state.pointerAdd(ScriptPointer.ProtectedActivePlayer);
    p.protect = true;
    ScriptRunner.execute(state);
    p.protect = false;
}

// THE PAIR THE REAL DEATH RUNS. [proc,player_death_lose_items] lifts the untradeables into
// deathkeep_untradeable and drops the rest; [queue,player_death_default] hands them back after the
// respawn teleport, so whatever will not fit lands at the player's feet in Lumbridge instead of
// back at the body. A sim cannot run the queue script - ~player_death delays inside it - so it
// runs the two halves, and the check below is what stops that from being a lie: if the hand-back
// ever stops following the teleport in death.rs2, this fails rather than passing on a sim-only
// ordering.
function die(p: Player, killer?: Player): void {
    runScript(p, killer ? '[proc,pvp_death_lose_items]' : '[proc,player_death_lose_items]', killer);
    runScript(p, '[proc,death_return_untradeables]');
}
{
    const src = fs.readFileSync(Environment.BUILD_SRC_DIR + '/scripts/player/scripts/death.rs2', 'utf8');
    const teleport = src.indexOf('p_teleport(map_findsquare(0_50_50_21_18');
    const handback = src.indexOf('~death_return_untradeables;');
    check('death.rs2 hands the untradeables back AFTER the respawn teleport', teleport > 0 && handback > teleport, true);
    check('  ...and does it exactly once', src.split('~death_return_untradeables;').length - 1, 1);
}

/** Everything lying around this player: name, who owns it, and whether it will ever go public. */
function floor(p: Player): { name: string; owner: string; reveals: boolean; count: number }[] {
    const out: { name: string; owner: string; reveals: boolean; count: number }[] = [];
    for (let zx = (p.x - 2) >> 3; zx <= (p.x + 2) >> 3; zx++) {
        for (let zz = (p.z - 2) >> 3; zz <= (p.z + 2) >> 3; zz++) {
            for (const obj of World.gameMap.getZone(zx << 3, zz << 3, p.level).getAllObjsSafe()) {
                if (Math.abs(obj.x - p.x) > 2 || Math.abs(obj.z - p.z) > 2) continue;
                if (obj.lifecycle !== EntityLifeCycle.DESPAWN) continue;
                const who = obj.receiver64 === Obj.NO_RECEIVER ? 'everyone' : (World.getPlayerByHash64(obj.receiver64)?.username ?? 'someone');
                out.push({
                    name: ObjType.get(obj.type).debugname ?? String(obj.type),
                    owner: who,
                    reveals: obj.reveal !== -1,
                    count: obj.count
                });
            }
        }
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
}

function clearFloor(p: Player): void {
    for (let zx = (p.x - 2) >> 3; zx <= (p.x + 2) >> 3; zx++)
        for (let zz = (p.z - 2) >> 3; zz <= (p.z + 2) >> 3; zz++) for (const obj of World.gameMap.getZone(zx << 3, zz << 3, p.level).getAllObjsSafe()) if (obj.lifecycle === EntityLifeCycle.DESPAWN) World.removeObj(obj, 0);
}

const show = (rows: ReturnType<typeof floor>) => rows.map(r => `${r.name}${r.count > 1 ? ' x' + r.count : ''} -> ${r.owner}${r.reveals ? ' (will go public)' : ''}`);

/** What is in any named inv, not just the carried one. */
function held(p: Player, invName: string): Record<string, number> {
    const type = InvType.getId(invName);
    if (type === -1) throw new Error('no such inv: ' + invName);
    const inv = p.getInventory(type);
    const out: Record<string, number> = {};
    if (!inv) return out;
    for (let i = 0; i < inv.capacity; i++) {
        const slot = inv.get(i);
        if (!slot) continue;
        const name = ObjType.get(slot.id).debugname ?? String(slot.id);
        out[name] = (out[name] ?? 0) + slot.count;
    }
    return out;
}

// SAFE GROUND AND THE WILDERNESS, read off the content rather than asserted. ~wilderness_level is
// what death.rs2 asks, so the sim asks it too: a coord the sim merely BELIEVES is Wilderness would
// test the safe-area rule twice and claim it had covered both.
const SAFE = { x: 3222, z: 3218 }; // Lumbridge
const WILD = { x: 3100, z: 3600 }; // level 11, west of the Chaos Temple
{
    const packed = (p: Player) => (p.level << 28) | (p.x << 14) | p.z;
    const probe: any = player('probe', SAFE.x, SAFE.z, 0);
    check('Lumbridge is not the Wilderness', H.runProc(probe, '[proc,wilderness_level]', [packed(probe)])[0], 0);
    const probe2: any = player('probe2', WILD.x, WILD.z, 0);
    check('  ...and the test coord in the Wilderness is', H.runProc(probe2, '[proc,wilderness_level]', [packed(probe2)])[0], 11);
}

// Five things carried: three tradeables and two untradeables, one of them a god cape.
function kit(p: any) {
    H.clearInv(p);
    H.give(p, 'shark', 3);
    H.give(p, 'rune_scimitar', 1);
    H.give(p, 'amulet_of_ghostspeak', 1); // untradeable, not a cape, cost 35 - the cheapest thing carried
    H.give(p, 'saradomin_cape', 1); // untradeable, category armour_godcape, param=destroy_death
    H.setVar(p, 'pk_skull', 1); // skulled, so nothing is kept by the three-priciest rule
    H.tick(1);
}

console.log('=== KILLED BY SOMETHING THAT IS NOT A PLAYER, OUTSIDE THE WILDERNESS');
{
    const p: any = player('pvm', SAFE.x, SAFE.z, 0);
    clearFloor(p);
    kit(p);
    die(p);
    const rows = floor(p);
    console.log('  on the floor:', show(rows));
    console.log('  still carried:', held(p, 'inv'));
    const owner = (n: string) => rows.find(r => r.name === n)?.owner;
    check('an untradeable is KEPT, skulled and all', H.invCount(p, 'amulet_of_ghostspeak'), 1);
    check('  ...and is not on the floor at all', owner('amulet_of_ghostspeak'), undefined);
    check('a tradeable is still lost, and public to everyone at once', owner('rune_scimitar'), 'everyone');
    check('  ...and so are the stacked ones', owner('shark'), 'everyone');
    check('a god cape is still destroyed, as its message says', owner('saradomin_cape'), undefined);
    check('  ...and is not kept either', H.invCount(p, 'saradomin_cape'), 0);
    check('the bones are still there', owner('bones'), 'everyone');
    check('nothing is left behind in the holding inv', Object.keys(held(p, 'deathkeep_untradeable')).length, 0);
}

console.log('\n=== THE SAME DEATH INSIDE THE WILDERNESS: nothing changed there');
{
    const p: any = player('pvmwild', WILD.x, WILD.z, 0);
    clearFloor(p);
    kit(p);
    die(p);
    const rows = floor(p);
    console.log('  on the floor:', show(rows));
    const owner = (n: string) => rows.find(r => r.name === n)?.owner;
    check('an untradeable IS lost in the Wilderness', H.invCount(p, 'amulet_of_ghostspeak'), 0);
    check('  ...dropped owned by the player who died', owner('amulet_of_ghostspeak'), 'pvmwild');
    // A reveal is SCHEDULED on anything with an owner, but Zone.revealObj refuses to reveal an
    // untradeable - it just stops trying. So the question is what the owner is AFTER the window.
    H.tick(Obj.REVEAL + 20);
    const after = floor(p);
    check('  ...and still only theirs once the reveal window has passed', after.find(r => r.name === 'amulet_of_ghostspeak')?.owner, 'pvmwild');
    check('the tradeable is public as ever', owner('rune_scimitar'), 'everyone');
}

console.log('\n=== KILLED BY A PLAYER IN THE WILDERNESS');
{
    const victim: any = player('victim', WILD.x, WILD.z, 0);
    const killer: any = player('killer', WILD.x + 1, WILD.z, 0);
    clearFloor(victim);
    kit(victim);
    die(victim, killer);
    const rows = floor(victim);
    console.log('  on the floor:', show(rows));
    const owner = (n: string) => rows.find(r => r.name === n)?.owner;
    check('a tradeable goes to the killer', owner('rune_scimitar'), 'killer');
    check('  ...and so do the stacked ones', owner('shark'), 'killer');
    check('an untradeable stays with the victim', owner('amulet_of_ghostspeak'), 'victim');
    H.tick(Obj.REVEAL + 20);
    const after = floor(victim);
    check('  ...and is STILL only the victim, so the killer can never take it', after.find(r => r.name === 'amulet_of_ghostspeak')?.owner, 'victim');
    check('  while the killer share goes public once the window passes', after.find(r => r.name === 'rune_scimitar')?.owner, 'everyone');
    check('a god cape IS destroyed on a player kill', owner('saradomin_cape'), undefined);
}

console.log('\n=== AND IF A PLAYER EVER KILLS YOU OUTSIDE IT');
// Nowhere does today: the Duel Arena returns before this proc and Castle Wars, Pest Control and
// the Fight Cave are safe deaths. The guard is on that path all the same, so opening player
// killing anywhere else cannot quietly start eating untradeables.
{
    const victim: any = player('victim2', SAFE.x, SAFE.z, 0);
    const killer: any = player('killer2', SAFE.x + 1, SAFE.z, 0);
    clearFloor(victim);
    kit(victim);
    die(victim, killer);
    const rows = floor(victim);
    console.log('  on the floor:', show(rows));
    check('the untradeable is kept on the pvp path too', H.invCount(victim, 'amulet_of_ghostspeak'), 1);
    check('  ...and the killer still gets the tradeables', rows.find(r => r.name === 'rune_scimitar')?.owner, 'killer2');
    check('  ...and a god cape is destroyed here as well, not carried home', [H.invCount(victim, 'saradomin_cape'), rows.some(r => r.name === 'saradomin_cape')], [0, false]);
}

console.log('\n=== WHAT IS STILL LOST OUTSIDE THE WILDERNESS');
{
    // param=destroy_death IS NOT THE LIST. It reads like one, and ten objs carry it, but the only
    // thing that consults it is the three-priciest calculation - it means "can never be one of the
    // items you keep", not "destroyed". Outside the Wilderness nothing ever destroyed an obj for
    // carrying it: the god capes are deleted by the loops in the death paths, and the Undertaker's
    // outfit by ~undertaker_outfit_destroy, which returns at once unless you are in the Wilderness.
    // So of the ten, only the three capes are lost here - the other seven are kept, which is the
    // point of the change and not an oversight in it.
    const flagged = H.objNamesByParam('destroy_death');
    console.log('  param=destroy_death:', flagged.join(', '));
    const p: any = player('destroy', SAFE.x, SAFE.z, 0);
    const lost: string[] = [];
    const survived: string[] = [];
    for (const name of flagged) {
        clearFloor(p);
        H.clearInv(p);
        H.give(p, name, 1);
        H.setVar(p, 'pk_skull', 1); // skulled: the three-priciest rule cannot be what saved it
        H.tick(1);
        die(p);
        const kept = H.invCount(p, name) > 0;
        const onFloor = floor(p).some(r => r.name === name);
        check(`  ${name} is ${kept ? 'kept' : onFloor ? 'dropped' : 'destroyed'}, and in one place only`, kept && onFloor, false);
        (kept ? survived : lost).push(name);
    }
    console.log('  lost:', lost.join(', '), '\n  kept:', survived.join(', '));
    check('the god capes are the only ones lost outside the Wilderness', lost.sort(), ['guthix_cape', 'saradomin_cape', 'zamorak_cape']);
    check("  ...so the Undertaker's outfit and Ana's barrel come home with you", survived.length, 7);

    // THE UNDERTAKER'S OUTFIT IS STILL RUINED IN THE WILDERNESS, and the killer still paid for it:
    // that is what the outfit is for, and ~undertaker_outfit_destroy is what does it, so the new
    // rule must not have got in front of it.
    const victim: any = player('undertaker', WILD.x, WILD.z, 0);
    const killer: any = player('undertaker_killer', WILD.x + 1, WILD.z, 0);
    clearFloor(victim);
    H.clearInv(victim);
    H.give(victim, 'undertaker_hat', 1);
    H.setVar(victim, 'pk_skull', 1);
    H.tick(1);
    die(victim, killer);
    console.log('  the outfit in the Wilderness:', held(victim, 'inv'), show(floor(victim)));
    check("the Undertaker's outfit is ruined in the Wilderness", H.invCount(victim, 'undertaker_hat'), 0);
    check(
        '  ...and it is gone, not on the floor',
        floor(victim).some(r => r.name === 'undertaker_hat'),
        false
    );
    check(
        '  ...and the killer is paid in Death tokens',
        floor(victim).some(r => r.name === 'death_token'),
        true
    );

    // A looting bag's contents are lost wherever you die (storage_items.rs2), untradeable or not.
    const bag: any = player('bag', SAFE.x, SAFE.z, 0);
    clearFloor(bag);
    H.clearInv(bag);
    H.give(bag, 'looting_bag', 1);
    const store = InvType.getId('looting_bag_store');
    bag.invAdd(store, ObjType.getId('rune_scimitar'), 1);
    bag.invAdd(store, ObjType.getId('amulet_of_ghostspeak'), 1);
    H.setVar(bag, 'pk_skull', 1);
    H.tick(1);
    die(bag);
    console.log('  looting bag after death:', held(bag, 'looting_bag_store'), 'carried:', held(bag, 'inv'));
    check('a looting bag is emptied by death', Object.keys(held(bag, 'looting_bag_store')).length, 0);
    check('  ...and an untradeable INSIDE it is not rescued', H.invCount(bag, 'amulet_of_ghostspeak'), 0);
    check('  ...while the bag itself, which is untradeable too, is kept', H.invCount(bag, 'looting_bag'), 1);
}

console.log('\n=== MORE UNTRADEABLES THAN 28 SLOTS HOLD');
// You can carry 42 (28 inventory, 14 worn) and respawn with 28. What fits comes back; the rest is
// dropped, not deleted - the one thing that must not happen here is an item quietly ceasing to
// exist because the hand-back ran out of room.
{
    const flagged = new Set(H.objNamesByParam('destroy_death'));
    const spare: string[] = [];
    for (const [name, id] of ObjType.configNames) {
        if (spare.length >= 42) break;
        const type = ObjType.get(id);
        if (type.tradeable !== false || type.stackable || type.certtemplate !== -1) continue;
        if (flagged.has(name) || type.category === ObjType.getId('saradomin_cape') /* never true: keeps tsc honest */) continue;
        if (name.endsWith('_cert') || name.startsWith('null')) continue;
        spare.push(name);
    }
    check('found enough distinct untradeables to overfill an inventory', spare.length, 42);

    const p: any = player('overflow', SAFE.x, SAFE.z, 0);
    clearFloor(p);
    H.clearInv(p);
    for (const name of spare.slice(0, 28)) H.give(p, name, 1);
    H.equip(p, {
        hat: spare[28],
        back: spare[29],
        front: spare[30],
        rhand: spare[31],
        torso: spare[32],
        lhand: spare[33],
        arms: spare[34],
        legs: spare[35],
        head: spare[36],
        hands: spare[37],
        feet: spare[38],
        jaw: spare[39],
        ring: spare[40],
        quiver: spare[41]
    });
    H.setVar(p, 'pk_skull', 1); // skulled: the three-priciest rule is out of the way
    H.tick(1);
    const before = 42;
    die(p);
    const carried = Object.values(held(p, 'inv')).reduce((a, b) => a + b, 0);
    const rows = floor(p).filter(r => spare.includes(r.name));
    const dropped = rows.reduce((a, r) => a + r.count, 0);
    console.log(`  carried ${before} untradeables, kept ${carried}, dropped ${dropped}`);
    check('the inventory comes back full', carried, 28);
    check('  ...and every single one of the other 14 is on the floor, not deleted', dropped, before - 28);
    check(
        '  ...owned by the player, as a dropped untradeable always is',
        rows.every(r => r.owner === 'overflow'),
        true
    );
    check('  ...and the holding inv is left empty either way', Object.keys(held(p, 'deathkeep_untradeable')).length, 0);
}

console.log('\n=== THE THREE KEPT ITEMS ARE UNCHANGED');
{
    const p: any = player('keep', SAFE.x, SAFE.z, 0);
    clearFloor(p);
    kit(p);
    H.setVar(p, 'pk_skull', 0); // unskulled: three kept
    H.tick(1);
    die(p);
    console.log('  carried:', held(p, 'inv'));
    // The ranking is oc_cost and nothing else, as it always was. What is new is that the ghostspeak
    // amulet no longer has to win a slot to survive - it loses the ranking and is kept anyway.
    check('the three dearest things are still what the rule keeps', [H.invCount(p, 'rune_scimitar'), H.invCount(p, 'shark')], [1, 2]);
    check('  ...and the cheap untradeable is kept besides', H.invCount(p, 'amulet_of_ghostspeak'), 1);
    check('  ...while a god cape is still barred outright', H.invCount(p, 'saradomin_cape'), 0);

    // In the Wilderness the ranking is all an untradeable has, exactly as before.
    const q: any = player('keepwild', WILD.x, WILD.z, 0);
    clearFloor(q);
    H.clearInv(q);
    H.give(q, 'shark', 3);
    H.give(q, 'dragonfire_shield', 1); // untradeable, cost 2,000,000
    H.setVar(q, 'pk_skull', 0);
    H.tick(1);
    die(q);
    check('an untradeable is kept in the Wilderness when it is the dearest thing carried', H.invCount(q, 'dragonfire_shield'), 1);
}

console.log('\n=== AND THE ITEMS KEPT ON DEATH SCREEN SAYS SO');
// The screen is worked out on copies (equipment_screens.rs2), so looking changes nothing - but it
// has to agree with death.rs2 or it lies to the player about the item they care most about.
{
    const p: any = player('preview', SAFE.x, SAFE.z, 0);
    H.clearInv(p);
    kit(p);
    H.setVar(p, 'pk_skull', 1); // skulled: every slot in the "you will lose" column
    H.tick(1);
    H.ifaces.length = 0;
    runScript(p, '[proc,items_kept_open]');
    const lose = held(p, 'deathpreview_lose');
    const info = H.ifaces
        .filter(i => i.kind === 'text')
        .map(i => i.text ?? '')
        .join(' ');
    console.log('  the lose column:', lose);
    check('the screen does not list an untradeable as lost', lose['amulet_of_ghostspeak'], undefined);
    check('  ...and does still list the tradeables', [lose['rune_scimitar'], lose['shark']], [1, 3]);
    check('  ...and a god cape, which really is lost', lose['saradomin_cape'], 1);
    check('  ...and says why', info.includes('cannot be') && info.includes('Wilderness'), true);
    for (const name of ['deathpreview_keep', 'deathpreview_lose']) {
        const t = InvType.getId(name);
        const inv = p.getInventory(t);
        if (inv) for (let i = 0; i < inv.capacity; i++) if (inv.get(i)) p.invDelSlot(t, i);
    }

    const q: any = player('previewwild', WILD.x, WILD.z, 0);
    H.clearInv(q);
    kit(q);
    H.setVar(q, 'pk_skull', 1);
    H.tick(1);
    H.ifaces.length = 0;
    runScript(q, '[proc,items_kept_open]');
    const loseWild = held(q, 'deathpreview_lose');
    const infoWild = H.ifaces
        .filter(i => i.kind === 'text')
        .map(i => i.text ?? '')
        .join(' ');
    console.log('  the lose column in the Wilderness:', loseWild);
    check('in the Wilderness the screen DOES list the untradeable as lost', loseWild['amulet_of_ghostspeak'], 1);
    check('  ...and drops the line about keeping it', infoWild.includes('cannot be'), false);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
