// THE DRAGON HARPOON. https://oldschool.runescape.wiki/w/Dragon_harpoon
//
// Ported from OSRS obj 21028 and given a 1/128 drop from Dagannoth Supreme. Three things need
// proving and only the first is a reading:
//
//   the config - stats, requirements, the note - which a typo in a param name would silently lose;
//   that it FISHES, wielded as well as carried, since being wieldable is the whole point of it and
//   the pack is the only place the old harpoon check looked;
//   and the 20% catch rate, EXACTLY, which is the part that could be plausibly wrong.
//
// THE 20% IS PROVED BY PINNING THE ROLL, not by counting catches. stat_random interpolates the
// fish's success_low and success_high by the player's level into a value out of 256 and succeeds
// when `value > floor(nextDouble() * 256)`. A shark is low 3 / high 40, so at level 85 the plain
// harpoon's value is 35 and the dragon harpoon's is 42 - 35 x 1.2 to the integer. Pin the roll at
// 38 and the plain harpoon can NEVER catch while the dragon harpoon always does; pin it at 30 and
// both do; at 45, neither. Three attempts, no statistics, and a rate that is 10% or 30% instead
// fails at least one of them.
import * as H from './harness.ts';
import * as A from './a1lib.ts';
import { check, R } from './a1lib.ts';
import World from '#/engine/World.js';
import ObjType from '#/cache/config/ObjType.js';
import NpcType from '#/cache/config/NpcType.js';
import ParamType from '#/cache/config/ParamType.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import JavaRandom from '#/util/JavaRandom.js';
import { getExpByLevel } from '#/engine/entity/Player.js';
import type Player from '#/engine/entity/Player.js';
import type Npc from '#/engine/entity/Npc.js';

await H.boot();

const FISHING = 10;
const ATTACK = 0;
const WEARPOS_RHAND = 3;

// ONE STUB, SWITCHED BY A VARIABLE, rather than replacing nextDouble on and off. The drop test
// below has to pin the roll part way through a kill - see the long note there - and a stub that
// replaces the function cannot be switched on while the engine is mid-tick.
const origND = JavaRandom.nextDouble.bind(JavaRandom);
let pinned: number | null = null;
(JavaRandom as unknown as { nextDouble: () => number }).nextDouble = () => (pinned === null ? origND() : pinned);
const pin = (v: number | null) => {
    pinned = v;
};
/** A nextDouble that makes floor(nextDouble() * 256) exactly `roll`. */
const atRoll = (roll: number) => (roll + 0.5) / 256;

function setLevel(p: Player, stat: number, level: number) {
    p.baseLevels[stat] = level;
    p.levels[stat] = level;
    p.stats[stat] = getExpByLevel(level);
    H.tick(1);
}

// ------------------------------------------------------------------ the config
{
    const id = ObjType.getId('dragon_harpoon');
    check('the obj exists', id >= 0, true);
    const t = ObjType.get(id);
    check('examine', t.desc, 'A very powerful harpoon.');
    check('value', t.cost, 55000);
    check('weight', t.weight, 2267);
    check('equips in the weapon hand', t.wearpos, WEARPOS_RHAND);
    check('not stackable', !!t.stackable, false);

    const param = (name: string) => t.params.get(ParamType.getId(name));
    // Old School's own numbers, every one of which a mistyped param name would lose silently.
    check('stab bonus', param('stabattack'), 38);
    check('slash bonus', param('slashattack'), 32);
    check('slash defence', param('slashdefence'), 1);
    check('strength bonus', param('strengthbonus'), 42);
    check('60 Attack to wield', param('levelrequire'), 60);
    check('5 ticks a swing', param('attackrate'), 5);
    // rs2check rule 19: a weapon_stab is swung as stab AND slash, and a style with no sound ends
    // the session. Both are asserted here as well, because the rule only reads the config text.
    check('has a stab sound', !!param('stab_sound'), true);
    check('has a slash sound', !!param('slash_sound'), true);
    check('fishes as a harpoon', !!param('fish_equipment_struct'), true);

    const note = ObjType.getId('cert_dragon_harpoon');
    check('it has a banknote', note >= 0, true);
    check('  whose certlink is the harpoon', ObjType.get(note).certlink, id);
    check('  and which unnotes back to it', ObjType.get(note).certtemplate >= 0, true);
}

