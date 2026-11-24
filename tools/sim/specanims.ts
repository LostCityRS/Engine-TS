// EVERY SPECIAL PLAYS ITS OWN ANIMATION, not the weapon's ordinary swing.
// Usage: npx tsx tools/sim/specanims.ts   (exit code is the verdict)
//
// WHAT THIS IS FOR. The dragon warhammer's Smash played human_blunt_pound - the animation the
// hammer uses for a NORMAL attack - with the granite maul's graphic over it. Nothing errored,
// rs2check was clean, the damage and the Defence drain were both right, and every sim passed:
// the only symptom was that the special looked like a normal hit, which no assertion in this
// directory was looking at. The owner spotted it in game.
//
// So this fires each special and asserts two things no other sim does:
//
//   * the animation played is the special's own, and
//   * it is NOT the animation that weapon swings with ordinarily.
//
// The second half is the one that matters. A special that plays the right-NAMED animation is easy
// to assert; a special that plays the weapon's own attack animation is what actually shipped, and
// only a comparison against the ordinary swing catches it.
//
// The 2006 specials are checked too. That was once an argument for leaving them alone, and it only
// holds where the weapon's own animation is what it is playing: the bone dagger was playing the
// DRAGON DAGGER's, which is not a period choice, it is the wrong weapon's.
import * as H from './harness.ts';
import { check, R, player } from './a1lib.ts';
import ObjType from '#/cache/config/ObjType.js';
import ParamType from '#/cache/config/ParamType.js';
import SeqType from '#/cache/config/SeqType.js';
import SpotanimType from '#/cache/config/SpotanimType.js';
import JavaRandom from '#/util/JavaRandom.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import ScriptPointer from '#/engine/script/ScriptPointer.js';
import Npc from '#/engine/entity/Npc.js';
import Player from '#/engine/entity/Player.js';

await H.boot();

const DEFENCE = 1;
const param = (obj: string, key: string): unknown => (ObjType.get(ObjType.getId(obj)) as unknown as { params?: Map<number, unknown> }).params?.get(ParamType.getId(key));
const seqName = (id: number | undefined): string => (typeof id === 'number' && id >= 0 ? (SeqType.get(id)?.debugname ?? `seq_${id}`) : '-');

const origND = JavaRandom.nextDouble.bind(JavaRandom);
const pin = (v: number | null) => {
    (JavaRandom as unknown as { nextDouble: () => number }).nextDouble = v === null ? origND : () => v;
};
const runSpec = (label: string, npc: Npc, p: Player) => {
    const script = ScriptProvider.getByName(label)!;
    const state = ScriptRunner.init(script, npc, p, []);
    state.pointerAdd(ScriptPointer.ProtectedActivePlayer);
    ScriptRunner.execute(state);
};

// WHERE THE GRAPHIC GOES. The beta-world dump (rune-server 697435) spells this out and I read it
// wrong twice. It writes "gfx: N" for a graphic on the PLAYER and says "enemy entity gfx: N" when
// it means the target - and of these four only the bludgeon says enemy entity:
//
//     dragon warhammer   anim 1378  gfx 1292               -> player
//     granite hammer     anim 1378  gfx 1450               -> player
//     dragon sword       anim 7515  gfx 1369               -> player
//     abyssal bludgeon   anim 3299  enemy entity gfx 1284   -> target
//
// First it was spotanim_pl at height 96 for all four - right entity for three, wrong height for
// all. Then it was spotanim_npc at 0 for all four - right height, wrong entity for three. The
// build demonstrated the rule the whole time: pvm_godswords.rs2 puts each godsword's own graphic
// on the player and only the Zamorakian's freeze on the target, which is exactly what the dump's
// "zgs ... gfx: 1210 enemy entity gfx: 369" says.
//
// Height 0 is right for all of them, measured rather than assumed: every one of these models runs
// from y=0 down to y=-4500..-9700, so it stands on the ground and extends upward, the same shape
// as spot_ags_spec which this build has always drawn at 0.
//
// `spot: null` means the special throws no graphic of its own.
//
// Asserting this needs the entity's spotanimId read BEFORE the next tick clears it, so the rows
// below are checked inside the same loop that fires each special rather than afterwards.
// weapon, its spec label, the animation the special should play, the graphic it should throw, and
// the params holding the weapon's ORDINARY attack animations - the thing it must not play.
// `where` is the entity the graphic belongs on: 'npc' for an impact effect at the point of the
// hit, 'player' for a 2006 special whose glow is around the wielder, which is where the cache's
// own puncture/cleave/shatter set puts it.
type Row = { weapon: string; label: string; anim: string; spot: string | null; where: 'npc' | 'player'; height: number; ordinary: string[] };
const SPECS: Row[] = [
    // Post-2006, imported: see content/scripts/skill_combat/configs/melee/osrs_spec_anims.seq
    { weapon: 'dragon_warhammer', label: '[label,pvm_dragon_warhammer_sa]', anim: 'osrs_dwh_spec', spot: 'dwh_spec', where: 'player', height: 0, ordinary: ['crushattack_anim'] },
    { weapon: 'granite_hammer', label: '[label,pvm_granite_hammer_sa]', anim: 'osrs_dwh_spec', spot: 'granite_hammer_spec', where: 'player', height: 0, ordinary: ['crushattack_anim'] },
    // NOT all.seq's abyssal_bludgeon_special_attack, which has the same OSRS id and is the same
    // corrupt import as the rest of that set: it forces a bronze axe into the left hand.
    { weapon: 'abyssal_bludgeon', label: '[label,pvm_abyssal_bludgeon_sa]', anim: 'osrs_bludgeon_spec', spot: 'bludgeon_spec', where: 'npc', height: 0, ordinary: ['crushattack_anim'] },
    { weapon: 'dragon_sword', label: '[label,pvm_dragon_sword_sa]', anim: 'osrs_dsword_spec', spot: 'dsword_spec', where: 'player', height: 0, ordinary: ['stabattack_anim', 'slashattack_anim'] },
    // Backstab's own, OSRS 4198 and gfx 704. It used to play `puncture` with spotanim 252, which
    // the beta-world dump names as the DRAGON DAGGER's special - the same defect as the bludgeon
    // borrowing the granite maul's, and the reason this row is no longer the "2006 weapons keep
    // the cache's own" example it was written as.
    { weapon: 'bone_dagger', label: '[label,pvm_bone_dagger_sa]', anim: 'osrs_bone_dagger_spec', spot: 'bone_dagger_spec_gfx', where: 'player', height: 0, ordinary: ['stabattack_anim', 'slashattack_anim'] }
];

