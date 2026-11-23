/**
 * THE KING BLACK DRAGON'S BREATH, AND THE MESH IT IS PLAYED ON.
 *
 * Reported as "kbd. kbds animation is bugged" (DeathPlateau-Bugs#56). The same fault as the
 * Melzar's Maze skeletons (#68) and found the same way: an animation authored for one mesh played
 * on another.
 *
 * THERE ARE TWO KING BLACK DRAGON MODELS IN THE BUILD. npc_king_dragon is the 377-native one -
 * black_dragon still wears it - and npc_king_dragon_1..5 is the OSRS import, which is what the
 * king_dragon npc wears today. Its config declares the matching OSRS animation set, osrs_seq_89
 * through 92, and those pose correctly on it.
 *
 * But king_black_dragon.rs2 did not use them. It named dragon_firebreath_middle/left/right/all,
 * which were authored against the 377 mesh. Posed with content's tools/pose377.py:
 *
 *   dragon_firebreath_all_attack on npc_king_dragon (377)      a clean rear-and-breathe
 *   dragon_firebreath_all_attack on npc_king_dragon_1..5 (OSRS) tail and legs stretched into flat
 *                                                               spikes, the back half collapsed
 *   osrs_seq_91 on npc_king_dragon_1..5                         correct
 *
 * The npc was re-modelled and the script was never told. It now reads npc_param(attack_anim), so
 * the config is the single place the animation is named and the two cannot drift apart again.
 *
 *   npx tsx tools/sim/kbdanims.ts
 */
import fs from 'fs';
import path from 'path';
import * as H from './harness.ts';
import { check, R } from './a1lib.ts';
import NpcType from '#/cache/config/NpcType.js';
import SeqType from '#/cache/config/SeqType.js';
import ParamType from '#/cache/config/ParamType.js';
import Environment from '#/util/Environment.js';

await H.boot();

const seqName = (v?: number) => (v === undefined || v < 0 ? '-' : (SeqType.get(v)?.debugname ?? String(v)));
const param = (t: any, name: string) => {
    const pid = ParamType.getId(name);
    return pid >= 0 ? (t.params?.get(pid) as number | undefined) : undefined;
};

const KBD = NpcType.get(NpcType.getId('king_dragon'));
const SRC = fs.readFileSync(path.join(Environment.BUILD_SRC_DIR, 'scripts/areas/area_wilderness/scripts/king_black_dragon.rs2'), 'utf8');

// ---- 1. the config names the OSRS set, which is what its mesh wears -------------------------
console.log('\n1. the king black dragon declares the animation set that matches its model');
{
    check('readyanim is the OSRS idle', seqName(KBD.readyanim), 'osrs_seq_90');
    check('attack_anim is the OSRS attack', seqName(param(KBD, 'attack_anim')), 'osrs_seq_91');
    check('defend_anim is the OSRS block', seqName(param(KBD, 'defend_anim')), 'osrs_seq_89');
    check('death_anim is the OSRS death', seqName(param(KBD, 'death_anim')), 'osrs_seq_92');
}

// ---- 2. and the script plays THAT, rather than naming a seq of its own ----------------------
// THE REGRESSION THAT WAS REPORTED. Five calls named dragon_firebreath_* - the 377 mesh's
// animations - on an npc wearing the OSRS mesh. Reading the param is what keeps the config the
// single place the animation is named.
console.log("\n2. and king_black_dragon.rs2 plays the config's animation, not one of its own");
{
    const breath = SRC.match(/npc_anim\(dragon_firebreath_\w+\s*,/g) ?? [];
    check(`no dragon_firebreath_* seq is named in the script (${breath.length})`, breath.length, 0);
    const fromParam = SRC.match(/npc_anim\(npc_param\(attack_anim\)\s*,/g) ?? [];
    check(`  ...and ${fromParam.length} breath calls read npc_param(attack_anim)`, fromParam.length >= 5, true);
}

// ---- 3. the 377 dragons that those animations BELONG to are untouched ------------------------
// The lazy fix is to delete dragon_firebreath_* everywhere. black_dragon and the rest still wear
// npc_king_dragon and npc_red_dragon, the meshes those frames were authored for, and posing them
// there is a clean rear-and-breathe. They must keep them.
console.log('\n3. the 377-mesh dragons keep the animations those frames were authored for');
for (const n of ['black_dragon', 'red_dragon', 'blue_dragon']) {
    const t = NpcType.get(NpcType.getId(n));
    check(`  ${n.padEnd(14)} still uses the 377 dragon set`, seqName(t.readyanim), 'dragon_ready');
}
check('and dragon_firebreath_all_attack still exists to be used', SeqType.getId('dragon_firebreath_all_attack') >= 0, true);

console.log(R.bad ? `\nFAILED: ${R.bad} of ${R.ok + R.bad}` : `\n${R.ok} ok`);
process.exit(R.bad ? 1 : 0);
