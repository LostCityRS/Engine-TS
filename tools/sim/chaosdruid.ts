// THE ELDER CHAOS DRUID OUTSIDE THE CHAOS TEMPLE, who exchanges bone banknotes for bones.
// https://oldschool.runescape.wiki/w/Elder_Chaos_druid_(NPC) and its dialogue transcript.
//
// Every line he says is in the transcript, so every line is asserted here rather than eyeballed.
// The part that needs a sim rather than a reading is the exchange: it spends coins and hands back
// unstackable bones, and inv_moveitem_uncert DROPS WHAT WILL NOT FIT AT THE PLAYER'S FEET. This is
// level 38 Wilderness. So every case below also checks the ground is empty afterwards - a pass
// that only counted the bones in the pack would not notice a player's stack lying in a PK zone.
//
// TWO THINGS ABOUT READING WHAT WAS SAID, both of which cost a false failure first:
//
//   a1lib.talk's return value starts too late. It snapshots the interface log inside drive(), and
//   by then the FIRST ~chatnpc page has already been sent during the ticks talk() spends waiting
//   for the script to start - so the welcome line was simply missing from what came back. These
//   cases clear the log first and read it whole.
//
//   And the lines are WRAPPED at the chatbox's width, mid-sentence, each line its own component
//   text. "I charge 50 coins per banknote" is never one string; it is "...I charge 50 coins" and
//   "per banknote.". So the lines are joined back together before anything is looked for in them.
import * as H from './harness.ts';
import * as A from './a1lib.ts';
import { check, R } from './a1lib.ts';
import World from '#/engine/World.js';
import { canTravel } from '#/engine/GameMap.js';
import { CollisionType } from '#/engine/routefinder/index.js';
import NpcType from '#/cache/config/NpcType.js';
import InvType from '#/cache/config/InvType.js';
import type Player from '#/engine/entity/Player.js';

await H.boot();

// WHERE HE STANDS, AND WHY THAT TILE. Old School says only "outside the Chaos Temple in level 38
// Wilderness" and gives no coordinate, so it was read off the map rather than guessed. A flood
// from the altar at 2947,3820 comes back with 51 tiles and solid rock on every side: that pocket
// IS the temple, and its only way out is east at 2958,3820 and 2958,3821, where a pair of "Large
// door" locs sit between two warrior statues. Everything from 2959 eastwards is open Wilderness.
//
// So 2959,3822: immediately outside, on drawn floor, and one tile clear of the doorway line that
// runs through z3820 and z3821 - an npc blocks its own tile and that doorway is two tiles wide, so
// standing him in it would have him barring the altar he is there to serve.
const DRUID = 'elder_chaos_druid_merchant';
const DX = 2959;
const DZ = 3822;

const DIRS: [number, number][] = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
];

/** Everything said to this player during `go`, as one string, plus the chatbox messages. */
function heard(p: Player, go: () => void) {
    H.clearLogs();
    go();
    const text = H.ifaces
        .filter(i => i.who === p.username && i.kind === 'text' && i.text)
        .map(i => i.text!)
        .join(' ');
    const mes = H.mesgs.filter(m => m.who === p.username).map(m => m.text);
    return { text, mes };
}

const free = (p: Player) => p.getInventory(InvType.INV)!.freeSlotCount;

function groundAround(p: Player): number {
    let n = 0;
    for (const obj of World.gameMap.getZone(p.x, p.z, p.level).getAllObjsUnsafe()) {
        if (Math.abs(obj.x - p.x) <= 1 && Math.abs(obj.z - p.z) <= 1) n++;
    }
    return n;
}

/** A pack with exactly $want slots free, holding $notes notes and $coins coins. */
function pack(p: Player, note: string, notes: number, coins: number, want: number) {
    H.give(p, note, notes);
    if (coins > 0) H.give(p, 'coins', coins);
    const junk = free(p) - want;
    if (junk > 0) H.give(p, 'bronze_sword', junk);
    H.tick(1);
}

// ------------------------------------------------------------------ where he stands
{
    const p = A.player('ecd_spawn', 2962, 3822);
    const npc = H.npcNear(DRUID, DX, DZ, 0);
    check('he is spawned outside the temple', npc ? `${npc.x},${npc.z}` : 'nowhere', `${DX},${DZ}`);
    check('named as the mage he stands with', npc ? NpcType.get(npc.type).name : null, 'Elder Chaos druid');

    const seen = new Set<string>([`${p.x},${p.z}`]);
    const q: [number, number][] = [[p.x, p.z]];
    while (q.length && seen.size < 4000) {
        const [cx, cz] = q.shift()!;
        for (const [dx, dz] of DIRS) {
            const k = `${cx + dx},${cz + dz}`;
            if (seen.has(k) || !canTravel(0, cx, cz, dx, dz, 1, 0, CollisionType.NORMAL)) continue;
            seen.add(k);
            q.push([cx + dx, cz + dz]);
        }
    }
    check('a player in the Wilderness can walk up to him', DIRS.some(([dx, dz]) => seen.has(`${DX + dx},${DZ + dz}`)), true);
}

