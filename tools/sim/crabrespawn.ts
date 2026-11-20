/**
 * How long a Rellekka rock crab stays dead, and what it comes back as.
 *
 * THE WIKI NUMBER IS 50 TICKS / 30 SECONDS (https://oldschool.runescape.wiki/w/Rock_Crab).
 * NpcType.respawnrate defaults to 100 - a full minute - and nothing in the rock crab configs
 * declared one, so every kill took twice as long to come back as it should. Reported as "about
 * double" (DeathPlateau-Bugs#31) and measured here at 98 ticks before the fix, 48 after.
 *
 * WHY A SIM AND NOT JUST READING THE CONFIG. npc_del reads the respawnrate off the npc's CURRENT
 * type (NpcOps.ts, ScriptOpcode.NPC_DEL), and a rock crab changes type twice in its life: it is
 * placed as the dormant "Rocks" form, becomes the crab when a player walks past, and is killed as
 * the crab. A respawnrate declared on the wrong one of those four types reads perfectly well in
 * the config and does nothing at all. Section 2 kills one and counts.
 *
 * WHY THE CRAB IS WOKEN BY HAND HERE. The reveal is driven by huntmode, and World's player-hunt
 * pass is gated on rsbuf.getNpcObservers(nid) > 0 (World.ts) - a sim player has no socket, so it
 * observes nothing and no hunt ever runs. changeType is exactly what [ai_opplayer2,
 * horror_rockcrab_inactive] does (content: areas/area_relleka/scripts/rock_crabs.rs2), so the npc
 * reaches the state a real player's approach puts it in. The reveal itself is not what this sim is
 * about.
 */
import * as H from './harness.js';
import { check, R, player, fight } from './a1lib.js';
import NpcType from '#/cache/config/NpcType.js';
import World from '#/engine/World.js';

await H.boot();

// The wiki's number, written down once. Everything below is checked against this.
const RESPAWN_TICKS = 50;

// ---- 1. The declared rate, on the forms that can actually die ------------------------------
// The awake forms are the only ones a player can kill - the dormant forms carry no Attack op - so
// they are the only ones whose respawnrate npc_del will ever read.
for (const form of ['horror_rockcrab', 'horror_rockcrab_small']) {
    check(`${form} declares a ${RESPAWN_TICKS}-tick respawn`, NpcType.get(NpcType.getId(form)).respawnrate, RESPAWN_TICKS);
}

// ---- 2. What a kill actually costs in ticks -------------------------------------------------
/**
 * Wake a dormant crab, kill it, and count the ticks until it is back.
 * Returns the gap and the name of the type it came back as.
 */
function killAndWait(dormant: string, awake: string, x: number, z: number, who: string) {
    const p = player(who, x, z, 0);
    H.maxOut(p);

    const npc = H.npcNear(dormant, x, z, 0);
    if (!npc) throw new Error('no ' + dormant + ' near ' + x + ',' + z);

    npc.changeType(NpcType.getId(awake), 0x7fffffff, true);
    H.tick(1);

    const woke = NpcType.get(npc.type).name;
    if (!fight(p, npc, 400)) throw new Error(dormant + ' would not die');

    let gap = 0;
    while (!npc.isActive && gap < 400) {
        H.tick(1);
        gap++;
    }
    return { woke, gap, backAs: NpcType.get(npc.type).name };
}

// The scaled rate is what the world really queues: World.removeNpc passes the respawnrate through
// scaleByPlayerCount, which only ever SHORTENS it (and by under a tick at these player counts).
// A couple of ticks also go on npc_delay(1) in npc_death.rs2 and on fight()'s own settling ticks
// before the count starts, so the gap is checked as a window rather than to the tick - a window
// far too narrow for the 100-tick default to sit in, which is the regression that matters.
const scaled = World.scaleByPlayerCount(RESPAWN_TICKS);
const low = scaled - 4;
const high = scaled + 2;

{
    const r = killAndWait('horror_rockcrab_inactive', 'horror_rockcrab', 2704, 3726, 'crabbig');
    check('a dormant rock wakes as the Rock Crab', r.woke, 'Rock Crab');
    check(`killed crab is back in ${low}..${high} ticks (got ${r.gap})`, r.gap >= low && r.gap <= high, true);
    // The 60-second default is what #31 was: name it, so a regression says which bug came back.
    check(`and nowhere near the 100-tick default (got ${r.gap})`, r.gap < 80, true);
    // A crab that respawned as a crab would be attackable with no one having walked past it.
    check('and is a rocky outcrop again, not a crab', r.backAs, 'Rocks');
}

{
    const r = killAndWait('horror_rockcrab_small_inactive', 'horror_rockcrab_small', 2704, 3726, 'crabsmall');
    check('a dormant small rock wakes as the small Rock Crab', r.woke, 'Rock Crab');
    check(`killed small crab is back in ${low}..${high} ticks (got ${r.gap})`, r.gap >= low && r.gap <= high, true);
    check('and is a rocky outcrop again, not a crab', r.backAs, 'Rocks');
}

console.log(R.bad ? `FAILED: ${R.bad} of ${R.ok + R.bad}` : `${R.ok} ok`);
process.exit(R.bad ? 1 : 0);
