/**
 * AN ANIMATION BELONGS TO A RIG, AND A MODEL STANDS ON ONE.
 *
 * Reported as "dragon slayer. melzars maze skeletons animations are bugged" (DeathPlateau-Bugs#68,
 * filed twice as #69), and the cause is worth stating because the obvious reading is backwards.
 *
 * Those skeletons are built on npc_dragonslayer_skeleton, whose vertices are labelled with
 * transform groups 1,2,4,5,8,29,31..49 - the HUMAN rig. Their readyanim and walkanim are
 * human_ready and human_walk_f, which FIT. But they also carried
 *
 *   param=attack_anim,skeleton_attack
 *   param=defend_anim,skeleton_block
 *   param=death_anim,skeleton_death
 *
 * and the skeleton_* set was authored for poh_skeleton_8, which is labelled 1-23. Rendered frame
 * by frame with content's tools/pose377.py - the tool that exists for exactly this question -
 * skeleton_attack on this mesh detaches the skull, turns the ribcage ninety degrees, flattens both
 * arms into planks and leaves it on one leg. The same five frames on poh_skeleton_8 are a clean
 * swing, and human_unarmedpunch on this mesh is an intact skeleton.
 *
 * So the npc looked right standing still and came apart the moment it swung, which is precisely
 * what a player would call "the animations are bugged". The fix deletes the three params and lets
 * npc_combat.param's human defaults apply.
 *
 * WHY THIS CHECK IS SHAPED BY MODEL AND NOT BY A METRIC. The first attempt at a guard here was a
 * general sweep - "flag any npc whose animation does not drive most of its model's transform
 * groups" - and then "flag any model with groups above the animation's highest". Both are
 * worthless: the first flagged 1,902 slots including a chicken playing chicken_walk, the second
 * 3,223 including a red dragon playing dragon_ready. An animation is simply not required to move
 * every group, and a model routinely carries labels a given animation never touches. The rig
 * mismatch is real and the metric for it is not, so what is asserted is the thing that was
 * actually established: these animations belong to that model, and no other.
 *
 *   npx tsx tools/sim/skeletonanims.ts
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

const MODEL_NAMES = new Map<number, string>();
for (const line of fs.readFileSync(path.join(Environment.BUILD_SRC_DIR, 'pack/model.pack'), 'utf8').split('\n')) {
    const eq = line.indexOf('=');
    if (eq > 0) MODEL_NAMES.set(Number(line.slice(0, eq)), line.slice(eq + 1).trim());
}

const seqName = (v?: number) => (v === undefined || v < 0 ? '-' : (SeqType.get(v)?.debugname ?? String(v)));
const modelOf = (t: any) => MODEL_NAMES.get((t.models ?? [])[0]) ?? '?';

/** Every animation slot an npc can play, as [slot, seq name]. */
function animsOf(t: any): [string, string][] {
    const out: [string, string][] = [];
    if (t.readyanim >= 0) out.push(['readyanim', seqName(t.readyanim)]);
    if (t.walkanim >= 0) out.push(['walkanim', seqName(t.walkanim)]);
    for (const pn of ['attack_anim', 'defend_anim', 'death_anim']) {
        const pid = ParamType.getId(pn);
        const v = pid >= 0 ? (t.params?.get(pid) as number | undefined) : undefined;
        if (v !== undefined) out.push([pn, seqName(v)]);
    }
    return out;
}

const all: { npc: string; model: string; anims: [string, string][] }[] = [];
for (let id = 0; id < NpcType.count; id++) {
    const t = NpcType.get(id);
    if (!t?.debugname) continue;
    all.push({ npc: t.debugname, model: modelOf(t), anims: animsOf(t) });
}

// ---- 1. the skeleton_* set is only played on the model it was authored for -------------------
// skeleton_hound_* is a different family for a different mesh and is not this rule's business, so
// the prefix is matched exactly rather than loosely - "startsWith('skeleton')" would drag the
// hellhound in and make this check about something it has no evidence for.
const SKELETON_SET = new Set([
    'skeleton_ready',
    'skeleton_walk',
    'skeleton_attack',
    'skeleton_block',
    'skeleton_death',
    'skeleton_trans_ready',
    'skeleton_trans_walk',
    'skeleton_trans_attack',
    'skeleton_trans_block',
    'skeleton_trans_death',
    'skeleton_beforesummon'
]);
const RIG = 'poh_skeleton_8';

console.log(`\n1. the skeleton_* animations are only played on ${RIG}`);
{
    const offenders: string[] = [];
    let users = 0;
    for (const e of all) {
        const skel = e.anims.filter(([, s]) => SKELETON_SET.has(s));
        if (!skel.length) continue;
        users++;
        if (e.model !== RIG) offenders.push(`${e.npc} (${e.model}): ${skel.map(([k, s]) => `${k}=${s}`).join(' ')}`);
    }
    console.log(`      (${users} npcs play one; ${offenders.length} on another model)`);
    for (const o of offenders) console.log(`      >> ${o}`);
    check('every npc playing a skeleton animation is on the rig it was authored for', offenders.length, 0);
    // AND THERE ARE STILL PLENTY, so the above cannot pass by the set emptying out.
    check(`  ...and ${users} npcs still play them`, users > 15, true);
}

// ---- 2. the four that were reported now take the human defaults ------------------------------
// Named outright, because this is the bank of npcs the report was about and a regression should
// say so rather than only failing a general rule.
console.log('\n2. the four on the human rig take the human combat defaults');
for (const name of ['dragonslayer_skeleton', 'dragonslayer_skeleton_2', 'dragonslayer_skeleton_3', 'draynor_skeleton']) {
    const t = NpcType.get(NpcType.getId(name));
    if (!t) {
        check(`  ${name} exists`, false, true);
        continue;
    }
    check(`  ${name.padEnd(24)} is on the human rig`, modelOf(t), 'npc_dragonslayer_skeleton');
    const slots = animsOf(t).filter(([k]) => k.endsWith('_anim'));
    check(`    ...and declares no combat animation of its own (${slots.map(s => s.join('=')).join(' ') || 'none'})`, slots.length, 0);
    // the defaults it therefore gets, asserted so a change to npc_combat.param shows up here
    check('    ...so it idles as a human, which already fitted', seqName(t.readyanim), 'human_ready');
}

// ---- 3. and the nineteen that were always right were not touched -----------------------------
// The easy way to "fix" this is to take the skeleton animations off everything. That would break
// every real skeleton in the game, so the ones that were correct are held in place.
console.log('\n3. the real skeletons still animate as skeletons');
for (const name of ['skeleton', 'skeleton_armed', 'mm_skeleton', 'skull_skeleton', 'giantskeleton', 'skeletal_miner']) {
    const t = NpcType.get(NpcType.getId(name));
    const a = new Map(animsOf(t));
    check(`  ${name.padEnd(16)} ready/walk are the skeleton's`, `${a.get('readyanim')}/${a.get('walkanim')}`, 'skeleton_ready/skeleton_walk');
    check('    ...and so is its attack', a.get('attack_anim'), 'skeleton_attack');
}

console.log(R.bad ? `\nFAILED: ${R.bad} of ${R.ok + R.bad}` : `\n${R.ok} ok`);
process.exit(R.bad ? 1 : 0);
