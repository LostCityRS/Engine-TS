/**
 * The quest completion scroll: that every quest's reward lines actually reach a player.
 *
 * WHY THIS IS NOT COVERED BY CHECKING THE REWARD. A quest hands ~send_quest_complete a string of
 * reward lines, and that proc decides which interface to draw them on. Three quests had a case of
 * their own in that switch, pointing at a scroll whose name matched the quest but whose component
 * ids did not match the interface - and on those, the reward lines were simply never written. The
 * quest completed, the XP was paid, the scroll opened, and the reward list was a dead argument.
 *
 * Gertrude's Cat was the first found (questscroll_fluffs, 2302, children scattered across 2303,
 * 2305, 2308, 2309 and 3215 - opening it rendered a shape-puzzle random event). Sea Slug and
 * Watchtower were the other two: `questscroll` is 297 with com_0..com_7 at 298-305, contiguous and
 * real, but their case wrote com_9 and com_10, and those names sit on 4444 and 6158 - 4444 between
 * levelup_ranged and options_ld, 6158 between options_ld:com_2 and questscroll_itgronigen:com_4.
 * The quest point count went into an unrelated interface and $rewardtext was never written at all.
 *
 * All three go through inter_238 now, which is contiguous at 12140-12155. This drives the two whose
 * reward lines nobody had ever seen and reads the text back off the interface.
 */
import * as H from './harness.js';
import { check, R, player } from './a1lib.js';
import type Player from '#/engine/entity/Player.js';

await H.boot();

// inter_238, the scroll every quest now uses. Contiguous, which is the whole point.
const INTER_238 = 12141; // :com_0

/** The text this player was just given on the scroll, by component name. */
function scrollText(p: Player, from: number): Record<string, string> {
    const out: Record<string, string> = {};
    for (const f of H.ifaces.slice(from)) {
        if (f.who !== p.username || f.kind !== 'text' || typeof f.text !== 'string') continue;
        const com = f.com - INTER_238;
        if (com >= 0 && com <= 14) out['com_' + com] = f.text;
    }
    return out;
}

/**
 * Complete a quest through its own completion queue and read the scroll back.
 * The queue runs with protected access, which is what a real queue has.
 */
function scrollOf(who: string, varp: string, done: number, queue: string, x: number, z: number) {
    const p = player(who, x, z, 0);
    H.setVar(p, varp, done);
    const qpBefore = H.getVar(p, 'qp') as number;
    const from = H.ifaces.length;
    H.runProc(p, queue, [], undefined, true);
    H.tick(3);
    return { text: scrollText(p, from), qpBefore, qp: H.getVar(p, 'qp') as number };
}

// ---- Watchtower -----------------------------------------------------------------------------
// ^itwatchtower_complete = 13, ^itwatchtower_questpoints = 4.
{
    const s = scrollOf('scwt', 'itwatchtower', 13, '[queue,itwatchtower_quest_complete]', 2544, 3112);
    check('Watchtower names the quest on the scroll', s.text.com_3, 'You have finished the Watchtower Quest.');
    check('Watchtower shows its quest points', s.text.com_9, '4 Quest Points');
    // The three lines the quest passes in, which were a dead argument before.
    check('Watchtower shows its Magic XP', s.text.com_10, '15,250 Magic XP');
    check('Watchtower shows its coins', s.text.com_11, '5,000 Coins');
    check('Watchtower shows its spell', s.text.com_12, 'Watchtower Teleport Spell');
    // And the points are RECOUNTED, not hand-added: the case this replaces did its own
    // `%qp = add(%qp, ...)`, which made ~update_questpoints a no-op.
    check('Watchtower recounts quest points from 0', s.qp, 4);
}

// ---- Sea Slug -------------------------------------------------------------------------------
// ^seaslug_complete = 12, ^seaslug_questpoints = 1. Note the singular on com_9.
{
    const s = scrollOf('scss', 'seaslugquest', 12, '[queue,seaslug_quest_complete]', 2528, 3331);
    check('Sea Slug shows its quest point, singular', s.text.com_9, '1 Quest Point');
    check('Sea Slug shows its Fishing XP', s.text.com_10, '7,175 Fishing XP');
    check('Sea Slug shows its platform access', s.text.com_11, 'Fishing Platform Access');
    check('Sea Slug shows its pearls', s.text.com_12, 'Some Oyster Pearls');
    check('Sea Slug recounts quest points from 0', s.qp, 1);
}

// ---- and the lines that must stay empty -----------------------------------------------------
// Both quests pass three reward lines, and the scroll has five slots. A leftover in com_13 or
// com_14 would mean split_get is reading past the end of what the quest handed it.
{
    const s = scrollOf('sctail', 'itwatchtower', 13, '[queue,itwatchtower_quest_complete]', 2544, 3112);
    check('the fourth reward slot is empty', s.text.com_13, '');
    check('and the fifth', s.text.com_14, '');
}

console.log(R.bad ? `FAILED: ${R.bad} of ${R.ok + R.bad}` : `${R.ok} ok`);
process.exit(R.bad ? 1 : 0);
