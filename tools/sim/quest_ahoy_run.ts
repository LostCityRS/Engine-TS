// GHOSTS AHOY, played through on foot. Nothing here teleports except the quest's own ghost ship.
//
// This is the REBUILT quest - the one the wiki describes - after an audit found that what was here
// was an invented quest standing on the real one's parts. Each `note` gives the wiki's step number,
// so the trace reads as the walkthrough.
//
// WHAT THE RUNS TAUGHT THE MANIFEST. ahoy_town_barrier is placed twice, at 3652,3485 and 3659,3508,
// and that is not redundancy: Velorina, Robin, the innkeeper, Gravingas, the villagers and the pier
// are inside the walls, while Necrovarus, the Ectofuntus, the temple, the wreck and the crone are
// outside them, with no open-ground route between the two halves. And ahoy_harbour_door is ONE loc
// type placed seven times, four of which are in the way: Robin's house, the temple's upper floor,
// the wreck's middle deck and the crone's hut.
//
//   npx tsx tools/sim/quest_ahoy_run.ts
import * as H from './harness.js';
import { play, Manifest, Step } from './questrun.js';

await H.boot();

// A gate crossing, from the side you are standing on. [label,ahoy_step_through] steps you two tiles
// along one axis from your OWN tile, so the approach tile has to be the one next to the barrier on
// your side - and it has to be exact, because landing on the far side makes the handler step you
// back out again.
const gate = (at: [number, number], loc: [number, number], why: string): Step[] => [
    { go: at, r: 200, exact: true, why: why },
    { loc: 'ahoy_town_barrier', at: loc, why: 'pass the energy barrier' }
];
const southIn = (): Step[] => gate([3651, 3485], [3652, 3485], 'the south gate, from outside');
const northOut = (): Step[] => gate([3659, 3507], [3659, 3508], 'the north gate, from inside');
const northIn = (): Step[] => gate([3659, 3509], [3659, 3508], 'the north gate, from outside');

const innDoorOut: Step[] = [
    { go: [3671, 3498], r: 64, why: 'the inn door from inside' },
    { loc: 'ahoy_harbour_door', at: [3670, 3497], soft: true }
];
const innDoor: Step[] = [
    { go: [3670, 3496], r: 160, why: "outside Robin's house" },
    { loc: 'ahoy_harbour_door', at: [3670, 3497], why: 'open the tatty door', soft: true }
];
// one of the twelve ghost villagers, signing. The petition wants ten.
const sign = (): Step[] => [{ talk: 'ahoy_ghost_villager', tries: 6, why: 'a signature' }];