// ---------------------------------------------------------------------------------------------
console.log('== the four imported animations exist and look like player specials');
{
    for (const nm of ['osrs_dwh_spec', 'osrs_dsword_spec', 'osrs_sotd_spec', 'osrs_sol_spec']) {
        const id = SeqType.getId(nm);
        check(`${nm} is in the build`, id !== -1, true);
        if (id === -1) continue;
        const s = SeqType.get(id) as unknown as { frames: unknown[]; priority: number; walkmerge: unknown };
        check(`${nm} has frames`, (s.frames?.length ?? 0) > 0, true);
        // The shape every imported player special in this build carries, osrs_ags_spec included.
        check(`${nm} has special priority`, s.priority, 6);
        check(`${nm} walk-merges`, s.walkmerge !== null && s.walkmerge !== undefined, true);
    }
    for (const nm of ['dwh_spec', 'granite_hammer_spec', 'bludgeon_spec', 'dsword_spec', 'sotd_spec_gfx', 'sol_spec_gfx']) {
        check(`spotanim ${nm} is in the build`, SpotanimType.getId(nm) !== -1, true);
    }
}

// ---------------------------------------------------------------------------------------------
console.log("\n== each special plays its own animation, and not the weapon's ordinary swing");
{
    for (const r of SPECS) {
        if (ObjType.getId(r.weapon) === -1) {
            check(`${r.weapon} exists`, false, true);
            continue;
        }
        const p = player(`spec_${r.weapon}`, 3250, 3250);
        H.clearInv(p);
        H.give(p, r.weapon);
        H.opheld(p, r.weapon, 2);
        H.tick(1);
        const npc = H.addNpc('slayer_gargoyle', p.x + 1, p.z);
        H.setVar(p, 'com_maxhit', 10);

        const mark = H.anims.length;
        pin(0.99);
        let onNpc = { id: -1, height: -1 };
        let onPlayer = { id: -1, height: -1 };
        try {
            runSpec(r.label, npc, p);
            // read before the tick: PathingEntity clears spotanimId at the end of one
            onNpc = { id: npc.spotanimId, height: npc.spotanimHeight };
            onPlayer = { id: p.spotanimId, height: p.spotanimHeight };
            H.tick(1);
        } finally {
            pin(null);
        }
        if (r.spot !== null) {
            const want = SpotanimType.getId(r.spot);
            // THE HALF THAT WAS REPORTED: an impact effect goes on the target at ground level, and
            // nowhere near the player. The 2006 row below is the other way round on purpose.
            const [here, there] = r.where === 'npc' ? [onNpc, onPlayer] : [onPlayer, onNpc];
            check(`${r.weapon}: ${r.spot} is on the ${r.where}`, here.id, want);
            check(`${r.weapon}: ...at height ${r.height}`, here.height, r.height);
            check(`${r.weapon}: ...and not on the other one`, there.id === want, false);
        }
        const played = H.anims
            .slice(mark)
            .filter(a => a.who === p.username)
            .map(a => seqName(a.seq));
        check(`${r.weapon}: plays ${r.anim}`, played.includes(r.anim), true);

        // THE HALF THAT CAUGHT NOTHING BEFORE: the ordinary swing must not be what ran.
        const swings = r.ordinary.map(k => seqName(param(r.weapon, k) as number)).filter(s => s !== '-');
        const clash = swings.filter(s => played.includes(s));
        check(`${r.weapon}: does not play its ordinary swing (${swings.join('/')})`, clash, []);
        if (played.length === 0) console.log(`      (nothing played at all for ${r.weapon})`);
    }
}

