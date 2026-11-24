// ROCK, STICK, PEE HAT AND KRAKA DROPPED NOTHING BUT BONES.
//
// A drop table attaches by npc CATEGORY - [ai_queue3,_<category>] - and the four NAMED Death
// Plateau trolls carried no category at all, so no handler could reach them and the only thing
// that landed was their own param=death_drop. Every generic troll in the same file is categorised.
// Reported by a player who killed Rock twelve times for twelve lots of bones
// (DeathPlateau-Bugs#32).
//
// WHAT THIS ASKS, and it is deliberately not "the table is correct": these four now share tables
// that other npcs already use and that other checks already cover. What was broken was reachability
// - a kill that pays only its own death_drop - so that is what is asserted, plus the two things a
// shared table could get wrong at the seams: a quest key leaking to an npc it was never meant for,
// and the pairing being swapped.
//
// EVERY KILL IS A REAL KILL. Both tables cover all 128 rolls, so a categorised troll drops
// something beyond bones on about 98 kills in 100 - the ~2% is ~randomjewel coming up empty, which
// it does about half the time without a ring of wealth. Ten kills each therefore makes a silent
// failure impossible rather than unlikely, and reading the floor after a real death is the only way
// to prove the trigger fired at all: these tables' bodies are inline on the trigger, not labels,
// so there is nothing to call directly.
//
//   npx tsx tools/sim/namedtrolls.ts
import * as H from './harness.ts';
import { check, R, player } from './a1lib.ts';
import World from '#/engine/World.js';
import NpcType from '#/cache/config/NpcType.js';
import CategoryType from '#/cache/config/CategoryType.js';
import ObjType from '#/cache/config/ObjType.js';
import { EntityLifeCycle } from '#/engine/entity/EntityLifeCycle.js';
import { PlayerStatMap } from '#/engine/entity/PlayerStat.js';
import type Npc from '#/engine/entity/Npc.js';

await H.boot();

const HP = PlayerStatMap.get('HITPOINTS')!;
const KILLS = 10;
const QUEST_KEYS = ['troll_key_prison', 'troll_key_godric', 'troll_key_eadgar'];
let seq = 0;

function find(name: string): Npc | null {
    const id = NpcType.getId(name);
    if (id === -1) throw new Error('no such npc: ' + name);
    for (const npc of World.npcs) if (npc && npc.isActive && npc.type === id) return npc;
    return null;
}

/** Kill it `KILLS` times, waiting out each respawn, and tally everything that hit the floor. */
function loot(name: string): { tally: Map<string, number>; kills: number } {
    const tally = new Map<string, number>();
    const p: any = player('troll' + seq++, 2852, 3591, 0);
    H.maxOut(p);
    H.equip(p, { rhand: 'dragon_scimitar' });
    let kills = 0;
    // ROUNDS, NOT KILLS, and there have to be enough of them for the respawns. Each of these four
    // has ONE spawn and a 100-tick respawnrate, so most rounds are spent waiting rather than
    // fighting; a budget of three rounds per kill got five kills out of ten and failed on its own
    // arithmetic rather than on anything in the game.
    for (let round = 0; round < KILLS * 8 && kills < KILLS; round++) {
        const npc = find(name);
        if (!npc) {
            H.tick(50);
            continue;
        } // waiting out a respawn
        if (!H.standBeside(p, npc)) {
            H.tick(5);
            continue;
        }
        p.setLevel(HP, 99);
        H.tick(1);
        H.attackNpc(p, npc);
        for (let t = 0; t < 200 && npc.isActive; t++) H.tick(1);
        if (npc.isActive) continue; // did not die; do not count it
        H.tick(2); // the death queue, where the drop happens
        kills++;
        // ONE ZONE, read once. Walking a few tile offsets returns the SAME zone repeatedly, which
        // is how a single pile of bones once counted as forty-nine.
        const zone = World.gameMap.getZone(npc.x, npc.z, npc.level);
        for (const obj of zone.getAllObjsSafe()) {
            if (obj.lifecycle !== EntityLifeCycle.DESPAWN) continue; // the map's own spawns
            const t = ObjType.get(obj.type);
            const n = t.debugname ?? String(obj.type);
            tally.set(n, (tally.get(n) ?? 0) + 1);
            World.removeObj(obj, 0);
        }
    }
    return { tally, kills };
}

const TROLLS: [string, string, string][] = [
    ['death_troll_commander', 'troll_general', 'Rock (111)'],
    ['death_troll_leuitanant', 'troll_general', 'Stick (104)'],
    ['death_troll_guard1', 'mountain_troll', 'Pee Hat (91)'],
    ['death_troll_guard2', 'mountain_troll', 'Kraka (91)']
];

// ------------------------------------------------------------------ 1. they have a category
console.log('\nA CATEGORY, WHICH IS THE WHOLE OF THE BUG');
// NAMED, NOT JUST NON-EMPTY. The first version of this compared t.category against itself and so
// could not fail; it would have passed just as happily with Rock on the thrower troll's table.
for (const [npc, cat, who] of TROLLS) {
    const t: any = NpcType.get(NpcType.getId(npc));
    const want = CategoryType.getId(cat);
    check(`${who.padEnd(14)} is ${cat}`, t.category, want);
    check('  ...which is a real category, not -1 that no handler can reach', want !== -1, true);
}

// ------------------------------------------------------------------ 2. and a kill pays something
console.log(`\nAND A KILL PAYS MORE THAN BONES (${KILLS} kills each)`);
for (const [npc, , who] of TROLLS) {
    const { tally, kills } = loot(npc);
    check(`${who.padEnd(14)} died ${kills} times`, kills >= KILLS - 2, true);
    check('  ...and dropped big bones', (tally.get('big_bones') ?? 0) > 0, true);
    const beyond = [...tally.keys()].filter(k => k !== 'big_bones');
    check(`  ...and ${beyond.length} other kind(s) of loot: ${beyond.slice(0, 4).join(', ') || 'NOTHING'}`, beyond.length > 0, true);
    // THE SEAM OF A SHARED TABLE. Both tables carry a quest-key branch for OTHER npcs, gated on
    // npc_type; if that gate were ever loosened to the category these four would start handing out
    // Troll Stronghold keys.
    for (const key of QUEST_KEYS) {
        check(`  ...and no ${key}, which belongs to another troll`, tally.get(key) ?? 0, 0);
    }
}

console.log(R.bad ? `FAILED: ${R.bad} of ${R.ok + R.bad}` : `${R.ok} ok`);
process.exit(R.bad ? 1 : 0);
