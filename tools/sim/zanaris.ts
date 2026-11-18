// ZANARIS TALKS BACK: the forty-two fairies, the poet sheep, the cow that will not admit it can
// talk, and the four Gate Keepers who want a diamond.
//
// Fifty-four npcs in one city offered Talk-to with nothing behind it - the largest single pocket of
// unanswered dialogue in the game - and the two magic doors into the market opened for free when
// they should cost a cut diamond. All of it is in the Old School transcripts verbatim.
//
// WHAT IS WORTH TESTING, in order of what would actually break:
//   1. The gate takes exactly one diamond, takes it only from somebody on the OUTSIDE, and does
//      not open when it is refused. Getting the side wrong charges people on the way out, and
//      getting the open wrong seals the market again - which is the bug the doors were wired up to
//      fix in the first place.
//   2. The cow's heckle leaves the sheep as the active npc. The heckle is `~chatnpc_specific`
//      beside a `.npc_find`, and the undotted `npc_find` rebinds the active npc, which would put
//      the sheep's last four lines in the cow's mouth under the cow's chathead.
//   3. The random branches all come up and none of them falls through to silence.
import * as H from './harness.ts';
import { check, R, player, drive, useOnNpc } from './a1lib.ts';
import LocType from '#/cache/config/LocType.js';
import NpcType from '#/cache/config/NpcType.js';
import Npc from '#/engine/entity/Npc.js';
import Player from '#/engine/entity/Player.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import World from '#/engine/World.js';

await H.boot();

/**
 * Everything the player was shown since a mark: interface text AND chatbox messages.
 *
 * BOTH, because the dialogue uses both and half the checks here were reading an empty half. The
 * poems and the Gate Keeper's lines are if_settext on a chat component; "You give the doorman a
 * diamond." and "This sheep has already been shorn." are mes(), which never touches an interface.
 *
 * A chathead's NAME is a line of its own and comes immediately before that speaker's text, which
 * is what the cow-heckle check below reads to tell who is talking.
 */
type Mark = { iface: number; mes: number };
const mark = (): Mark => ({ iface: H.ifaces.length, mes: H.mesgs.length });
function lines(p: Player, from: Mark): string[] {
    return [
        ...H.ifaces
            .slice(from.iface)
            .filter(i => i.who === p.username && i.kind === 'text' && i.text)
            .map(i => i.text!),
        ...H.mesgs.slice(from.mes).filter(m => m.who === p.username).map(m => m.text)
    ];
}

/**
 * Did the player see this sentence?
 *
 * JOINED, not per line, and this is the trap that made eleven of these checks lie. ~chatnpc runs
 * the string through split_init($string, 380, 4, q8_full), which WRAPS it at 380 pixels into up to
 * four component texts - so "You may not pass through this door without paying the trading tax."
 * arrives as two or three separate lines and no single one of them contains the sentence. The first
 * run of this sim reported the Gate Keeper silent, the cow silent and four of the seven fairy lines
 * missing, all of them working perfectly.
 */
const said = (out: string[], s: string) => out.join(' ').includes(s);

function talkTo(p: Player, npc: Npc, picks: (number | string)[] = []): string[] {
    const from = mark();
    if (!H.standBeside(p, npc)) {
        throw new Error(`nowhere to stand beside ${npc.x},${npc.z},${npc.level}`);
    }
    H.opNpc(p, npc, 1);
    for (let t = 0; t < 10 && !p.activeScript; t++) {
        H.tick(1);
    }
    drive(p, picks);
    return lines(p, from);
}

function must(name: string, x: number, z: number, level = 0): Npc {
    const npc = H.npcNear(name, x, z, level);
    if (!npc) {
        throw new Error(`no ${name} is placed near ${x},${z},${level}`);
    }
    return npc;
}

function placed(name: string): number {
    const id = NpcType.getId(name);
    let n = 0;
    for (const npc of World.npcs) {
        if (npc && npc.type === id) {
            n++;
        }
    }
    return n;
}

// =============================================================================== the fairies

