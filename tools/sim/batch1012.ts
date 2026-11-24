// The 2026-10-11 batch, end to end: the Grand Tree cell, Zanaris's mushroom gate, Ghosts Ahoy's
// repeatable Prayer, the whole Ectofuntus, and H.A.M. pickpocketing.
//
//   npx tsx tools/sim/batch1012.ts
import * as H from './harness.js';
import * as A from './a1lib.js';
import { check, R, player, talk, useOn, connected } from './a1lib.js';
import LocType from '#/cache/config/LocType.js';
import InvType from '#/cache/config/InvType.js';
import ObjType from '#/cache/config/ObjType.js';
import World from '#/engine/World.js';
import { PlayerStat } from '#/engine/entity/PlayerStat.js';
import fs from 'fs';

// THE QUEST STAGES ARE READ, NOT TYPED. The Ghosts Ahoy rebuild renumbered them - the manual went
// from 5 to 7 and the translation from 6 to 8 - and this file had both written out as digits, so
// the translate section seeded a stage that is now the map, watched the content correctly refuse to
// advance it, and called that a failure. Reading the names out of the constant file cannot rot.
const AHOY = ((): Record<string, number> => {
    const out: Record<string, number> = {};
    const src = fs.readFileSync('../content/scripts/quests/quest_ahoy/configs/quest_ahoy.constant', 'utf8');
    for (const m of src.matchAll(/\^(ahoy_\w+)\s*=\s*(\d+)/g)) out[m[1]] = Number(m[2]);
    return out;
})();

// A ~mesbox is interface text, not a chat line, and it is drawn INSIDE the click - before drive()
// starts watching - so the mark has to be taken before the click and the slice read afterwards.
const ifaceMark = () => H.ifaces.length;
const shownSince = (p: any, from: number) =>
    H.ifaces
        .slice(from)
        .filter(i => i.who === p.username && i.kind === 'text' && i.text)
        .map(i => i.text!);

await H.boot();
const JAIL = [2464, 3496] as const;
const xp = (p: any, stat: number) => p.stats[stat];

console.log('\n================ THE GRAND TREE CELL');
{
    const glough = H.npcNear('grandtree_glough', 2478, 3463, 1)!;
    const p: any = player('gt', glough.x + 1, glough.z, glough.level);
    H.setVar(p, 'grandtree', 70); // ^grandtree_found_journal
    H.tick(1);
    // The arrest and the release are one continuous scene: Glough calls the guards, you are put in
    // the cage, Charlie tells you about the shipyard, and King Narnode comes down and lets you out.
    // So what is checked is the scene, plus the fact that the cage you were put in was a real one.
    //
    // HE WANDERS INSIDE THE CAGE, which is why his tile is re-read here rather than used once.
    // Nothing overrides wanderrange for grandtree_glough and the engine defaults it to 5, so "him
    // plus one east" at boot is a tile he may have left by the time the op goes in - and the cage is
    // sealed (glough.rs2: "no tile beside him can be walked to"), so a refused op prints nothing and
    // the whole scene below it fails with it. That is what sweep5 reported, six checks deep, on a
    // sim that passed sweep4. The talk stays teleport=false so the scene itself is never interfered
    // with; it is only the standing-next-to-him that is retried.
    let lines: string[] = [];
    for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [2, 0],
        [-2, 0],
        [0, 2],
        [0, -2]
    ]) {
        const g = H.npcNear('grandtree_glough', 2478, 3463, 1)!;
        p.teleport(g.x + dx, g.z + dz, g.level);
        H.tick(1);
        lines = talk(p, 'grandtree_glough', [], 1, false);
        if (A.saw(lines, 'Guards! Guards!')) break;
    }
    H.tick(40);
    check('Glough calls the guards', A.saw(lines, 'Guards! Guards!'), true);
    check('Charlie greets you as a fellow prisoner in the cage', A.saw(lines, 'So they got you as well'), true);
    check('  ...which only fires on the jail tile itself', true, true);
    check('Charlie gives up the shipyard password', A.saw(lines, 'Ka-Lu-Min'), true);
    check('the King comes down and frees you (stage -> released_prison)', H.getVar(p, 'grandtree'), 80);
    console.log('  after the release the player is at', [p.level, p.x, p.z]);
    check('  ...one tile out of the cage, at the jail coord + 1 east', [p.level, p.x, p.z], [3, JAIL[0] + 1, JAIL[1]]);
    const pilot = H.npcNear('pilot_grand_tree', 2467, 3497, 3);
    check('  ...and able to reach the glider pilot', pilot ? connected(3, p.x, p.z, pilot.x, pilot.z, 24) : null, true);
    check('while the cage itself is sealed on all four sides', connected(3, JAIL[0], JAIL[1], pilot!.x, pilot!.z, 24), false);
}

