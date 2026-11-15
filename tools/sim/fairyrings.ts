// The fairy ring network, driven through the real triggers: the locs, the dial, the gate.
//
// WHY A SIM AND NOT A LOOK AT THE CACHE. Every part of this feature is the kind that reads
// correct and behaves wrong. A loc can be named and still not clickable; a dial can turn and
// store the wrong letter; a code table can be right and the teleport land a tile inside a wall.
// So nothing here inspects a config: it clicks the ring, presses the arrows the way a player
// would, reads the letters off the panel the server actually sent, and asks where the player
// ended up.
//
// THE CASE THAT MATTERS MOST is the gate, and it is checked twice on purpose. A ring refuses
// without Fairytale Part I - but [if_button] is reachable by anything that can send a component
// id, so the ENTER button checks the quest again. A test that only clicked rings would pass a
// network any client could teleport around for free.
//
// Usage: npx tsx tools/sim/fairyrings.ts
import * as H from './harness.ts';
import Component from '#/cache/config/Component.js';
import type Player from '#/engine/entity/Player.js';
import LocType from '#/cache/config/LocType.js';
import SeqType from '#/cache/config/SeqType.js';
import SpotanimType from '#/cache/config/SpotanimType.js';
import VarPlayerType from '#/cache/config/VarPlayerType.js';

const VarpId = (name: string) => {
    const id = VarPlayerType.getId(name);
    if (id === -1) throw new Error('no such varp: ' + name);
    return id;
};

await H.boot();
H.loginOrder();

let ok = 0,
    bad = 0;
