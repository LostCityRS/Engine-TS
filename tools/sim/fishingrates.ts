// EVERY CATCH RATE IN FISHING, HELD AGAINST THE WIKI (Corey, 24 November: "can you check the
// catching rates for fishing? all of fishing").
//
// The rates were all correct when this was written. That is the point of writing it down: there are
// twenty-five catchable things across twelve spot handlers, their numbers live in four different
// shapes (structs, a dbrow-free hardcoded block, constants, and bare literals in script), and the
// only record that any of them matched Old School was a handful of prose comments. One file now
// holds the whole table, so the next change to a fishing number either agrees with the wiki or
// fails here.
//
// WHERE THE NUMBERS COME FROM. Every fish page on the Old School wiki carries a
// {{Skilling success chart}} whose low= and high= ARE the game's own stat_random arguments, so they
// are quoted here verbatim rather than read off a plotted percentage. A cascade chart lists its
// series rarest-first, which is the same order ~fish_roll rolls them in (fish2 before fish1).
//
// THE ENGINE'S FORMULA IS PROVED, NOT ASSUMED. stat_random is
//   value = floor(low * (99 - L) / 98) + floor(high * (L - 1) / 98) + 1,   success if value > rand(256)
// and the +1 is the part that would be easy to get wrong - it is worth a whole percentage point at
// the rates sharks are caught at. The wiki publishes big net fishing's casket chance as a plain
// fraction, "about 1/128 at lower levels and 1/85.3 at higher levels" (Casket), and the build's
// casket roll is stat_random(fishing, 1, 2). 1/128 and 1/85.3 are exactly 2/256 and 3/256, which is
// what the formula above gives at level 1 and level 99 with the +1 and nothing else. So one
// published fraction pins the whole formula, and every other rate in this file rides on it.
//
//   npx tsx tools/sim/fishingrates.ts
import * as H from './harness.ts';
import { check, R } from './a1lib.ts';
import ObjType from '#/cache/config/ObjType.js';
import ParamType from '#/cache/config/ParamType.js';
import StructType from '#/cache/config/StructType.js';
import InvType from '#/cache/config/InvType.js';
import NpcType from '#/cache/config/NpcType.js';
import Npc from '#/engine/entity/Npc.js';
import World from '#/engine/World.js';
import Environment from '#/util/Environment.js';
import { PlayerStat } from '#/engine/entity/PlayerStat.js';
import fs from 'fs';

await H.boot();

const sp = (struct: string, param: string): number => {
    const s = StructType.getId(struct);
    if (s === -1) throw new Error('no such struct: ' + struct);
    return StructType.get(s).params?.get(ParamType.getId(param)) as number;
};
const src = (rel: string): string => fs.readFileSync(Environment.BUILD_SRC_DIR + '/scripts/' + rel, 'utf8');

/** The engine's stat_random, in the open, so expectations are computed and not copied. */
const value = (low: number, high: number, level: number): number => Math.floor((low * (99 - Math.min(level, 99))) / 98) + Math.floor((high * (Math.min(level, 99) - 1)) / 98) + 1;
const pct = (low: number, high: number, level: number): number => (value(low, high, level) / 256) * 100;