// ------------------------------------------------------------------ what he says
{
    const p = A.player('ecd_talk', DX + 1, DZ);
    const { text } = heard(p, () => A.talk(p, DRUID, ['Yes please']));
    check('welcomes you to the temple', text.includes("welcome to The Dark Lord's temple"), true);
    check('says Zamorak rewards those who offer bones', text.includes('Zamorak will reward those who offer the bones of the vanquished'), true);
    check('offers the service', text.includes('I can exchange banknotes for bones'), true);
    check('names the fee', text.includes('I charge 50 coins per banknote'), true);
    check('offers all three options', ['Yes please.', 'Who are you?', 'No thanks.'].every(o => text.includes(o)), true);
    check('takes the notes when you say yes', text.includes('Hand me the banknotes you wish me to exchange'), true);
}
{
    const p = A.player('ecd_who', DX + 1, DZ);
    const { text } = heard(p, () => A.talk(p, DRUID, ['Who are you', 'No thanks']));
    check('will not say who he is', text.includes('That is not important'), true);
    check('says what he is there for', text.includes('facilitate your offerings to The Dark Lord'), true);
    check('asks again after that', text.includes('Would you like any bone banknotes exchanged?'), true);
    check('lets you decline', text.includes('No thanks'), true);
}

// ------------------------------------------------------------------ the four refusals
{
    const p = A.player('ecd_plain', DX + 1, DZ);
    H.give(p, 'bones', 1);
    const { text } = heard(p, () => A.useOnNpc(p, DRUID, 'bones'));
    check('refuses an item that is not a banknote', text.includes("I exchange banknotes for real items. That's not a banknote."), true);
    check('  and keeps the bones', H.invCount(p, 'bones'), 1);
}
{
    const p = A.player('ecd_notbone', DX + 1, DZ);
    H.give(p, 'cert_iron_ore', 5);
    const { text } = heard(p, () => A.useOnNpc(p, DRUID, 'cert_iron_ore'));
    check('refuses a note the altar would not take', text.includes("I only exchange items that can be offered as a sacrifice to The Dark Lord's altar."), true);
    check('  and keeps the notes', H.invCount(p, 'cert_iron_ore'), 5);
}
{
    const p = A.player('ecd_broke', DX + 1, DZ);
    H.give(p, 'cert_bones', 10);
    H.give(p, 'coins', 49);
    const { text } = heard(p, () => A.useOnNpc(p, DRUID, 'cert_bones'));
    check('refuses 49 coins', text.includes('I charge 50 coins for exchanging each banknote.'), true);
    check('  and takes nothing', [H.invCount(p, 'cert_bones'), H.invCount(p, 'coins')], [10, 49]);
}
{
    const p = A.player('ecd_full', DX + 1, DZ);
    pack(p, 'cert_bones', 10, 1000, 0);
    check('no free slot to start', free(p), 0);
    const { text } = heard(p, () => A.useOnNpc(p, DRUID, 'cert_bones'));
    check('refuses a full pack', text.includes('Your inventory is too full.'), true);
    check('  and takes no payment', H.invCount(p, 'coins'), 1000);
    check('  and drops nothing', groundAround(p), 0);
}

// ------------------------------------------------------------------ the exchange
{
    const p = A.player('ecd_ten', DX + 1, DZ);
    H.give(p, 'cert_bones', 10);
    H.give(p, 'coins', 500);
    const { mes } = heard(p, () => A.useOnNpc(p, DRUID, 'cert_bones'));
    check('exchanges ten notes', [H.invCount(p, 'bones'), H.invCount(p, 'cert_bones')], [10, 0]);
    check('  for 500 coins exactly', H.invCount(p, 'coins'), 0);
    check('  and says so', mes.some(m => m.includes('The druid exchanges 10 x Bones')), true);
    check('  and drops nothing', groundAround(p), 0);
}
{
    const p = A.player('ecd_afford', DX + 1, DZ);
    H.give(p, 'cert_bones', 10);
    H.give(p, 'coins', 275);
    A.useOnNpc(p, DRUID, 'cert_bones');
    check('exchanges only what the coins cover', [H.invCount(p, 'bones'), H.invCount(p, 'cert_bones')], [5, 5]);
    check('  leaving the change', H.invCount(p, 'coins'), 25);
    check('  and drops nothing', groundAround(p), 0);
}
{
    // A PART-EXCHANGE FOR WANT OF SPACE, which is the case that drops things on the floor if the
    // count is wrong. Five free slots and twenty notes: the notes keep their own slot throughout,
    // so five bones is the whole of it.
    const p = A.player('ecd_space', DX + 1, DZ);
    pack(p, 'cert_bones', 20, 5000, 5);
    check('five slots free to start', free(p), 5);
    A.useOnNpc(p, DRUID, 'cert_bones');
    check('fills the free slots and stops', [H.invCount(p, 'bones'), H.invCount(p, 'cert_bones')], [5, 15]);
    check('  charging only for those five', H.invCount(p, 'coins'), 4750);
    check('  and drops nothing', groundAround(p), 0);
}
{
    // THE LAST NOTE INHERITS ITS OWN SLOT, so a pack with no free slot at all still exchanges one.
    const p = A.player('ecd_lastnote', DX + 1, DZ);
    pack(p, 'cert_bones', 1, 50, 0);
    check('no free slot', free(p), 0);
    A.useOnNpc(p, DRUID, 'cert_bones');
    check('exchanges the single note anyway', [H.invCount(p, 'bones'), H.invCount(p, 'cert_bones')], [1, 0]);
    check('  and drops nothing', groundAround(p), 0);
}
{
    // NOT HARDCODED TO ORDINARY BONES: anything the altar accepts, he unnotes.
    const p = A.player('ecd_dragon', DX + 1, DZ);
    H.give(p, 'cert_dragon_bones', 3);
    H.give(p, 'coins', 150);
    A.useOnNpc(p, DRUID, 'cert_dragon_bones');
    check('unnotes dragon bones too', [H.invCount(p, 'dragon_bones'), H.invCount(p, 'cert_dragon_bones')], [3, 0]);
    check('  for 150 coins', H.invCount(p, 'coins'), 0);
    check('  and drops nothing', groundAround(p), 0);
}
console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