const check = (what: string, got: unknown, want: unknown) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (pass) ok++;
    else bad++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${what}: ${JSON.stringify(got)}${pass ? '' : `   (want ${JSON.stringify(want)})`}`);
};

const FAIRY_COMPLETE = 100; // ^fairy_complete, quest_fairy.constant

// the rings as the map places them: loc name, centre tile, and the code that reaches it.
// Every coordinate was probed by tools/sim/ringsites.ts, never estimated - see the note in
// fairy_rings.constant about the three first drafts that were in the wrong place.
const RINGS: { loc: string; x: number; z: number; code: string; where: string; quest?: string }[] = [
    { loc: '64_fairy_mushroom_ring', x: 2412, z: 4434, code: 'BKS', where: 'Zanaris' },
    { loc: '1_fairy_mushroom_ring', x: 2319, z: 3619, code: 'AKQ', where: 'Piscatoris' },
    { loc: '6_fairy_mushroom_ring', x: 2644, z: 3495, code: 'ALS', where: "McGrubor's Wood" },
    { loc: '27_fairy_mushroom_ring', x: 3129, z: 3496, code: 'DKR', where: 'Edgeville' },
    { loc: '47_fairy_mushroom_ring', x: 2705, z: 3576, code: 'CJR', where: 'Sinclair Mansion' },
    // AIQ USED TO POINT HERE and called it Port Sarim. A flood fill reaches 40 tiles and stops:
    // it is an islet, which is what RuneScape's CLP is. AIQ is Mudskipper Point, below.
    { loc: '37_fairy_mushroom_ring', x: 3082, z: 3206, code: 'CLP', where: 'Draynor island' },
    { loc: '3_fairy_mushroom_ring', x: 2995, z: 3113, code: 'AIQ', where: 'Mudskipper Point' },
    { loc: '4_fairy_mushroom_ring', x: 2780, z: 3614, code: 'AJR', where: 'Rellekka slayer cave' },
    { loc: '7_fairy_mushroom_ring', x: 2556, z: 2924, code: 'AKS', where: 'Feldip hunter area' },
    { loc: '10_fairy_mushroom_ring', x: 2505, z: 3634, code: 'ALP', where: 'the Lighthouse' },
    { loc: '14_fairy_mushroom_ring', x: 3600, z: 3523, code: 'ALQ', where: 'the Haunted Woods' },
    { loc: '15_fairy_mushroom_ring', x: 3230, z: 3106, code: 'BIQ', where: 'the Kalphite Hive' },
    { loc: '18_fairy_mushroom_ring', x: 2596, z: 3277, code: 'BIS', where: 'Ardougne zoo' },
    { loc: '19_fairy_mushroom_ring', x: 2393, z: 3045, code: 'BKP', where: 'Chompy marsh' },
    { loc: '23_fairy_mushroom_ring', x: 3470, z: 3430, code: 'BKR', where: 'Mort Myre' },
    { loc: '24_fairy_mushroom_ring', x: 2733, z: 3353, code: 'BLR', where: "the Legends' Guild" },
    { loc: '25_fairy_mushroom_ring', x: 2511, z: 3886, code: 'CIP', where: 'Miscellania' },
    { loc: '29_fairy_mushroom_ring', x: 2521, z: 3127, code: 'CIQ', where: 'north-west of Yanille' },
    { loc: '30_fairy_mushroom_ring', x: 2797, z: 3009, code: 'CKR', where: 'south of Tai Bwo Wannai' },
    { loc: '33_fairy_mushroom_ring', x: 3447, z: 3470, code: 'CKS', where: 'Canifis' },
    { loc: '36_fairy_mushroom_ring', x: 2712, z: 2785, code: 'CLR', where: 'Ape Atoll' },
    { loc: '38_fairy_mushroom_ring', x: 3108, z: 3149, code: 'DIS', where: "the Wizards' Tower" },
    { loc: '42_fairy_mushroom_ring', x: 2970, z: 2978, code: 'DKP', where: 'the Karamja gnome glider' },
    { loc: '43_fairy_mushroom_ring', x: 2706, z: 3777, code: 'DKS', where: 'the polar hunter area' },
    { loc: '45_fairy_mushroom_ring', x: 3414, z: 3005, code: 'DLQ', where: 'north of Nardah' },
    // THREE OTHER REALMS, which the surrounding-landmark check is the only reason to trust: the
    // abyss sits beside abyss_exit_to_fire, the TzHaar one among the TzHaar, and the Fisher King's
    // on the grass outside his castle rather than in the throne room a first pass chose.
    { loc: '49_fairy_mushroom_ring', x: 3025, z: 4833, code: 'ALR', where: 'the Abyssal Area' },
    { loc: '50_fairy_mushroom_ring', x: 2440, z: 5146, code: 'BLP', where: 'the TzHaar city' },
    { loc: '52_fairy_mushroom_ring', x: 2629, z: 4677, code: 'BJR', where: "the Fisher King's realm" },
    // READ AS ABSENT TWICE, because Tirannwn does not answer to RuneScape's name for it: it is
    // here under the Regicide quest's prefix. DLS, the Myreque's cave, was found the same way.
    { loc: '53_fairy_mushroom_ring', x: 2200, z: 3120, code: 'DLR', where: 'Isafdar' },
    // THE ONE CODE WITH A GATE OF ITS OWN. DLS was built, removed because it dropped a player who
    // had never met the Myreque into their hideout, and brought back once %routequest existed to
    // gate it on. `quest` here is what the every-code loop below has to finish first, and the
    // refusal is checked separately - see the gate section at the end.
    { loc: '55_fairy_mushroom_ring', x: 3500, z: 9810, code: 'DLS', where: "the Myreque's cave", quest: 'routequest' }
];

/** In Search of the Myreque, finished: ^route_complete. */
const ROUTE_COMPLETE = 8;

// the order each dial turns in, which is NOT alphabetical
const DIALS = ['ADCB', 'ILKJ', 'PSRQ'];

const comId = (name: string) => {
    const id = Component.getId(`fairy_rings:${name}`);
    if (id === -1) throw new Error('no such component: fairy_rings:' + name);
    return id;
};
const LETTER = [comId('letter1'), comId('letter2'), comId('letter3')];
const PANEL = Component.getId('fairy_rings');

// IS THE PANEL OPEN, asked of the server rather than of the wire. if_openmain sets modalMain and
// defers IfOpenMain to the output flush, which a socketless sim player never performs - so a test
// watching for that message reads "closed" on a panel that is open, and worse, reads the same for
// a panel that correctly refused to open. modalMain cannot be wrong about it either way.
const panelOpen = (pl: Player) => pl.modalMain === PANEL;

/** Anything the server put on a text component for this player, mesboxes included. */
/**
 * The chatbox, which is NOT where textSeen looks. textSeen reads if_settext on interface
 * components - which is what ~mesbox and the dial panel use - while mes() goes to the message
 * list. DLS's refusal is a mes(), so asserting it through textSeen compared against an empty
 * string and failed for a reason that had nothing to do with the gate.
 */
const saidTo = (pl: Player) =>
    H.mesgs
        .filter(m => m.who === pl.username)
        .map(m => m.text)
        .join(' ');

const textSeen = (pl: Player) =>
    H.ifaces
        .filter(f => f.who === pl.username && f.kind === 'text' && f.text)
        .map(f => f.text!)
        .join(' ');

/** What the panel is currently showing on dial n, as the server last set it. */
function shown(p: Player, n: number): string {
    const t = [...H.ifaces].reverse().find(f => f.who === p.username && f.kind === 'text' && f.com === LETTER[n]);
    return t?.text ?? '';
}

function settle(ticks = 20) {
    for (let t = 0; t < ticks; t++) H.tick(1);
}

/** Click a ring the way a client does, and let the walk-and-run finish. */
function useRing(p: Player, ring: { loc: string; x: number; z: number }) {
    H.opLoc(p, ring.x, ring.z, ring.loc, 1);
    settle();
}

/** Turn the dials to a code by pressing the arrows, as a player must. */
function dialTo(p: Player, code: string) {
    for (let n = 0; n < 3; n++) {
        const want = DIALS[n].indexOf(code[n]);
        if (want === -1) throw new Error(`dial ${n + 1} has no letter ${code[n]}`);
        // press right until the panel reads the letter we want; four presses is a full turn, so
        // five without arriving means the dial is not wrapping and the test should say so
        let presses = 0;
        while (shown(p, n) !== code[n]) {
            H.ifButton(p, `fairy_rings:right${n + 1}`);
            // TWO TICKS, NOT TWENTY. An arrow is an [if_button] that sets three text components and
            // returns; it has nothing to walk or wait for. At settle()'s default this loop was
            // twelve presses x 20 ticks x 29 codes of doing nothing, and the sim took 319 seconds
            // against the nightly's 180 second cap - so it was killed, retried, killed again, and
            // reported as "fails twice" while passing perfectly well alone. Same trap the shard
            // runner's own comments describe for glassblowing, audit7, lunar and droprate.
            settle(2);
            if (++presses > 4) throw new Error(`dial ${n + 1} will not reach ${code[n]} (stuck on ${shown(p, n)})`);
        }
    }
}

const at = (p: Player) => `${p.x},${p.z}`;

// ---------------------------------------------------------------- the rings are really there
console.log('\nthe rings this map actually has');
for (const r of RINGS) {
    const near = H.locsNear(r.loc, r.x, r.z);
    const hit = near.find(l => l.x === r.x && l.z === r.z);
    check(`${r.where} has a ring at ${r.x},${r.z}`, hit !== undefined, true);
}

// ---------------------------------------------------------------- and they LOOK like rings
//
// THE BUG THIS EXISTS FOR, and it reached a deployed world. 377 placed five of these as loc_9158
// with minigame_start_icon edges; only the Zanaris ones were ever mushroom rings. Activating the
// five gave them a name and a click and left them on those models, so Edgeville had a fairy ring
// that teleported correctly and could not be seen. Every check in this file passed, because not
// one of them asked what the thing looked like.
//
// The hub is the reference rather than a model name written out here: whatever the ring in Zanaris
// is made of is what a fairy ring looks like in this world, and the other five have to match it.
console.log('\nand they look like the one in Zanaris');
const modelsOf = (name: string) => {
    const id = LocType.getId(name);
    if (id === -1) throw new Error('no such loc: ' + name);
    return (LocType.get(id).models ?? []).join(',');
};
for (const piece of ['', '_edge', '_corner']) {
    const want = modelsOf(`64_fairy_mushroom_ring${piece}`);
    check(`the hub's ${piece || 'centre'} has a model at all`, want.length > 0, true);
    for (const r of RINGS) {
        if (r.loc.startsWith('64_')) continue;
        check(`${r.where}'s ${piece || 'centre'} is the same model`, modelsOf(`${r.loc}${piece}`), want);
    }
}

