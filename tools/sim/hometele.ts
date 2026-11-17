// WHERE HOME TELEPORT PUTS YOU, one book at a time.
// Usage: npx tsx tools/sim/hometele.ts   (exit code is the verdict)
//
// All three books used to call one label with no argument and land everyone in Edgeville, which is
// also where ::home goes - two ways to the same square, one of them with a wait on it. The
// normal book now goes to Lumbridge again, the way 474 had it and the way this build had it before
// September. The destination travels as an argument through five weak queues, so what this asserts
// is that it arrives: the staging is the part that can silently drop it.
import fs from 'fs';
import path from 'path';
import Environment from '#/util/Environment.js';
import * as H from './harness.js';
import { check, R, player, walkable, reachLoc, connected } from './a1lib.js';

await H.boot();

// Falador, far from both destinations and not in the Wilderness, so "did it move" means something
// whichever book is being cast.
const START: [number, number] = [2965, 3380];

type Book = { com: string; what: string; where: [number, number]; place: string };
const BOOKS: Book[] = [
    { com: 'magic:home_teleport', what: 'the normal book', where: [3221, 3218], place: 'Lumbridge' },
    { com: 'ancient_magic:home_teleport', what: 'the Ancient Magicks', where: [3087, 3496], place: 'Edgeville' },
    { com: 'lunar_magic:lunar_home_teleport', what: 'Lunar', where: [2098, 3919], place: 'Lunar Isle' }
];

// map_findsquare searches two squares out, so the landing can be the chosen square or a neighbour.
const near = (p: { x: number; z: number }, w: [number, number]) => Math.abs(p.x - w[0]) <= 2 && Math.abs(p.z - w[1]) <= 2;

console.log('== each book lands where it should');
let n = 0;
for (const b of BOOKS) {
    const p = player('hometele' + n++, START[0], START[1]);
    H.setVar(p, 'home_teleport_last', 0);
    H.ifButton(p, b.com);
    H.tick(30);
    check(`${b.what} -> ${b.place}`, near(p, b.where) ? b.place : `(${p.x}, ${p.z})`, b.place);
}

// ---------------------------------------------------------------------------------------------
// The five stages are 7 + 6 + 3 + 5 + 3 = 24 ticks, which is Old School's cast time. A destination
// that failed to reach the last queue would land the player nowhere at all, and so would a stage
// that stopped chaining - checking the clock as well as the square tells those two apart.
console.log('\n== and takes the full cast to get there');
{
    const p = player('hometeleclock', START[0], START[1]);
    H.setVar(p, 'home_teleport_last', 0);
    H.ifButton(p, 'magic:home_teleport');
    let arrived = -1;
    for (let t = 1; t <= 40 && arrived === -1; t++) {
        H.tick(1);
        if (p.x !== START[0] || p.z !== START[1]) arrived = t;
    }
    // 7 + 6 + 3 + 5 + 3 stage delays, and the arrival queue runs the tick after the last of them.
    check('it lands on tick 25, not before', arrived, 25);
    check('and it lands in Lumbridge', near(p, [3221, 3218]), true);
}

// ---------------------------------------------------------------------------------------------
// ^home_teleport_wait, read out of the content source: a constant is compiled away, so there is no
// way to ask the running server what it is.
const SCRIPTS = path.join(Environment.BUILD_SRC_DIR, 'scripts');
const WAIT = (() => {
    const src = fs.readFileSync(path.join(SCRIPTS, 'skill_magic/configs/home_teleport.constant'), 'utf8');
    const m = src.match(/\^home_teleport_wait\s*=\s*(\d+)/);
    if (!m) throw new Error('no ^home_teleport_wait in skill_magic/configs/home_teleport.constant');
    return parseInt(m[1], 10);
})();

