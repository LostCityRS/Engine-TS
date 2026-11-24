// WANTED!: the two fights, and the numbers behind them.
// Usage: NODE_MEMBERS=true npx tsx tools/sim/wantedfight.ts   (exit code is the verdict)
//
// wanted_summoned_black_knight and wanted_solus_attackable have both carried op2=Attack since the
// cache was built, with NO COMBAT STATS AT ALL behind either - so the sixth stop summoned nothing
// and the last stop could only ever be narrated (DeathPlateau-Bugs#98).
//
// EVERY NUMBER ASSERTED HERE IS A PUBLISHED ONE. The Black Knight's are Old School's
// "Black Knight (Wanted!)" page, level 32, which agrees field for field with this build's own
// [black_knight]; Solus's are his own npc page, which gives far more than the quest page's
// "40 Hitpoints and ... a weak, but fairly rapid melee attack". The three numbers that are NOT on
// a page are called out in all.npc and are not asserted as if they were.
import * as H from './harness.js';
import * as A from './a1lib.js';
import { check, R, player } from './a1lib.js';
import World from '#/engine/World.js';
import NpcType from '#/cache/config/NpcType.js';
import ObjType from '#/cache/config/ObjType.js';
import ParamType from '#/cache/config/ParamType.js';
import { NpcStat } from '#/engine/entity/NpcStat.js';

await H.boot();
H.loginOrder();

const typeOf = (nm: string) => NpcType.get(NpcType.getId(nm));
const nparam = (nm: string, key: string): unknown => typeOf(nm).params?.get(ParamType.getId(key));
// NPC COMBAT LEVELS LIVE IN NpcType.stats[], an array indexed by stat slot - there is no
// .hitpoints or .attack field on NpcType, and reading one gives undefined rather than an error,
// which is how an assertion over nothing gets written. Npc's constructor copies this same array
// into levels/baseLevels (src/engine/entity/Npc.ts), so this is the number the fight uses.
const nstat = (nm: string, stat: NpcStat): number => typeOf(nm).stats[stat];
const nearNpc = (nm: string, p: { x: number; z: number; level: number }, r = 6) => {
    const id = NpcType.getId(nm);
    for (const n of World.npcs) {
        if (!n || !n.isActive || n.type !== id || n.level !== p.level) continue;
        if (Math.max(Math.abs(n.x - p.x), Math.abs(n.z - p.z)) <= r) return n;
    }
    return null;
};

console.log("== the Black Knight is Old School's level-32 one, to the field");
{
    const nm = 'wanted_summoned_black_knight';
    check('combat level 32', typeOf(nm).vislevel, 32);
    check('42 hitpoints', nstat(nm, NpcStat.HITPOINTS), 42);
    check('Attack 25', nstat(nm, NpcStat.ATTACK), 25);
    check('Strength 25', nstat(nm, NpcStat.STRENGTH), 25);
    check('Defence 25', nstat(nm, NpcStat.DEFENCE), 25);
    check('a 5-tick attack', nparam(nm, 'attackrate'), 5);
    check('attack bonus +18', nparam(nm, 'attackbonus'), 18);
    check('strength bonus +16', nparam(nm, 'strengthbonus'), 16);
    check('melee defence 73/76/70', [nparam(nm, 'stabdefence'), nparam(nm, 'slashdefence'), nparam(nm, 'crushdefence')], [73, 76, 70]);
    check('magic defence -11', nparam(nm, 'magicdefence'), -11);
    check('ranged defence 72', nparam(nm, 'rangedefence'), 72);
    // AND IT HAS TO COME FOR YOU, which is the half stats alone do not buy.
    check('it hunts on sight', typeOf(nm).huntrange > 0, true);
}

console.log("\n== and Solus has his own page's numbers, not the quest page's summary");
{
    const nm = 'wanted_solus_attackable';
    check('40 hitpoints', nstat(nm, NpcStat.HITPOINTS), 40);
    check('Attack 25', nstat(nm, NpcStat.ATTACK), 25);
    check('Strength 25', nstat(nm, NpcStat.STRENGTH), 25);
    check('Defence 25', nstat(nm, NpcStat.DEFENCE), 25);
    // THE "FAIRLY RAPID" IS A NUMBER: 3 ticks against the Black Knight's 5. Asserted as a pair,
    // because "3" alone would pass on a file that had given everything a 3.
    check('a 3-tick attack - the "fairly rapid"', nparam(nm, 'attackrate'), 3);
    check("  ...and faster than the Black Knight's 5", (nparam(nm, 'attackrate') as number) < (nparam('wanted_summoned_black_knight', 'attackrate') as number), true);
    check('strength bonus +16', nparam(nm, 'strengthbonus'), 16);
    // His defence profile is the character of the fight: soft to a sword, hard to a spell.
    check('melee defence +5 on every style', [nparam(nm, 'stabdefence'), nparam(nm, 'slashdefence'), nparam(nm, 'crushdefence')], [5, 5, 5]);
    check('magic defence +72', nparam(nm, 'magicdefence'), 72);
    check('  ...so a spell is far worse against him than a blade', (nparam(nm, 'magicdefence') as number) > (nparam(nm, 'slashdefence') as number) + 50, true);
    // NO COMBAT LEVEL, which is how the page has him and how the cache already had him:
    // "vislevel=hide". That parses to 0, not -1 - so 0 is what the client is handed, and 0 is
    // what is asserted here. The point of the check is that giving him stats did not give him a
    // level: the fields this file adds are the ones below, and none of them may put a number
    // over his head.
    check('no combat level shown, as the page has it', typeOf(nm).vislevel, 0);
    check('and he is aggressive', typeOf(nm).huntrange > 0, true);
}