// ---------------------------------------------------------------- every ring opens the dial
//
// ALL SIX, CLICKED, and not because six assertions are better than one. Everything else in this
// file dials from Zanaris, so deleting another ring's trigger entirely left every other check
// green: the ring was still placed, still named, and no test ever touched it. The script claims
// every ring dials; this is the only thing that holds it to that.
console.log('\nevery ring opens the dial, not just the hub');
for (const r of RINGS) {
    const u = H.makePlayer(`fr_use_${r.code.toLowerCase()}`, r.x, r.z + 2);
    H.loginOrder(u);
    H.setVarBit(u, 'fairy_farmers_quest', FAIRY_COMPLETE);
    H.clearLogs();
    useRing(u, r);
    check(`the ring at ${r.where} opens the dial`, panelOpen(u), true);
}

// ---------------------------------------------------------------- the gate
console.log('\nbefore Fairytale Part I');
const nobody = H.makePlayer('fr_locked', 2412, 4440);
H.loginOrder(nobody);
H.setVarBit(nobody, 'fairy_farmers_quest', 0);
H.clearLogs();
useRing(nobody, RINGS[0]);
check('the ring does not open the dial', panelOpen(nobody), false);
// NOT H.mesgs: ~mesbox is a chat interface with text set on it and p_pausebutton, not
// messageGame, so the words arrive as if_settext and the message log stays empty.
check('and it says something about fairies', /fairies|mushrooms/i.test(textSeen(nobody)), true);

