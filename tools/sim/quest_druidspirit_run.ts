// NATURE SPIRIT, played through on foot.
//
// Quest 88 of the quest-by-quest pass. Filliman Tarlock died in Mort Myre and has not noticed, and
// the whole first half of the quest is convincing him: a mirror, his own journal, and then the
// ritual on three stones that turns him into the spirit of the swamp. The second half is the
// blessed sickle, the druid pouch and three Ghasts.
//
// Mort Myre itself is stepped across rather than walked - it is a hundred-odd tiles of swamp with
// 186 Ghast spawns in it and no part of the quest happens on the way - but every leg inside the
// camp and the grotto is walked, and the three stones have to be loaded in the right order with
// the player standing on the right one.
//
//   NODE_MEMBERS=true npx tsx tools/sim/quest_druidspirit_run.ts
import * as H from './harness.js';
import { play, Manifest } from './questrun.js';

await H.boot();

const DREZEL: [number, number, number] = [3439, 9898, 0];
const GATE: [number, number] = [3443, 3458];
const GATE_STAND: [number, number, number] = [3443, 3459, 0];
const CAMP: [number, number, number] = [3438, 3340, 0]; // Filliman's camp, north of the stones
const GROTTO_DOOR: [number, number] = [3440, 3337];
const TREE: [number, number] = [3439, 3338]; // the knot hole with the journal
const BOWL: [number, number, number] = [3437, 3337, 0];
const STONE_NATURE: [number, number] = [3439, 3336];
const STONE_SPIRIT: [number, number] = [3441, 3336];
const STONE_FAITH: [number, number] = [3440, 3335];
const _FILLIMAN_SPOTFILLIMAN_SPOT: [number, number] = [3440, 3336];
const LOG: [number, number] = [3439, 3348];
const LOG_STAND: [number, number, number] = [3440, 3348, 0];
const _GROTTO_INGROTTO_IN: [number, number, number] = [3442, 9734, 0];
const GROTTO_SEARCH: [number, number] = [3441, 9740];
const GROTTO_EXIT: [number, number] = [3442, 9733];
const GHAST: [number, number, number] = [3422, 3337, 0]; // the three nearest spawns, 3422-3423,3335-3336

