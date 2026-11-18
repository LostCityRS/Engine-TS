// WHAT A ROCK CRAB ACTUALLY HITS FOR.
//
//   npx tsx tools/sim/rockcrabhit.ts
//
// Players reported being hit for 3. They were: this npc carried a strength bonus of 96, picked to
// force the engine's derivation up to a max hit of 3, under a note claiming 3 was the published
// figure. The OSRS wiki gives the Rock Crab a max hit of 1 - which is the whole reason a level 13
// monster with 50 hitpoints is the thing low levels train on unattended.
//
// The damage roll itself was never wrong. randominc(n) is floored by pushInt's toInt32, so it is a
// clean uniform 0..n; what was wrong was the n.
import * as H from './harness.js';
import NpcType from '#/cache/config/NpcType.js';
import ParamType from '#/cache/config/ParamType.js';
import { PlayerStatMap } from '#/engine/entity/PlayerStat.js';
import { NpcStat } from '#/engine/entity/NpcStat.js';
import { check, R, player } from './a1lib.js';

await H.boot();

const HP = PlayerStatMap.get('HITPOINTS')!;
const WIKI_MAX = 1;

console.log('\n================ THE CONFIGURED FIGURE');
for (const name of ['horror_rockcrab', 'horror_rockcrab_small']) {
    const t = NpcType.getByName(name)!;
    const maxHit = Number(t.params?.get(ParamType.getId('max_hit')) ?? -1);
    check(`${name} states a max hit of ${WIKI_MAX}`, maxHit, WIKI_MAX);
    // stated, not derived: a strength bonus here would be bending the derivation behind its back
    check(`${name} carries no strength bonus`, t.params?.get(ParamType.getId('strengthbonus')) ?? 0, 0);
    // read off the type, not defaulted to the answer: the first version of this line fell back to
    // 50 when it could not find the field, so it would have passed whatever the npc actually had.
    check(`${name} has 50 hitpoints`, t.stats[NpcStat.HITPOINTS], 50);
    check(`${name} is combat level 13`, t.vislevel, 13);
}

console.log('\n================ AND WHAT IT ROLLS IN A FIGHT');
{
    const CRAB: [number, number] = [2710, 3720];
    const npc = H.addNpc('horror_rockcrab', CRAB[0], CRAB[1]);
    const p = player('crabtarget', CRAB[0] + 1, CRAB[1]);
    for (const s of ['ATTACK', 'STRENGTH', 'DEFENCE', 'RANGED', 'MAGIC']) {
        const id = PlayerStatMap.get(s)!;
        p.baseLevels[id] = 10;
        p.levels[id] = 10;
    }
    p.baseLevels[HP] = 990;
    H.tick(2);
    H.clearLogs();

    for (let round = 0; round < 30; round++) {
        npc.levels[5] = 50;
        npc.baseLevels[5] = 50;
        H.setNpcMode(npc, 'OPPLAYER2', p);
        for (let t = 0; t < 60; t++) {
            H.tick(1);
            p.levels[HP] = 990;
            npc.levels[5] = 50;
        }
    }

    const mine = H.hits.filter(h => h.who === p.username);
    const dist: Record<number, number> = {};
    for (const h of mine) dist[h.damage] = (dist[h.damage] ?? 0) + 1;
    const worst = Math.max(...mine.map(h => h.damage));
    console.log(`  ${mine.length} hits taken`);
    for (const d of Object.keys(dist)
        .map(Number)
        .sort((a, b) => a - b)) {
        console.log(`    damage ${d}: ${dist[d]} (${((dist[d] / mine.length) * 100).toFixed(1)}%)`);
    }
    check('it landed some hits at all', mine.length > 30, true);
    check(`nothing above ${WIKI_MAX} was dealt`, worst <= WIKI_MAX, true);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
