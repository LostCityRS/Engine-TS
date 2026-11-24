/**
 * WHICH WAY A BANK TELLER STANDS, and whether it is at the booth it is standing at.
 *
 * Reported on the Varrock east bank (DeathPlateau-Bugs#75) and true of nearly every bank in the
 * game. Static npc spawns in the .jm2 map data carry a coordinate and an id and nothing else
 * (GameMap.loadNpcs), so there is no spawn direction to correct and the engine's default leaves an
 * npc facing SOUTH. Varrock east's four tellers stand directly south of their booths, so all four
 * had their backs to the counter and to the player using it.
 *
 * The content fix derives the facing from the map rather than writing it down: a teller faces its
 * one adjacent bank booth. This is the measurement that justified that rule and the check that it
 * is being applied.
 *
 *   npx tsx tools/sim/bankerfacing.ts
 */
import * as H from './harness.ts';
import { check, R } from './a1lib.ts';
import World from '#/engine/World.js';
import NpcType from '#/cache/config/NpcType.js';
import LocType from '#/cache/config/LocType.js';
import CategoryType from '#/cache/config/CategoryType.js';
import VarNpcType from '#/cache/config/VarNpcType.js';
import type Npc from '#/engine/entity/Npc.js';

await H.boot();

const TELLER = CategoryType.getId('bank_teller');

// EVERY LOC A PLAYER CALLS A BANK BOOTH, by name rather than by a list of type names. There are
// twenty-odd of them and they share no category, so a list here would be a list to forget the next
// booth from - and the content proc keys off the same name for the same reason.
const BOOTHS = new Set<number>();
for (let i = 0; i < LocType.count; i++) {
    const t = LocType.get(i);
    if (t && typeof t.name === 'string' && t.name.toLowerCase() === 'bank booth') BOOTHS.add(i);
}

function boothOn(level: number, x: number, z: number): boolean {
    for (const loc of World.gameMap.getZone(x, z, level).getAllLocsUnsafe()) {
        if (loc && loc.x === x && loc.z === z && BOOTHS.has(loc.type)) return true;
    }
    return false;
}

/** The one booth beside this teller, or null when there is none - and 'MANY' if the rule is ambiguous. */
function boothBeside(npc: Npc): [number, number] | null | 'MANY' {
    const found: [number, number][] = [];
    for (const [dx, dz] of [
        [0, 1],
        [1, 0],
        [0, -1],
        [-1, 0]
    ] as [number, number][]) {
        if (boothOn(npc.level, npc.x + dx, npc.z + dz)) found.push([npc.x + dx, npc.z + dz]);
    }
    if (found.length === 0) return null;
    if (found.length > 1) return 'MANY';
    return found[0];
}

/**
 * Where this npc is actually pointing, as a tile, from the fine coords ai_spawn set.
 *
 * faceAngleX/Z are FINE coords: CoordGrid.fine(pos, size) is pos * 2 + size, so the tile comes back
 * out as (fine - size) / 2. The size matters - a 2x2 npc's fine coord is offset by 2, not 1 - so
 * reading these as if they were tiles lands half a tile out on anything bigger than a teller.
 */
function facingTile(npc: any): [number, number] | null {
    if (npc.faceAngleX < 0 || npc.faceAngleZ < 0) return null;
    const w = npc.width ?? 1;
    const l = npc.length ?? 1;
    return [(npc.faceAngleX - w) / 2, (npc.faceAngleZ - l) / 2];
}

const tellers: Npc[] = [];
for (const npc of World.npcs) {
    if (npc && npc.isActive && NpcType.get(npc.type).category === TELLER) tellers.push(npc);
}
tellers.sort((a, b) => a.x - b.x || a.z - b.z);

/**
 * A SPAWN FACING ONLY MEANS ANYTHING FOR A TELLER THAT STAYS PUT, and that is not all of them.
 *
 * PathingEntity updates faceAngle on every step it takes, so a wandering npc overwrites whatever
 * ai_spawn gave it within a few ticks of the world starting - and walks off its booth while it is
 * at it. 12 of the 19 teller types have no movement config at all (moverestrict=0, wanderrange=5)
 * where banker1 and banker2 are nomove with wanderrange 0.
 *
 * This file checked all 98 at first and read four "WRONG" facings that were nothing of the kind:
 * an elid_banker pointing north with its booth to the east had simply taken a step. Scoping the
 * claim to the tellers that cannot move is the honest version; the wanderers are a separate
 * problem, and section 5 pins the list of them so it cannot grow quietly.
 */
