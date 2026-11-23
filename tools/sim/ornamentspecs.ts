/**
 * AN ORNAMENT KIT MUST NOT COST A WEAPON ITS SPECIAL ATTACK.
 *
 * Reported as "using orn kit on weps that has specs" (DeathPlateau-Bugs#54), and the shape of it is
 * worth keeping in mind for every future kit.
 *
 * A kit turns an item into a DIFFERENT obj: dragon_scimitar becomes dragon_scimitar_or. The
 * ornamented obj correctly carries param=specwep and param=sa_energy, so ~sa_enabled returns true,
 * the special bar lights up and the click spends the energy. But what the special actually DOES is
 * decided by `switch_obj($weapon)` in player_special_attack.rs2 and pvp_special_attack.rs2, and
 * those named only the plain ids - so a kitted weapon drained the bar and did nothing at all.
 *
 * Five of the build's 26 ornament pairs are spec weapons and all five were affected: the dragon
 * scimitar and the four godswords. The rest are armour and cosmetics, which is why this went
 * unnoticed.
 *
 * THE CHECK IS DERIVED, NOT A LIST OF FIVE. It walks every ornament pair in the cache, so a
 * seventeenth kit applied to a spec weapon fails here rather than reaching a player - which is the
 * point, because ornament_kit.rs2 is built so that "adding a kit is a config change and nothing
 * here has to know".
 *
 *   npx tsx tools/sim/ornamentspecs.ts
 */
import fs from 'fs';
import path from 'path';
import * as H from './harness.ts';
import { check, R } from './a1lib.ts';
import ObjType from '#/cache/config/ObjType.js';
import ParamType from '#/cache/config/ParamType.js';
import Environment from '#/util/Environment.js';

await H.boot();

const param = (t: any, name: string) => {
    const id = ParamType.getId(name);
    return id >= 0 ? (t?.params?.get(id) as number | undefined) : undefined;
};
const objName = (id: number) => ObjType.get(id)?.debugname ?? String(id);

/** Every obj named in a `case` of a special-attack switch, plus any special-cased above it. */
function weaponsNamedIn(file: string): Set<string> {
    const src = fs.readFileSync(path.join(Environment.BUILD_SRC_DIR, file), 'utf8');
    const out = new Set<string>();
    for (const m of src.matchAll(/^\s*case ([^:]+):/gm)) {
        for (const c of m[1].split(',')) out.add(c.trim());
    }
    // the granite maul is handled by an `if` above the switch rather than a case
    for (const m of src.matchAll(/=\s*(\w+)\)\s*\{/g)) out.add(m[1]);
    return out;
}

const DISPATCH: [string, string][] = [
    ['player_special_attack.rs2', 'scripts/skill_combat/scripts/player/player_special_attack.rs2'],
    ['pvp_special_attack.rs2', 'scripts/skill_combat/scripts/pvp/pvp_special_attack.rs2']
];

/** [base, ornamented] for every ornament kit pair in the cache. */
const PAIRS: [number, number][] = [];
for (let i = 0; i < ObjType.count; i++) {
    const t = ObjType.get(i);
    if (!t?.debugname) continue;
    for (const slot of ['ornament_into', 'ornament_into2', 'ornament_into3']) {
        const into = param(t, slot);
        if (into !== undefined && into !== null) PAIRS.push([i, into]);
    }
}

console.log(`\n${PAIRS.length} ornament kit pairs in the cache`);

// ---- 1. an ornamented weapon keeps the params that light the special bar ----------------------
// If these were lost the bar would simply be greyed out, which is a different bug and not this one.
// Asserted so that "the spec works" cannot be achieved by quietly removing specwep.
console.log('\n1. an ornamented spec weapon still declares its special attack');
{
    let spec = 0;
    for (const [base, orn] of PAIRS) {
        if (param(ObjType.get(base), 'specwep') !== 1) continue;
        spec++;
        check(`  ${objName(orn).padEnd(26)} keeps specwep`, param(ObjType.get(orn), 'specwep'), 1);
        check(`    ...and the same sa_energy as ${objName(base)}`, param(ObjType.get(orn), 'sa_energy'), param(ObjType.get(base), 'sa_energy'));
    }
    console.log(`      (${spec} of the ${PAIRS.length} pairs are spec weapons)`);
    check('there are spec weapons with kits, so this is not vacuous', spec > 0, true);
}

// ---- 2. AND THE DISPATCH KNOWS ABOUT IT -------------------------------------------------------
// THE ACTUAL BUG. Both switches decide what the special does; a weapon the bar enables but the
// switch does not name is a weapon that spends energy for nothing.
console.log('\n2. and both special-attack switches name it');
for (const [label, file] of DISPATCH) {
    const named = weaponsNamedIn(file);
    const missing: string[] = [];
    for (const [base, orn] of PAIRS) {
        if (param(ObjType.get(base), 'specwep') !== 1) continue;
        // only weapons the dispatch handles at all - if the plain one is absent too, that is a
        // different gap and not something an ornament kit broke
        if (!named.has(objName(base))) continue;
        if (!named.has(objName(orn))) missing.push(`${objName(orn)} (for ${objName(base)})`);
    }
    for (const m of missing) console.log(`      MISSING ${m}`);
    check(`  ${label.padEnd(26)} names every ornamented spec weapon (${missing.length} missing)`, missing.length, 0);
    check(`    ...and names a decent number of weapons at all (${named.size})`, named.size > 20, true);
}

// ---- 3. the plain weapons are still there -----------------------------------------------------
// The lazy way to make section 2 pass is to drop the plain ids. Named so it cannot happen quietly.
console.log('\n3. and the plain weapons were not displaced by them');
for (const [label, file] of DISPATCH) {
    const named = weaponsNamedIn(file);
    const gone = PAIRS.filter(([base]) => param(ObjType.get(base), 'specwep') === 1)
        .map(([base]) => objName(base))
        .filter(n => !named.has(n));
    check(`  ${label.padEnd(26)} still names every plain one (${gone.join(', ') || 'none missing'})`, gone.length, 0);
}

console.log(R.bad ? `\nFAILED: ${R.bad} of ${R.ok + R.bad}` : `\n${R.ok} ok`);
process.exit(R.bad ? 1 : 0);