console.log(`\n== the ${WAIT}-minute wait still bites`);
{
    const p = player('hometelewait', START[0], START[1]);
    H.setVar(p, 'home_teleport_last', 0);
    H.ifButton(p, 'magic:home_teleport');
    H.tick(30);
    check('the first cast worked', near(p, [3221, 3218]), true);
    const was: [number, number] = [p.x, p.z];
    const from = H.mesgs.length;
    H.ifButton(p, 'magic:home_teleport');
    H.tick(30);
    check('the second does not move you', [p.x, p.z], was);
    const said = H.mesgs
        .slice(from)
        .filter(m => m.who === p.username)
        .map(m => m.text);
    check(
        'and says how long to wait',
        said.some(m => m.includes('wait another')),
        true
    );
    // AND THE NUMBER IT SAYS IS THE CONSTANT. No minute has passed since the cast, so the whole
    // wait is still to run - which is what makes this readable as "the cooldown is WAIT minutes"
    // rather than just "there is one". A change to the constant that did not reach the script
    // would land here.
    check(
        `...and it is ${WAIT} minutes, the constant's own figure`,
        said.some(m => m.includes(`wait another ${WAIT} minutes`)),
        true
    );
}

// ---------------------------------------------------------------------------------------------
// THE THREE SPELLBOOK TOOLTIPS SAY THE NUMBER AND CANNOT READ IT. "once every 15 minutes" is text
// baked into the .if files and packed into the client's cache; an interface cannot call a script,
// so there is no way to build that line from ^home_teleport_wait. Nothing but this stops the
// cooldown being changed in the script and the three books going on promising the old one.
console.log('\n== the spellbooks promise what the server does');
{
    const BOOKS_IF = ['magic.if', 'ancient_magic.if', 'lunar_magic.if'];
    const wrong: string[] = [];
    let found = 0;
    for (const file of BOOKS_IF) {
        const src = fs.readFileSync(path.join(SCRIPTS, 'skill_magic/interfaces', file), 'utf8');
        const m = src.match(/once every (\d+) minutes/);
        if (!m) {
            wrong.push(`${file}: no "once every N minutes" line at all`);
            continue;
        }
        found++;
        if (parseInt(m[1], 10) !== WAIT) {
            wrong.push(`${file}: says ${m[1]}, the server waits ${WAIT}`);
        }
    }
    for (const one of wrong) console.log(`     ${one}`);
    check(`all three books say ${WAIT} minutes`, wrong, []);
    // ...and the scan actually read three tooltips, rather than passing because a rename made its
    // regex match nothing.
    check('...and all three were found to check', found, BOOKS_IF.length);
}

// ---------------------------------------------------------------------------------------------
// Each stage waits in a WEAK queue so that doing anything else gives up the teleport. That is the
// one property the switch from weakqueue to weakqueue* could have quietly dropped - the starred
// form takes its arguments in a second bracket, and a plain queue would look identical until a
// player walked away mid-cast and got carried off anyway.
// "Next to the bank on Lunar Isle" is Old School's wording, and two different questions hide in it.
// reachLoc answers the first - is the booth actually usable from the tile the spell chose, by the
// engine's own footprint test - and the flood fill answers the second, which is whether the player
// can leave. THE FIRST SQUARE PICKED PASSED EVERYTHING BUT THE FLOOD FILL: the three tiles behind
// the counter (2097-2099, 3921) are walled in on their other three sides, so a player put there is
// standing beside the bank, can click it, and is stuck in a pocket of three squares for good. Both
// checks, or neither is worth running.
console.log('\n== and Lunar lands you within reach of the bank');
{
    const p = player('hometelelunar', START[0], START[1]);
    H.setVar(p, 'home_teleport_last', 0);
    H.ifButton(p, 'lunar_magic:lunar_home_teleport');
    H.tick(30);
    check('on the island', near(p, [2098, 3919]), true);
    check('  on a walkable square', walkable(0, p.x, p.z), true);
    check('  and the booth is clickable from it', reachLoc(0, p.x, p.z, 'lunar_bankbooth', 2098, 3920), true);
    // Not sealed into a pocket of its own: the Moonclan teleport's landing square is reachable on
    // foot from it, so the player is on the island proper and not on top of a wall.
    check('  with the rest of the island walkable from it', connected(0, p.x, p.z, 2113, 3915), true);
}

console.log('\n== and walking away still gives it up');
{
    const p = player('hometelewalk', START[0], START[1]);
    H.setVar(p, 'home_teleport_last', 0);
    H.ifButton(p, 'magic:home_teleport');
    H.tick(4);
    H.walkTo(p, START[0] + 4, START[1]);
    H.tick(30);
    check('still in Falador', Math.abs(p.x - START[0]) <= 6 && Math.abs(p.z - START[1]) <= 6, true);
    check('and the wait was not spent', H.getVar(p, 'home_teleport_last'), 0);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
