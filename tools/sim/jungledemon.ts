// WHAT THE JUNGLE DEMON THROWS, AND WHAT THE GNOMES SWING.
//
// Two reports about the same twenty seconds of Monkey Madness:
//
//   "jungle demon only attacks with melee and not both mage and melee"  DeathPlateau-Bugs#48
//   "...and the gnomes att anim wrong"                                  DeathPlateau-Bugs#47
//
// The demon had no [ai_*] triggers of its own, so it fell through to skill_combat's wildcard and was
// a plain melee monster. The 10th Squad's three gnomes swung on human_sword_slash and human_castwave
// - human animations on a gnome rig, which is the same class of mistake as the skeletons in #68.
//
// THE FIGHT IS DRIVEN FOR REAL rather than asserted from configs, because both reports are about
// what reaches the client. A config can carry every right value and still never play: that is what
// H.npcAnims and H.spotanims exist for.
//
//   npx tsx tools/sim/jungledemon.ts
import * as H from './harness.ts';
import { check, R, player, held } from './a1lib.ts';
import World from '#/engine/World.js';
import NpcType from '#/cache/config/NpcType.js';
import SeqType from '#/cache/config/SeqType.js';
import SpotanimType from '#/cache/config/SpotanimType.js';
import ParamType from '#/cache/config/ParamType.js';

await H.boot();

const seqName = (id: number) => SeqType.get(id)?.debugname ?? String(id);
const spotName = (id: number) => SpotanimType.get(id)?.debugname ?? String(id);
// Straight off the type's param map, as tools/sim/animpriority.ts reads them.
const nparam = (npcName: string, paramName: string): number | string | null => {
    const t = NpcType.get(NpcType.getId(npcName)) as unknown as { params?: Map<number, number | string> };
    const pid = ParamType.getId(paramName);
    if (pid === -1 || !t.params) return null;
    return t.params.get(pid) ?? null;
};

// ---------------------------------------------------------------- 1. the gnomes animate as gnomes
//
// DERIVED FROM THE MESH, not from a list of three animation names. Each squad member's attack anim
// has to come from the same family as the walk it already uses - which is what "the gnomes att anim
// wrong" means, and what naming midget_attacksword in a check would quietly assume rather than
// test. A fourth squad member given a human swing fails here.
console.log('\n1. EACH SQUAD MEMBER ANIMATES LIKE THE MESH IT IS');
const SQUAD = ['mm_garkor_final_battle', 'mm_karam_final_battle', 'mm_zooknock_final_battle'];
for (const name of SQUAD) {
    const t = NpcType.get(NpcType.getId(name)) as unknown as { walkanim: number; debugname?: string };
    const atk = nparam(name, 'attack_anim');
    const walk = seqName(t.walkanim);
    const family = walk.split('_')[0];
    const atkName = typeof atk === 'number' ? seqName(atk) : String(atk);
    check(`  ${name.replace('mm_', '').replace('_final_battle', '').padEnd(9)} walks on ${walk.padEnd(12)} and attacks on a ${family}_* (${atkName})`, atkName.startsWith(family + '_'), true);
}

// ---------------------------------------------------------------- 2. and the demon is configured to cast
console.log('\n2. THE DEMON IS CONFIGURED FOR TWO STYLES');
{
    const t = NpcType.get(NpcType.getId('mm_demon')) as unknown as { attackrange: number; size: number };
    // Both numbers are [koldemon]'s - the same npc_greater_demon mesh at the same size, which the
    // cache itself configured for melee and magic. Read off that npc rather than written here, so
    // "where did 5 come from" has an answer in the build.
    const kol = NpcType.get(NpcType.getId('koldemon')) as unknown as { attackrange: number; size: number };
    check('  it has an attackrange at all (it had none)', t.attackrange > 0, true);
    check("  and it is koldemon's, on koldemon's mesh and size", [t.attackrange, t.size], [kol.attackrange, kol.size]);
    check("  magicattack_anim is the greater demon's own cast", typeof nparam('mm_demon', 'magicattack_anim') === 'number' ? seqName(nparam('mm_demon', 'magicattack_anim') as number) : null, 'demon_casting');
    check('    which is what koldemon uses too', typeof nparam('koldemon', 'magicattack_anim') === 'number' ? seqName(nparam('koldemon', 'magicattack_anim') as number) : null, 'demon_casting');
    check('  and it still has its melee anim', typeof nparam('mm_demon', 'attack_anim') === 'number' ? seqName(nparam('mm_demon', 'attack_anim') as number) : null, 'demon_attack');
}

// ---------------------------------------------------------------- 3. the fight
console.log('\n3. AND IN THE FIGHT IT USES BOTH, AND ALL FOUR WAVES');
const p: any = player('demonfight', 2415, 9907, 0);
H.maxOut(p);
H.setVar(p, 'tutorial', 1000);
H.setVar(p, 'macro_event', 1);
H.setVar(p, 'mm_main', 14); // ^mm_has_sigil
H.give(p, 'mm_sigil', 1);
H.tick(2);
H.clearLogs();
// THROUGH drive(), NOT A BARE opheld. [opheld2,mm_sigil] opens with ~chatplayer and ends with a
// ~mesbox, both of which park the player's script on a click - so a bare opheld never reached the
// p_telejump, and this file reported that wearing the sigil did not put a demon in the room.
held(p, 'mm_sigil', 2);
H.tick(4);

