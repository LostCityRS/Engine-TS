// THE CONSTRUCTION SKILL GUIDE, which did not exist.
//
//   npx tsx tools/sim/constructguide.ts
//
// "we never built a construction skill guide." Twenty-two of the twenty-three skills had one and
// the stats tab's Construction button printed "Construction arrives with the player-owned house.
// There's no skill guide for it yet." - a note that had gone stale: there are sixteen room types
// and 351 buildable pieces in the build now.
//
// WHAT THIS CHECKS, and why it is not just "the window opened". The guide is generated data all
// the way down - tools/genfurn.py computes the level bands, the level order and the slice each
// band draws, from the same furnspec.json the furniture itself comes from - so the thing worth
// asserting is that what the player SEES still matches the tables the house is built from:
//
//   * every one of the 351 pieces appears, exactly once, across the band pages;
//   * each page's rows are the right pieces at the right levels, in level order;
//   * no page is past the interface's 40-row list, which is the failure the bands exist to stop;
//   * the band buttons tile 1..99 with no gap and no overlap;
//   * the Rooms page lists all sixteen rooms in level order with their prices;
//   * and the icon on each row is the piece's own first material.
import * as H from './harness.js';
import * as A from './a1lib.js';
import Component from '#/cache/config/Component.js';
import EnumType from '#/cache/config/EnumType.js';
import InvType from '#/cache/config/InvType.js';
import Player from '#/engine/entity/Player.js';

await H.boot();
H.loginOrder();

const R = { ok: 0, bad: 0 };
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) R.ok++;
    else R.bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

const enumOf = (name: string) => EnumType.getByName(name)!.values;
const num = (name: string, key: number) => Number(enumOf(name).get(key));
const str = (name: string, key: number) => String(enumOf(name).get(key));

const ITEMS = 351; // ^poh_furn_items
const ROOMS = 16; // ^poh_room_count
const BANDS = enumOf('poh_guide_lo').size;

console.log('\n================ CONSTRUCTION SKILL GUIDE');
console.log(`  ${ITEMS} pieces, ${ROOMS} room types, ${BANDS} level bands`);

const p: Player = A.player('cguide', 3222, 3218, 0);
H.maxOut(p);
H.tick(1);

/** What the guide last drew: one entry per filled row, in row order. */
function read(): { level: number; name: string; obj: number }[] {
    const textOf = new Map<number, string>();
    for (const f of H.ifaces) {
        if (f.who !== p.username || f.kind !== 'text' || f.text === undefined) continue;
        textOf.set(f.com, f.text);
    }
    // The icon column is the 'skillguide' inv, filled by ~skillguide_row and transmitted to
    // skill_guide:icons - so the obj a row shows is read off the player's inventory, not out of
    // the interface log. Read from the inv the guide actually filled: an assertion that compared
    // two values the sim had failed to find would pass on -1 == -1 and prove nothing.
    const icons = p.getInventory(InvType.getId('skillguide'));
    const rows: { level: number; name: string; obj: number }[] = [];
    for (let r = 1; r <= 40; r++) {
        const lvl = textOf.get(Component.getId(`skill_guide:lvl${r}`)) ?? '';
        const name = textOf.get(Component.getId(`skill_guide:name${r}`)) ?? '';
        if (lvl === '' && name === '') continue;
        rows.push({ level: Number(lvl), name, obj: icons?.get(r - 1)?.id ?? -1 });
    }
    return rows;
}

const buttonLabels = () => {
    const out: string[] = [];
    for (let b = 1; b <= 13; b++) {
        const id = Component.getId(`skill_guide:btn${b}`);
        const last = [...H.ifaces].reverse().find(f => f.who === p.username && f.kind === 'text' && f.com === id);
        out.push(last?.text ?? '');
    }
    return out;
};

// ---- the stats tab opens it -------------------------------------------------------------
H.clearLogs();
H.ifButton(p, 'stats:construction_button');
H.tick(2);

