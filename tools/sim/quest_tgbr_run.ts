// THE GREAT BRAIN ROBBERY, played through on foot.
//
// A quest the 377 cache does not have a line of: November 2006 against a September 2006 cache, so
// Harmony Island, the Underwater Tunnel, Brother Tranquility, Mi-Gor, Barrelchest, the Sorebones and
// all fourteen items came out of the rev 474 cache. content/scripts/quests/quest_tgbr/configs/
// quest_tgbr.constant is the design document; this is the proof that the fourteen stages can be
// walked in order.
//
// WHAT THIS RUN CANNOT DO, said here rather than quietly skipped:
//   the ten wooden cats are carved at a Workbench in a player-owned house, and a sim player has no
//   house, so they are handed over instead. The carving itself (~tgbr_carve_cats, one plank and one
//   fur each at 16 Crafting for 15 experience) is checked by tools/sim/tgbrcats.ts.
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_tgbr_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const HARMLESS: [number, number, number] = [3670, 2979, 0]; // beside Brother Tranquility
const MILL: [number, number, number] = [3786, 2824, 0]; // inside the Harmony windmill's ring
const STATUE: [number, number, number] = [3794, 2844, 0]; // west of the statue
const _CHAMBER_WCHAMBER_W: [number, number, number] = [3786, 9254, 0];
const _TUNNEL_WTUNNEL_W: [number, number, number] = [3789, 9254, 1];
const _CHAMBER_ECHAMBER_E: [number, number, number] = [3829, 9254, 0];
const _LADDER_TOPLADDER_TOP: [number, number, number] = [3831, 2854, 0];
const _PEEPPEEP: [number, number, number] = [3804, 2845, 0]; // outside the gate, at the peephole
const BOOKCASE: [number, number, number] = [3049, 3484, 0]; // Edgeville monastery, by the shelf
const JAIL: [number, number, number] = [3549, 3554, 2]; // the cell at the top of the castle
const CRATE: [number, number, number] = [3548, 3555, 2];
const CANIFIS: [number, number, number] = [3507, 3495, 0]; // Rufus's counter
const CELLAR: [number, number, number] = [3786, 9224, 0];
const LOCKER: [number, number, number] = [3792, 2873, 0]; // on the sand beside the ship's locker
const _DECKDECK: [number, number, number] = [3799, 2873, 1]; // the deck above, after the bridge flag
const GATE: [number, number, number] = [3804, 2844, 0]; // outside the monastery gate
const COURTYARD: [number, number, number] = [3808, 2843, 0]; // inside the gate