console.log('THE FORTY-TWO FAIRIES');
{
    check('  fairy has a Talk-to script', !!ScriptProvider.getByName('[opnpc1,fairy]'), true);
    check('  and the map places forty-two', placed('fairy'), 42);
    const p = player('zan_fairy', 2372, 4449);
    // The seven openers, verbatim from Transcript:Fairy - each the first line of its branch.
    const OPENERS = [
        'Have you got any idea where Burthorpe is?',
        'Be careful when you pick mushrooms near the strange ruins',
        'Do you have any idea what a Winter Fairy actually does?',
        "Sorry, I can't talk I'm looking for Sarah-Jane!",
        'Is your name Freddie, and are you loosing your teeth?',
        "I've just been told to get ready to go to Etceteria",
        'Picking mushrooms near the forge will probably end quite badly'
    ];
    const hit = new Set<number>();
    let silent = 0;
    for (let i = 0; i < 90; i++) {
        const out = talkTo(p, must('fairy', 2372, 4449));
        const idx = OPENERS.findIndex(o => said(out, o));
        if (idx === -1) {
            silent++;
        } else {
            hit.add(idx);
        }
        // The two-handers: a player line in the middle, and the fairy answering it afterwards.
        if (idx === 2) {
            check('    the Winter Fairy branch runs to its end', said(out, "Neither do I, but I'm supposed to be one this week"), true);
        }
        if (idx === 4) {
            check('    the Freddie branch runs to its end', said(out, 'The co-ordinator has sent me to find him'), true);
        }
    }
    check('  no conversation came up empty', silent, 0);
    check('  and all seven lines come up', hit.size, 7);
}

// ================================================================================= the sheep

console.log('\nTHE SHEEP IS A POET');
{
    const POEMS = ['Twinkle, twinkle little egg', "T'was brillig and the slithey toathes", 'I wish I was a cow', 'How goes it, blade of grass?'];
    check('  fairy_sheep has a Talk-to script', !!ScriptProvider.getByName('[opnpc1,fairy_sheep]'), true);
    check('  and the map places five', placed('fairy_sheep'), 5);
    const p = player('zan_sheep', 2408, 4459);

    const no = talkTo(p, must('fairy_sheep', 2408, 4459), ['No thanks']);
    check('  it offers its latest poem', said(no, "I've just finished composing my latest poem"), true);
    check('  and takes a refusal badly', said(no, 'You humans have absolutely no understanding of art!'), true);
    check('  reciting nothing', POEMS.some(q => said(no, q)), false);

    const hit = new Set<number>();
    let heckled = 0;
    let silent = 0;
    for (let i = 0; i < 50; i++) {
        const out = talkTo(p, must('fairy_sheep', 2408, 4459), ['Yes, please']);
        const idx = POEMS.findIndex(q => said(out, q));
        if (idx === -1) {
            silent++;
            continue;
        }
        hit.add(idx);
        if (said(out, 'Do I look like I care?')) {
            heckled++;
            // THE REGRESSION GUARD. `Cow` speaks the heckle through chatnpc_specific; the sheep's
            // four lines after it come from the active npc. If .npc_find were npc_find, the active
            // npc would now be the cow and this label would read Cow.
            const at = out.indexOf('Do I look like I care?');
            check('    and the sheep is still the one speaking after it', out.slice(0, at).reverse().find(l => l === 'Sheep' || l === 'Cow'), 'Sheep');
        }
        if (said(out, "Hahaha, I don't think!")) {
            heckled++;
            check('    the sheep gets the last word on that one too', said(out, 'Well I thought it was funny'), true);
        }
    }
    check('  every acceptance got a poem', silent, 0);
    check('  and all four poems come up', hit.size, 4);
    check('  the cow heckles some of them', heckled > 3, true);
}

