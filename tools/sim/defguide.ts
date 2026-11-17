// THE DEFENCE GUIDE LISTS A TIER ONCE, NOT ONCE PER TRIM.
//
//   npx tsx tools/sim/defguide.ts
//
// Tracker issue 22: "black & addy armor (trimmed) variants listed in def menu". Two of the guide's
// rows were the trimmed Treasure Trails rewards of the row directly above them -
//
//   lvl 10  Black armour             black_platebody
//   lvl 10  Black armour (trimmed)   black_platebody_trim
//   lvl 30  Adamant armour           adamant_platebody
//   lvl 30  Adamant armour (trimmed) adamant_platebody_trim
//
// - and a trim carries the identical requirement (levelrequire/scripts/tier10.rs2 and tier30.rs2
// put each pair on the same level), so the extra row tells a player nothing they were not just
// told. It was not a policy either: the cache holds seven trim/gold platebody variants and the
// guide listed two of them, leaving out both gold versions and all three rune ones, while the
// file's own header states the convention it broke - "Metal armour tiers collapsed to one
// platebody row each". No other skill guide in the build lists a trim row at all.
//
// WHAT THIS ASSERTS, and why it is phrased as a rule rather than a row count. "37 rows" would pass
// again the moment somebody adds a trim and drops something else, and it would say nothing about
// why. The rule is the one the file already claims to follow: no row may show a trimmed or gold
// variant of an item the guide has already listed. That catches the two that were there, catches
// rune (t) being added later, and leaves every legitimate pair of same-level rows alone - Bronze
// and Iron are both level 1 and are different armour, which is the distinction a row count cannot
// make.
import * as H from './harness.js';
import { check, R, player } from './a1lib.js';
import Component from '#/cache/config/Component.js';
import InvType from '#/cache/config/InvType.js';
import ObjType from '#/cache/config/ObjType.js';
import Player from '#/engine/entity/Player.js';

await H.boot();
H.loginOrder();

const p: Player = player('defguide', 3222, 3218, 0);
H.maxOut(p);
H.tick(1);
H.clearLogs();
// the Defence button on the stats tab (interfaces/stats.rs2)
H.ifButton(p, 'stats:com_74');
H.tick(2);

const textOf = new Map<number, string>();
for (const f of H.ifaces) {
    if (f.who !== p.username || f.kind !== 'text' || f.text === undefined) continue;
    textOf.set(f.com, f.text);
}
// The icon column is the 'skillguide' inv that ~skillguide_row fills, so the obj on a row is read
// off the player's own inventory rather than out of the interface log.
const icons = (p as unknown as { getInventory: (id: number) => { get(slot: number): { id: number } | null } | null }).getInventory(InvType.getId('skillguide'));
type Row = { level: number; name: string; obj: string };
const rows: Row[] = [];
for (let r = 1; r <= 40; r++) {
    const lvl = textOf.get(Component.getId(`skill_guide:lvl${r}`)) ?? '';
    const name = textOf.get(Component.getId(`skill_guide:name${r}`)) ?? '';
    if (lvl === '' && name === '') continue;
    const id = icons?.get(r - 1)?.id ?? -1;
    rows.push({ level: Number(lvl), name, obj: id === -1 ? '-' : (ObjType.get(id).debugname ?? String(id)) });
}

console.log('\n== the guide opens and is built from the rows the content declares');
check('the Defence button opens the Defence guide', textOf.get(Component.getId('skill_guide:title')), 'Defence');
check('  it has rows', rows.length > 0, true);
check('  and they fit the interface, which holds 40', rows.length <= 40, true);
check('  with no gap in the middle: every row 1..n is filled', rows.length, rows.filter(r => r.name !== '').length);

console.log('\n== and no row is the trimmed or gold version of a row already in it');
const COSMETIC = /_(trim|gold|goldplate)$/;
const listed = new Set(rows.map(r => r.obj));
const duplicates = rows.filter(r => COSMETIC.test(r.obj) && listed.has(r.obj.replace(COSMETIC, '')));
for (const d of duplicates) {
    const base = d.obj.replace(COSMETIC, '');
    console.log(`       lvl ${d.level}  "${d.name}" (${d.obj}) repeats ${base}, which is already listed`);
}
check(
    'no cosmetic variant of a listed item has a row of its own',
    duplicates.map(d => d.obj),
    []
);
// And the rows it was reported for are gone by name, so a rename cannot quietly bring them back.
check(
    '  "Black armour (trimmed)" is not a row',
    rows.some(r => r.name.includes('Black armour (trimmed)')),
    false
);
check(
    '  "Adamant armour (trimmed)" is not a row',
    rows.some(r => r.name.includes('Adamant armour (trimmed)')),
    false
);
// The plain tiers must still be there - removing the trims must not take their base rows with them.
for (const want of ['black_platebody', 'adamant_platebody', 'rune_platelegs', 'bronze_platebody']) {
    check(`  ${want} is still listed`, listed.has(want), true);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