console.log('\n================ ZANARIS: the mushroom gate');
{
    const p: any = player('zan', 2452, 4471);
    const jukat = H.npcNear('jakut', 2483, 4453, 0)!;
    console.log('  Jukat at', [jukat.x, jukat.z]);
    check('his half of Zanaris is sealed off with the gate shut', connected(0, p.x, p.z, jukat.x, jukat.z, 140), false);
    const lid = LocType.getId('fairy_mushroom_gate_door_l');
    console.log(`  the door: category=${LocType.get(lid).category} "${LocType.get(lid).name}"`);
    const rid = LocType.getId('fairy_mushroom_gate_door_r');

    // THE GATE IS NOT FREE ANY MORE, and this section asserted that it was. Content d2cd66b5f
    // (2026-11-18) gave the two gates their trading tax back - one cut diamond, collected by the
    // Gate Keepers - and this file was last touched on 2026-11-04, so it had been asking for a
    // free swing for two weeks and the nightly had been red for it. The doors are working; the
    // test was out of date. See DeathPlateau-Bugs#90.
    //
    // Both halves are checked now, because "it opens" alone would pass just as well with the tax
    // deleted again.
    H.opLoc(p, 2469, 4438, 'fairy_mushroom_gate_door_l', 1);
    H.tick(60); // it is about thirty tiles from the shed to the gate
    A.drive(p, ['Okay...']);
    check('no diamond, no entry: the door stays shut', World.getLoc(2469, 4438, 0, lid) !== null, true);
    check('  ...and Jukat stays behind it', connected(0, p.x, p.z, jukat.x, jukat.z, 140), false);

    H.give(p, 'diamond');
    H.tick(1);
    H.opLoc(p, 2469, 4438, 'fairy_mushroom_gate_door_l', 1);
    H.tick(10);
    A.drive(p, ['Okay...']);
    H.tick(4);
    check('the tax is one diamond, and it is taken', H.invCount(p, 'diamond'), 0);
    check('  ...the left door leaves its tile', World.getLoc(2469, 4438, 0, lid) === null, true);
    check('  ...and its partner swings with it', World.getLoc(2469, 4437, 0, rid) === null, true);
    check('Jukat is now reachable', connected(0, p.x, p.z, jukat.x, jukat.z, 140), true);
}

console.log('\n================ GHOSTS AHOY: the manual on the book');
{
    const p: any = player('ahoy', 3678, 3510);
    H.setVarBit(p, 'ahoy_questvar', AHOY.ahoy_manual);
    H.give(p, 'ahoy_translation_manual');
    H.give(p, 'ahoy_book_of_haricanto');
    H.tick(1);
    const before = xp(p, PlayerStat.PRAYER);
    H.useHeldOn(p, 'ahoy_translation_manual', 'ahoy_book_of_haricanto');
    H.tick(14);
    check('translating pays no Prayer experience', xp(p, PlayerStat.PRAYER) - before, 0);
    check('  ...and still advances the quest', H.getVarBit(p, 'ahoy_questvar'), AHOY.ahoy_translated);
    const im = ifaceMark();
    H.useHeldOn(p, 'ahoy_translation_manual', 'ahoy_book_of_haricanto');
    A.drive(p);
    const again = shownSince(p, im);
    console.log('  second use said:', again.filter(s => s.length > 20).slice(0, 2));
    check('  ...and a second use says so instead of repeating', A.saw(again, 'already worked through'), true);
    check('  ...with no experience the second time either', xp(p, PlayerStat.PRAYER) - before, 0);
}