// ------------------------------------------------------------------ wielding it
{
    const p = A.player('dh_wield59', 2600, 3420);
    setLevel(p, ATTACK, 59);
    H.give(p, 'dragon_harpoon', 1);
    H.clearLogs();
    H.opheld(p, 'dragon_harpoon', 2); // Wield
    H.tick(2);
    check('59 Attack cannot wield it', H.wornName(p, WEARPOS_RHAND), null);
    // levelrequire.rs2's wording, which is lower case: "You need to have an attack level of 60."
    check('  and is told the level it wants', H.mesgs.some(m => m.text.includes('attack level of 60')), true);
    check('  and still has it', H.invCount(p, 'dragon_harpoon'), 1);
}
{
    const p = A.player('dh_wield60', 2600, 3420);
    setLevel(p, ATTACK, 60);
    H.give(p, 'dragon_harpoon', 1);
    H.opheld(p, 'dragon_harpoon', 2);
    H.tick(2);
    check('60 Attack wields it', H.wornName(p, WEARPOS_RHAND), 'dragon_harpoon');
}

// ------------------------------------------------------------------ fishing with it
function sharkSpot(p: Player): Npc {
    let best: Npc | null = null;
    let bestD = Infinity;
    for (const n of World.npcs) {
        const nm = NpcType.get(n.type).debugname ?? '';
        if (!nm.endsWith('_memberfish')) continue;
        const d = Math.max(Math.abs(n.x - p.x), Math.abs(n.z - p.z));
        if (d < bestD) {
            bestD = d;
            best = n;
        }
    }
    if (!best) throw new Error('no shark fishing spot in the world');
    return best;
}

/** Click Harpoon on a shark spot and let it run; true if a shark was caught. */
function harpoon(p: Player, spot: Npc, ticks = 16): boolean {
    const before = H.invCount(p, 'raw_shark');
    H.opNpc(p, spot, 3);
    for (let t = 0; t < ticks; t++) {
        H.tick(1);
        if (H.invCount(p, 'raw_shark') > before) return true;
    }
    return false;
}

function atSpot(name: string, fishing: number): { p: Player; spot: Npc } {
    const probe = A.player(name + '_probe', 2600, 3420);
    const spot = sharkSpot(probe);
    const p = A.player(name, spot.x + 1, spot.z);
    p.teleport(spot.x + 1, spot.z, spot.level);
    H.tick(1);
    setLevel(p, FISHING, fishing);
    setLevel(p, ATTACK, 60);
    return { p, spot };
}

{
    const { p, spot } = atSpot('dh_notool', 85);
    H.clearLogs();
    harpoon(p, spot, 8);
    check('no harpoon at all is refused', H.ifaces.some(i => i.kind === 'text' && !!i.text && i.text.toLowerCase().includes('harpoon')), true);
    check('  and catches nothing', H.invCount(p, 'raw_shark'), 0);
}
{
    // 60 FISHING WITH A DRAGON HARPOON: the level, not the tool, is what is missing.
    const { p, spot } = atSpot('dh_level60', 60);
    H.give(p, 'dragon_harpoon', 1);
    H.clearLogs();
    harpoon(p, spot, 8);
    const said = H.ifaces
        .filter(i => i.kind === 'text' && i.text)
        .map(i => i.text!)
        .join(' ');
    check('60 Fishing cannot use a dragon harpoon', said.includes('76 Fishing') || said.includes('Fishing level of 61'), true);
    check('  and catches nothing', H.invCount(p, 'raw_shark'), 0);
}
{
    // CARRIED, at the shark's own level, with the roll pinned to succeed for either harpoon.
    const { p, spot } = atSpot('dh_carry', 85);
    H.give(p, 'dragon_harpoon', 1);
    pin(atRoll(30));
    check('a carried dragon harpoon fishes', harpoon(p, spot), true);
    pin(null);
}
{
    // WIELDED - the case the old check could not see, because it only looked in the pack.
    const { p, spot } = atSpot('dh_worn', 85);
    H.give(p, 'dragon_harpoon', 1);
    H.opheld(p, 'dragon_harpoon', 2);
    H.tick(2);
    check('it is in the weapon hand', H.wornName(p, WEARPOS_RHAND), 'dragon_harpoon');
    check('  and the pack is empty', H.invCount(p, 'dragon_harpoon'), 0);
    pin(atRoll(30));
    check('a WIELDED dragon harpoon fishes', harpoon(p, spot), true);
    pin(null);
}

// ------------------------------------------------------------------ the 20%, exactly
//
// shark: success_low 3, success_high 40. At level 85 the engine's value is
//   plain:  floor(3*14/98) + floor(40*84/98) + 1 = 0 + 34 + 1 = 35
//   dragon: low and high scaled by 6/5 -> 3 and 48, so 0 + floor(48*84/98) + 1 = 0 + 41 + 1 = 42
// and 42 is 35 x 1.2 to the integer.
for (const [roll, plainWant, dragonWant, what] of [
    [30, true, true, 'a roll both values clear'],
    [38, false, true, 'a roll ONLY the dragon harpoon clears'],
    [45, false, false, 'a roll neither value clears']
] as [number, boolean, boolean, string][]) {
    pin(atRoll(roll));
    const plain = atSpot(`dh_p${roll}`, 85);
    H.give(plain.p, 'harpoon', 1);
    check(`${what} (${roll}): plain harpoon`, harpoon(plain.p, plain.spot), plainWant);

    const dragon = atSpot(`dh_d${roll}`, 85);
    H.give(dragon.p, 'dragon_harpoon', 1);
    check(`${what} (${roll}): dragon harpoon`, harpoon(dragon.p, dragon.spot), dragonWant);
    pin(null);
}