const m: Manifest = {
    quest: 'THE GREAT BRAIN ROBBERY',
    source: 'oldschool.runescape.wiki/w/The_Great_Brain_Robbery/Quick_guide',
    stageVar: 'tgbr',
    done: 130, // ^tgbr_complete
    start: HARMLESS,
    steps: [
        { note: 'requirements: Cabin Fever and Creature of Fenkenstrain, 16 Crafting,' },
        { note: '30 Construction and 50 Prayer. None of them is boostable.' },
        { setvar: 'fever_quest', to: 7, why: '^fever_complete' },
        { setvar: 'fenk_quest', to: 8, why: '^fenk_complete' },

        { note: 'items: Murphy’s fishbowl helmet and diving apparatus from Recipe for Disaster' },
        { note: '(there is one set of diving gear in the game and this quest wears it), a hammer,' },
        { note: 'nails, planks, a holy symbol and the Ring of Charos.' },
        { give: 'hundred_pirate_diving_helmet' },
        { give: 'hundred_pirate_diving_backpack' },
        { give: 'hammer' },
        { give: 'nails', n: 40 },
        { give: 'plank', n: 8 },
        { give: 'blessedstar' },
        { give: 'ring_of_charos' },
        { give: 'tinderbox' },
        { held: 'hundred_pirate_diving_helmet', op: 2, why: 'the helmet on' },
        { held: 'hundred_pirate_diving_backpack', op: 2, why: 'and the apparatus' },
        { worn: 'hundred_pirate_diving_helmet' },
        { worn: 'hundred_pirate_diving_backpack' },

        { note: 'SCOUTING, wiki step 1: Brother Tranquility, by the dock on Mos Le’Harmless' },
        {
            talk: 'tgbr_tranquility_shell',
            picks: ['What island?', 'I will come and look.'],
            want: 'put us both on the beach',
            why: 'take the job; he teleports you to Harmony Island'
        },
        { stage: 10 },
        { wait: 6, why: 'his teleport is a two-tick spell animation and then the jump' },

        { note: 'wiki step 2: out of the mill, north to the statue, pull it and climb down' },
        { setpos: STATUE, why: 'north of the windmill' },
        { loc: 'tgbr_multi_statue', at: [3795, 2844], op: 1, want: 'hole under it', why: 'pull the statue' },
        { varis: 'tgbr_statue', to: 2 },
        { loc: 'tgbr_multi_statue', at: [3795, 2844], op: 1, why: 'and climb down' },
        { go: [3786, 9254, 0], why: 'the dry chamber at the foot of the shaft' },

        { note: 'wiki steps 3-4: the flooded tunnel, and the steps at the far end of it' },
        { loc: 'harmony_tunnel_stairs_west', at: [3788, 9254], op: 1, why: 'down into the water' },
        { go: [3820, 9254, 1], why: 'east along the tunnel' },
        { loc: 'tgbr_multi_stairs', at: [3829, 9254], op: 1, want: 'steps will hold', why: 'nail the steps back together' },
        { varis: 'tgbr_stairs', to: 1 },
        { loc: 'tgbr_multi_stairs', at: [3829, 9254], op: 2, why: 'and climb them' },

        { note: 'wiki step 5: up the ladder and through the peephole' },
        { loc: 'harmony_tunnel_ladder_east', at: [3831, 9254], op: 1, why: 'out onto the island' },
        { go: [3804, 2844, 0], why: 'south-west to the monastery gate' },
        { loc: 'tgbr_multi_gate_door', at: [3805, 2844], op: 2, want: 'walled yard', why: 'look through the hole in the gate' },
        { stage: 20 },

        { note: 'wiki step 6: back to Brother Tranquility, who ferries you off the island' },
        { setpos: MILL, why: 'back to the windmill' },
        { talk: 'tgbr_tranquility_shell', op: 3, want: 'quicker than the boat', why: 'ask for a lift to Mos Le’Harmless' },
        { wait: 6, why: 'the teleport' },
        { talk: 'tgbr_tranquility_shell', want: 'prayer against poison', why: 'tell him what you saw' },
        { stage: 30 },

        { note: 'THE PRAYER BOOK, wiki steps 1-2: the Edgeville monastery’s south-west shelf' },
        { setpos: BOOKCASE, why: 'to the monastery north of Edgeville' },
        { loc: 'bookcase', at: [3049, 3483], op: 1, want: 'prayers against poison', why: 'search the bookcase' },
        { has: 'tgbr_prayer_book_unread' },
        { held: 'tgbr_prayer_book_unread', op: 1, want: 'by heart', why: 'read it' },
        { has: 'tgbr_prayer_book' },
        { stage: 40 },

        { note: 'wiki steps 3-6: a holy symbol on, back to the island, and recite it' },
        { held: 'blessedstar', op: 2, why: 'wear the holy symbol' },
        { worn: 'blessedstar' },
        { setpos: MILL, why: 'back to Harmony Island' },
        { held: 'tgbr_prayer_book', op: 2, want: 'stops tasting of anything', why: 'recite the prayer' },
        { stage: 50 },
        { talk: 'tgbr_tranquility_shell', want: 'somebody who has done it before', why: 'and tell him' },

        { note: 'THE DOCTOR, wiki step 1: Dr Fenkenstrain, in the cell at the top of his castle' },
        { setpos: JAIL, why: 'to the top floor of Fenkenstrain’s castle' },
        {
            talk: 'fenk_fenkenstrain_in_tower',
            picks: ['I can have you teleported there.'],
            want: 'Find another way',
            why: 'he will come, and he will not teleport'
        },
        { stage: 60 },

        { note: 'wiki steps 2-3: Rufus, who will only talk to a werewolf - or to the Ring of Charos' },
        { held: 'ring_of_charos', op: 2, why: 'the ring on' },
        { worn: 'ring_of_charos' },
        { setpos: CANIFIS, why: 'to the Canifis meat counter' },
        { talk: 'werewolfshopkeeper1', picks: ['What do you send?'], want: 'shipping orrrder', why: 'ask about posting a man' },
        { has: 'tgbr_crate_part' },
        { has: 'tgbr_wolf_whistle' },
        { varis: 'tgbr_crate', to: 1 },

        { note: 'wiki step 4: ten wooden cats. A sim player has no house, so they are given here;' },
        { note: 'tools/sim/tgbrcats.ts checks the carving itself.' },
        { give: 'wooden_cat', n: 10, how: 'Carve wooden cats in your house, one plank and one fur each, with 16 Crafting' },

        { note: 'wiki steps 5-8: build the crate beside him, floor it, fill it, whistle, post it' },
        { setpos: CRATE, why: 'back to the cell' },
        { loc: 'tgbr_multi_crate', at: [3548, 3555], op: 1, want: 'perfectly ordinary crate', why: 'build the crate' },
        { varis: 'tgbr_crate', to: 2 },
        { loc: 'tgbr_multi_crate', at: [3548, 3555], op: 1, want: 'second floor halfway up', why: 'add the false bottom' },
        { varis: 'tgbr_crate', to: 3 },
        { loc: 'tgbr_multi_crate', at: [3548, 3555], op: 1, want: 'ten wooden cats', why: 'fill the top with cats' },
        { varis: 'tgbr_crate', to: 4 },
        { note: 'the whistle cannot be blown through a fishbowl helmet, which is Old School’s own' },
        { note: 'joke and is kept: a player who has just come off the island is wearing one.' },
        { close: true, why: 'the fill step ends on a box, and an open box swallows the next click' },
        { strip: ['blessedstar', 'ring_of_charos'], why: 'helmet and apparatus off' },
        { held: 'tgbr_wolf_whistle', op: 1, want: 'wooden heads knocking', why: 'blow the whistle for Rufus' },
        { has: 'tgbr_shipping_order' },
        { useLoc: 'tgbr_multi_crate', at: [3548, 3555], obj: 'tgbr_shipping_order', want: 'crate is gone', why: 'post the crate' },
        { stage: 70 },

        { held: 'hundred_pirate_diving_helmet', op: 2, why: 'the helmet back on for the island' },
        { held: 'hundred_pirate_diving_backpack', op: 2, why: 'and the apparatus' },

        { note: 'THE TRANSPLANTS, wiki steps 1-2: the doctor, now in the windmill cellar' },
        { setpos: CELLAR, why: 'down into the cellar' },
        { talk: 'tgbr_doctor_shell', want: 'Brain tongs', why: 'ask what he needs' },
        { stage: 80 },

        { note: 'wiki steps 3-4: the beached ship’s locker, and the deck above it' },
        { setpos: LOCKER, why: 'to the beached ship' },
        { loc: 'harmony_ship_locker', at: [3791, 2873], op: 1, why: 'open the locker' },
        { loc: 'harmony_ship_locker_open', at: [3791, 2873], op: 1, want: 'coil of fuse', why: 'search it' },
        { has: 'tgbr_fuse' },
        { loc: 'harmony_ship_ladder_1', at: [3802, 2873], op: 1, why: 'up the ladder to the deck above' },
        { take: 'tgbr_keg', r: 8, why: 'the keg of powder' },

        { note: 'wiki step 5: the keg against the monastery gate, the fuse, and a tinderbox' },
        { setpos: GATE, why: 'to the monastery gate' },
        { useLoc: 'tgbr_multi_gate_door', at: [3805, 2844], obj: 'tgbr_keg', want: 'wants a fuse', why: 'set the keg against the gate' },
        { useLoc: 'tgbr_multi_gate_door', at: [3805, 2844], obj: 'tgbr_fuse', want: 'well clear of the keg', why: 'run the fuse back' },
        { varis: 'tgbr_fuse', to: 1 },
        { useLoc: 'tgbr_multi_fuse_far', at: [3803, 2844], obj: 'tinderbox', want: 'comes off its wall', why: 'light it' },
        { varis: 'tgbr_gate', to: 5 },
        { varis: 'tgbr_peephole', to: 1 },
        { stage: 90 },

        { note: 'wiki step 6: four Sorebones, one piece of the kit each and never the same piece' },
        { note: 'twice - which is what the wiki has to tell a player to manage by hand.' },
        { loc: 'tgbr_multi_gate_door', at: [3805, 2844], op: 1, why: 'in through the gap where the gate was' },
        { fight: ['tgbr_sorebones', 'tgbr_sorebones_apron'], until: 'tgbr_brain_tongs', tries: 8, r: 12, why: 'the brain tongs' },
        { take: 'tgbr_brain_tongs', r: 12, why: 'off the floor' },
        { fight: ['tgbr_sorebones', 'tgbr_sorebones_apron'], until: 'tgbr_cranial_clamp', tries: 8, r: 12, why: 'the cranial clamp' },
        { take: 'tgbr_cranial_clamp', r: 12, why: 'off the floor' },
        { fight: ['tgbr_sorebones', 'tgbr_sorebones_apron'], until: 'tgbr_bell_jar', tries: 8, r: 12, why: 'three bell jars' },
        { note: 'a bell jar does not stack, so the three of them are three clicks - which is how' },
        { note: 'Old School drops them too.' },
        { take: 'tgbr_bell_jar', r: 12, why: 'the first jar' },
        { take: 'tgbr_bell_jar', r: 12, why: 'the second' },
        { take: 'tgbr_bell_jar', r: 12, why: 'and the third' },
        { fight: ['tgbr_sorebones', 'tgbr_sorebones_apron'], until: 'tgbr_skull_staple', tries: 8, r: 12, why: 'thirty skull staples' },
        { take: 'tgbr_skull_staple', r: 12, why: 'off the floor' },
        { has: 'tgbr_brain_tongs' },
        { has: 'tgbr_cranial_clamp' },
        { has: 'tgbr_bell_jar', n: 3 },
        { has: 'tgbr_skull_staple', n: 30 },

        { note: 'wiki step 7: the kit to the doctor, and the cat-and-ball while he works' },
        { setpos: CELLAR, why: 'back down to the cellar' },
        { talk: 'tgbr_doctor_shell', want: 'washing his hands', why: 'hand the kit over' },
        { stage: 100 },
        { varis: 'tgbr_restored', to: 1 },
        { hasnt: 'tgbr_brain_tongs' },

        { note: 'wiki step 8: Brother Tranquility, then the fight' },
        { setpos: MILL, why: 'up to Brother Tranquility' },
        { talk: 'tgbr_tranquility_shell', want: 'Still in there', why: 'he sends you after Mi-Gor' },

        { note: 'THE BIG BATTLE: confront Mi-Gor in the courtyard and kill what he whistles up' },
        { setpos: COURTYARD, why: 'back into the monastery courtyard' },
        {
            talk: 'tgbr_migor_shell',
            op: 1,
            picks: ['You took their heads apart.'],
            want: 'reason nobody has',
            why: 'confront him'
        },
        // 110 IS A STAGE THIS RUN CANNOT STAND STILL ON, and Barrelchest may already be down:
        // the confrontation above is driven for up to 600 ticks, and a damage-immune player with
        // maxed stats kills what Mi-Gor whistles up while that is still clicking. So the marker
        // stays - ExportHelper needs it for the leg - but says it may have been passed, and the
        // nearnpc on him is gone with it: the fight below proves more than it did, because its
        // untilvar reads tgbr reaching 120 - which cannot happen unless he was summoned AND put
        // down, by this step or by the one before it.
        { stage: 110, orLater: true },
        { fight: 'tgbr_barrelchest', untilvar: 'tgbr', to: 120, tries: 30, r: 16, why: 'kill it' },
        { stage: 120 },
        { has: 'barrelchest_anchor' },

        { note: 'and the reward' },
        { setpos: MILL, why: 'back to the windmill' },
        { talk: 'tgbr_tranquility_shell', want: 'neither is whatever he was feeding', why: 'tell him it is over' },
        { stage: 130 },
        { has: 'tgbr_blessed_lamp' },
        { has: 'tgbr_prayer_book' }
    ]
};

const p: any = H.makePlayer('tgbr', m.start[0], m.start[1]);
H.tick(2);
p.teleport(m.start[0], m.start[1], m.start[2]);
// The island's air and Barrelchest's anchor both do real damage; this run is about whether the
// fourteen stages can be walked, so the damage is nulled as every other quest run nulls it. The
// anchor's prayer drain still fires - that is queued off the hit, not off the health.
p.applyDamage = function () {};
H.maxOut(p);
H.tick(1);

const res = play(m, p);
const bad = res.filter(r => !r.ok);
console.log('');
if (bad.length) {
    console.log('WHAT WENT WRONG');
    for (const r of bad) console.log('  step ' + r.n + '  ' + r.what + (r.detail ? '  -- ' + r.detail : ''));
}
process.exit(bad.length ? 1 : 0);