const m: Manifest = {
    quest: 'GHOSTS AHOY',
    source: 'oldschool.runescape.wiki/w/Ghosts_Ahoy/Quick_guide (2004 quest, unchanged in OSRS)',
    stageVar: 'ahoy_questvar',
    done: 15,
    start: [3648, 3485, 0],
    steps: [
        { give: 'amulet_of_ghostspeak' },
        { give: 'ectotoken', n: 30 },
        // The tea is made outside the quest - nettles, gloves, a fire and a bowl of water - so the
        // run starts from the boiled bowl. NOT FROM THE FINISHED CUP, which is what it used to be
        // handed, under a comment claiming "the crone's fuss about the cup is tested, not skipped".
        // The fuss was tested. WHERE THE CUP COMES FROM was the part being skipped, and that was
        // the part that did not work: nothing in the game produced a chinacup_empty, so the quest
        // could not be finished by any player (DeathPlateau-Bugs#92). The cup now has to come out
        // of her, as it does for a player.
        { give: 'bowl_nettletea' },
        { give: 'bucket_milk' },
        { give: 'needle' },
        { give: 'thread' },
        { give: 'silk' },
        { give: 'reddye' },
        { give: 'bluedye' },
        { give: 'yellowdye' },
        { give: 'spade' },
        { give: 'oak_longbow' },
        { give: 'bucket_ectoplasm' },
        { setvar: 'priestperil', to: 60, why: 'Priest in Peril, a real requirement' },
        { setvar: 'prieststart', to: 5, why: 'The Restless Ghost, the other one' },

        { note: 'wiki step 2: into Port Phasmatys and talk to Velorina' },
        ...southIn(),
        { go: [3677, 3510], why: "Velorina's house" },
        { talk: 'ahoy_velorina', picks: [1] },
        { stage: 1 },

        { note: 'wiki step 3: Necrovarus at the Ectofuntus, outside the walls' },
        ...northOut(),
        { go: [3658, 3516], why: 'the Ectofuntus' },
        { talk: 'ahoy_necrovarus' },
        { stage: 2 },

        { note: 'wiki step 4: back to Velorina, who names the old crone' },
        ...northIn(),
        { go: [3677, 3510] },
        { talk: 'ahoy_velorina' },
        { stage: 3 },

        { note: 'wiki steps 5-6: the crone east of the slayer tower, and her tea' },
        ...northOut(),
        { go: [3550, 3545], r: 200, why: 'west across the swamp' },
        { go: [3470, 3558], r: 200 },
        { go: [3460, 3554], r: 64, why: 'outside her hut' },
        { loc: 'ahoy_harbour_door', at: [3461, 3555], why: 'open the hut door', soft: true },
        { go: [3463, 3556], r: 32 },
        { talk: 'ahoy_crone', why: 'she asks for nettle tea' },
        { talk: 'ahoy_crone', why: 'and hands over her own porcelain cup' },
        { has: 'chinacup_empty' },
        { use: ['bowl_nettletea', 'chinacup_empty'], why: 'pour the tea into her cup' },
        { use: ['bucket_milk', 'chinacup_of_nettletea'], why: 'and the milk she insists on' },
        { talk: 'ahoy_crone', why: 'her cup, with milk in it' },
        { hasnt: 'chinacup_of_nettletea_milky' },
        { stage: 4 },

        { note: 'wiki step 7: the wreck. The old man wants his son model ship' },
        { go: [3550, 3545], r: 200, why: 'back east' },
        { go: [3610, 3543], r: 200, why: 'the wreck' },
        { loc: 'ahoy_ghostship_ladder', at: [3609, 3543], why: 'up to the deck' },
        { level: 1 },
        { loc: 'ahoy_harbour_door', at: [3615, 3543], why: 'open the deck door', soft: true },
        { go: [3618, 3543], why: 'the old man' },
        { talk: 'ahoy_oldman', why: 'he asks for the model ship' },

        { note: 'the model ship is in the chest at the aft end of the hold, where he says it is' },
        { loc: 'ahoy_ghostship_laddertop', at: [3609, 3543], why: 'down into the hold' },
        { level: 0 },
        { go: [3619, 3545], r: 64, why: 'the aft chest' },
        { loc: 'ahoy_chest_locked', at: [3619, 3544], why: 'the model ship' },
        { has: 'ahoy_toy_boat' },
        { use: ['needle', 'ahoy_toy_boat'], why: 'needle, silk and thread' },
        { has: 'ahoy_toy_boat_repaired' },
        { hasnt: 'silk' },
        { hasnt: 'thread' },

        { note: 'wiki step 7: search the mast for the flag colours, then dye the flag to match' },
        { go: [3610, 3543], r: 64 },
        { loc: 'ahoy_ghostship_ladder', at: [3609, 3543] },
        { go: [3615, 3542], why: 'the forward ladder' },
        { loc: 'ahoy_ghostship_ladder', at: [3615, 3541], why: 'up to the quarterdeck' },
        { level: 2 },
        { go: [3619, 3542], r: 32, why: 'the mast' },
        { note: 'the search is random(2) - the wind takes the flag half the time - and six soft' },
        { note: 'tries still lost the whole walk about one run in sixty-four, which is what this' },
        { note: 'did. Pinned high so random(2) comes out 1 and the flag hangs still first time,' },
        { note: 'then one more search to see the remembered-colours branch.' },
        { rng: 0.99, why: 'random(2) = 1: the wind drops' },
        { loc: 'ahoy_mast', at: [3619, 3543], want: 'red, then blue, then yellow', why: 'search it' },
        { rng: null },
        { loc: 'ahoy_mast', at: [3619, 3543], want: 'have it by heart', why: 'and again, now it is remembered' },
        { varis: 'ahoy_windspeed', to: 1 },
        { use: ['reddye', 'ahoy_toy_boat_repaired'], why: 'red, blue and yellow' },
        { varis: 'ahoy_subquest_toyboat', to: 3 },

        { note: 'the old man trades the key for his son ship' },
        { loc: 'ahoy_ghostship_laddertop', at: [3615, 3541], why: 'down to the deck' },
        { level: 1 },
        { go: [3618, 3543], why: 'the old man' },
        { talk: 'ahoy_oldman', why: 'hand over the ship' },
        { has: 'ahoy_chest_key' },

        { note: 'wiki step 7: the three map scraps - the captain chest, the lobster, the rocks' },
        { go: [3615, 3542] },
        { loc: 'ahoy_ghostship_ladder', at: [3615, 3541] },
        { level: 2 },
        { go: [3617, 3541] },
        { loc: 'ahoy_chest_locked', at: [3618, 3541], why: "the captain's chest" },
        { has: 'ahoy_map_scrap_1' },
        { loc: 'ahoy_ghostship_laddertop', at: [3615, 3541] },
        { loc: 'ahoy_ghostship_laddertop', at: [3609, 3543] },
        { level: 0 },
        { go: [3621, 3544], r: 64, why: 'the aft chest in the hold' },
        { loc: 'ahoy_chest_locked', at: [3621, 3543], why: 'something inside moves' },
        { fight: 'giant_lobster' },
        { loc: 'ahoy_chest_locked', at: [3621, 3543], why: 'and now search it' },
        { has: 'ahoy_map_scrap_2' },
        { go: [3603, 3543], r: 64, why: 'west along the hull to the last chest' },
        { loc: 'ahoy_chest_locked', at: [3602, 3543], why: 'the chest across the rocks' },
        { has: 'ahoy_map_scrap_3' },
        { use: ['ahoy_map_scrap_1', 'ahoy_map_scrap_2'] },
        { has: 'ahoy_map_complete' },
        { stage: 5 },

        { note: 'wiki steps 8-9: the ghost captain, Dragontooth Island, and the dig' },
        ...northIn(),
        { go: [3701, 3487], r: 200, why: 'the pier' },
        { talk: 'ahoy_ghost_captain_1', why: 'sail to Dragontooth Island' },
        { go: [3803, 3530], r: 128, exact: true, why: 'where the figures point' },
        { held: 'spade' },
        { has: 'ahoy_book_of_haricanto' },
        { stage: 6 },

        { note: 'wiki step 10: Ak-Haranu wants a bow with Robin name on it' },
        { go: [3793, 3557], r: 128, why: 'back to the island dock' },
        { talk: 'ahoy_ghost_captain_1', why: 'sail back' },
        { go: [3691, 3496], r: 128, why: 'the dock' },
        { talk: 'ahoy_akharanu_multi', why: 'he names his price' },
        { varis: 'ahoy_subquest_bow', to: 1 },

        { note: 'Robin, in the inn: four hands of Rune-Draw and he owes you a hundred coins' },
        ...innDoor,
        { go: [3676, 3490], why: 'Robin' },
        { talk: 'ahoy_robin', why: 'he explains the game' },
        { talk: 'ahoy_robin', picks: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], tries: 40, until: 'oak_longbow_signed', why: 'play until he loses four' },
        { varis: 'ahoy_subquest_bow', to: 8 },
        { has: 'oak_longbow_signed' },
        { go: [3670, 3498], r: 64, why: 'the inn door, which has swung shut' },
        { loc: 'ahoy_harbour_door', at: [3670, 3497], soft: true },
        { go: [3691, 3496], r: 128, why: 'back to the dock' },
        { talk: 'ahoy_akharanu_multi', why: 'trade the signed bow for the manual' },
        { has: 'ahoy_translation_manual' },
        { stage: 7 },
        { use: ['ahoy_translation_manual', 'ahoy_book_of_haricanto'] },
        { stage: 8 },

        { note: 'wiki step 11: a job at the inn, a bucket of ectoplasm, and wear the thing' },
        ...innDoor,
        { go: [3681, 3495], why: 'the ghost innkeeper' },
        { talk: 'ahoy_ghost_innkeeper', why: 'ask for work' },
        { has: 'ahoy_bedsheet' },
        { use: ['bucket_ectoplasm', 'ahoy_bedsheet'] },
        { has: 'ahoy_bedsheetgreen' },
        { held: 'ahoy_bedsheetgreen', op: 2, why: 'wear it' },

        ...innDoorOut,
        { note: 'wiki step 11: Gravingas, in the square by the north gate, and ten signatures' },
        { go: [3658, 3503], r: 160, why: 'Gravingas' },
        { talk: 'ahoy_ghost_protestor', why: 'he hands over the petition' },
        { has: 'ahoy_petition' },
        ...sign(),
        ...sign(),
        ...sign(),
        ...sign(),
        ...sign(),
        ...sign(),
        ...sign(),
        ...sign(),
        ...sign(),
        ...sign(),
        { varis: 'ahoy_signaturecounter', to: 10 },
        { go: [3658, 3503], r: 160, why: 'back to Gravingas' },
        { talk: 'ahoy_ghost_protestor', why: 'ten names' },
        { stage: 9 },

        { note: 'wiki step 11: show it to Necrovarus, and he drops a key' },
        ...northOut(),
        { go: [3658, 3516], why: 'the Ectofuntus' },
        { talk: 'ahoy_necrovarus', why: 'ten names' },
        { stage: 10 },
        { take: 'ahoy_bone_key', why: 'it fell out of his robes' },

        { note: 'wiki step 11: the locked door upstairs, and the coffin behind it' },
        { go: [3665, 3518], why: 'the temple stairs' },
        { loc: 'ahoy_tower_stairs_lv1', at: [3666, 3518], why: 'up' },
        { level: 1 },
        { loc: 'ahoy_harbour_door', at: [3656, 3514], why: 'the bone key turns the bone lock' },
        { varis: 'ahoy_templedoor_unlocked', to: 1 },
        { loc: 'ahoy_coffin', at: [3659, 3513], why: "Necrovarus's coffin" },
        { has: 'ahoy_robes_of_necrovarus' },

        { note: 'wiki step 12: the crone, then Necrovarus, then Velorina' },
        { loc: 'ahoy_tower_stairs_lv1_top', at: [3666, 3520], why: 'back down' },
        { level: 0 },
        { go: [3550, 3545], r: 200, why: 'west to the crone' },
        { go: [3460, 3554], r: 200 },
        { loc: 'ahoy_harbour_door', at: [3461, 3555], soft: true },
        { go: [3463, 3556], r: 32 },
        { talk: 'ahoy_crone', why: 'she tells you what the robes are for' },
        { stage: 11 },
        { go: [3550, 3545], r: 200, why: 'back east' },
        { go: [3658, 3516], r: 200, why: 'the Ectofuntus' },
        { talk: 'ahoy_necrovarus', why: 'let him see you holding them' },
        { stage: 12 },
        ...southIn(),
        { go: [3677, 3510], why: 'Velorina' },
        { talk: 'ahoy_velorina', why: 'tell her' },
        { stage: 15 },
        { has: 'ectophial' }
    ]
};