// ---------------------------------------------------------------------------------------------
console.log("\n== and the dragon warhammer still takes 30% of the target's current Defence");
{
    // The animation change must not have disturbed the drain, which is the whole point of Smash.
    const p = player('dwh_drain', 3250, 3250);
    H.clearInv(p);
    H.give(p, 'dragon_warhammer');
    H.opheld(p, 'dragon_warhammer', 2);
    H.tick(1);
    const npc = H.addNpc('slayer_gargoyle', p.x + 1, p.z);
    H.setVar(p, 'com_maxhit', 20);

    const before = npc.levels[DEFENCE];
    pin(0.99); // the accuracy roll lands on a HIGH pin
    try {
        runSpec('[label,pvm_dragon_warhammer_sa]', npc, p);
    } finally {
        pin(null);
    }
    const after = npc.levels[DEFENCE];
    check('defence is drained', after < before, true);
    check('by 30%, rounded down', before - after, Math.floor(before * 0.3));

    // Compounding: the second takes 30% of what is LEFT, not of the base.
    const mid = npc.levels[DEFENCE];
    pin(0.99);
    try {
        runSpec('[label,pvm_dragon_warhammer_sa]', npc, p);
    } finally {
        pin(null);
    }
    check('a second Smash compounds off the current level', mid - npc.levels[DEFENCE], Math.floor(mid * 0.3));
}

// ---------------------------------------------------------------------------------------------
console.log('\n== and the ORDINARY attack animations are the ones Old School plays');
{
    // THE CHECK THAT WOULD HAVE CAUGHT ALL OF THIS. Every fault reported this round was an
    // animation id sitting in an obj param that nothing ever read back - "the bludgeon and the
    // hill giant club are swinging like a gmaul", "the staves have the wrong swipe". A param can
    // name any animation in the build and nothing errors; it just looks wrong in game.
    //
    // Expectations are the beta-world dump's, quoted per weapon. Where a 377 name is given, the
    // dump's id IS that name's id in this build - checked, not assumed.
    type Anims = { weapon: string; want: Record<string, string>; why: string };
    const ORDINARY: Anims[] = [
        {
            weapon: 'abyssal_bludgeon',
            // THE osrs_* NAMES, not all.seq's. Those carry an invented held-model swap - an
            // ectophial on the stance, a rune axe on the walk, a dragon axe on the run, an iron
            // axe on the swing - which puts an AXE in the player's hands for most of every frame.
            // The OSRS ids are the dump's either way, which is exactly why this could only be
            // caught in the client: an id checker compares ids, and these ARE the right ids.
            why: "crush 3298, defence 1666, stance 1652 - and 1666 IS the granite maul's, shared",
            want: {
                crushattack_anim: 'osrs_bludgeon_crush',
                defend_anim: 'slayer_granite_maul_defend',
                ready_baseanim: 'osrs_bludgeon_ready',
                walk_f_baseanim: 'osrs_bludgeon_walk',
                running_baseanim: 'osrs_bludgeon_run'
            }
        },
        {
            weapon: 'dragon_warhammer',
            why: 'crush 401, defence 403 - already right, and worth pinning so it stays right',
            want: { crushattack_anim: 'human_blunt_pound', defend_anim: 'human_blunt_block' }
        },
        {
            weapon: 'dragon_sword',
            why: 'stab 386, slash 390',
            want: { stabattack_anim: 'human_sword_stab', slashattack_anim: 'human_sword_slash' }
        }
    ];
    // the four bladed staves: stance 813, stab 428, slash 440, crush 419, defence 420. We had the
    // one-handed SWORD's 386/390 and the Kodai wand's 414/415.
    for (const s of ['staff_of_the_dead', 'staff_of_light', 'toxic_staff_of_the_dead', 'toxic_staff_uncharged']) {
        ORDINARY.push({
            weapon: s,
            why: 'bladed staff: stance 813, stab 428, slash 440, crush 419, defence 420',
            want: {
                ready_baseanim: 'human_staffready',
                stabattack_anim: 'human_spear_spike',
                slashattack_anim: 'human_scythe_sweep',
                crushattack_anim: 'human_stafforb_pummel',
                defend_anim: 'human_stafforb_block'
            }
        });
    }

    for (const row of ORDINARY) {
        if (ObjType.getId(row.weapon) === -1) {
            check(`${row.weapon} exists`, false, true);
            continue;
        }
        console.log(`   ${row.weapon}: ${row.why}`);
        for (const [key, want] of Object.entries(row.want)) {
            check(`  ${row.weapon}.${key}`, seqName(param(row.weapon, key) as number), want);
        }
    }
}

