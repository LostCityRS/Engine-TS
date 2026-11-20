/**
 * A quest's reward scroll advertises a number of XP. This drives the quest-complete queue and
 * checks the player's skill actually moved by that many points.
 *
 * WHY THE TWO HAVE TO BE CHECKED TOGETHER. stat_advance takes TENTHS of a point - Player.addXp
 * stores tenths and the client divides by 10 - while the scroll's reward line is a string a human
 * typed. Nothing ties them, so a quest written with the scroll's own number in the stat_advance
 * pays a tenth of what it promises and still builds, still completes and still shows the right
 * scroll. Priest in Peril was exactly that (DeathPlateau-Bugs#30): stat_advance(prayer, 1406) for
 * a scroll reading "1,406 Prayer XP", so the reward was 140.6 XP.
 *
 * WHY IT LOOKED LIKE THE MULTIPLIER. The report was "prayer exp reward was not multiplied 10x",
 * and at the 10x rate a tenth of 1,406 multiplied by ten is 1,406 - the advertised number, landing
 * as though no multiplier had been applied at all. So the rates are driven here too: the bug and a
 * genuinely missing multiplier are only told apart by watching the same reward at more than one
 * rate.
 *
 * Jungle Potion is the control. It is the same shape - a literal stat_advance in a complete queue
 * against a scroll line - and it was already right (7750 tenths for "775 Herblore XP"), so a
 * failure here means this sim is wrong rather than the content.
 */
import * as H from './harness.js';
import { check, R, player } from './a1lib.js';
import type Player from '#/engine/entity/Player.js';

await H.boot();

// The engine's stat order, for the skills this sim reads.
const STAT = { prayer: 5, magic: 6, herblore: 15, thieving: 17 } as const;

/** The reward lines the scroll was just given (inter_238:com_10..14). */
function rewardLines(p: Player, from: number): string[] {
    return H.ifaces
        .slice(from)
        .filter(f => f.who === p.username && f.kind === 'text' && typeof f.text === 'string' && f.text.length > 0)
        .map(f => f.text as string);
}

/**
 * Complete a quest and report the XP it really paid, in whole points.
 * The queue is run with protected access, which is what a real queue has.
 */
function completed(name: string, queue: string, stat: number, rate: number, setup: (p: Player) => void) {
    const p = player('qrx_' + name + '_' + rate, 3435, 9897, 0);
    H.setVar(p, 'xp_rate', rate);
    setup(p);
    const before = p.stats[stat];
    const from = H.ifaces.length;
    H.runProc(p, '[queue,' + queue + ']', [], undefined, true);
    return { gained: (p.stats[stat] - before) / 10, lines: rewardLines(p, from) };
}

// ---- 1. Priest in Peril: 1,406 Prayer XP ----------------------------------------------------
// The scroll's own number, written down once here. Every assertion below is against this, so the
// sim cannot drift into agreeing with whatever the content happens to pay.
const PIP_PRAYER = 1406;

for (const rate of [1, 5, 10]) {
    const r = completed('pip', 'priestperil_complete', STAT.prayer, rate, p => H.setVar(p, 'priestperil', 60));
    check(`Priest in Peril at ${rate}x pays ${PIP_PRAYER} x ${rate} Prayer XP`, r.gained, PIP_PRAYER * rate);
}

// The scroll has to keep advertising the number those checks are pinned to, or they are pinned to
// nothing a player ever sees.
{
    const r = completed('pipscroll', 'priestperil_complete', STAT.prayer, 1, p => H.setVar(p, 'priestperil', 60));
    const advertised = r.lines.filter(l => l.includes('Prayer XP'));
    check('Priest in Peril advertises one Prayer XP line', advertised.length, 1);
    check('Priest in Peril advertises 1,406 Prayer XP', advertised[0], '1,406 Prayer XP');
    // An unmultiplied rate is the one rate where the scroll's number and the payout must agree.
    check('and pays exactly what it advertises at Realism', r.gained, PIP_PRAYER);
}

// ---- 2. Jungle Potion: 775 Herblore XP (the control) ----------------------------------------
const JP_HERBLORE = 775;

for (const rate of [1, 10]) {
    const r = completed('jp', 'junglepotion_quest_complete', STAT.herblore, rate, p => H.setVar(p, 'junglepotion', 0));
    check(`Jungle Potion at ${rate}x pays ${JP_HERBLORE} x ${rate} Herblore XP`, r.gained, JP_HERBLORE * rate);
}

{
    const r = completed('jpscroll', 'junglepotion_quest_complete', STAT.herblore, 1, p => H.setVar(p, 'junglepotion', 0));
    const advertised = r.lines.filter(l => l.includes('Herblore XP'));
    check('Jungle Potion advertises one Herblore XP line', advertised.length, 1);
    check('Jungle Potion advertises 775 Herblore XP', advertised[0], '775 Herblore XP');
    check('and pays exactly what it advertises at Realism', r.gained, JP_HERBLORE);
}