const p: any = H.makePlayer('ahoyrun', m.start[0], m.start[1]);
H.tick(2);
p.teleport(m.start[0], m.start[1], m.start[2]);
// The giant lobster is level 32 and the swamp between here and the crone is not empty; this run is
// auditing whether the quest can be completed, not whether it can be survived, and a death loses
// the pack. Damage going the OTHER way is untouched, so the lobster still has to be killed.
(p as any).applyDamage = function () {};
// AND NO RANDOM EVENTS. These runs walk for hundreds of ticks at a stretch and a random event
// teleports the player out of the middle of it - one run lost the walk to Zooknock at 2523,4780,
// 262 tiles into a 628-tile route, which reads as a pathing failure and is not one.
// ~macro_event_allowed refuses to spawn one while %macro_event is already set, so setting it is
// the switch. A player being interrupted by a random event is real; it is just not what is
// under test here.
H.setVar(p, 'macro_event', 1);
H.maxOut(p);
H.equip(p, { front: 'amulet_of_ghostspeak', rhand: 'rune_scimitar' });
H.tick(1);

const prayerBefore = (p as any).stats ? (p as any).stats[5] : 0;
const res = play(m, p);
const bad = res.filter(r => !r.ok);

console.log('');
console.log('REWARDS, AND WHAT CAN BE DONE TWICE');
const xp = () => ((p as any).stats ? (p as any).stats[5] : 0);
console.log('  Prayer xp from the whole quest: ' + (xp() - prayerBefore) / 10 + '   (the wiki says 2,400)');
console.log('  ectophial in the pack: ' + H.invCount(p, 'ectophial'));
if (H.invCount(p, 'ahoy_translation_manual') > 0 && H.invCount(p, 'ahoy_book_of_haricanto') > 0) {
    const before = xp();
    for (let i = 0; i < 5; i++) {
        H.useHeldOn(p, 'ahoy_translation_manual', 'ahoy_book_of_haricanto');
        for (let k = 0; k < 10; k++) H.tick(1);
        if (p.activeScript) p.activeScript = null;
    }
    const gained = (xp() - before) / 10;
    console.log('  re-reading the manual onto the book five more times: ' + gained + ' Prayer xp' + (gained > 0 ? '   *** REPEATABLE ***' : '   (nothing, correctly)'));
}

if (bad.length) {
    console.log('');
    console.log('WHAT WENT WRONG');
    for (const r of bad) console.log('  step ' + r.n + '  ' + r.what + (r.detail ? '  -- ' + r.detail : ''));
}
process.exit(bad.length ? 1 : 0);