function staysPut(npc: Npc): boolean {
    return NpcType.get(npc.type).wanderrange === 0;
}

// ---- 1. the rule is unambiguous, which is why it can be a rule ------------------------------
console.log('\n1. every bank teller has at most one booth beside it');
{
    check('there are bank booths to find', BOOTHS.size > 0, true);
    check('and bank tellers to face them', tellers.length > 50, true);
    const many = tellers.filter(n => boothBeside(n) === 'MANY');
    for (const n of many) console.log(`      AMBIGUOUS ${NpcType.get(n.type).debugname} L${n.level} ${n.x},${n.z}`);
    check(`no teller has two booths beside it, so "face your booth" is never a guess (${many.length})`, many.length, 0);

    const withBooth = tellers.filter(n => {
        const b = boothBeside(n);
        return b !== null && b !== 'MANY';
    });
    console.log(`      (${withBooth.length} of ${tellers.length} tellers stand at a booth; ${tellers.length - withBooth.length} stand nowhere near one)`);
    check('most of them do stand at a booth', withBooth.length > tellers.length / 2, true);
}

// ---- 2. and each one is facing it ------------------------------------------------------------
// THE REAL CHECK. ai_spawn has already run for every static npc by the time H.boot() returns, so
// this is reading the facing the game gave them rather than re-deriving it.
console.log('\n2. and every one that stays put is facing it');
{
    let wrong = 0;
    let right = 0;
    for (const npc of tellers) {
        if (!staysPut(npc)) continue;
        const booth = boothBeside(npc);
        if (booth === null || booth === 'MANY') continue;
        const face = facingTile(npc as any);
        const ok = face !== null && face[0] === booth[0] && face[1] === booth[1];
        if (ok) right++;
        else {
            wrong++;
            if (wrong <= 10) {
                console.log(`      WRONG ${String(NpcType.get(npc.type).debugname).padEnd(18)} L${npc.level} at ${npc.x},${npc.z} booth ${booth[0]},${booth[1]} facing ${face ? face.join(',') : 'nothing'}`);
            }
        }
    }
    check(`all ${right + wrong} fixed tellers at a booth are facing it (${wrong} are not)`, wrong, 0);
    check('  and there were a good number of them to check', right + wrong > 40, true);
}

// ---- 3. the bank this was reported about, named outright --------------------------------------
// Varrock east: four booths along z=3419, four tellers along z=3418 directly south of them. Facing
// south - the engine default - put every one of them back-to-counter. The reporter stood at
// 3253,3420, the player side. Named here so a regression says which bank came back.
console.log('\n3. Varrock east bank, which is the one that was reported');
for (const x of [3252, 3253, 3254, 3256]) {
    const npc = tellers.find(n => n.level === 0 && n.x === x && n.z === 3418);
    if (!npc) {
        check(`  a teller stands at ${x},3418`, false, true);
        continue;
    }
    const face = facingTile(npc as any);
    check(`  ${x},3418 faces its booth at ${x},3419, not south`, face ? `${face[0]},${face[1]}` : 'nothing', `${x},3419`);
}

// ---- 4. AND THE ONES WITH NO BOOTH WERE NOT GUESSED AT ---------------------------------------
// Twenty-nine tellers stand behind the row, in a doorway or at a chest. The map has no answer for
// those and the fix does not invent one: they keep the south every npc spawns with. A change that
// started pointing them somewhere would be inventing game behaviour, so it fails here.
console.log('\n4. a teller with no booth beside it is left exactly as it was');
{
    const none = tellers.filter(n => staysPut(n) && boothBeside(n) === null);
    console.log(`      (${none.length} tellers have no booth beside them)`);
    check('there are some, so this is a real case and not a vacuous check', none.length > 0, true);
    let moved = 0;
    for (const npc of none) {
        const face = facingTile(npc as any);
        // unfocus()'s south: the tile directly south of the npc
        if (!face || face[0] !== npc.x || face[1] !== npc.z - 1) moved++;
    }
    check(`none of them were pointed anywhere (${moved} were)`, moved, 0);
}