// ---- 2b. Desert Treasure: 20,000 Magic XP, and the same bug the other way up -----------------
// This one was written at TEN TIMES its reward rather than a tenth, so it paid 200,000 to a player
// on Realism and two million on 10x. It is driven at all three rates for the same reason Priest in
// Peril is: a wrong amount and a wrong multiplier are indistinguishable at a single rate.
const DT_MAGIC = 20000;

for (const rate of [1, 5, 10]) {
    const r = completed('dt', 'dt_quest_complete', STAT.magic, rate, () => {});
    check(`Desert Treasure at ${rate}x pays ${DT_MAGIC} x ${rate} Magic XP`, r.gained, DT_MAGIC * rate);
}

{
    const r = completed('dtscroll', 'dt_quest_complete', STAT.magic, 1, () => {});
    const advertised = r.lines.filter(l => l.includes('Magic XP'));
    check('Desert Treasure advertises one Magic XP line', advertised.length, 1);
    check('Desert Treasure advertises 20,000 Magic XP', advertised[0], '20,000 Magic XP');
    check('and pays exactly what it advertises at Realism', r.gained, DT_MAGIC);
}

// ---- 2c. Tribal Totem: 1,775 Thieving XP ----------------------------------------------------
// Its scroll used to read "1,1775 Thieving XP" - a stray comma, not a wrong payout. The payout was
// always right, so what this pins is the two agreeing, which is the only way a typo in a reward
// line gets noticed at all.
const TOTEM_THIEVING = 1775;

for (const rate of [1, 10]) {
    const r = completed('totem', 'totem_quest_complete', STAT.thieving, rate, () => {});
    check(`Tribal Totem at ${rate}x pays ${TOTEM_THIEVING} x ${rate} Thieving XP`, r.gained, TOTEM_THIEVING * rate);
}

{
    const r = completed('totemscroll', 'totem_quest_complete', STAT.thieving, 1, () => {});
    const advertised = r.lines.filter(l => l.includes('Thieving XP'));
    check('Tribal Totem advertises one Thieving XP line', advertised.length, 1);
    check('Tribal Totem advertises 1,775 Thieving XP', advertised[0], '1,775 Thieving XP');
    check('and pays exactly what it advertises at Realism', r.gained, TOTEM_THIEVING);
}

// ---- 2d. Watchtower: 15,250 Magic XP, which the queue never sees ----------------------------
// NOT DRIVEN THROUGH THE COMPLETE QUEUE, because Watchtower does not pay from there. Its queue
// only shows the scroll; the reward is handed out by [oploc1,watchleverup] the moment the
// forcefield comes up, and the queue is armed afterwards. A quest can put its reward anywhere, so
// a sim that only ever drives complete queues would have scored this one as having no reward at
// all - which is exactly what my first sweep for this did.
const WT_MAGIC = 15250;
const WT_CRYSTALS = ['powering_crystal1', 'powering_crystal2', 'powering_crystal3', 'powering_crystal4'];
const WT_FOUND_ALL = 11; // ^itwatchtower_found_all_crystals

for (const rate of [1, 10]) {
    const p = player('wt' + rate, 2543, 3116, 2);
    H.setVar(p, 'xp_rate', rate);
    H.setVar(p, 'itwatchtower', WT_FOUND_ALL);
    for (const c of WT_CRYSTALS) H.give(p, c, 1);
    const before = p.stats[STAT.magic];
    const from = H.ifaces.length;
    H.opLoc(p, 2543, 3115, 'watchleverup', 1);
    H.tick(20); // the lever does p_delay(3) and only then arms the complete queue
    const gained = (p.stats[STAT.magic] - before) / 10;
    check(`Watchtower at ${rate}x pays ${WT_MAGIC} x ${rate} Magic XP`, gained, WT_MAGIC * rate);
    // AND ITS REWARD LIST IS NEVER SHOWN, which is why there is no scroll-text check here to match
    // the ones above. Watchtower and Sea Slug are the two quests ~send_quest_complete routes to the
    // `questscroll` interface instead of inter_238 (general/scripts/quests.rs2), and that branch
    // writes the quest message, the quest-point count and the reward obj - never $rewardtext. Their
    // reward lines exist only as a dead argument in the source. Pinned rather than left implied: if
    // that branch ever starts printing them, this notices and the check above can join the others.
    if (rate === 1) {
        check('and shows no reward list at all, on the questscroll branch', rewardLines(p, from).filter(l => l.includes('Magic XP')).length, 0);
    }
}

// ---- 3. The rate itself, so a real missing multiplier cannot hide behind section 1 -----------
// If addXp ever stopped multiplying, section 1's 5x and 10x checks would fail - but they would
// also fail if the amounts changed. This separates the two: the ratio between rates is the
// multiplier, whatever the amount is.
{
    const one = completed('ratio1', 'priestperil_complete', STAT.prayer, 1, p => H.setVar(p, 'priestperil', 60));
    const ten = completed('ratio10', 'priestperil_complete', STAT.prayer, 10, p => H.setVar(p, 'priestperil', 60));
    check('10x pays ten times what Realism pays', ten.gained, one.gained * 10);
}

console.log(R.bad ? `FAILED: ${R.bad} of ${R.ok + R.bad}` : `${R.ok} ok`);
process.exit(R.bad ? 1 : 0);