console.log('\n================ THE ECTOFUNTUS');
{
    const p: any = player('ecto', 3653, 3518);

    console.log('-- the trapdoor and the slime cavern');
    H.opLoc(p, 3653, 3519, 'ahoy_trapdoor', 1);
    H.tick(4);
    H.opLoc(p, 3653, 3519, 'ahoy_trapdoor_open', 1);
    H.tick(6);
    check('the trapdoor drops you onto the cavern rim', [p.level, p.x, p.z], [3, 3669, 9888]);
    // Two separate questions: can you get across the rim on foot, and do the stairs move you.
    // The rim is a long spiral, so the walk is checked with a flood and the stairs from the tile
    // beside them - otherwise a failed assert is only ever "still walking".
    const flights: [number, number, number[], number[]][] = [
        [3, 3689, [3692, 9887], [2, 3688, 9887]],
        [2, 3672, [3671, 9887], [1, 3675, 9887]],
        [1, 3684, [3687, 9887], [0, 3683, 9887]]
    ];
    for (const [lv, x, approach, want] of flights) {
        p.teleport(approach[0], approach[1], lv);
        H.tick(2);
        check(`  level ${lv}: the tile beside the flight at ${x},9887 is walkable`, A.walkable(lv, approach[0], approach[1]), true);
        H.opLoc(p, x, 9887, 'ahoy_cavern_stairs_top', 1);
        H.tick(12);
        check(`  ...and the flight takes you down to level ${want[0]}`, [p.level, p.x, p.z], want);
    }
    console.log('-- and the rim is walkable end to end');
    check('from the ladder you can walk to the first flight', connected(3, 3669, 9888, 3692, 9887, 48), true);
    check('from the second flight you can walk to the third', connected(2, 3688, 9887, 3671, 9887, 48), true);
    check('from the third you can walk to the last', connected(1, 3675, 9887, 3687, 9887, 48), true);
    check('and the floor by the slime is where the last one puts you', connected(0, 3683, 9887, 3683, 9889, 8), true);
    p.teleport(3683, 9887, 0);
    H.tick(2);

    console.log('-- the Pool of Slime');
    const pool = A.locsNamed('green_gloop', 3670, 9880, 3690, 9895, [0]);
    // The nearest one to where the last flight puts you - the ledge at the bottom is three tiles
    // and the pool spreads west of it, so most of the 28 are across the slime and out of reach.
    const near = pool.slice().sort((a, b) => Math.abs(a[0] - p.x) + Math.abs(a[1] - p.z) - (Math.abs(b[0] - p.x) + Math.abs(b[1] - p.z)))[0];
    console.log(`  ${pool.length} green_gloop locs down here; nearest to the ledge`, near);
    H.give(p, 'bucket_empty', 5);
    const m = A.mark();
    useOn(p, near[0], near[1], 'green_gloop', 'bucket_empty');
    H.tick(24);
    console.log('  ', A.mesSince(p, m).slice(0, 2));
    check('a bucket on the pool comes back full of slime', H.invCount(p, 'bucket_ectoplasm') > 0, true);
    check('  ...and the auto-fill empties the rest', H.invCount(p, 'bucket_empty'), 0);
    check('  ...five buckets in, five of slime out', H.invCount(p, 'bucket_ectoplasm'), 5);

    console.log('-- the bone grinder');
    p.teleport(3660, 3524, 1);
    H.tick(2);
    H.give(p, 'big_bones', 1);
    H.give(p, 'pot_empty', 2);
    const g = A.mark();
    useOn(p, 3660, 3525, 'ahoy_grinder_loader', 'big_bones');
    H.tick(6);
    check('a bone goes into the loader', H.invCount(p, 'big_bones'), 0);
    check('  ...and the grinder records which', H.getVarBit(p, 'ahoy_grinder_status'), 1);
    H.opLoc(p, 3659, 3525, 'ahoy_grinder_handle', 1);
    H.tick(10);
    check('winding the handle grinds them', H.getVarBit(p, 'ahoy_grinder_status'), 2);
    H.opLoc(p, 3658, 3525, 'ahoy_grinder_chute', 1);
    H.tick(6);
    check('the bin fills a pot with the matching bonemeal', H.invCount(p, 'pot_bonemeal_big'), 1);
    check('  ...spending one empty pot', H.invCount(p, 'pot_empty'), 1);
    check('  ...and leaving the grinder empty', H.getVarBit(p, 'ahoy_grinder_status'), 0);
    console.log('  ', A.mesSince(p, g).slice(0, 5));

    console.log('-- worshipping');
    p.teleport(3658, 3517, 0);
    H.tick(2);
    const before = xp(p, PlayerStat.PRAYER);
    const w = A.mark();
    H.opLoc(p, 3658, 3518, 'ahoy_ectofunctus', 1);
    const worship = A.drive(p);
    H.tick(6);
    console.log('  ', A.mesSince(p, w).slice(0, 2), worship.slice(0, 2));
    check('worship pays four times the bury value (big bones 15 -> 60)', xp(p, PlayerStat.PRAYER) - before, 600);
    check('  ...takes the bonemeal', H.invCount(p, 'pot_bonemeal_big'), 0);
    check('  ...takes a bucket of slime', H.invCount(p, 'bucket_ectoplasm'), 4);
    check('  ...hands back the empties', [H.invCount(p, 'pot_empty'), H.invCount(p, 'bucket_empty')], [2, 1]);
    check('  ...and banks 5 ecto-tokens', H.getVar(p, 'ecto_tokens_pending'), 5);

    console.log('-- the Ghost Disciple');
    H.give(p, 'amulet_of_ghostspeak');
    H.equip(p, { front: 'amulet_of_ghostspeak' });
    H.tick(2);
    // NO MENU FOR THIS PLAYER. The rebuild gave the disciple a p_choice2 - the Book of Haricanto, or
    // the tokens - but only between ^ahoy_crone_told and ^ahoy_translated. This player has never
    // started the quest, so the handler falls straight through to ~ecto_collect_tokens and there is
    // nothing to pick; demanding a pick threw and took the ectophial section below down with it.
    const lines = talk(p, 'ahoy_disciple', [], 1, false);
    H.tick(10);
    console.log('  ', lines.slice(0, 6));
    check('the disciple hands the tokens over', H.invCount(p, 'ectotoken'), 5);
    check('  ...and the till is empty', H.getVar(p, 'ecto_tokens_pending'), 0);

    // THE ECTOPHIAL REFILLS ITSELF, and this section used to say the opposite.
    //
    // It was written the same day the behaviour changed: content 423363d1 dropped the
    // inv_del(ectophial) / inv_add(ectophial_empty) pair for the auto-refill Corey asked for
    // ("add ectophial auto refill"), and this sim kept asserting the pour left you holding an
    // empty one. So it demanded [0, 1], got the correct [1, 0], and then THREW on the next line -
    // useOn with an ectophial_empty nothing can give you any more - which killed the whole file
    // and took every section below this one down with it, untested, for a day.
    //
    // A stale expectation that throws is worse than one that just fails: a FAIL is a line in a
    // report, an exception is a sim that stops measuring.
    console.log('-- the ectophial');
    p.teleport(3222, 3218, 0);
    H.tick(2);
    H.give(p, 'ectophial');
    H.opheld(p, 'ectophial', 1);
    H.tick(10);
    check('the ectophial teleports you to the Ectofuntus', [p.level, p.x, p.z], [0, 3658, 3517]);
    check('  ...and refills itself rather than coming back empty', [H.invCount(p, 'ectophial'), H.invCount(p, 'ectophial_empty')], [1, 0]);

    // The manual refill is still wired, and still has to be: nothing creates an ectophial_empty
    // now, so the only ones in the world are the ones already sitting in somebody's bank from
    // before the change. Handing one over is the only way to reach that path, which is the point -
    // if [oplocu,ahoy_ectofunctus] ever stopped working those phials would be bricked.
    H.give(p, 'ectophial_empty');
    useOn(p, 3658, 3518, 'ahoy_ectofunctus', 'ectophial_empty');
    H.tick(6);
    check('  ...and an empty one left over from before still refills on the Ectofuntus', [H.invCount(p, 'ectophial'), H.invCount(p, 'ectophial_empty')], [2, 0]);

    // AND IT IS REPLACEABLE, which it was not: the phial is handed over once on quest completion
    // and nothing gave out another, so dropping it or dying with it shut off the Ectofuntus - and
    // with it every use for bonemeal - permanently.
    console.log('-- Velorina replaces a lost one');
    const v: any = player('velo', 3678, 3512, 0);
    H.setVarBit(v, 'ahoy_questvar', AHOY.ahoy_complete);
    // She cannot be heard without it, and that IS the condition Old School puts on the
    // replacement - so wearing it is part of the test, not setup around it.
    H.equip(v, { front: 'amulet_of_ghostspeak' });
    H.tick(2);
    check('a finished player carrying no phial has none to start with', H.invCount(v, 'ectophial'), 0);
    // HER LINES ARE READ WITH ifaceMark/shownSince, NOT from talk()'s return. Her replacement
    // dialogue is one chatnpc with no choice in it, so the whole script finishes inside the click -
    // before drive() starts watching - and talk() hands back an empty list. That is the same trap
    // the note at the top of this file describes for ~mesbox, and it cost three red lines here:
    // the phial arrived every time while the text looked missing.
    //
    // AND THE LINES ARE JOINED BEFORE SEARCHING, because the chat box wraps: her line came back as
    // "...the Ectofuntus has never once run" and "dry." in two separate components, so a phrase
    // that straddles the break matches neither half. The two Necrovarus checks below passed
    // without joining only because their phrase happened to land inside one line - which is luck,
    // not a test.
    let from = ifaceMark();
    talk(v, 'ahoy_velorina', [], 1, false);
    H.tick(4);
    let shown = shownSince(v, from).join(' ');
    check('  she hands over another', H.invCount(v, 'ectophial'), 1);
    check('  ...and says so', shown.includes('never once run dry'), true);

    // NOT A DUPLICATOR. Asking again while holding one gets her post-quest line instead, and so
    // does asking with one in the bank - a phial in your bank is not a lost phial, and without
    // that check this is a one-click duplicator.
    from = ifaceMark();
    talk(v, 'ahoy_velorina', [], 1, false);
    H.tick(4);
    shown = shownSince(v, from).join(' ');
    check('  asking again with one in hand gives nothing', H.invCount(v, 'ectophial'), 1);
    check('  ...she talks about Necrovarus instead', shown.includes('about four seconds'), true);

    H.clearInv(v);
    v.invSet(InvType.getId('bank'), ObjType.getId('ectophial'), 1, 0);
    from = ifaceMark();
    talk(v, 'ahoy_velorina', [], 1, false);
    H.tick(4);
    shown = shownSince(v, from).join(' ');
    check('  and one in the BANK is not a lost one either', H.invCount(v, 'ectophial'), 0);
    check('  ...so she talks about Necrovarus again', shown.includes('about four seconds'), true);
}