// AND THE BUTTON DIRECTLY, which is the way round the ring: a client can send a component id
// without ever touching a mushroom.
//
// A PLAYER OF ITS OWN, and this is the whole reason the check is worth anything. Reusing `nobody`
// made it pass for the wrong reason: the ring had left it suspended in the mesbox's p_pausebutton,
// so the ENTER press never executed and the test read "did not teleport" on a press that never
// happened. Removing the gate from the button survived that version of the test.
const bypass = H.makePlayer('fr_bypass', 2412, 4440);
H.loginOrder(bypass);
H.setVarBit(bypass, 'fairy_farmers_quest', 0);
// 41 is DKR in the varp's own encoding, dial1 + dial2 * 4 + dial3 * 16. Spelled out rather than
// written as a bare number because getting this wrong is what made this very check hollow once:
// 26 looked like DKR, decoded to CKS, went nowhere, and hid a missing quest gate.
H.setVar(bypass, 'fairy_ring_dial', 1 + 2 * 4 + 2 * 16); // D K R
const bypassFrom = at(bypass);
H.ifButton(bypass, 'fairy_rings:enter_box');
settle();
check('pressing ENTER without the quest teleports nobody', at(bypass), bypassFrom);
check('...and that player is not somewhere suspended, which would make the check hollow', bypass.activeScript === null, true);