// ------------------------------------------------------------------ the drop
// ------------------------------------------------------------------ the drop, band by band
//
// 1/128, the band the dragon axe already has from Rex, and taken OUT OF THE GEM BAND so nothing
// else in Supreme's table moved. `random(128)` is `JavaRandom.nextDouble() * 128` truncated, so
// a pinned nextDouble picks the band outright: 74 must still be the raw sharks it was, 75 the new
// harpoon, 76 the gems. That is the point of testing three - a boundary off by one would take the
// harpoon's slot from a neighbour, and the neighbour's loss does not show in a single draw.
//
// THE KING HAS TO BE KILLED FOR REAL, which took two attempts to learn. Running
// [ai_queue3,dagcave_ranged_boss] directly looked ideal - set a hero, pin the roll, read the
// ground - and it dropped nothing at all, not even the king bones every kill gives. The trigger's
// first line is `gosub(npc_death)`, and npc_death's fifth is `npc_arrivedelay`: that PARKS the
// script for up to two ticks, so everything after it, which is the whole table, had not run when
// execute() returned. A script started by hand is attached to nothing, so no amount of ticking
// afterwards resumes it either.
//
// SO THE TABLE IS ENQUEUED ON THE NPC, which is what a kill does and what makes the parked script
// resume. Nothing in the engine notices an npc reaching zero hitpoints - death is content's job,
// and content ends it with `npc_queue(3, ...)`, which is Npc.enqueueScript(AI_QUEUE3). Queued that
// way the script belongs to the npc, so when npc_arrivedelay parks it the next tick picks it up
// again and the table rolls. Two earlier shapes did not work and are worth not repeating: running
// the trigger by hand (parks and is never resumed) and fighting the king down (a maxed sim player
// cannot reliably hit it, because maxOut writes no [changestat] and %com_* stay a level-1
// character's - thirty ticks of swinging at a one-hitpoint boss killed nothing).
//
// The pin goes on with the queue and comes off after: a constant nextDouble decides everything
// else in those ticks too, which is harmless precisely because it is constant.
// WHAT THIS KILL DROPPED, not what is lying there. Every band is killed on the same tile and a
// lootdrop lasts long enough to still be there for the next one, so band 76 "dropped" band 75's
// harpoon and the test passed the boundary it was meant to catch. The before list is subtracted.
function objsAround(nx: number, nz: number, nl: number): string[] {
    const out: string[] = [];
    for (const obj of World.gameMap.getZone(nx, nz, nl).getAllObjsUnsafe()) {
        if (Math.abs(obj.x - nx) <= 2 && Math.abs(obj.z - nz) <= 2) out.push(ObjType.get(obj.type).debugname ?? String(obj.type));
    }
    return out;
}

function dropAt(band: number): string[] {
    const p = A.player(`dh_drop${band}`, 2444, 10147);
    const npc = H.addNpc('dagcave_ranged_boss', p.x + 2, p.z);
    H.tick(1);
    const [nx, nz, nl] = [npc.x, npc.z, npc.level];
    const before = objsAround(nx, nz, nl);
    npc.heroPoints.addHero(p.hash64, 100);
    npc.applyDamage(npc.levels[3], 0);
    npc.enqueueScript(ServerTriggerType.AI_QUEUE3, 0, 0);
    pin((band + 0.5) / 128);
    H.tick(10); // the queue, the arrivedelay, then the table
    pin(null);
    const after = objsAround(nx, nz, nl);
    for (const was of before) {
        const i = after.indexOf(was);
        if (i !== -1) after.splice(i, 1);
    }
    return after;
}
{
    const band74 = dropAt(74);
    check('74 is still the raw sharks', band74.includes('shark'), true);
    check('  and not the harpoon', band74.includes('cert_dragon_harpoon'), false);

    const band75 = dropAt(75);
    check('75 drops the dragon harpoon', band75.includes('cert_dragon_harpoon'), true);
    check('  noted, as the axe is', band75.includes('dragon_harpoon'), false);
    check('  and the king bones every kill gives', band75.includes('dagannoth_king_bones'), true);

    const band76 = dropAt(76);
    check('76 is the gem table, not the harpoon', band76.includes('cert_dragon_harpoon'), false);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