const titleId = Component.getId('skill_guide:title');
const title = [...H.ifaces].reverse().find(f => f.who === p.username && f.kind === 'text' && f.com === titleId);
check('the Construction button opens the guide', title?.text, 'Construction');
check('it does not print the old placeholder', H.mesgs.filter(m => m.who === p.username && m.text.includes('no skill guide')).length, 0);

const labels = buttonLabels();
check('one button for Rooms plus one per band', labels.filter(Boolean).length, BANDS + 1);
check('the first is Rooms', labels[0], 'Rooms');

// THE BANDS MUST TILE 1..99. A gap loses pieces off the end of the guide silently.
const ranges = labels.slice(1, BANDS + 1).map(l => l.split('-').map(Number));
check('the bands start at 1', ranges[0][0], 1);
check('and end at 99', ranges[ranges.length - 1][1], 99);
const joins: string[] = [];
for (let i = 1; i < ranges.length; i++) {
    if (ranges[i][0] !== ranges[i - 1][1] + 1) joins.push(`${labels[i]} does not follow ${labels[i + 1 - 1]}`);
}
check('and are contiguous', joins, []);

// ---- the Rooms page ----------------------------------------------------------------------
console.log('\n  Rooms');
const rooms = read();
check('    all sixteen room types', rooms.length, ROOMS);
const wantRooms = Array.from({ length: ROOMS }, (_, i) => i + 1)
    .map(r => ({ level: num('poh_room_level', r), name: `${str('poh_room_name', r)} - ${str('poh_room_cost_text', r)} coins` }))
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
check('    in level order with their prices', rooms.map(r => `${r.level} ${r.name}`).sort(), wantRooms.map(r => `${r.level} ${r.name}`).sort());
check(
    '    and the page itself is in level order',
    rooms.map(r => r.level),
    [...rooms.map(r => r.level)].sort((a, b) => a - b)
);

// ---- every band page -----------------------------------------------------------------------
const seen: number[] = [];
for (let band = 1; band <= BANDS; band++) {
    const lo = num('poh_guide_lo', band);
    const hi = num('poh_guide_hi', band);
    H.clearLogs();
    H.ifButton(p, `skill_guide:btn${band + 1}`);
    H.tick(2);
    const rows = read();

    // What the tables say this band should hold, in the order the guide walks them.
    const want: { level: number; name: string; obj: number }[] = [];
    for (let n = num('poh_guide_first', band); n <= num('poh_guide_last', band); n++) {
        const item = num('poh_guide_order', n);
        want.push({
            level: num('poh_furn_level', item),
            name: `${str('poh_furn_name', item)} (${str('poh_fam_room', num('poh_furn_fam', item))})`,
            // a namedobj enum stores the obj id, not its name
            obj: num('poh_furn_mat1', item)
        });
        seen.push(item);
    }

    console.log(`\n  band ${band}: levels ${lo}-${hi}`);
    check(`    ${want.length} row(s), inside the 40-row list`, rows.length <= 40 && rows.length === want.length, true);
    check(
        '    the right pieces, in order',
        rows.map(r => `${r.level} ${r.name}`),
        want.map(r => `${r.level} ${r.name}`)
    );
    check(
        '    every level inside the band',
        rows.every(r => r.level >= lo && r.level <= hi),
        true
    );
    check(
        "    and the icon is the piece's first material",
        rows.map(r => r.obj),
        want.map(r => r.obj)
    );
    check(
        '    (and those icons are real objs)',
        rows.every(r => r.obj > 0),
        true
    );
}

// ---- nothing lost, nothing listed twice ------------------------------------------------------
console.log('\n  across the whole guide');
check('    every piece appears exactly once', seen.length, ITEMS);
check('    with no duplicates', new Set(seen).size, ITEMS);
check(
    '    and none missing',
    [...seen].sort((a, b) => a - b),
    Array.from({ length: ITEMS }, (_, i) => i + 1)
);

H.despawn(p);
console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