// ---------------------------------------------------------------- the encoding
//
// A GUARD, not a formality. The varp and the code table have to agree about which dial is in
// which bits; when they did not, every code still worked through the arrows and only a direct
// varp write revealed it. This pins the encoding from the outside: dial the code by hand, then
// read the varp and check it is the number the constant file claims.
console.log('\nthe varp and the code table agree');
const enc = H.makePlayer('fr_enc', 2412, 4440);
H.loginOrder(enc);
H.setVarBit(enc, 'fairy_farmers_quest', FAIRY_COMPLETE);
H.setVar(enc, 'fairy_ring_dial', 0);
H.clearLogs();
useRing(enc, RINGS[0]);
dialTo(enc, 'DKR');
check('dialling DKR by hand stores 41', enc.getVar(VarpId('fairy_ring_dial')), 1 + 2 * 4 + 2 * 16);

// ---------------------------------------------------------------- the dial
console.log('\nthe dial, turned by hand');
const p = H.makePlayer('fr_dialer', 2412, 4440);
H.loginOrder(p);
H.setVarBit(p, 'fairy_farmers_quest', FAIRY_COMPLETE);
H.setVar(p, 'fairy_ring_dial', 0);
H.clearLogs();
useRing(p, RINGS[0]);
check('the ring opens the dial once the quest is done', panelOpen(p), true);
check('and it opens reading the stored code', [shown(p, 0), shown(p, 1), shown(p, 2)], ['A', 'I', 'P']);

// one full turn of each dial, in the order a ring turns
for (let n = 0; n < 3; n++) {
    const seen: string[] = [];
    for (let i = 0; i < 5; i++) {
        seen.push(shown(p, n));
        H.ifButton(p, `fairy_rings:right${n + 1}`);
        settle();
    }
    check(`dial ${n + 1} turns ${DIALS[n]} and wraps`, seen.join(''), DIALS[n] + DIALS[n][0]);
}

// and back the other way
H.setVar(p, 'fairy_ring_dial', 0);
H.clearLogs();
useRing(p, RINGS[0]);
H.ifButton(p, 'fairy_rings:left1');
settle();
check('a left turn from A goes to B, not D', shown(p, 0), 'B');

// ---------------------------------------------------------------- every code, from every ring
console.log('\nevery code, dialled from Zanaris');
for (const r of RINGS) {
    const t = H.makePlayer(`fr_${r.code.toLowerCase()}`, 2412, 4440);
    H.loginOrder(t);
    H.setVarBit(t, 'fairy_farmers_quest', FAIRY_COMPLETE);
    // A code with its own quest needs that one finished too, or it refuses by design.
    if (r.quest) H.setVar(t, r.quest, ROUTE_COMPLETE);
    H.setVar(t, 'fairy_ring_dial', 0);
    H.clearLogs();
    useRing(t, RINGS[0]);
    dialTo(t, r.code);
    check(`${r.code} reads ${r.code} on the panel`, [shown(t, 0), shown(t, 1), shown(t, 2)].join(''), r.code);
    H.ifButton(t, 'fairy_rings:enter_box');
    settle();
    check(`${r.code} lands at ${r.where}`, at(t), `${r.x},${r.z}`);
}

// ---------------------------------------------------------------- the animation
//
// ALSO FOUND IN A DEPLOYED WORLD. anim() sets what the client plays next, so a vanish, a jump and
// an appear in one tick reach the client as nothing: only the last anim survives the tick, and by
// then the player has moved. The fix is a delay either side, and this is what holds it there.
console.log('\nand it plays the teleport rather than blinking');
const seqId = (n: string) => {
    const id = SeqType.getId(n);
    if (id === -1) throw new Error('no such seq: ' + n);
    return id;
};
const VANISH = seqId('human_fairy_vanish');
const APPEAR = seqId('human_fairy_appear');