// ---- 5. AND THE SHARED SPAWN DEFAULTS STILL RUN ----------------------------------------------
// THE TRAP ai_spawn.rs2 NAMES IN ITS OWN COMMENT, and this file did not catch it until a mutation
// showed it up. A trigger written for one npc - or for one CATEGORY, which is what the fix adds -
// REPLACES the wildcard [ai_spawn,_] for every npc it covers, because the engine picks the most
// specific and runs only that. So [ai_spawn,_bank_teller] takes 98 npcs off ~npc_spawn_defaults,
// and if it forgets to call it back they lose %npc_start_coord and %npc_combat_xp_multiplier in
// silence. The Spinolyps had been doing exactly that for months.
//
// Deleting the ~npc_spawn_defaults line changed nothing in this file - 13 ok - until this section
// existed. %npc_start_coord is the one worth reading: it is set to npc_coord at spawn, so for a
// teller that cannot move it must still BE its coord.
console.log('\n5. and the shared spawn defaults still ran for all of them');
{
    const START = VarNpcType.getId('npc_start_coord');
    check('npc_start_coord exists to be read', START >= 0, true);
    let unset = 0;
    let checked = 0;
    for (const npc of tellers) {
        if (!staysPut(npc)) continue;
        checked++;
        const packed = (npc as any).getVar(START) as number;
        // CoordGrid.packCoord's shape: level << 28 | x << 14 | z
        const want = (npc.level << 28) | (npc.x << 14) | npc.z;
        if (packed !== want) unset++;
    }
    console.log(`      (${checked} fixed tellers checked)`);
    check(`every one has %npc_start_coord set to where it stands (${unset} do not)`, unset, 0);
}

// ---- 6. AND NO TELLER WANDERS OFF ITS BOOTH ---------------------------------------------------
// THIS SECTION USED TO BE A PIN ON TWELVE TYPES THAT DID. They had no movement config at all, so
// they took the engine default and walked up to five tiles - away from the counter a player was
// standing at, and losing the spawn facing section 1 sets, because PathingEntity rewrites an npc's
// facing on every step. That is how the wrong-way reports in section 1 came about: four tellers
// were reported facing wrongly and were not; they had simply taken a step.
//
// It was filed rather than decided (DeathPlateau-Bugs#80) because pinning npcs that belong to nine
// areas' quests and minigames - Rum Deal's ghosts, Cabin Fever, Mourning's End, the Mage Arena,
// Rogues' Den, the TzHaar, Keldagrim, Miscellania, Spirits of the Elid - is not a call to make
// inside a bug about which way a banker looks. What settled it was checking the one thing that
// could have made it wrong: whether anything in the build wants them to move. Nothing does.
// Eleven of the twelve are referenced by NO script; magearena_banker is referenced twice, by an
// [opnpc1] in gundai.rs2 and an [opnpcu] in platinum_token.rs2, and neither is about where it
// stands. DeathPlateau-Content now gives all twelve banker1's three lines.
//
// SO THE PIN BECOMES A ZERO, which is a stronger check than the list ever was: a new teller type
// added without movement config fails here, and so does one of these twelve losing its lines
// again.
console.log('\n6. no teller wanders off its booth');
{
    const WAS = [
        'ahoy_ghost_banker',
        'dwarf_city_banker1',
        'dwarf_city_banker2',
        'elid_banker',
        'fever_banker_01',
        'fever_banker_02',
        'magearena_banker',
        'misc_banker',
        'mourning_elf_bankerf',
        'mourning_elf_bankerm',
        'roguesden_banker',
        'tzhaar_banker1'
    ];
    const wander = [...new Set(tellers.filter(n => !staysPut(n)).map(n => NpcType.get(n.type).debugname ?? '?'))].sort();
    console.log(`      (${tellers.filter(n => !staysPut(n)).length} spawns across ${wander.length} types)`);
    check('no teller type wanders', wander.join(', ') || '(none)', '(none)');
    // AND THE TWELVE BY NAME, so that "none wander" cannot be satisfied by a teller list that has
    // quietly stopped finding them. Each of the twelve has to be among the tellers AND stand still.
    const found = WAS.filter(nm => tellers.some(n => (NpcType.get(n.type).debugname ?? '') === nm));
    check(`all ${WAS.length} of the formerly wandering types are still spawned and found`, found.length, WAS.length);
    const moving = WAS.filter(nm => tellers.some(n => (NpcType.get(n.type).debugname ?? '') === nm && !staysPut(n)));
    check('  and every one of them stands still now', moving.join(', ') || '(all still)', '(all still)');
}

console.log(R.bad ? `\nFAILED: ${R.bad} of ${R.ok + R.bad}` : `\n${R.ok} ok`);
process.exit(R.bad ? 1 : 0);
