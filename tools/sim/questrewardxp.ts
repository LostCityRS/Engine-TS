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
const STAT = { prayer: 5, herblore: 15 } as const;

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