const anim = H.makePlayer('fr_anim', 2412, 4440);
H.loginOrder(anim);
H.setVarBit(anim, 'fairy_farmers_quest', FAIRY_COMPLETE);
H.setVar(anim, 'fairy_ring_dial', 0);
H.clearLogs();
useRing(anim, RINGS[0]);
dialTo(anim, 'DKR');
H.clearLogs();
H.ifButton(anim, 'fairy_rings:enter_box');
settle();
const played = H.anims.filter(a => a.who === anim.username);
const vanish = played.find(a => a.seq === VANISH);
const appear = played.find(a => a.seq === APPEAR);
check('the vanish reaches the client', vanish !== undefined, true);
check('and so does the appear', appear !== undefined, true);
// THE ORDER AND THE GAP ARE THE WHOLE POINT. Both on one tick is the bug, not the fix.
check('the vanish comes first', vanish && appear ? vanish.tick < appear.tick : false, true);
check('...with a tick between them, so each is actually seen', vanish && appear ? appear.tick - vanish.tick >= 2 : false, true);
check('and the player still arrived', at(anim), '3129,3496');

// AND THE SPOTANIM, which is the other half of what "no animation" meant. The seq is the player
// shrinking away; without an effect beside it the whole teleport is a fade to nothing and back.
// A spotanim is a per-tick mask exactly like an anim, so the same one-tick collapse that ate the
// appear would eat this - hence the same two assertions about order and gap.
const RING_GFX = (() => {
    const id = SpotanimType.getId('fairy_flower_ring');
    if (id === -1) throw new Error('no such spotanim: fairy_flower_ring');
    return id;
})();
const sparks = H.spotanims.filter(g => g.who === anim.username && g.spotanim === RING_GFX);
check('the departure has an effect, not just a fade', sparks.length >= 1, true);
check('and so does the arrival', sparks.length >= 2, true);
// Height 0 puts it on the ground around the feet. A ring model at head height is a different
// effect entirely, and the number is the only thing in the call that says which.
check(
    '...both at ground level',
    sparks.every(g => g.height === 0),
    true
);
check('...a tick apart, so neither is swallowed', sparks.length >= 2 ? sparks[1].tick - sparks[0].tick >= 2 : false, true);

// ---------------------------------------------------------------- a code that goes nowhere
console.log('\na code with nothing at the other end');
const lost = H.makePlayer('fr_lost', 2412, 4440);
H.loginOrder(lost);
H.setVarBit(lost, 'fairy_farmers_quest', FAIRY_COMPLETE);
H.setVar(lost, 'fairy_ring_dial', 0);
H.clearLogs();
useRing(lost, RINGS[0]);
dialTo(lost, 'AIP'); // one of RuneScape's nine unused combinations, and also code 0
const stood = at(lost);
H.clearLogs();
H.ifButton(lost, 'fairy_rings:enter_box');
settle();
check('AIP does not move anybody', at(lost), stood);
check('and the ring says so', /nothing happens/i.test(saidTo(lost)), true);

// ---------------------------------------------------------------- the code is remembered
console.log('\nand the dial remembers');
const mem = H.makePlayer('fr_mem', 2412, 4440);
H.loginOrder(mem);
H.setVarBit(mem, 'fairy_farmers_quest', FAIRY_COMPLETE);
H.setVar(mem, 'fairy_ring_dial', 0);
H.clearLogs();
useRing(mem, RINGS[0]);
dialTo(mem, 'DKR');
H.clearLogs();
useRing(mem, RINGS[0]); // open it again
check('reopening shows the code last dialled', [shown(mem, 0), shown(mem, 1), shown(mem, 2)].join(''), 'DKR');

// ---------------------------------------------------------------- the old route still works
//
// TWO PLAYERS, because the ring by Fairy Nuff behaves differently either side of the quest and
// only one of those paths reaches the choice. The first version of this test used the unquested
// player alone - which takes the early branch and steps straight out - so deleting the choice
// entirely in favour of the dial went unnoticed. The quested player is the one that proves the
// swamp is still on offer once a player COULD dial instead.
console.log('\nand the swamp step that was already there');