// ============================================================ the table
// level/xp/low/high as the named wiki page carries them. xp is the real figure; the structs hold it
// multiplied by ten, which is how ~fishing_xp is fed everywhere in the build.
type Fish = { fish: string; struct?: string; level: number; xp: number; low: number; high: number; page: string; note?: string };
const TABLE: Fish[] = [
    { fish: 'shrimps', struct: 'fishing_struct_shrimps', level: 1, xp: 10, low: 48, high: 256, page: 'Raw shrimps' },
    { fish: 'sardine', struct: 'fishing_struct_sardine', level: 5, xp: 20, low: 32, high: 192, page: 'Raw sardine' },
    { fish: 'herring', struct: 'fishing_struct_herring', level: 10, xp: 30, low: 24, high: 128, page: 'Raw herring' },
    { fish: 'anchovies', struct: 'fishing_struct_anchovies', level: 15, xp: 40, low: 24, high: 128, page: 'Raw anchovies' },
    { fish: 'trout', struct: 'fishing_struct_trout', level: 20, xp: 50, low: 32, high: 192, page: 'Raw trout' },
    { fish: 'pike', struct: 'fishing_struct_pike', level: 25, xp: 60, low: 16, high: 96, page: 'Raw pike' },
    // 65 here and 80 in the Lumbridge caves: the wiki page carries both and cavefish.rs2 tops up
    // the difference, which is asserted further down rather than taken on trust.
    { fish: 'slimy eel', struct: 'fishing_struct_mort_slimey_eel', level: 28, xp: 65, low: 10, high: 80, page: 'Raw slimy eel' },
    { fish: 'salmon', struct: 'fishing_struct_salmon', level: 30, xp: 70, low: 16, high: 96, page: 'Raw salmon' },
    { fish: 'frog spawn', struct: 'fishing_struct_giant_frogspawn', level: 33, xp: 75, low: 16, high: 96, page: 'Frog spawn' },
    { fish: 'tuna', struct: 'fishing_struct_tuna', level: 35, xp: 80, low: 8, high: 64, page: 'Raw tuna' },
    { fish: 'cave eel', struct: 'fishing_struct_raw_cave_eel', level: 38, xp: 80, low: 10, high: 80, page: 'Raw cave eel' },
    { fish: 'lobster', struct: 'fishing_struct_lobster', level: 40, xp: 90, low: 6, high: 95, page: 'Raw lobster' },
    { fish: 'leaping trout', struct: 'fishing_struct_leaping_trout', level: 48, xp: 50, low: 32, high: 192, page: 'Leaping trout' },
    { fish: 'swordfish', struct: 'fishing_struct_swordfish', level: 50, xp: 100, low: 4, high: 48, page: 'Raw swordfish' },
    { fish: 'lava eel', struct: 'fishing_struct_lava_eel', level: 53, xp: 60, low: 16, high: 96, page: 'Raw lava eel' },
    { fish: 'leaping salmon', struct: 'fishing_struct_leaping_salmon', level: 58, xp: 70, low: 16, high: 96, page: 'Leaping salmon' },
    { fish: 'karambwan', struct: 'fishing_struct_tbwt_raw_karambwan', level: 65, xp: 50, low: 5, high: 160, page: 'Raw karambwan' },
    { fish: 'leaping sturgeon', struct: 'fishing_struct_leaping_sturgeon', level: 70, xp: 80, low: 8, high: 64, page: 'Leaping sturgeon' },
    { fish: 'shark', struct: 'fishing_struct_shark', level: 76, xp: 110, low: 3, high: 40, page: 'Raw shark' },
    // THE TWO TRAWLER FISH HAVE NO CHART, because the Fishing Trawler hands them over rather than
    // rolling for them. Their level and xp are the wiki's; the RATES are the shark's by a
    // deliberate decision (fishing.struct), so the Wilderness spot pays more per catch without
    // catching any faster. Quoted as the shark's pair so a change to either one fails here.
    { fish: 'sea turtle', struct: 'fishing_struct_seaturtle', level: 79, xp: 57, low: 3, high: 40, page: 'Raw sea turtle', note: "no chart - shark's rates by design" },
    { fish: 'manta ray', struct: 'fishing_struct_mantaray', level: 81, xp: 69, low: 3, high: 40, page: 'Raw manta ray', note: "no chart - shark's rates by design" },
    // BIG NET FISHING has no structs: memberfish.rs2 rolls each of these inline, so the level and xp
    // columns are checked against that file's text further down.
    { fish: 'mackerel', level: 16, xp: 20, low: 5, high: 65, page: 'Raw mackerel', note: 'big net, rolled inline' },
    { fish: 'cod', level: 23, xp: 45, low: 4, high: 55, page: 'Raw cod', note: 'big net, rolled inline' },
    { fish: 'bass', level: 46, xp: 100, low: 3, high: 40, page: 'Raw bass', note: 'big net, rolled inline' }
];

console.log('=== THE WHOLE TABLE, and what each is caught at');
console.log('  fish              lvl   xp    low/high    lvl-1%  lvl-50%  lvl-99%');
for (const f of TABLE) {
    const at = (l: number) => pct(f.low, f.high, Math.max(l, f.level)).toFixed(1).padStart(6);
    console.log(`  ${f.fish.padEnd(16)} ${String(f.level).padStart(3)} ${String(f.xp).padStart(5)}  ${`${f.low}/${f.high}`.padEnd(10)} ${at(1)}  ${at(50)}  ${at(99)}` + (f.note ? '   <- ' + f.note : ''));
}

console.log('\n=== every struct carries the wiki rate and the wiki experience');
{
    const wrong: string[] = [];
    for (const f of TABLE) {
        if (!f.struct) continue;
        const low = sp(f.struct, 'success_low');
        const high = sp(f.struct, 'success_high');
        const xp = sp(f.struct, 'productexp');
        if (low !== f.low || high !== f.high) wrong.push(`${f.fish} rolls ${low}/${high}, the ${f.page} chart says ${f.low}/${f.high}`);
        if (xp !== f.xp * 10) wrong.push(`${f.fish} pays ${xp / 10} xp, ${f.page} says ${f.xp}`);
    }
    check('no struct disagrees with its wiki page', wrong, []);

    // EVERY STRUCT IN THE BUILD IS IN THE TABLE, so a fish added later cannot slip past unchecked.
    const known = new Set(TABLE.map(f => f.struct).filter(Boolean));
    const all = [...StructType.configNames.keys()].filter(n => n.startsWith('fishing_struct_'));
    check(
        'and every fishing struct in the build is in the table',
        all.filter(n => !known.has(n)),
        []
    );
    console.log(`  ${all.length} structs, ${TABLE.length} rows counting the three big-net fish`);
}