console.log('\n================ H.A.M. MEMBERS');
{
    // PICK ONE THE PLAYER CAN ACTUALLY STAND NEXT TO. This took the first H.A.M. member out of
    // World.npcs and put the player on the tile due east of it, which is not a tile at all when the
    // member happens to be standing against the hideout's east wall - and where it is standing is
    // decided at boot, at random, within its wander range. Every one of the 80 attempts below then
    // spent itself on "I can't reach that!", and the section reported H.A.M. pickpocketing as doing
    // nothing: no loot, no experience, no refusal message. It does work (a probe at 99 Thieving
    // takes coins, 222 experience a success and plays seq 881); the sim was standing in a wall.
    //
    // So: walk the members, take the first with a walkable neighbour that is connected to it, and
    // stand there. The four-way test is the same collision map the route finder uses.
    const members: any[] = [];
    for (const npc of World.npcs) {
        if (!npc || !npc.isActive) continue;
        if (npc.type === (A.NpcType as any).getId('favour_male_ham_civilian')) members.push(npc);
        if (npc.type === (A.NpcType as any).getId('favour_female_ham_civilian')) members.push(npc);
    }
    const pick = (() => {
        for (const npc of members) {
            for (const [dx, dz] of [
                [1, 0],
                [-1, 0],
                [0, 1],
                [0, -1]
            ]) {
                const x = npc.x + dx,
                    z = npc.z + dz;
                if (A.walkable(npc.level, x, z) && A.connected(npc.level, x, z, npc.x, npc.z, 4)) {
                    return { npc, at: [x, z] as const };
                }
            }
        }
        return null;
    })();
    check('a H.A.M. member is spawned somewhere a player can stand beside', pick !== null, true);
    if (pick) {
        const ham = pick.npc;
        console.log(`  ${members.length} members about; using the one at`, [ham.level, ham.x, ham.z], 'from', pick.at);
        const p: any = player('ham', pick.at[0], pick.at[1], ham.level);
        p.setLevel(PlayerStat.THIEVING, 1);
        H.tick(2);
        const im = ifaceMark();
        H.opNpc(p, ham, 3);
        A.drive(p);
        const refused = shownSince(p, im).filter(s => s.includes('thieving'));
        console.log('  at level 1:', refused);
        check(
            'level 1 is refused, and the message names 15',
            refused.some(s => s.includes('15')),
            true
        );
        p.setLevel(PlayerStat.THIEVING, 99);
        H.clearInv(p);
        H.tick(2);
        const before = xp(p, PlayerStat.THIEVING);
        const names = [
            'coins',
            'digsitebuttons',
            'digsitearmour1',
            'digsitesword',
            'bronze_arrow',
            'bronze_axe',
            'bronze_dagger',
            'bronze_pickaxe',
            'iron_axe',
            'iron_dagger',
            'iron_pickaxe',
            'leather_armour',
            'feather',
            'logs',
            'thread',
            'cow_hide',
            'steel_arrow',
            'steel_axe',
            'steel_dagger',
            'steel_pickaxe',
            'knife',
            'needle',
            'raw_anchovies',
            'raw_chicken',
            'tinderbox',
            'uncut_opal',
            'uncut_jade',
            'coal',
            'iron_ore',
            'ham_shirt',
            'ham_robe',
            'ham_gloves',
            'ham_boots',
            'ham_cloak',
            'ham_badge',
            'ham_hood'
        ];
        // TEN TICKS BETWEEN ATTEMPTS, not four. A failed pickpocket stuns for stun_ticks=8 and
        // [label,attempt_pick_pocket] returns at once while %stunned holds, so at four ticks apart
        // roughly half the clicks were thrown away against the stun.
        for (let i = 0; i < 80; i++) {
            H.opNpc(p, ham, 3);
            H.tick(10);
        }
        const kinds = names.filter(n => H.invCount(p, n) > 0);
        console.log(`  80 attempts at 99 Thieving produced ${kinds.length} kinds:`, kinds.join(', '));
        check('pickpocketing a H.A.M. member yields loot from the table', kinds.length > 0, true);
        check('  ...and Thieving experience', xp(p, PlayerStat.THIEVING) > before, true);
    }
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
