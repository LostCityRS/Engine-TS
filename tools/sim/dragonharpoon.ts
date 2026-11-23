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
import VarPlayerType from '#/cache/config/VarPlayerType.js';
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
// ------------------------------------------------------------------ Fishstabber
//
// "A visible +3 boost to Fishing. This consumes 100% of the player's special attack energy."
// It lands no hit and needs no target, so it runs on the spec bar's own click
// ([if_button,combat_stabsword:specbar], specwep.rs2) rather than through player_special_attack,
// which refuses before it reads the weapon unless an npc is in front of you.
const SA_ENERGY = VarPlayerType.getByName('sa_energy')!.id;
const SPECBAR = 'combat_stabsword:specbar';

// THE BAR HAS TO BE FILLED BY HAND, and that is not a bug in this feature. sa_energy is a perm
// varp with no default and nothing sets it to full for a new account - [proc,sa_login] only starts
// the regen timer - so a freshly made player has an EMPTY bar and the energy check refuses
// everything. That is true of every special weapon in the build, not just this one, and five
// minutes of regen fixes it for a real account; a sim player lives for a few hundred ticks, so it
// is filled here the way a player who has been online a while would have it.
function fullBar(p: Player) {
    p.setVar(SA_ENERGY, 1000);
    H.tick(1);
}

function wielding(name: string, fishing: number): Player {
    const p = A.player(name, 2600, 3420);
    setLevel(p, FISHING, fishing);
    setLevel(p, ATTACK, 60);
    H.give(p, 'dragon_harpoon', 1);
    H.opheld(p, 'dragon_harpoon', 2);
    H.tick(2);
    if (H.wornName(p, WEARPOS_RHAND) !== 'dragon_harpoon') throw new Error('did not wield');
    fullBar(p);
    return p;
}

{
    const p = wielding('dh_spec', 80);
    check('the bar is full to start', p.getVar(SA_ENERGY), 1000);
    H.clearLogs();
    H.ifButton(p, SPECBAR);
    H.tick(2);
    check('Fishstabber boosts Fishing by 3', p.levels[FISHING] - p.baseLevels[FISHING], 3);
    check('  and spends the whole bar', p.getVar(SA_ENERGY), 0);
    check('  and says so', H.says.some(s => s.who === p.username && s.text === 'Here fishy fishies!'), true);
}
{
    // NOT ENOUGH ENERGY: refused with the game's own wording, and no boost.
    const p = wielding('dh_specpoor', 80);
    p.setVar(SA_ENERGY, 900);
    H.clearLogs();
    H.ifButton(p, SPECBAR);
    H.tick(2);
    check('nine tenths of a bar is not enough', p.levels[FISHING] - p.baseLevels[FISHING], 0);
    check('  and is told so', H.mesgs.some(m => m.text.includes('enough power left')), true);
    check('  and the bar is untouched', p.getVar(SA_ENERGY), 900);
}
{
    // CARRIED IS NOT WIELDED. "Special attacks require the player to wield the weapon", which is
    // also how the 60 Attack gate ends up gating the boost: no wield, no Fishstabber.
    const p = A.player('dh_specheld', 2600, 3420);
    setLevel(p, FISHING, 80);
    H.give(p, 'dragon_harpoon', 1);
    fullBar(p);
    H.ifButton(p, SPECBAR);
    H.tick(2);
    check('a harpoon in the pack cannot spec', p.levels[FISHING] - p.baseLevels[FISHING], 0);
    check('  and spends nothing', p.getVar(SA_ENERGY), 1000);
}
{
    // IT SHOWS PAST 99, as in Old School, while the rolls treat anything above 99 as 99 - the
    // engine's stat_random clamps the level itself, which is why speccing at 99 is worthless.
    const p = wielding('dh_spec99', 99);
    H.ifButton(p, SPECBAR);
    H.tick(2);
    check('99 Fishing becomes a visible 102', p.levels[FISHING], 102);
}
{
    // AND THE BOOST REACHES THE ROLL, which is the only question that really matters. A shark at
    // level 82 with this harpoon is value 40 and at 85 it is 42, so a pinned roll of 41 is one the
    // unboosted player can never clear and the boosted one always does.
    const before = atSpot('dh_specroll_a', 82);
    H.give(before.p, 'dragon_harpoon', 1);
    pin(atRoll(41));
    check('82 Fishing cannot catch it', harpoon(before.p, before.spot), false);
    pin(null);

    const after = atSpot('dh_specroll_b', 82);
    setLevel(after.p, ATTACK, 60);
    H.give(after.p, 'dragon_harpoon', 1);
    H.opheld(after.p, 'dragon_harpoon', 2);
    H.tick(2);
    fullBar(after.p);
    H.ifButton(after.p, SPECBAR);
    H.tick(2);
    check('  the spec takes it to 85', after.p.levels[FISHING], 85);
    pin(atRoll(41));
    check('  and then it catches', harpoon(after.p, after.spot), true);
    pin(null);
}
{
    // "DOES NOT DISRUPT RESOURCE GATHERING if the player is already fishing when the special
    // attack is activated" - so the fish keep coming after the click, not only before it.
    const { p, spot } = atSpot('dh_specmid', 85);
    setLevel(p, ATTACK, 60);
    H.give(p, 'dragon_harpoon', 1);
    H.opheld(p, 'dragon_harpoon', 2);
    H.tick(2);
    fullBar(p);
    pin(atRoll(30));
    H.opNpc(p, spot, 3);
    H.tick(6); // fishing is under way
    H.ifButton(p, SPECBAR);
    const caught = H.invCount(p, 'raw_shark');
    let more = false;
    for (let t = 0; t < 20 && !more; t++) {
        H.tick(1);
        if (H.invCount(p, 'raw_shark') > caught) more = true;
    }
    pin(null);
    check('speccing mid-catch does not stop the fishing', more, true);
    check('  and it did boost', p.levels[FISHING] - p.baseLevels[FISHING], 3);
}

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