console.log('\n=== the level each fish needs');
{
    // The struct-driven spots gate on a constant or a struct param; the rest gate on a literal in
    // the handler. Both are read rather than described, because a comment claiming level 35 while
    // the script says 30 is exactly the drift this file is for.
    const wrong: string[] = [];
    // ANCHORED ON THE LABEL, not on the first match in the file. A bare /stat\(fishing\) < (\d+)/
    // over memberfish.rs2 finds the shark's 76 and calls it the mackerel's, and over freshfish.rs2
    // finds the trout's 20 and calls it the pike's - both of which this check did on its first run.
    // The block between one [label,...] and the next is the only place to look.
    const gateIn = (file: string, label: string): number | null => {
        const text = src(file);
        // [label,...] or [proc,...]: the lava eel's level lives in a shared requirements proc with
        // the oily rod and the ice gloves, not at the top of its own label.
        let at = text.indexOf(`[label,${label}]`);
        if (at === -1) at = text.indexOf(`[proc,${label}]`);
        if (at === -1) return null;
        const next = text.indexOf('\n[', at + 1);
        const block = text.slice(at, next === -1 ? undefined : next);
        const m = block.match(/stat\(fishing\) < (\d+)/);
        return m ? Number(m[1]) : null;
    };
    const SPOT = 'skill_fishing/scripts/fishing_spots/';
    const GATES: [string, string, string, number][] = [
        ['sardine', SPOT + 'saltfish.rs2', 'attempt_fish_sardine', 5],
        ['mackerel (big net)', SPOT + 'memberfish.rs2', 'attempt_fish_mackerel', 16],
        ['trout', SPOT + 'freshfish.rs2', 'attempt_fish_trout_salmon', 20],
        ['pike', SPOT + 'freshfish.rs2', 'attempt_fish_pike', 25],
        ['tuna', SPOT + 'rarefish.rs2', 'attempt_fish_swordfish', 35],
        ['lobster', SPOT + 'rarefish.rs2', 'attempt_fish_lobster', 40],
        ['lava eel', SPOT + 'lavafish.rs2', 'oil_rod_fishing_check_requirements', 53],
        ['monkfish (Swan Song)', 'quests/quest_swansong/scripts/quest_swansong.rs2', 'swan_fish_attempt', 62],
        ['shark', SPOT + 'memberfish.rs2', 'attempt_fish_shark', 76]
    ];
    for (const [name, file, label, want] of GATES) {
        const got = gateIn(file, label);
        if (got !== want) wrong.push(`${name}: ${label} gates at ${got}, the wiki says ${want}`);
    }
    // The paired spots gate their rarer fish on a threshold inside the roll instead of at the top.
    const THRESHOLDS: [string, string, RegExp, number][] = [
        ['herring', SPOT + 'saltfish.rs2', /stat\(fishing\) >= (\d+)\) \{\s*~fish_roll\(raw_sardine, raw_herring/, 10],
        ['anchovies', SPOT + 'saltfish.rs2', /stat\(fishing\) >= (\d+)\) \{\s*~fish_roll\(raw_shrimp, raw_anchovies/, 15],
        ['cod (big net)', SPOT + 'memberfish.rs2', /\/\/ cod\s*\n\s*if \(\$level >= (\d+)\)/, 23],
        ['salmon', SPOT + 'freshfish.rs2', /stat\(fishing\) >= (\d+)\) \{\s*~fish_roll\(raw_trout, raw_salmon/, 30],
        ['salmon (waterfall)', SPOT + 'waterfall.rs2', /stat\(fishing\) >= (\d+)\) \{\s*~fish_roll_loc\(raw_trout, raw_salmon/, 30],
        ['bass (big net)', SPOT + 'memberfish.rs2', /\/\/ bass\s*\n\s*if \(\$level >= (\d+)\)/, 46],
        ['swordfish', SPOT + 'rarefish.rs2', /stat\(fishing\) >= (\d+)\) \{\s*~fish_roll\(raw_tuna, raw_swordfish/, 50],
        ['cave eel', SPOT + 'cavefish.rs2', /stat\(fishing\) >= \^(cave_eel_level)\)/ as unknown as RegExp, 0]
    ];
    for (const [name, file, re, want] of THRESHOLDS) {
        if (want === 0) continue; // the constant-named one is checked below
        const m = src(file).match(re);
        const got = m ? Number(m[1]) : null;
        if (got !== want) wrong.push(`${name}: the roll opens at ${got}, the wiki says ${want}`);
    }
    check('the hardcoded level gates match the wiki', wrong, []);

    // and the ones that are already named constants or struct params
    check(
        'slimy eel 28, cave eel 38, frog spawn 33',
        [
            Number(src('skill_fishing/configs/eels.constant').match(/slimey_eel_level = (\d+)/)![1]),
            Number(src('skill_fishing/configs/eels.constant').match(/cave_eel_level = (\d+)/)![1]),
            Number(src('skill_fishing/configs/eels.constant').match(/frogspawn_level = (\d+)/)![1])
        ],
        [28, 38, 33]
    );
    check('sea turtle 79, manta ray 81', [Number(src('skill_fishing/configs/wildyfish.constant').match(/turtle_level = (\d+)/)![1]), Number(src('skill_fishing/configs/wildyfish.constant').match(/manta_level = (\d+)/)![1])], [79, 81]);
    check('karambwan 65', Number(src('skill_fishing/configs/karambwan.constant').match(/karambwan_level = (\d+)/)![1]), 65);
    // Barbarian fishing wants Agility and Strength as well as Fishing, and the wiki's pairs are
    // 48/15, 58/30, 70/45 with 5, 6 and 7 xp in each of the two.
    const barb: [string, number, number, number][] = [
        ['fishing_struct_leaping_trout', 48, 15, 50],
        ['fishing_struct_leaping_salmon', 58, 30, 60],
        ['fishing_struct_leaping_sturgeon', 70, 45, 70]
    ];
    const barbWrong: string[] = [];
    for (const [s, fish, agil, xp] of barb) {
        if (sp(s, 'barbfish_fishing_level') !== fish) barbWrong.push(`${s} fishing ${sp(s, 'barbfish_fishing_level')} not ${fish}`);
        if (sp(s, 'barbfish_agil_str_level') !== agil) barbWrong.push(`${s} agil/str ${sp(s, 'barbfish_agil_str_level')} not ${agil}`);
        if (sp(s, 'barbfish_agil_str_exp') !== xp) barbWrong.push(`${s} agil/str xp ${sp(s, 'barbfish_agil_str_exp') / 10} not ${xp / 10}`);
    }
    check('barbarian fishing wants the right Agility and Strength, and pays them', barbWrong, []);
}

console.log('\n=== the formula itself, against a fraction the wiki publishes as a fraction');
{
    // "about 1/128 at lower levels and 1/85.3 at higher levels" (Casket). The build rolls
    // stat_random(fishing, 1, 2) for it.
    const text = src('skill_fishing/scripts/fishing_spots/memberfish.rs2');
    const casket = text.match(/\/\/ casket\s*\n\s*if \(stat_random\(fishing, (\d+), (\d+)\)/);
    check('the casket roll is still 1 and 2', [Number(casket![1]), Number(casket![2])], [1, 2]);
    check('  ...which the formula makes 1/128 at level 1', (256 / value(1, 2, 1)).toFixed(1), '128.0');
    check('  ...and 1/85.3 at level 99, both exactly as the wiki states', (256 / value(1, 2, 99)).toFixed(1), '85.3');
}

console.log('\n=== big net fishing, which has no structs to read');
{
    const text = src('skill_fishing/scripts/fishing_spots/memberfish.rs2');
    const roll = (comment: string): [number, number] | null => {
        const m = text.match(new RegExp(`// ${comment}\\b[\\s\\S]{0,120}?stat_random\\(fishing, (\\d+), (\\d+)\\)`));
        return m ? [Number(m[1]), Number(m[2])] : null;
    };
    check('mackerel 5/65', roll('mackerel'), [5, 65]);
    check('cod 4/55', roll('cod'), [4, 55]);
    check('bass 3/40', roll('bass'), [3, 40]);
    const xp = (name: string): number | null => {
        const m = text.match(new RegExp(`inv_add\\(inv, raw_${name}, 1\\);[\\s\\S]{0,120}?~fishing_xp\\((\\d+)\\)`));
        return m ? Number(m[1]) / 10 : null;
    };
    check("and the experience is the wiki's: mackerel 20, cod 45, bass 100", [xp('mackerel'), xp('cod'), xp('bass')], [20, 45, 100]);
}

console.log('\n=== the dragon harpoon is 20% and nothing else');
{
    // The wiki carries a second and third chart on Raw tuna, Raw swordfish and Raw shark for the
    // dragon and crystal harpoons. The dragon one is the plain pair times 6/5 truncated, which is
    // what ~fish_catch_roll computes - so these are the wiki's own dragon-harpoon numbers.
    const dragon = (low: number, high: number): [number, number] => [Math.floor((low * 6) / 5), Math.floor((high * 6) / 5)];
    check('tuna 8/64 becomes 9/76', dragon(8, 64), [9, 76]);
    check('swordfish 4/48 becomes 4/57', dragon(4, 48), [4, 57]);
    check('shark 3/40 becomes 3/48', dragon(3, 40), [3, 48]);
    const text = src('skill_fishing/scripts/fishing.rs2');
    check('and the build still computes it that way', /\$low = calc\(\$low \* 6 \/ 5\)/.test(text) && /\$high = calc\(\$high \* 6 \/ 5\)/.test(text), true);
    // Only harpoon spots, which is every spot that passes `harpoon` through ~fish_roll.
    check('applied on the harpoon spots only', /if \(\$equipment = harpoon & ~fish_harpoon_usable = dragon_harpoon\)/.test(text), true);
}

console.log('\n=== a cascade spot rolls the rarer fish first');
{
    // ~fish_roll(fish1, fish2) rolls fish2 and only falls through to fish1 if it misses, and a
    // cascade chart on the wiki lists its series rarest-first. So the rarer fish belongs in the
    // SECOND argument at every paired spot, and a swap would quietly make the rare fish common.
    const pairs: [string, string, string, string][] = [
        ['skill_fishing/scripts/fishing_spots/saltfish.rs2', 'raw_shrimp', 'raw_anchovies', 'shrimps/anchovies'],
        ['skill_fishing/scripts/fishing_spots/saltfish.rs2', 'raw_sardine', 'raw_herring', 'sardine/herring'],
        ['skill_fishing/scripts/fishing_spots/freshfish.rs2', 'raw_trout', 'raw_salmon', 'trout/salmon'],
        ['skill_fishing/scripts/fishing_spots/rarefish.rs2', 'raw_tuna', 'raw_swordfish', 'tuna/swordfish'],
        ['skill_fishing/scripts/fishing_spots/cavefish.rs2', 'mort_slimey_eel', 'raw_cave_eel', 'slimy eel/cave eel'],
        ['skill_fishing/scripts/fishing_spots/wildyfish.rs2', 'raw_seaturtle', 'raw_mantaray', 'sea turtle/manta ray']
    ];
    const wrong: string[] = [];
    for (const [file, common, rare, label] of pairs) {
        const text = src(file);
        if (!text.includes(`(${common}, ${rare},`)) wrong.push(`${label}: no ~fish_roll(${common}, ${rare}, ...) in ${file.split('/').pop()}`);
        const cost = (n: string) => ObjType.get(ObjType.getId(n)).cost;
        void cost;
    }
    check('the rarer fish is the second argument everywhere', wrong, []);
    // and the one spot that pairs through the loc variant
    check('the waterfall pairs the same way', src('skill_fishing/scripts/fishing_spots/waterfall.rs2').includes('~fish_roll_loc(raw_trout, raw_salmon,'), true);
}

console.log('\n=== the slimy eel is worth more in the caves than in Mort Myre');
{
    // 65 on the struct, 80 in the Lumbridge Swamp Caves, and the difference topped up by the caves
    // handler. The wiki's page carries both numbers; the top-up is the only thing joining them.
    check('the struct pays Mort Myre 65', sp('fishing_struct_mort_slimey_eel', 'productexp') / 10, 65);
    check("and the caves top it up by 15, to the wiki's 80", Number(src('skill_fishing/configs/eels.constant').match(/cave_slimey_eel_bonus_xp = (\d+)/)![1]) / 10, 15);
    check('  ...which the caves handler actually pays', /cave_slimey_eel_bonus_xp/.test(src('skill_fishing/scripts/fishing_spots/cavefish.rs2')), true);
}

console.log('\n=== the karambwanji, which is bait and still has a published rate');
{
    // Raw karambwanji, "Karambwanji + shrimp fishing chance": low=100 high=250, level 5, 5 xp. It
    // rolls in quest_tbwt.rs2 rather than through a struct, because the vessel and the spot are two
    // doors into one catch, so there is nothing for the table above to read.
    //
    // THE NUMBERS ARE OFF Raw karambwanji AND NOT OFF Karambwanji. The latter page's first success
    // chart is the COOKING one (200/400), and quoting it here would make the bait three times too
    // EASY rather than too hard - the opposite mistake to the one this check was added for.
    const text = src('quests/quest_tbwt/scripts/quest_tbwt.rs2');
    const m = text.match(/if \(stat_random\(fishing, (\d+), (\d+)\) = false\) \{\s*\n\s*mes\("You fail to catch anything\."\)/);
    check('karambwanji rolls 100/250', m ? [Number(m[1]), Number(m[2])] : null, [100, 250]);
    check('  ...at level 5', Number(text.match(/\[label,tbwt_net_karambwanji\][\s\S]*?stat\(fishing\) < (\d+)/)![1]), 5);
    check('  ...for 5 xp', Number(text.match(/inv_add\(inv, tbwt_raw_karambwanji, 1\);\s*\n\s*stat_advance\(fishing, (\d+)\)/)![1]) / 10, 5);
    check('  ...which is 41.4% at 5 and 98.0% at 99', [pct(100, 250, 5).toFixed(1), pct(100, 250, 99).toFixed(1)], ['41.4', '98.0']);
}

console.log('\n=== the Fishing Trawler, every row of it');
{
    // THE TRAWLER DIVERGES FROM OLD SCHOOL ON PURPOSE and the divergence is not what is checked
    // here. OSRS rolls a flat 150/200 for every Trawler fish; this build rolls 150/200 once to
    // decide junk-or-fish and then each fish's OWN low/high, which trawler_win.rs2 argues for from
    // two archived 2007 screenshots. That is a decision, so the rates are left alone.
    //
    // WHAT IS CHECKED is the part that is not a decision: the level each fish needs, and the
    // experience it pays. The wiki's reward table gates them at 81, 79, 76, 50, 40, 35 and 16, and
    // every fish pays what catching it normally pays. Two were wrong - swordfish gated at 60
    // instead of 50, and the two Trawler-only fish paying 115 and 105 where the wiki and this
    // build's own structs both say 69 and 57.
    const text = src('minigames/game_trawler/scripts/trawler_win.rs2');
    const row = (fish: string): { level: number; low: number; high: number; xp: number } | null => {
        const m = text.match(new RegExp(`\\$level >= (\\d+) & stat_random\\(fishing, (\\d+), (\\d+)\\) = true\\) \\{\\s*\\n\\s*inv_add\\(trawler_rewardinv, ${fish}, 1\\);[\\s\\S]{0,600}?~fishing_xp\\((\\d+)\\)`));
        return m ? { level: Number(m[1]), low: Number(m[2]), high: Number(m[3]), xp: Number(m[4]) / 10 } : null;
    };
    const WANT: [string, number, number][] = [
        ['raw_mantaray', 81, 69],
        ['raw_seaturtle', 79, 57],
        ['raw_shark', 76, 110],
        ['raw_swordfish', 50, 100],
        ['raw_lobster', 40, 90],
        ['raw_tuna', 35, 80]
    ];
    const wrong: string[] = [];
    for (const [fish, level, xp] of WANT) {
        const r = row(fish);
        if (!r) {
            wrong.push(`${fish}: no row found`);
            continue;
        }
        if (r.level !== level) wrong.push(`${fish} gated at ${r.level}, the wiki's reward table says ${level}`);
        if (r.xp !== xp) wrong.push(`${fish} pays ${r.xp} xp, the wiki says ${xp}`);
    }
    check('every Trawler fish is gated and paid as the wiki has it', wrong, []);
    // ...and the rates it rolls are each fish's own, which is the documented divergence. Quoted
    // from the table at the top of this file so the two cannot drift apart.
    const byName: Record<string, string> = { raw_mantaray: 'manta ray', raw_seaturtle: 'sea turtle', raw_shark: 'shark', raw_swordfish: 'swordfish', raw_lobster: 'lobster', raw_tuna: 'tuna' };
    const rateWrong: string[] = [];
    for (const [fish] of WANT) {
        const r = row(fish)!;
        const f = TABLE.find(t => t.fish === byName[fish])!;
        if (r.low !== f.low || r.high !== f.high) rateWrong.push(`${fish} rolls ${r.low}/${r.high}, the spot rolls ${f.low}/${f.high}`);
    }
    check('  ...and rolls it at the same rate the open-water spot does', rateWrong, []);
    check('  ...behind one 150/200 junk gate, which is where OSRS puts the 150/200', /stat_random\(fishing, 150, 200\) = false/.test(text), true);
}

console.log('\n=== and the engine really rolls what the formula says');
{
    // The table above is arithmetic. This is the engine: a long run of real rolls at three levels,
    // against the rate the formula predicts. Pure measurement, so the band is wide enough that it
    // cannot fail by luck - it exists to catch a rate that is wrong by a factor, not by a hair.
    const p = H.makePlayer('rates', 3222, 3218);
    H.loginOrder(p);
    const N = 20000;
    const rows: string[] = [];
    const wrong: string[] = [];
    // ~fish_catch_roll is the real roll every harpoon, rod and net spot goes through, and it takes
    // the struct - so this measures the shipped path rather than a probe written for the sim.
    const roll = (struct: string, dragon: boolean): boolean => H.runProc(p, '[proc,fish_catch_roll]', [StructType.getId(struct), dragon ? 1 : 0])[0] === 1;
    for (const f of TABLE.filter(f => f.struct && ['shrimps', 'lobster', 'shark', 'karambwan'].includes(f.fish))) {
        for (const level of [1, 50, 99]) {
            p.setLevel(PlayerStat.FISHING, level);
            let hit = 0;
            for (let i = 0; i < N; i++) if (roll(f.struct!, false)) hit++;
            const got = (hit / N) * 100;
            const want = pct(f.low, f.high, level);
            rows.push(`  ${f.fish.padEnd(10)} level ${String(level).padStart(2)}  predicted ${want.toFixed(2)}%  measured ${got.toFixed(2)}%`);
            if (Math.abs(got - want) > 1.5) wrong.push(`${f.fish} at ${level}: ${got.toFixed(2)}% measured against ${want.toFixed(2)}% predicted`);
        }
    }
    // and the dragon harpoon, measured rather than computed, at the level anyone using one is at
    p.setLevel(PlayerStat.FISHING, 99);
    let plain = 0;
    let drag = 0;
    for (let i = 0; i < N; i++) {
        if (roll('fishing_struct_shark', false)) plain++;
        if (roll('fishing_struct_shark', true)) drag++;
    }
    rows.push(`  shark at 99 with a dragon harpoon  predicted ${pct(3, 48, 99).toFixed(2)}%  measured ${((drag / N) * 100).toFixed(2)}%`);
    if (Math.abs((drag / N) * 100 - pct(3, 48, 99)) > 1.5) wrong.push(`dragon harpoon shark: ${((drag / N) * 100).toFixed(2)}% against ${pct(3, 48, 99).toFixed(2)}% predicted`);
    if (drag <= plain) wrong.push(`the dragon harpoon caught no more than the plain one (${drag} against ${plain})`);
    for (const r of rows) console.log(r);
    check('measured rates match the formula at levels 1, 50 and 99', wrong, []);
}

console.log('\n=== HOW OFTEN YOU GET A ROLL AT ALL, which the rates above cannot see');
// A correct success chance on a roll you only get half as often is still half the fish, and nothing
// above this would notice. Corey reported 10 tuna in 10 minutes at level 39, then 27 in 20-30, then
// 26 harpoon swings in a minute, and none of those three numbers can be read off the rates.
//
// THE CADENCE IS PER METHOD, not one number for fishing. An earlier version of this file measured a
// NET spot at 6 ticks and wrote that up as "the" cadence, which is wrong twice over: the steady loop
// in each handler sets %action_delay = map_clock + N and rolls when the clock reaches it, then
// spends the next tick re-arming, so a roll lands every N+1 ticks - and N is 4 in some handlers and
// 5 in others. Old School is the same way, and the two figures it publishes both match:
//
//   HARPOON        6 ticks   Lantern harpooning: tick manipulation speeds it up "from a six-tick
//                            action (with a regular harpoon)"
//   FLY FISHING    5 ticks   Tick manipulation: "Barbarian fishing and fly fishing are both
//   BARBARIAN      5 ticks   normally a 5-tick action. This means that a roll to catch a fish
//                            normally happens every five ticks."
//
// Net, bait and cage have no published figure I could find, so they are recorded at what they are
// rather than held to a number nobody can cite - a change to one still fails this check and has to
// be argued for rather than slipped in.
{
    const SPOT = 'skill_fishing/scripts/fishing_spots/';
    // The SECOND delay in each handler is the steady loop's; the first is the opening click's.
    const steady = (file: string, label: string): number | null => {
        const text = src(file);
        const at = text.indexOf(`[label,${label}]`);
        if (at === -1) return null;
        const next = text.indexOf('\n[', at + 1);
        const block = text.slice(at, next === -1 ? undefined : next);
        const m = block.match(/%action_delay = calc\(map_clock \+ (\d+)\)/);
        return m ? Number(m[1]) + 1 : null;
    };
    const METHODS: [string, string, string, number, string][] = [
        ['harpoon, tuna and swordfish', SPOT + 'rarefish.rs2', 'fish_swordfish', 6, 'Lantern harpooning'],
        ['harpoon, shark', SPOT + 'memberfish.rs2', 'fish_shark', 6, 'Lantern harpooning'],
        ['harpoon, the Wilderness pair', SPOT + 'wildyfish.rs2', 'fish_wildy', 6, 'Lantern harpooning'],
        ['fly fishing, trout and salmon', SPOT + 'freshfish.rs2', 'fish_trout_salmon', 5, 'Tick manipulation'],
        ['barbarian, leaping fish', SPOT + 'barbarian.rs2', 'barbfish_catch', 5, 'Tick manipulation'],
        // no published figure for these; recorded, not asserted against the wiki
        ['bait, sardine and herring', SPOT + 'saltfish.rs2', 'fish_sardine', 5, '(unsourced)'],
        ['bait, pike', SPOT + 'freshfish.rs2', 'fish_pike', 5, '(unsourced)'],
        ['net, shrimps', SPOT + 'saltfish.rs2', 'fish_shrimp', 6, '(unsourced)'],
        ['cage, lobster', SPOT + 'rarefish.rs2', 'fish_lobster', 6, '(unsourced)'],
        ['big net', SPOT + 'memberfish.rs2', 'fish_mackerel', 6, '(unsourced)']
    ];
    // The waterfall's fly fishing has no [label,...] - its loop sits in [oploc3,loc_2027] - so the
    // same read is done by trigger. It is still fly fishing and still has to be 5.
    const steadyAt = (file: string, header: string): number | null => {
        const text = src(file);
        const at = text.indexOf(`[${header}]`);
        if (at === -1) return null;
        const next = text.indexOf('\n[', at + 1);
        const block = text.slice(at, next === -1 ? undefined : next);
        const ms = [...block.matchAll(/%action_delay = calc\(map_clock \+ (\d+)\)/g)];
        return ms.length ? Number(ms[ms.length - 1][1]) + 1 : null;
    };
    const wrong: string[] = [];
    {
        const got = steadyAt(SPOT + 'waterfall.rs2', 'oploc3,loc_2027');
        console.log(`  ${'fly fishing, the waterfall'.padEnd(30)} ${got === null ? 'NOT FOUND' : got + ' ticks a cast'}  Tick manipulation`);
        if (got !== 5) wrong.push(`fly fishing, the waterfall: ${got} ticks a cast, expected 5`);
    }
    for (const [label, file, name, want, source] of METHODS) {
        const got = steady(file, name);
        console.log(`  ${label.padEnd(30)} ${got === null ? 'NOT FOUND' : got + ' ticks a cast'}  ${source}`);
        if (got !== want) wrong.push(`${label}: ${got} ticks a cast, expected ${want} (${source})`);
    }
    check('every method rolls on its own cadence, and the three published ones match', wrong, []);
}

console.log('\n=== measured, by counting the casts the engine actually animates');
{
    // One anim call per roll, so the modal animation count IS the cast count - no guessing from the
    // screen. Corey counted 26 harpoon swings in a minute against the 16.8 casts measured here, and
    // the two agree: human_harpoon carries loops=20 maxloops=4, so one cast shows SEVERAL visible
    // swings and a swing is not a cast. That is worth leaving written down - the swing count was
    // proposed as a diagnostic and it cannot be one.
    const spotOf = (suffix: string, x: number, z: number): Npc => {
        let best: Npc | null = null;
        let bestD = Infinity;
        for (const n of World.npcs) {
            if (!(NpcType.get(n.type).debugname ?? '').endsWith(suffix)) continue;
            const d = Math.max(Math.abs(n.x - x), Math.abs(n.z - z));
            if (d < bestD) {
                bestD = d;
                best = n;
            }
        }
        if (!best) throw new Error('no ' + suffix + ' spot near ' + x + ',' + z);
        return best;
    };
    // KEEP LIST, not just the tool: fly fishing needs feathers (~check_fish_equipment reads
    // baitrequired off the equipment's struct and bails out with "You don't have any feathers left"),
    // and the first run of this deleted them on the first tick and measured zero casts.
    const measure = (name: string, suffix: string, op: number, tool: string, level: number, near: [number, number], ticks: number, keep: string[] = []): number => {
        const spot = spotOf(suffix, near[0], near[1]);
        const p: any = H.makePlayer('cad_' + name.replace(/\W/g, ''), spot.x + 1, spot.z);
        H.loginOrder(p);
        p.teleport(spot.x + 1, spot.z, spot.level);
        H.tick(1);
        p.setLevel(PlayerStat.FISHING, level);
        H.clearInv(p);
        H.give(p, tool, 1);
        for (const k of keep) H.give(p, k, 2000);
        const keepIds = new Set([ObjType.getId(tool), ...keep.map(k => ObjType.getId(k))]);
        const invId = InvType.getId('inv');
        H.clearLogs();
        H.opNpc(p, spot, op);
        for (let t = 0; t < ticks; t++) {
            H.tick(1);
            // the pack must never fill, or fishing stops with "You can't carry any more fish" and the
            // spot reads far slower than it is - which is exactly what the first run of this said
            for (let slot = 0; slot < 28; slot++) {
                const held = p.getInventory(invId)?.get(slot);
                if (held && !keepIds.has(held.id)) p.invDelSlot(invId, slot);
            }
        }
        // THE GAP BETWEEN CONSECUTIVE CASTS, not ticks divided by casts. The opening click runs a
        // staged animation through its own branches before the steady loop takes over, so dividing
        // the whole window by the cast count charges that startup to every cast and reported fly
        // fishing as 5.6 ticks when its loop is a clean 5. The median gap ignores the start.
        const tally = new Map<number, number>();
        for (const a of H.anims) if (a.who === p.username) tally.set(a.seq, (tally.get(a.seq) ?? 0) + 1);
        let best = -1;
        let bestN = 0;
        for (const [seq, n] of tally)
            if (n > bestN) {
                bestN = n;
                best = seq;
            }
        const at = H.anims.filter(a => a.who === p.username && a.seq === best).map(a => a.tick);
        const gaps = at
            .slice(1)
            .map((t, i) => t - at[i])
            .sort((a, b) => a - b);
        const median = gaps.length ? gaps[Math.floor(gaps.length / 2)] : NaN;
        console.log(`  ${name.padEnd(18)} ${at.length} casts in ${ticks} ticks, median gap ${median} ticks, ${(60 / (median * 0.6)).toFixed(1)} a minute`);
        return median;
    };
    const TICKS = 420;
    const harpoon = measure('harpoon @39', '_rarefish', 3, 'harpoon', 39, [2845, 3145], TICKS);
    const fly = measure('fly fishing @30', '_freshfish', 1, 'fly_fishing_rod', 30, [2714, 3532], TICKS, ['feather']);
    check('a harpoon cast measures 6 ticks, as the handler and the wiki both say', harpoon, 6);
    check('a fly fishing cast measures 5, which is the faster cadence and correct', fly, 5);
    check('  ...so fly fishing really is quicker per cast than harpooning', fly < harpoon, true);
}

console.log('\n=== a whole trip, the way a player actually fishes one');
{
    // COREY'S OWN TRIP: level 39, a harpoon, click once, fish until the pack is full. Nothing empties
    // it from outside, so if a real trip costs time that the per-cast measurements above cannot see,
    // it shows up here. 27 tuna is a full pack beside the harpoon.
    //
    // The expected time is negative-binomial, not a point: 27 catches at 11.33% a cast wants about
    // 238 casts, which at 6 ticks is 14.3 minutes, and the spread is wide - a single trip anywhere
    // from about 9 to 20 minutes is ordinary luck. The check below is therefore deliberately loose;
    // it is here to catch a trip that takes twice as long as it should, not to pin a median.
    const spot = (() => {
        let best: Npc | null = null;
        let bestD = Infinity;
        for (const n of World.npcs) {
            if (!(NpcType.get(n.type).debugname ?? '').endsWith('_rarefish')) continue;
            const d = Math.max(Math.abs(n.x - 2845), Math.abs(n.z - 3145));
            if (d < bestD) {
                bestD = d;
                best = n;
            }
        }
        if (!best) throw new Error('no harpoon spot');
        return best;
    })();
    const p: any = H.makePlayer('trip', spot.x + 1, spot.z);
    H.loginOrder(p);
    p.teleport(spot.x + 1, spot.z, spot.level);
    H.tick(1);
    p.setLevel(PlayerStat.FISHING, 39);
    H.clearInv(p);
    H.give(p, 'harpoon', 1);
    H.clearLogs();
    H.opNpc(p, spot, 3);
    const LIMIT = 4000;
    let ticks = LIMIT;
    for (let t = 0; t < LIMIT; t++) {
        H.tick(1);
        if (H.invCount(p, 'raw_tuna') >= 27) {
            ticks = t + 1;
            break;
        }
    }
    const tally = new Map<number, number>();
    for (const a of H.anims) if (a.who === p.username) tally.set(a.seq, (tally.get(a.seq) ?? 0) + 1);
    const casts = Math.max(0, ...tally.values());
    const mins = (ticks * 0.6) / 60;
    console.log(`  27 tuna in ${ticks} ticks (${mins.toFixed(1)} min), ${casts} casts, ${((H.invCount(p, 'raw_tuna') / casts) * 100).toFixed(1)}% hit rate`);
    check('a pack of 27 tuna at level 39 fills', H.invCount(p, 'raw_tuna'), 27);
    check('  ...in under 25 minutes, which is twice what it should take', mins < 25, true);
    // ticks/casts rather than a median here, so the whole trip's overheads are included - it is a
    // trip measurement, not a cadence one, and 6.3 would still pass where 12 would not.
    check('  ...at about 6 ticks a cast even with the pack filling up', ticks / casts < 7, true);
}

console.log('\n=== and the spots themselves, which do not move');
{
    // ORDINARY FISHING SPOTS NEVER RELOCATE in this build, which barbarian_fishing.npc already says
    // out loud: fishing_movement.rs2 hangs @move_fishing_spot off [ai_timer,...] for six spot types,
    // but an ai_timer only ever fires if the npc config carries timer=, and only the barbarian spots
    // do. Recorded because it was the first explanation reached for a slow session and it is the
    // wrong one - a spot that never moves is more generous, not less.
    check('the barbarian spots carry a timer, so they do move', /^timer=\d+/m.test(src('skill_fishing/configs/barbarian_fishing.npc')), true);
    check('  ...and fishing_movement is still wired to six spot types', (src('skill_fishing/scripts/fishing_movement.rs2').match(/^\[ai_timer,/gm) ?? []).length, 6);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