const swamp = H.makePlayer('fr_swamp', 2452, 4476);
H.loginOrder(swamp);
H.setVarBit(swamp, 'fairy_farmers_quest', 0); // it never needed the quest
H.clearLogs();
H.opLoc(swamp, 2452, 4473, 'fairy_mushroom_ring', 1);
settle();
check('without the quest it steps straight out to the swamp', at(swamp), '3201,3169');

const both = H.makePlayer('fr_both', 2452, 4476);
H.loginOrder(both);
H.setVarBit(both, 'fairy_farmers_quest', FAIRY_COMPLETE);
H.clearLogs();
H.opLoc(both, 2452, 4473, 'fairy_mushroom_ring', 1);
settle();
check('with the quest it offers a choice instead of picking for you', both.resumeButtons.length, 2);
check('and the swamp is still the second option', H.choose(both, 'multi2:com_2'), true);
settle();
check('...which still goes to the swamp', at(both), '3201,3169');

const dialer2 = H.makePlayer('fr_both2', 2452, 4476);
H.loginOrder(dialer2);
H.setVarBit(dialer2, 'fairy_farmers_quest', FAIRY_COMPLETE);
H.clearLogs();
H.opLoc(dialer2, 2452, 4473, 'fairy_mushroom_ring', 1);
settle();
H.choose(dialer2, 'multi2:com_1');
settle();
check('and the first option opens the dial', panelOpen(dialer2), true);

// ---------------------------------------------------------------- the right-click back to Zanaris
//
// BKS is the code every player dials most, so every surface ring carries a "Zanaris" option that
// dials it for them. Two halves have to be true for that to work and neither implies the other:
// the option has to EXIST in the right-click menu (a loc op, the one thing here with no
// server-side behaviour to observe) and the trigger behind it has to go somewhere.
console.log('\nthe right-click shortcut back to Zanaris');
const ZANARIS = '2412,4434';
const opOf = (loc: string, n: number) => LocType.get(LocType.getId(loc)).op?.[n - 1] ?? null;

// The surface rings, which are RINGS minus the Zanaris one it starts with.
const SURFACE = RINGS.slice(1);
for (const r of SURFACE) {
    check(`${r.where}'s ring offers it`, opOf(r.loc, 2), 'Zanaris');
}
// AND THE RINGS IN ZANARIS DO NOT, which is the half a "does the option work" test would miss.
// All three of these stand in Zanaris already, so the option would teleport you across the room.
for (const loc of ['64_fairy_mushroom_ring', 'fairy_mushroom_ring', 'fairy_mushroom_ring3']) {
    check(`${loc} does not offer it, being in Zanaris`, opOf(loc, 2), null);
}

for (const r of SURFACE) {
    // ON the ring tile: blockwalk is off, so this is a legal stand, and it keeps five different
    // map squares' pathing out of a test that is about the trigger. The 47_ case below walks in.
    const back = H.makePlayer(`fr_z${r.code}`, r.x, r.z);
    H.loginOrder(back);
    H.setVarBit(back, 'fairy_farmers_quest', FAIRY_COMPLETE);
    H.clearLogs();
    H.opLoc(back, r.x, r.z, r.loc, 2);
    settle();
    check(`${r.where} -> Zanaris`, at(back), ZANARIS);
    // WITHOUT THE PANEL. The point of the shortcut is that it does not open one; if it did, this
    // would be the dial with extra steps and the player would still be spelling out BKS.
    check('...without opening the dial', panelOpen(back), false);
}