// Puts a player at the given stop of the hunt: `done` sightings banked, and `at` lit.
const atStop = (name: string, done: number, at: number) => {
    const p: any = player(name, 2994, 3375, 0);
    H.maxOut(p);
    H.clearInv(p);
    H.setVarBit(p, 'wanted_main', 30); // ^wanted_hunting
    for (let i = 1; i <= done; i++) H.setVarBit(p, 'wanted_mission' + i + 'complete', 1);
    H.setVarBit(p, 'wanted_mission' + at, 1);
    H.give(p, 'wanted_crystal_ball');
    H.tick(2);
    return p;
};
const talkToShell = (p: any, shell: number) => {
    const id = NpcType.getId('wanted_solus' + shell);
    const npc = World.npcs.find((n: any) => n && n.isActive && n.type === id)!;
    p.teleport(npc.x + 1, npc.z, npc.level);
    H.tick(2);
    H.clearLogs();
    H.opNpc(p, npc, 1);
    for (let t = 0; t < 40 && !p.activeScript; t++) H.tick(1);
    A.drive(p);
    H.tick(10);
    return npc;
};

console.log('\n== the sixth stop summons the knight, and he is real');
{
    // five banked, so the next conversation is stop six
    const p = atStop('wk_six', 5, 7);
    check('no Black Knight before it', nearNpc('wanted_summoned_black_knight', p, 12), null);
    talkToShell(p, 7);
    const knight = nearNpc('wanted_summoned_black_knight', p, 12);
    check('a Black Knight is summoned', knight !== null, true);
    if (knight) {
        check('  ...with the hitpoints to fight', knight.levels[NpcStat.HITPOINTS], 42);
        check('  ...and Attack is on his menu', H.npcOpWord(p, knight, 2), 'Attack');
    }
}

console.log('\n== and the last stop is a fight he loses, not a paragraph');
{
    const p = atStop('wk_last', 6, 4); // six banked; the essence mine lit
    check('no attackable Solus before it', nearNpc('wanted_solus_attackable', p, 12), null);
    talkToShell(p, 4);
    const solus = nearNpc('wanted_solus_attackable', p, 12);
    check('he stands and fights', solus !== null, true);
    check('  ...and the quest has NOT handed over the hat yet', H.invCount(p, 'wanted_solus_trophy'), 0);
    check('  ...nor moved on', H.getVarBit(p, 'wanted_main'), 30);
    if (solus) {
        check('  ...Attack is on his menu', H.npcOpWord(p, solus, 2), 'Attack');
        const died = { x: solus.x, z: solus.z, level: solus.level };
        H.attackNpc(p, solus);
        for (let t = 0; t < 400 && solus.isActive; t++) H.tick(1);
        check('he can be killed', solus.isActive, false);
        H.tick(6);
        A.drive(p);
        H.tick(4);
        // AND HIS BONES. Giving him an [ai_queue3] of his own takes him off [ai_queue3,_], where
        // ~npc_default_death drops npc_param(death_drop) - so the trigger that made him killable
        // is also what could quietly stop him leaving anything. tools/gennpcdrops.py noticed
        // before this check existed: he fell out of the generated drop viewer altogether.
        // Looked for over a few tiles and under both owners: he chases while you fight him, so
        // where he falls is not where he was first clicked, and a fresh drop belongs to its killer
        // before it goes public.
        const bones = ObjType.getId('bones');
        let found = false;
        for (let dx = -8; dx <= 8 && !found; dx++) {
            for (let dz = -8; dz <= 8 && !found; dz++) {
                found = !!(World.getObj(died.x + dx, died.z + dz, died.level, bones, p.hash64) ?? World.getObj(died.x + dx, died.z + dz, died.level, bones, -1n));
            }
        }
        check('  ...and his bones are left where he fell, as before', found, true);
        check('  ...killing him corners the quest', H.getVarBit(p, 'wanted_main'), 40);
        check('  ...and his hat is the proof', H.invCount(p, 'wanted_solus_trophy'), 1);
    }
}

console.log('\n== and running from that fight does not end the quest');
{
    // SEVEN banked and nothing lit - which is exactly where a player stands after fleeing the
    // last fight and letting the summoned Solus expire. Seven, not six: wanted_final marks the
    // essence mine done before it spawns him, so the flight happens with the full count already
    // banked, and the recovery branch is guarded on `>= ^wanted_sightings_needed`. Without the
    // scan putting him back there is no route to the hat at all.
    const p = atStop('wk_flee', 7, 4);
    H.setVarBit(p, 'wanted_mission4', 0); // he has despawned; nothing is lit
    H.tick(1);
    check('nothing is lit', H.getVarBit(p, 'wanted_mission4'), 0);
    H.clearLogs();
    H.opheld(p, 'wanted_crystal_ball', 1);
    for (let t = 0; t < 30 && !p.activeScript; t++) H.tick(1);
    A.drive(p);
    H.tick(4);
    check('a scan puts him back at the essence mine', H.getVarBit(p, 'wanted_mission4'), 1);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