// ---------------------------------------------------------------------------------------------
// THE TOOL SPECIALS, which this file did not cover and should have (23 November).
//
// Lumber Up, Rock Knocker and Fishstabber are the same rule as every row above - a special must
// play its OWN animation and not the weapon's ordinary swing - but they are a different shape:
// they take no target and land no hit, so they run from the spec bar's own click in specwep.rs2
// rather than through player_special_attack, and the table at the top of this file cannot reach
// them. That gap is not academic. The dragon harpoon shipped playing human_sword_stab, which IS
// its param=stabattack_anim, so Fishstabber looked like an ordinary poke; it was reported from
// play, exactly as the dragon warhammer's Smash was.
//
// ONE FLOURISH, NINE IDS. Old School registers the tool-special animation under nine byte-identical
// seqs (334, 3410, 7138, 7267, 8329, 8330, 8781, 11821, 11822 - all frames 53-63 of group 10975),
// one per tool that has a boosting special. 7138 is the one this build imported, under the name
// osrs_dpick_spec, so the harpoon playing it is not borrowing the pickaxe's animation: it is the
// same frames Old School plays for the harpoon.
console.log('\n== the tool specials play a flourish, not the tool\'s ordinary swing');
{
    const StatId: Record<string, number> = { woodcutting: 8, mining: 14, fishing: 10 };
    // `anim: null` means the special deliberately plays NOTHING. The dragon harpoon is in that
    // state on purpose: Old School's Fishstabber animation is not in this build, two substitutes
    // were wrong in play - its own attack animation, then the axe/pickaxe flourish - and the note
    // in specwep.rs2 records how to find the real one. Playing nothing is the one choice that
    // cannot look like another weapon, and the row below still holds it to the rule that matters.
    type Tool = { weapon: string; stat: string; bar: string; anim: string | null; ordinary: string[] };
    const TOOLS: Tool[] = [
        { weapon: 'dragon_axe', stat: 'woodcutting', bar: 'combat_axe:specbar', anim: 'dragon_smallaxe_anim', ordinary: ['slashattack_anim', 'crushattack_anim'] },
        { weapon: 'dragon_pickaxe', stat: 'mining', bar: 'combat_pickaxe:specbar', anim: 'osrs_dpick_spec', ordinary: ['stabattack_anim', 'crushattack_anim'] },
        { weapon: 'dragon_harpoon', stat: 'fishing', bar: 'combat_stabsword:specbar', anim: null, ordinary: ['stabattack_anim', 'slashattack_anim'] }
    ];
    for (const t of TOOLS) {
        if (ObjType.getId(t.weapon) === -1) {
            check(`${t.weapon} exists`, false, true);
            continue;
        }
        const p = player(`tool_${t.weapon}`, 3250, 3250);
        H.clearInv(p);
        H.give(p, t.weapon);
        H.opheld(p, t.weapon, 2);
        H.tick(1);
        // sa_energy is a perm varp with no default, so a fresh player's bar is only full because
        // login.rs2 fills it for a character that has not started the tutorial (specbarstart.ts).
        H.setVar(p, 'sa_energy', 1000);
        const mark = H.anims.length;
        H.ifButton(p, t.bar);
        H.tick(2);
        const played = H.anims
            .slice(mark)
            .filter(a => a.who === p.username)
            .map(a => seqName(a.seq));
        if (t.anim === null) {
            check(`${t.weapon}: plays no animation at all, as intended`, played, []);
        } else {
            check(`${t.weapon}: plays ${t.anim}`, played.includes(t.anim), true);
        }
        // THE RULE THAT HOLDS EITHER WAY, and the one both of the harpoon's wrong animations broke
        // in turn: whatever a special plays, it must not be the weapon's own swing.
        const swings = t.ordinary.map(k => seqName(param(t.weapon, k) as number)).filter(s => s !== '-');
        const clash = swings.filter(s => played.includes(s));
        check(`${t.weapon}: does not play its ordinary swing (${swings.join('/')})`, clash, []);
        // and the boost it exists for actually landed
        check(`${t.weapon}: boosts ${t.stat} by 3`, p.levels[StatId[t.stat]] - p.baseLevels[StatId[t.stat]], 3);
    }
}

console.log(`\n${R.ok} ok, ${R.bad} failed`);
process.exit(R.bad ? 1 : 0);