const demon: any = (() => {
    const id = NpcType.getId('mm_demon');
    for (const n of World.npcs) if (n && n.isActive && n.type === id) return n;
    return null;
})();
check('  wearing the sigil put a demon in the room', !!demon, true);
check('  and the three gnomes with it', SQUAD.filter(n => H.npcNear(n, p.x, p.z, 0)).length, 3);

if (demon) {
    // KEEP THE PLAYER ALIVE WITHOUT BLINDING THE RECORDER. quest_mm_run replaces applyDamage with a
    // no-op, which would be wrong here: H.hits is recorded inside applyDamage, so nulling it hides
    // the very hits this file is about. Topping the hitpoints up each tick leaves the hits real and
    // recorded, and the demon hits 32s.
    // THE PLAYER SWINGS FIRST, because the demon will not. mm_demon carries no huntmode at all, so
    // it never takes a target of its own and stands there until something hits it - which is why the
    // first run of this file reported a demon that played no animation and landed no hit in 400
    // ticks. That is a real difference from Old School, where it comes for you, but it is not what
    // either report is about and it is not quietly fixed here: see the note on the issue.
    H.attackNpc(p, demon);
    for (let i = 0; i < 600; i++) {
        p.levels[3] = p.baseLevels[3];
        if (!demon.isValid()) break;
        // the demon is topped up rather than allowed to die, so 600 ticks of fight actually happen
        // instead of the squad and the player ending it in ninety
        if (demon.levels[3] < 100) demon.levels[3] = demon.baseLevels[3];
        H.tick(1);
    }

    const byDemon = H.npcAnims.filter(a => a.who === 'mm_demon').map(a => seqName(a.seq));
    check('  it played its melee swing', byDemon.includes('demon_attack'), true);
    check('  and its cast', byDemon.includes('demon_casting'), true);

    // THE FOUR WAVES, told apart by the graphic on the DEMON rather than the one on the player.
    // Each wave row carries a spotanim_origin - windwave_casting and the other three - played by
    // ~npc_spell_cast before any roll, and a spotanim_target played only where the spell lands. The
    // first version of this read the player's side, and a quarter of the demon's casts miss, which
    // plays the generic splash instead - so a perfectly ordered wheel came out as "8 out of turn".
    // Reading the cast rather than the hit is the difference between asking what it threw and
    // asking what connected. H.npcSpotanims was added to the harness for this.
    const casts = H.npcSpotanims.filter(s => s.who === 'mm_demon' && /wave_casting/.test(spotName(s.spotanim)));
    const thrown = new Set(casts.map(s => spotName(s.spotanim)));
    for (const w of ['windwave_casting', 'waterwave_casting', 'earthwave_casting', 'firewave_casting']) {
        check(`    ${w.replace('_casting', '').padEnd(10)} thrown`, thrown.has(w), true);
    }
    // And they land, or the wheel would be four graphics and no fight.
    const landed = new Set(H.spotanims.filter(s => s.who === p.username).map(s => spotName(s.spotanim)));
    check('    and at least two kinds of wave impact reached the player', ['windwave_impact', 'waterwave_impact', 'earthwave_impact', 'firewave_impact'].filter(w => landed.has(w)).length >= 2, true);

    // AND IN ORDER, which is the difference between "alternates between all four wave spells" and
    // four dice rolls.
    const order = casts.map(s => spotName(s.spotanim).replace('wave_casting', ''));
    const WHEEL = ['wind', 'water', 'earth', 'fire'];
    const outOfTurn = order.filter((w, i) => i > 0 && WHEEL[(WHEEL.indexOf(order[i - 1]) + 1) % 4] !== w);
    // AND NOT VACUOUSLY: this read "(in order)" over ZERO casts on the run where the demon never
    // attacked at all, which is the shape of pass this repo keeps filing against itself (#81). The
    // count is part of the claim.
    check('  there were casts to put in order', order.length >= 8, true);
    check(`  and they are in order, over ${order.length} casts`, outOfTurn.length === 0 ? '(in order)' : `${outOfTurn.length} out of turn: ${order.join(',')}`, '(in order)');

    // Neither style is the safe one to stand in front of: 32 for both, which is the wiki's number
    // and what the melee already derived to from strength 170 and +50.
    const took = H.hits.filter(h => h.who === p.username);
    check('  it landed hits at all', took.length > 0, true);
    check(`  and none of ${took.length} was over 32 (biggest ${Math.max(0, ...took.map(h => h.damage))})`, Math.max(0, ...took.map(h => h.damage)) <= 32, true);

    // AND THE GNOMES SWUNG, with their own animations and no human one among them.
    const byGnome = H.npcAnims.filter(a => SQUAD.includes(a.who));
    check('  all three gnomes swung', new Set(byGnome.map(a => a.who)).size, 3);
    const human = byGnome.filter(a => seqName(a.seq).startsWith('human_')).map(a => `${a.who}:${seqName(a.seq)}`);
    check('  and not one of them played a human animation', [...new Set(human)].join(' ') || '(none)', '(none)');
    for (const name of SQUAD) {
        const want = nparam(name, 'attack_anim');
        const played = new Set(byGnome.filter(a => a.who === name).map(a => seqName(a.seq)));
        check(`    ${name.replace('mm_', '').replace('_final_battle', '').padEnd(9)} played its own param`, played.has(seqName(want as number)), true);
    }
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