console.log('\nSHEARING IT');
{
    const p = player('zan_shear', 2408, 4459);
    H.give(p, 'shears', 1);
    let wool = 0;
    let escaped = 0;
    let refused = 0;
    for (let i = 0; i < 40; i++) {
        // npcNear rather than a1lib's findNpc: a sheared sheep is a different npc type for 100
        // ticks, so some rounds have nothing left to shear and must be skipped rather than thrown.
        const npc = H.npcNear('fairy_sheep', 2408, 4459);
        if (!npc) {
            H.tick(20);
            continue;
        }
        H.standBeside(p, npc);
        const before = H.invCount(p, 'wool');
        useOnNpc(p, 'fairy_sheep', 'shears');
        if (H.invCount(p, 'wool') > before) {
            wool++;
        } else {
            escaped++;
        }
        H.tick(5);
    }
    console.log(`    ${wool} sheared, ${escaped} got away`);
    check('  shearing works', wool > 0, true);
    // random(4) = 0, the same roll the ordinary sheep uses - and the only one the wiki states
    // outright: "there is a 25% chance to fail when shearing these sheep".
    check('  and some get away, as the wiki says a quarter of them do', escaped > 0, true);
    check('  a shorn one will not perform', !!ScriptProvider.getByName('[opnpc1,fairy_sheepsheered]'), true);

    // Shears on an already-shorn one says so rather than falling through to the default message.
    const shorn = H.npcNear('fairy_sheepsheered', 2408, 4459);
    if (shorn) {
        H.standBeside(p, shorn);
        const from = mark();
        useOnNpc(p, 'fairy_sheepsheered', 'shears');
        if (lines(p, from).some(l => l.includes('already been shorn'))) {
            refused++;
        }
        check('  and shearing it twice says so', refused, 1);
    }
}

// =================================================================================== the cow

console.log('\nTHE COW IS NOT TALKING TO YOU');
{
    check('  fairy_cow has a Talk-to script', !!ScriptProvider.getByName('[opnpc1,fairy_cow]'), true);
    const p = player('zan_cow', 2437, 4444);
    const out = talkTo(p, must('fairy_cow', 2437, 4444));
    check('  it wonders aloud whether to ignore you', said(out, "Is it aware that cows can't talk I wonder?"), true);
    check('  and then does', said(out, 'The cow is studiously ignoring you.'), true);
}

// ========================================================================== the market gate

console.log('\nTHE GATE KEEPERS');
{
    check('  fairy_mindslayer has a Talk-to script', !!ScriptProvider.getByName('[opnpc1,fairy_mindslayer]'), true);
    check('  and the map places four', placed('fairy_mindslayer'), 4);
    const p = player('zan_gk', 2463, 4435);
    const out = talkTo(p, must('fairy_mindslayer', 2463, 4435));
    check('  he took the job from his father', said(out, "He went into retirement, I've taken over the family business instead"), true);
    check('  and is glad not to look like him', said(out, 'I inherited my good looks from my mother'), true);
}

console.log('\nTHE DOORS, AS PLACED');
{
    // The wiki's own ids for Magic door (Zanaris): 12045 left closed, 12047 right closed, both
    // released 27 February 2006 with A Fairy Tale Part I. Our cache agrees, and so does the map.
    check('  left closed is 12045', LocType.getId('fairy_mushroom_gate_door_l'), 12045);
    check('  right closed is 12047', LocType.getId('fairy_mushroom_gate_door_r'), 12047);
    check('  south gate, left half', H.locAt(0, 2466, 4434, 'fairy_mushroom_gate_door_l'), true);
    check('  south gate, right half', H.locAt(0, 2465, 4434, 'fairy_mushroom_gate_door_r'), true);
    check('  east gate, left half', H.locAt(0, 2469, 4438, 'fairy_mushroom_gate_door_l'), true);
    check('  east gate, right half', H.locAt(0, 2469, 4437, 'fairy_mushroom_gate_door_r'), true);
}

/**
 * Click a gate door from a given tile, driving whatever menu comes up.
 *
 * A MENU THAT DOES NOT MATCH IS A FAILING CHECK, NOT A STACK TRACE. drive() throws both ways -
 * "unexpected menu" when it was given no pick and one appeared, "menus not reached" when it was
 * given one and none did - and both are exactly the mistakes this section exists to catch: a gate
 * that charges people on the way out, and a gate that has quietly gone free again. Letting them
 * arrive as exceptions aborted the run halfway and buried the reason in a stack.
 */
