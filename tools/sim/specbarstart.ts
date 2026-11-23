// A NEW ACCOUNT'S SPECIAL ATTACK BAR, which until now started EMPTY.
// Usage: npx tsx tools/sim/specbarstart.ts   (exit code is the verdict)
//
// sa_energy is a perm varp and the .varp format has no default=, so a brand-new character's bar
// read 0. [proc,sa_login] only starts the regen timer - it fills nothing - so every special attack
// in the game was refused with "You don't have enough power left" for a player's first five
// minutes. It was found while testing the dragon harpoon's Fishstabber, where it looked exactly
// like the new special being broken.
//
// THE FIX HAS TO BE UNFARMABLE, which is the only interesting thing about it. The bar is perm, so
// "fill it if it is empty" would give a free special to anyone who spent theirs, logged out and
// came back - in the Wilderness that is worth a great deal. So login.rs2 keys on %tutorial being
// 0: it only ever counts up, from 0 to ^tutorial_complete, and 0 means this character has not yet
// taken its first step and so cannot have spent anything.
//
// Those are the two cases below, and the second is the one worth having: a login by a character
// that is PAST %tutorial = 0 must leave an empty bar empty, however many times it logs in.
import * as H from './harness.ts';
import { check, R, player } from './a1lib.ts';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import ScriptPointer from '#/engine/script/ScriptPointer.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import type Player from '#/engine/entity/Player.js';

await H.boot();

const FULL = 1000; // ^sa_max_energy

/** Run the LOGIN trigger again, which is what a player coming back does. */
function logInAgain(p: Player) {
    const script = ScriptProvider.getByTrigger(ServerTriggerType.LOGIN, -1, -1);
    if (!script) throw new Error('no LOGIN trigger script');
    const state = ScriptRunner.init(script, p);
    state.pointerAdd(ScriptPointer.ProtectedActivePlayer);
    ScriptRunner.execute(state);
    H.tick(1);
}

// ------------------------------------------------------------------ a brand-new character
{
    // a1lib.player logs one in, which runs the LOGIN trigger - so this is the real path, not a
    // varp written by the test.
    const p = player('sbs_new', 2600, 3420);
    check('a new character has not started the tutorial', H.getVar(p, 'tutorial'), 0);
    check('and its special bar is FULL', H.getVar(p, 'sa_energy'), FULL);
}

// ------------------------------------------------------------------ and it cannot be farmed
{
    const p = player('sbs_spent', 2600, 3420);
    // past the tutorial, bar spent, exactly as someone who has just used a special
    H.setVar(p, 'tutorial', 1000); // ^tutorial_complete
    H.setVar(p, 'sa_energy', 0);
    logInAgain(p);
    check('a spent bar stays spent when the player logs back in', H.getVar(p, 'sa_energy'), 0);
    logInAgain(p);
    logInAgain(p);
    check('and stays spent however many times they do it', H.getVar(p, 'sa_energy'), 0);
}
{
    // PART WAY THROUGH THE TUTORIAL is still not a fresh character: anything other than 0 means
    // the account has been played, so the bar is left alone there too.
    const p = player('sbs_mid', 2600, 3420);
    H.setVar(p, 'tutorial', 10);
    H.setVar(p, 'sa_energy', 0);
    logInAgain(p);
    check('a character part way through the tutorial is not refilled', H.getVar(p, 'sa_energy'), 0);
}
{
    // AND A FULL BAR IS NOT DISTURBED, nor is a part-full one topped up.
    const p = player('sbs_part', 2600, 3420);
    H.setVar(p, 'tutorial', 1000);
    H.setVar(p, 'sa_energy', 400);
    logInAgain(p);
    check('a part-full bar is left where it was', H.getVar(p, 'sa_energy'), 400);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
