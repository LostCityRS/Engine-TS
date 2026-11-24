/**
 * DOES THE AUTOCAST SETTING SURVIVE A LOGOUT?
 *
 * Reported as "autocast doesnt persist after logout" (DeathPlateau-Bugs#50), and the cause is one
 * missing line.
 *
 * %autocast_spell is a VARBIT, bits 1-31 of the varp `lastcastspell`, with %autocast_set on bit 0.
 * A varbit is saved only if the varp it lives in is, and `lastcastspell` carried `transmit=yes` and
 * no scope line at all. VarPlayerType defaults to SCOPE_TEMP, so the whole varp - and therefore the
 * autocast setting - was dropped at logout. The varp directly below it in the same file,
 * `trawler`, has scope=perm, which is what a saved one looks like.
 *
 * THE CHECK IS THE ENGINE'S OWN SAVE AND LOAD, not a claim about a config line. Player.save() is
 * what a logout writes and PlayerLoading.load is what a login reads, so round-tripping a player
 * through both is the question the report asks. A config-only assertion would have passed just as
 * well against a varp whose bits the save ignores for some other reason.
 *
 *   npx tsx tools/sim/autocastpersist.ts
 */
import * as H from './harness.ts';
import { check, R } from './a1lib.ts';
import Packet from '#/io/Packet.js';
import { PlayerLoading } from '#/engine/entity/PlayerLoading.js';
import VarPlayerType from '#/cache/config/VarPlayerType.js';
import VarBitType from '#/cache/config/VarBitType.js';

await H.boot();

const LASTCAST = VarPlayerType.getId('lastcastspell');

/** Save a player the way a logout does and load them back the way a login does. */
function roundTrip(p: any): any {
    return PlayerLoading.load(p.username, new Packet(new Uint8Array(p.save())), null);
}

// ---- 1. the varp the autocast bits live in is saved -------------------------------------------
console.log('\n1. lastcastspell, which holds the autocast bits, is a saved varp');
{
    check('lastcastspell exists', LASTCAST >= 0, true);
    check('and its scope is perm, not temp', VarPlayerType.get(LASTCAST).scope, VarPlayerType.SCOPE_PERM);
}

// ---- 2. and an autocast setting really comes back ---------------------------------------------
// THE ACTUAL REPORT. Set it, save, load, read it back off the loaded player.
console.log('\n2. an autocast spell set before a logout is still set after it');
{
    const p: any = H.makePlayer('acast1', 3222, 3222, 0);
    H.tick(2);
    H.setVar(p, 'tutorial', 1000);
    // the varbits the autocast UI writes (skill_combat/scripts/player/auto_cast.rs2)
    H.setVarBit(p, 'autocast_spell', 1234);
    H.setVarBit(p, 'autocast_set', 1);
    H.tick(1);
    const before = { spell: H.getVarBit(p, 'autocast_spell'), set: H.getVarBit(p, 'autocast_set') };
    check(`  it is set before the logout (spell ${before.spell}, set ${before.set})`, before.spell, 1234);

    const after: any = roundTrip(p);
    check('  the spell survives the round trip', H.getVarBit(after, 'autocast_spell'), 1234);
    check('  and so does the "autocast is on" flag', H.getVarBit(after, 'autocast_set'), 1);
}

// ---- 3. turning it off survives too -----------------------------------------------------------
// A setting that only persists when it is ON is half a fix: a player who switched autocast off and
// logged out must not come back with it on.
console.log('\n3. and so does turning it off');
{
    const p: any = H.makePlayer('acast2', 3222, 3224, 0);
    H.tick(2);
    H.setVar(p, 'tutorial', 1000);
    H.setVarBit(p, 'autocast_spell', 777);
    H.setVarBit(p, 'autocast_set', 1);
    H.tick(1);
    H.setVarBit(p, 'autocast_set', 0);
    H.setVarBit(p, 'autocast_spell', 0);
    H.tick(1);
    const after: any = roundTrip(p);
    check('  autocast comes back off', H.getVarBit(after, 'autocast_set'), 0);
    check('  with no spell remembered', H.getVarBit(after, 'autocast_spell'), 0);
}

// ---- 4. AND NOTHING ELSE RIDES ALONG ----------------------------------------------------------
// Making a varp perm saves EVERYTHING in its bits, so the question "what else is in there" has to
// be answered rather than assumed. lastcastspell's only varbits are the autocast pair - bit 0 and
// bits 1-31 - so perm saves exactly the setting that was reported and nothing besides. If a third
// varbit is ever added to this varp, it silently becomes saved player state, and this says so.
console.log('\n4. the only things in that varp are the autocast pair');
{
    let riders = 0;
    const names: string[] = [];
    for (let i = 0; i < VarBitType.count; i++) {
        const b = VarBitType.get(i);
        if (!b || b.basevar !== LASTCAST) continue;
        riders++;
        names.push(`${b.debugname ?? i} (bits ${b.startbit}-${b.endbit})`);
    }
    console.log(`      (${names.join(', ')})`);
    check('exactly two varbits live in lastcastspell', riders, 2);
    check(
        '  and they are the autocast pair',
        names.every(n => n.startsWith('autocast_')),
        true
    );
}

console.log(R.bad ? `\nFAILED: ${R.bad} of ${R.ok + R.bad}` : `\n${R.ok} ok`);
process.exit(R.bad ? 1 : 0);