function clickDoor(p: Player, x: number, z: number, name: string, standX: number, standZ: number, picks: (number | string)[] = [], label = 'the gate put up the menu this step expects'): string[] {
    p.teleport(standX, standZ, 0);
    H.tick(1);
    const from = mark();
    H.opLoc(p, x, z, name, 1);
    for (let t = 0; t < 10 && !p.activeScript; t++) {
        H.tick(1);
    }
    try {
        drive(p, picks);
    } catch (e) {
        check(`  ${label}`, String(e).replace(/^Error: /, ''), picks.length ? 'the trading-tax menu' : 'no menu at all');
    }
    H.tick(2);
    return lines(p, from);
}

console.log('\nONE CUT DIAMOND, FROM OUTSIDE ONLY');
{
    const p = player('zan_tax', 2466, 4436);

    // ---- outside, no diamond
    let out = clickDoor(p, 2466, 4434, 'fairy_mushroom_gate_door_l', 2466, 4434, ['Okay']);
    check('  he asks for the trading tax', said(out, 'You may not pass through this door without paying the trading tax'), true);
    check('  one diamond', said(out, 'The cost is one diamond'), true);
    check('  and refuses an empty pocket', said(out, 'No tax, no entry.'), true);
    check('  the door stays shut', H.locAt(0, 2466, 4434, 'fairy_mushroom_gate_door_l'), true);

    // ---- outside, with a diamond
    H.give(p, 'diamond', 2);
    out = clickDoor(p, 2466, 4434, 'fairy_mushroom_gate_door_l', 2466, 4434, ['Okay']);
    check('  a diamond buys the way in', said(out, 'You give the doorman a diamond.'), true);
    check('  exactly one of them', H.invCount(p, 'diamond'), 1);
    check('  and the door opens', H.locAt(0, 2466, 4434, 'fairy_mushroom_gate_door_l'), false);
    H.tick(505); // the framework's own 500-tick revert

    // ---- inside, leaving
    check('  the gate is shut again', H.locAt(0, 2466, 4434, 'fairy_mushroom_gate_door_l'), true);
    out = clickDoor(p, 2466, 4434, 'fairy_mushroom_gate_door_l', 2466, 4433, [], 'the south gate asks nothing of a player on the way out');
    check('  leaving is free - nobody is asked for anything', said(out, 'trading tax'), false);
    check('  no diamond is taken on the way out', H.invCount(p, 'diamond'), 1);
    check('  and the door opens anyway', H.locAt(0, 2466, 4434, 'fairy_mushroom_gate_door_l'), false);
    H.tick(505);

    // ---- the east gate, the other angle
    out = clickDoor(p, 2469, 4438, 'fairy_mushroom_gate_door_l', 2469, 4438, ['Okay']);
    check('  the east gate charges from the west side too', said(out, 'You give the doorman a diamond.'), true);
    check('  taking the last diamond', H.invCount(p, 'diamond'), 0);
    H.tick(505);
    out = clickDoor(p, 2469, 4438, 'fairy_mushroom_gate_door_l', 2470, 4438, [], 'the east gate asks nothing of a player on the way out');
    check('  and lets a penniless player back out of it', said(out, 'trading tax'), false);
    H.tick(505);
}

console.log('\nTHE OTHER THREE ANSWERS');
{
    const p = player('zan_ask', 2466, 4436);
    let out = clickDoor(p, 2466, 4434, 'fairy_mushroom_gate_door_l', 2466, 4434, ['Are you crazy']);
    check('  "are you crazy" gets the rules', said(out, 'Not at all. Those are the rules.'), true);
    check('  and no entry', H.locAt(0, 2466, 4434, 'fairy_mushroom_gate_door_l'), true);

    out = clickDoor(p, 2466, 4434, 'fairy_mushroom_gate_door_l', 2466, 4434, ["I haven't brought my diamonds"]);
    check('  saying so up front gets the same refusal', said(out, 'No tax, no entry.'), true);

    out = clickDoor(p, 2466, 4434, 'fairy_mushroom_gate_door_l', 2466, 4434, ['What do you do with all the diamonds']);
    check('  and asking why gets fairylights', said(out, 'Ever heard of fairylights?'), true);
    check('  spun by a spider', said(out, 'we get a spider to spin'), true);
    check('  which still does not open the door', H.locAt(0, 2466, 4434, 'fairy_mushroom_gate_door_l'), true);
}

console.log(`\n${R.ok} ok, ${R.bad} failed`);
process.exit(R.bad ? 1 : 0);