// THE GATE AGAIN, on the new door. The shortcut never opens the panel, so it cannot lean on the
// ENTER button's check the way the dial does - its own check is the only one standing.
const sneak = H.makePlayer('fr_zsneak', 3129, 3498);
H.loginOrder(sneak);
H.setVarBit(sneak, 'fairy_farmers_quest', 0);
H.clearLogs();
H.opLoc(sneak, 3129, 3496, '27_fairy_mushroom_ring', 2);
settle();
// They DO walk up to the ring - p_walk runs before the gate, as it does on a left click - so the
// thing to assert is that they are refused, not that they never moved. Asserting the tile they
// stop on would be asserting the pathfinder.
check('without the quest the shortcut refuses', at(sneak) === ZANARIS, false);
check('...and they are still standing in Edgeville', sneak.x > 3000 && sneak.z < 4000, true);
check('...and the ring says so', textSeen(sneak).includes('mushrooms are pretty'), true);

// AND IT IS THE SAME TELEPORT, not a bare telejump: the shortcut routes through
// fairy_ring_travel, so it gets the animation and the spotanim the dial does.
const zanim = H.makePlayer('fr_zanim', 2705, 3578);
H.loginOrder(zanim);
H.setVarBit(zanim, 'fairy_farmers_quest', FAIRY_COMPLETE);
H.clearLogs();
H.opLoc(zanim, 2705, 3576, '47_fairy_mushroom_ring', 2);
settle();
check(
    'the shortcut animates too',
    H.anims.some(a => a.who === zanim.username && a.seq === VANISH),
    true
);
check('...and sparkles', H.spotanims.filter(g => g.who === zanim.username && g.spotanim === RING_GFX).length >= 2, true);

// ---------------------------------------------------------------- DLS has a second gate
//
// WHY THIS IS ITS OWN SECTION. Every other code in the network is gated on Fairytale Part I and
// nothing else. DLS lands two tiles from the Myreque's hideout door, and with only that gate it
// let a player who had never met them walk straight in - which is why it was built, removed, and
// only brought back once %routequest existed to check. A sim that dialled DLS with every quest
// finished would prove the ring works and say nothing about the thing that got it deleted.
//
// The refusal must also be the SAME LINE an unused code gets, so the ring cannot be used to
// discover that DLS leads anywhere at all.
console.log('\nand DLS refuses without In Search of the Myreque');
const MYREQUE = RINGS.find(r => r.code === 'DLS')!;
const NOWHERE = 'The ring hums for a moment, and settles. Nothing happens.';
{
    const ungated = H.makePlayer('fr_dls_no', 2412, 4440);
    H.loginOrder(ungated);
    H.setVarBit(ungated, 'fairy_farmers_quest', FAIRY_COMPLETE);
    H.setVar(ungated, 'routequest', 0);
    H.setVar(ungated, 'fairy_ring_dial', 0);
    H.clearLogs();
    useRing(ungated, RINGS[0]);
    dialTo(ungated, 'DLS');
    H.ifButton(ungated, 'fairy_rings:enter_box');
    settle();
    check('the player is still in Zanaris', at(ungated) === `${MYREQUE.x},${MYREQUE.z}`, false);
    check('...and nowhere near the hideout', ungated.z < 9000, true);
    check('...and the ring gives nothing away', saidTo(ungated).includes(NOWHERE), true);
}
{
    // ...and with the quest finished it is an ordinary code again.
    const done = H.makePlayer('fr_dls_yes', 2412, 4440);
    H.loginOrder(done);
    H.setVarBit(done, 'fairy_farmers_quest', FAIRY_COMPLETE);
    H.setVar(done, 'routequest', ROUTE_COMPLETE);
    H.setVar(done, 'fairy_ring_dial', 0);
    H.clearLogs();
    useRing(done, RINGS[0]);
    dialTo(done, 'DLS');
    H.ifButton(done, 'fairy_rings:enter_box');
    settle();
    check('with the quest it lands at the cave', at(done), `${MYREQUE.x},${MYREQUE.z}`);
    check('...and does not print the refusal', saidTo(done).includes(NOWHERE), false);
}

console.log(`\n${ok} ok, ${bad} failed`);
process.exit(bad > 0 ? 1 : 0);