const m: Manifest = {
    quest: 'NATURE SPIRIT',
    source: 'oldschool.runescape.wiki/w/Nature_Spirit/Quick_guide',
    stageVar: 'druidspirit',
    done: 110, // ^druidspirit_complete
    start: DREZEL,
    steps: [
        { note: 'requirements: Priest in Peril and The Restless Ghost. Items: a silver sickle, a' },
        { note: 'ghostspeak amulet, and room for what Drezel and Filliman hand over.' },
        { note: '^priestperil_access_holy_barrier rather than ^priestperil_complete: Drezel only' },
        { note: 'reaches his post-quest menu, and so the Nature Spirit switch, once the barrier is' },
        { note: 'open, and he stops to replace a lost Wolfbane before anything else.' },
        { setvar: 'priestperil', to: 61, why: '^priestperil_access_holy_barrier' },
        { give: 'dagger_wolfbane' },
        { setvar: 'prieststart', to: 5, why: '^priest_complete' },
        { give: 'amulet_of_ghostspeak' },
        { give: 'silver_sickle' },
        { held: 'amulet_of_ghostspeak', op: 2, why: 'wear the amulet - Filliman cannot be heard without it' },
        { worn: 'amulet_of_ghostspeak' },

        { note: 'wiki step 1: Drezel, in the basement under Paterdomus' },
        { setpos: DREZEL, why: 'to Drezel' },
        {
            talk: 'priestperiltrappedmonk2',
            picks: ['Is there anything else interesting to do around here?', 'Well, what is it, I may be able to help?', "Yes, I'll go and look for him.", "Yes, I'm sure."],
            want: 'take this food to Filliman',
            why: 'he asks you to look for Filliman'
        },
        { stage: 5 },
        { has: 'meat_pie', n: 3 },
        { has: 'apple_pie', n: 3 },

        { note: 'wiki step 2: in through the gate - Filliman will not appear unless you came that' },
        { note: 'way, which is what %druidspirit = ^druidspirit_entered_swamp records' },
        { setpos: GATE_STAND, why: 'to the Mort Myre gate' },
        { loc: 'mortmyre_metalgateclosed_r', at: GATE, hop: true, want: 'gloomy atmosphere of Mort Myre', why: 'into the swamp' },
        { stage: 10 },

        { note: 'the swamp itself is stepped across: a hundred tiles of it with 186 Ghast spawns' },
        { note: 'and nothing of the quest on the way.' },
        { setpos: CAMP, why: "south through the swamp to Filliman's camp" },

        { note: 'wiki step 3: trying to enter the grotto is what brings him out' },
        { loc: 'grotto_door_druidicspirit', at: GROTTO_DOOR, picks: ["I'm wearing an amulet of ghost speak!", 'Ok, thanks.'], want: 'in no way reflects the truth', why: 'he does not believe he is dead' },
        { stage: 20 },

        { note: 'wiki step 4: the washing bowl on the bench, and the mirror underneath it' },
        { setpos: BOWL, why: 'to the bench' },
        { take: 'bowl_empty_filliman', r: 3, why: 'take the bowl, and the mirror is under it' },
        { take: 'mirror', r: 3, why: 'and the mirror' },
        { has: 'mirror' },

        { note: 'wiki step 5: the mirror shows him what he is' },
        { useNpc: 'filliman_tarlock_spirit', obj: 'mirror', want: 'most peculiar thing', why: 'show him the mirror' },
        { stage: 25 },

        { note: 'and the journal, in a knot in the grotto tree' },
        { loc: 'grotto_druidicspirit', at: TREE, op: 2, want: "'Tarlock' and 'journal'", why: 'search the tree' },
        { has: 'filliman_journal' },
        { note: 'Handing the journal over writes 30 and then opens a five-way menu, and only "How' },
        { note: 'can I help?" goes on to 35. Any of the other four leaves the quest at 30, where' },
        { note: 'filliman.rs2 case ^druidspirit_given_journal puts the same menu up again - so 30 is' },
        { note: 'a stage a player can sit at, and the table had no leg for it. DeathPlateau-Bugs#16.' },
        { note: 'The two menus word the last option differently - "Ok thanks." in the branch that' },
        { note: 'hands the journal over, "Ok, thanks." in the case that repeats it - so the picks' },
        { note: 'below are not interchangeable.' },
        {
            useNpc: 'filliman_tarlock_spirit',
            obj: 'filliman_journal',
            picks: ['Ok thanks.'],
            want: 'collect my thoughts',
            why: 'give him the journal and then decline, which leaves the quest at 30'
        },
        { stage: 30 },
        { hasnt: 'filliman_journal' },

        { note: 'and talking to him again puts the menu back, which is what a player at 30 does' },
        { talk: 'filliman_tarlock_spirit', picks: ['How can I help?'], want: 'small sheet of papyrus', why: 'offer to help this time' },
        { stage: 35 },
        { has: 'bloom_spell' },

        { note: 'wiki step 7: back to Drezel for the blessing the spell needs' },
        { setpos: DREZEL, why: 'back to Drezel' },
        { talk: 'priestperiltrappedmonk2', want: "you're now blessed", why: 'be blessed' },
        { stage: 40 },

        { note: 'wiki steps 8-9: stand next to a rotting log in the swamp and cast the spell, then' },
        { note: 'pick what grows on it' },
        { setpos: LOG_STAND, why: 'to a rotting log' },
        { held: 'bloom_spell', op: 1, want: 'cast the spell in the swamp', why: 'cast Bloom' },
        { stage: 45 },
        { has: 'used_bloom_spell' },
        { loc: 'log_druidicspirit2', at: LOG, op: 2, want: 'pick a mushroom from the log', why: 'pick the fungus' },
        { stage: 50 },
        { has: 'mortmyremushroom' },

        { note: 'wiki step 10: show it to Filliman, who then stands between the three stones' },
        { setpos: CAMP, why: 'back to the camp' },
        { talk: 'filliman_tarlock_spirit', picks: ['Ok, thanks.'], want: "represents 'something from nature'", why: 'show him the fungus' },
        { stage: 55 },

        { note: 'wiki steps 11-13: something from nature on the light-brown stone, the spent spell' },
        { note: 'on the grey one, and the player standing on the third - the journal says the' },
        { note: 'faith stone stands south of the spirit-to-become, and that is the one you stand on' },
        { useLoc: 'stonedisc_ds_nature', at: STONE_NATURE, obj: 'mortmyremushroom', want: 'absorb the fungus', why: 'the fungus' },
        { useLoc: 'stonedisc_ds_spirit', at: STONE_SPIRIT, obj: 'used_bloom_spell', want: 'absorb the used spell', why: 'and the spent spell' },
        { note: 'he only stands there for a hundred ticks at a time, and loading two stones takes' },
        { note: 'longer than that - clicking the grotto door is what puts him back.' },
        { loc: 'grotto_door_druidicspirit', at: GROTTO_DOOR, picks: ['Ok, thanks.'], soft: true, why: 'call him out again' },
        { go: [STONE_FAITH[0], STONE_FAITH[1]], exact: true, why: 'onto the faith stone' },
        { talk: 'filliman_tarlock_spirit', picks: ["I think I've solved the puzzle!"], want: 'everything seems to be in place', why: 'tell him it is done' },
        { stage: 60 },

        { note: 'wiki step 14: down into the grotto, and search it' },
        { loc: 'grotto_door_druidicspirit', at: GROTTO_DOOR, hop: true, want: 'beautifully tended small grotto', why: 'into the grotto' },
        { stage: 65 },
        { loc: 'druidic_spirit_grotto', at: GROTTO_SEARCH, picks: ['Ok, thanks.'], want: 'transformation is complete', why: 'search the grotto' },
        { stage: 70 },

        { note: 'wiki step 15: the silver sickle for a blessed one, and a druid pouch' },
        { talk: 'filliman_tarlock_ns', want: 'sickle has been blessed', why: 'hand over the sickle' },
        { stage: 75 },
        { has: 'silver_sickle_blessed' },
        { has: 'druid_pouch_empty' },

        { note: 'wiki steps 16-17: out into the swamp, Bloom off the sickle, and fill the pouch' },
        { loc: 'underground_rootwall_door', at: GROTTO_EXIT, hop: true, want: 'crawl back out', why: 'out of the grotto' },
        { setpos: LOG_STAND, why: 'back to the log' },
        { note: 'Bloom affects every rotting thing in the eight tiles round you, and after the' },
        { note: 'first it is a coin toss per loc - so the rng is pinned off zero and only the log' },
        { note: 'the loop reaches first blooms, which keeps the three picks on one known tile.' },
        { rng: 0.5, why: 'random(2) is not 0, so only the first log blooms' },
        { held: 'silver_sickle_blessed', op: 3, why: 'Bloom - it costs prayer points' },
        { stage: 80 },
        { loc: 'log_druidicspirit2', at: LOG, op: 2, want: 'pick a mushroom', why: 'one' },
        { stage: 85 },
        { note: 'picking it leaves you standing ON the log, and Bloom skips your own tile - so' },
        { note: 'step off it before each cast.' },
        { go: [LOG_STAND[0], LOG_STAND[1]], exact: true, why: 'off the log' },
        { held: 'silver_sickle_blessed', op: 3, why: 'Bloom again' },
        { loc: 'log_druidicspirit2', at: LOG, op: 2, want: 'pick a mushroom', why: 'two' },
        { go: [LOG_STAND[0], LOG_STAND[1]], exact: true, why: 'off the log again' },
        { held: 'silver_sickle_blessed', op: 3, why: 'and again' },
        { loc: 'log_druidicspirit2', at: LOG, op: 2, want: 'pick a mushroom', why: 'three' },
        { rng: null },
        { has: 'mortmyremushroom', n: 3 },
        { held: 'druid_pouch_empty', op: 1, want: 'natures harvests to your druid pouch', why: 'fill the pouch' },
        { stage: 90 },
        { has: 'druid_pouch' },

        { note: 'wiki step 18: the pouch makes a Ghast solid, and then it can be killed. Three of' },
        { note: 'them, and each one is its own stage.' },
        { setpos: GHAST, why: 'north-west to the Ghasts' },
        { useNpc: 'ghast_invis', obj: 'druid_pouch', want: 'makes the Ghast visible', why: 'bind the first' },
        { fight: 'ghast_vis', untilvar: 'druidspirit', to: 95, tries: 6, r: 8, why: 'kill it' },
        { stage: 95 },
        { useNpc: 'ghast_invis', obj: 'druid_pouch', want: 'makes the Ghast visible', why: 'bind the second' },
        { fight: 'ghast_vis', untilvar: 'druidspirit', to: 100, tries: 6, r: 8, why: 'kill it' },
        { stage: 100 },
        { useNpc: 'ghast_invis', obj: 'druid_pouch', want: 'makes the Ghast visible', why: 'bind the third' },
        { fight: 'ghast_vis', untilvar: 'druidspirit', to: 105, tries: 6, r: 8, why: 'and kill it' },
        { stage: 105 },

        { note: 'wiki step 19: back to the grotto, which he turns into an Altar of Nature' },
        { setpos: CAMP, why: 'back to the camp' },
        { loc: 'grotto_door_druidicspirit', at: GROTTO_DOOR, hop: true, soft: true, why: 'into the grotto' },
        { loc: 'druidic_spirit_grotto', at: GROTTO_SEARCH, want: 'Altar of Nature', why: 'tell him the Ghasts are dead' },
        { stage: 110 }
    ]
};

const p: any = H.makePlayer('nature', m.start[0], m.start[1]);
H.tick(2);
p.teleport(m.start[0], m.start[1], m.start[2]);
p.applyDamage = function () {};
H.setVar(p, 'macro_event', 1);
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
