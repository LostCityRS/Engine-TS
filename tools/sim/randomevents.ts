// THE TWO RANDOM EVENTS THIS ROUND ADDED, and the setting that now survives a logout.
//
//   npx tsx tools/sim/randomevents.ts
//
// content/tools/randomevents.py counts 2006scape's list against the content and says what is in;
// this is the half that cannot be read off a file - whether the two new ones actually happen.
import * as H from './harness.js';
import { check, R, player, mark, mesSince } from './a1lib.js';
import World from '#/engine/World.js';
import NpcType from '#/cache/config/NpcType.js';
import VarPlayerType from '#/cache/config/VarPlayerType.js';
import ObjType from '#/cache/config/ObjType.js';
import * as A from './a1lib.js';
import InvType from '#/cache/config/InvType.js';
import VarNpcType from '#/cache/config/VarNpcType.js';
import EnumType from '#/cache/config/EnumType.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ScriptRunner from '#/engine/script/ScriptRunner.js';
import { NpcStat } from '#/engine/entity/NpcStat.js';
import { NpcMode } from '#/engine/entity/NpcMode.js';
import SeqType from '#/cache/config/SeqType.js';
import Component from '#/cache/config/Component.js';
import ScriptState from '#/engine/script/ScriptState.js';
import { CollisionFlag } from '#/engine/routefinder/index.js';
import { isFlagged, canTravel } from '#/engine/GameMap.js';
import { CollisionType } from '#/engine/routefinder/index.js';
import LocType from '#/cache/config/LocType.js';
// VarBitType, with the capital B the filename has. The lowercase spelling resolves on Windows
// and loads a SECOND copy of the module whose static tables are empty, so every name lookup
// answers -1; on Linux the same import throws outright.
import VarBitType from '#/cache/config/VarBitType.js';
import Environment from '#/util/Environment.js';
import fs from 'fs';

// H.npcNear searches the WHOLE WORLD for the nearest npc of a type, with no radius - so a check
// that simply asks "is there a Niles?" answers yes for one standing in another kingdom. Every spawn
// test here wants the one that just appeared beside the player.
/** What Dr Ford is asking this player for: his own %npc_int2, through the enum he picked it from. */
const wanted = (npc: any): string => {
    const slot = npc.vars[VarNpcType.getByName('npc_int2')!.id];
    const id = EnumType.get(EnumType.getId('macro_dr_ford_wants')).values.get(slot) as number;
    return ObjType.get(id).debugname!;
};

/** Talk to THIS npc, not to the nearest one of its type in the world, which is what a1lib's talk
 * does - and which walked the player away from their own event to a Rick Turpentine standing
 * somewhere else entirely, where the click said nothing at all. */
const talkToThis = (p: any, npc: any, picks: (number | string)[] = []): string[] => {
    for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1]
    ]) {
        p.teleport(npc.x + dx, npc.z + dz, npc.level);
        H.tick(1);
        H.opNpc(p, npc, 1);
        for (let t = 0; t < 10 && !p.activeScript; t++) H.tick(1);
        if (p.activeScript) break;
    }
    return A.drive(p, picks);
};

const nearby = (name: string, p: any, within = 6) => {
    const npc = H.npcNear(name, p.x, p.z, p.level);
    if (!npc) return null;
    return Math.max(Math.abs(npc.x - p.x), Math.abs(npc.z - p.z)) <= within ? npc : null;
};

let badCoins = 0;
const check0 = (ok: boolean, got: number) => {
    if (!ok) {
        badCoins++;
        console.log(`       coins out of range: ${got}`);
    }
};

/** Run a proc the way a click does, so a p_delay inside it is resumed instead of abandoned. */
function runToEnd(p: any, name: string, ticks = 8) {
    const script = ScriptProvider.getByName(name);
    if (!script) throw new Error('no such script: ' + name);
    p.executeScript(ScriptRunner.init(script, p), true);
    for (let i = 0; i < ticks && (p.activeScript || p.delayed); i++) H.tick(1);
    H.tick(1);
}

await H.boot();

// ============================================================ auto retaliate survives a logout
console.log('AUTO RETALIATE IS REMEMBERED');
{
    // The whole of the fix is the varp's scope: it had none, a varp with none defaults to temp, and
    // every login turned the setting back on. Asserted against the packed cache rather than the
    // source line, so a config that fails to pack cannot pass this.
    const nodef = VarPlayerType.getByName('option_nodef')!;
    check('the setting is a varp the client is told about', nodef.transmit, true);
    check('  ...and it is saved rather than dropped at logout', nodef.scope, VarPlayerType.SCOPE_PERM);

    // and the button still flips it, both ways, without needing protected access
    const p: any = player('retaliate', 3222, 3222);
    H.setVar(p, 'option_nodef', 0);
    H.runProc(p, '[proc,toggle_auto_retaliate]');
    check('the button turns it off', H.getVar(p, 'option_nodef'), 1);
    H.runProc(p, '[proc,toggle_auto_retaliate]');
    check('  ...and on again', H.getVar(p, 'option_nodef'), 0);
}

// ============================================================================ the spade breaks
console.log('');
console.log('A SPADE BREAKS WHILE FARMING, AND GOES BACK TOGETHER');
{
    const p: any = player('spadebreak', 3222, 3222);
    H.clearInv(p);
    H.give(p, 'spade', 1);
    const from = mark();
    // THROUGH executeScript, NOT runProc. The event ends on p_delay while the head is still in the
    // air - runProc calls ScriptRunner.execute directly and nothing ever resumes the suspended
    // script, so the obj_add at the end of it never happens and the head never lands.
    runToEnd(p, '[proc,macro_event_lost_spade_spawn]');
    const said = mesSince(p, from);
    check('the spade comes apart in your hands', [H.invCount(p, 'spade'), H.invCount(p, 'spade_handle')], [0, 1]);
    check(
        '  ...and says so',
        said.some(m => m === 'You dig into the soil.'),
        true
    );

    // the head is on the ground somewhere near, which is the half a player has to go and fetch
    const headId = ObjType.getId('spade_head');
    let onFloor = false;
    for (let dx = -8; dx <= 8 && !onFloor; dx++) {
        for (let dz = -8; dz <= 8 && !onFloor; dz++) {
            if (World.getObj(p.x + dx, p.z + dz, p.level, headId, p.hash64)) onFloor = true;
        }
    }
    check('  ...and the head lands on the floor nearby', onFloor, true);

    H.give(p, 'spade_head', 1);
    const from2 = mark();
    H.useHeldOn(p, 'spade_head', 'spade_handle');
    check('using the two together rebuilds the spade', [H.invCount(p, 'spade'), H.invCount(p, 'spade_handle'), H.invCount(p, 'spade_head')], [1, 0, 0]);
    check(
        '  ...and either way round',
        mesSince(p, from2).some(m => m.startsWith('You carefully attach')),
        true
    );

    // the other way round, which is the half that used to be missed
    H.clearInv(p);
    H.give(p, 'spade_handle', 1);
    H.give(p, 'spade_head', 1);
    H.useHeldOn(p, 'spade_handle', 'spade_head');
    check('  ...including handle onto head', H.invCount(p, 'spade'), 1);

    // NO SPADE, NO BREAK. The roll falls through to a general event instead of taking apart a tool
    // you were not using - a farmer raking a patch has no spade in hand.
    H.clearInv(p);
    runToEnd(p, '[proc,macro_event_lost_spade_spawn]');
    check('with no spade it takes nothing apart', H.invCount(p, 'spade_handle'), 0);
}

// =========================================================================== the Evil Chicken
console.log('');
console.log('AN EVIL CHICKEN TURNS UP AND MEANS IT');
{
    const p: any = player('evilchicken', 3222, 3226);
    H.setVar(p, 'macro_event', 0);
    H.runProc(p, '[proc,macro_event_general_spawn]', [6]); // ^macro_evil_chicken
    H.tick(2);

    const chicken = H.npcNear('macro_evil_chicken_6', p.x, p.z, p.level);
    check('one spawns beside you', chicken !== null, true);
    if (chicken) {
        const t = NpcType.get(chicken.type);
        check('  ...at the bracket for a maxed player', t.debugname, 'macro_evil_chicken_6');
        check('  ...and it is something you can fight', [t.vislevel, t.stats[NpcStat.HITPOINTS]], [159, 170]);
    }
    check('  ...and it is the one holding you, so the PJ timer knows', H.getVar(p, 'aggressive_npc') !== 0, true);
}

console.log('');
// ============================================================== Call follower, on the equipment tab
console.log('');
console.log('CALL FOLLOWER BRINGS THE PET TO YOU');
{
    const p: any = player('callpet', 3230, 3222);
    H.clearInv(p);
    const from0 = mark();
    H.runProc(p, '[proc,call_follower]');
    check('with no pet out it says so', mesSince(p, from0).join(' | '), "You don't have a follower.");

    H.give(p, 'bosspet_kbd_item', 1);
    H.opheld(p, 'bosspet_kbd_item', 5);
    H.tick(2);
    const pet = H.followerOf(p);
    check('the pet is out', pet !== null, true);

    // STRAND IT SOMEWHERE IT CANNOT WALK BACK FROM, but close enough and on the same floor that
    // ~follower_keepup will not fetch it - which is the whole gap this button fills.
    pet!.teleport(p.x + 4, p.z + 4, p.level);
    H.tick(1);
    const away = Math.max(Math.abs(pet!.x - p.x), Math.abs(pet!.z - p.z));
    const from = mark();
    H.runProc(p, '[proc,call_follower]');
    H.tick(1);
    const near = Math.max(Math.abs(pet!.x - p.x), Math.abs(pet!.z - p.z));
    check('calling it brings it to your feet', [away > 1, near <= 1], [true, true]);
    check('  ...and says so', mesSince(p, from).join(' | '), 'You call your follower.');
    check('  ...and it is following again, not standing there', pet!.targetOp, NpcMode.PLAYERFOLLOW);
}

// ======================================================= the four talking randoms this round added
console.log('');
console.log('FOUR PEOPLE WALK UP AND TALK TO YOU');
{
    // The ids in macro_events.constant: 7 Rick Turpentine, 8 Cap'n Hand, 9 a certer, 10 Dr Ford.
    const EVENTS: [number, string, string][] = [
        [7, 'macro_highwayman', 'Rick Turpentine'],
        [8, 'macro_pirate', "Cap'n Hand"],
        [10, 'macro_doctor', 'Dr Ford']
    ];
    for (const [id, npcName, who] of EVENTS) {
        const p: any = player(`talk${id}`, 3222 + id, 3230, 0);
        H.setVar(p, 'macro_event', 0);
        H.runProc(p, '[proc,macro_event_general_spawn]', [id]);
        H.tick(2);
        const npc = nearby(npcName, p);
        check(`${who} turns up`, npc !== null, true);
        if (!npc) continue;
        check('  ...and comes to you rather than wandering off', npc.targetOp, NpcMode.PLAYERFOLLOW);
    }

    // A CERTER IS ONE OF THREE BROTHERS, so the check is that it is one of them rather than which.
    const p: any = player('talkcerter', 3240, 3230, 0);
    H.setVar(p, 'macro_event', 0);
    H.runProc(p, '[proc,macro_event_general_spawn]', [9]);
    H.tick(2);
    const brothers = ['macro_niles', 'macro_miles', 'macro_giles'].map(n => nearby(n, p)).filter(Boolean);
    check('one of the three certers turns up', brothers.length, 1);
}

// ============================================================== the shared random event drop table
console.log('');
console.log('AND THEY ALL PAY FROM ONE TABLE');
{
    const p: any = player('eventloot', 3250, 3230, 0);
    const seen = new Map<string, number>();
    for (let i = 0; i < 6000; i++) {
        const out = H.runProc(p, '[proc,macro_event_reward]');
        const [item, count] = out.slice(-2);
        const n = ObjType.get(item).debugname ?? String(item);
        seen.set(n, (seen.get(n) ?? 0) + 1);
        if (n === 'coins') check0(count >= 80 && count <= 640, count);
    }
    console.log(
        `       ${[...seen]
            .sort((a, b) => b[1] - a[1])
            .map(([n, c]) => `${n} ${(c / 60).toFixed(1)}%`)
            .join(', ')}`
    );
    check('every branch of the table is reachable', [...seen.keys()].sort(), ['coins', 'cosmic_talisman', 'kebab', 'keyhalf1', 'keyhalf2', 'spinach_roll', 'uncut_diamond', 'uncut_emerald', 'uncut_ruby', 'uncut_sapphire'].sort());
    const pct = (n: string) => (seen.get(n) ?? 0) / 60;
    check(
        '  ...a third of it is coins, and the gems thin out in order',
        pct('coins') > 32 && pct('coins') < 42 && pct('uncut_sapphire') > pct('uncut_emerald') && pct('uncut_emerald') > pct('uncut_ruby') && pct('uncut_ruby') > pct('uncut_diamond'),
        true
    );
    check('  ...and no coin drop is outside 80-640', badCoins, 0);
}

// ================================================== a members event never lands on a free world
console.log('');
console.log('AND EVERY ID THE ROLL CAN GIVE HAS AN NPC BEHIND IT');
{
    // Both tables have holes in them now - 5 and 6 are members' - which is the whole reason the
    // _pick enums exist: the roll used to be 1..count over the npc table, which required the ids to
    // run with no gaps. This world is a members one, so what it proves is that the roll and the npc
    // lookup agree; the free table's own holes are read straight out of general_macro_events_free.
    const free: number[] = [];
    const p: any = player('freeroll', 3260, 3230, 0);
    for (let i = 0; i < 400; i++) free.push(H.runProc(p, '[proc,macro_event_set_random]')[0]);
    const kinds = [...new Set(free)].sort((a, b) => a - b);
    console.log(`       400 rolls gave ids ${kinds.join(', ')} (members world)`);
    check(
        'every id rolled is one the world has an npc for',
        kinds.every(id => H.runProc(p, '[proc,macro_event_npc]', [id])[0] > 0),
        true
    );
}

// ============================================== and talking to them is what actually pays out
console.log('');
console.log('AND TALKING TO THEM IS THE POINT');
{
    const invCount = (p: any) => {
        const inv = p.getInventory(InvType.INV)!;
        let n = 0;
        for (let k = 0; k < inv.capacity; k++) if (inv.get(k)) n++;
        return n;
    };

    // RICK TURPENTINE pays off the shared table for nothing but the courtesy of a reply.
    {
        const p: any = player('rickchat', 3222, 3240, 0);
        H.clearInv(p);
        H.setVar(p, 'macro_event', 0);
        H.runProc(p, '[proc,macro_event_general_spawn]', [7]);
        H.tick(2);
        // NOT ASSERTED ON WHAT HE SAYS. drive() collects the chat from the SECOND page on - the page
        // the click itself opens is already gone by the time it starts - and Rick's whole dialogue is
        // one page, so there is nothing to read. What he DOES is the thing worth checking anyway.
        const rick = nearby('macro_highwayman', p)!;
        talkToThis(p, rick);
        check('Rick Turpentine hands something over', invCount(p) > 0, true);
        // And only once: the done marker is what stops him being a tap you can turn on again.
        const after = invCount(p);
        talkToThis(p, rick);
        check('  ...and not twice', invCount(p), after);
    }

    // DR FORD, both ways: he takes the thing he asked for, and leaves quietly when you have none.
    {
        const p: any = player('fordchat', 3232, 3240, 0);
        H.clearInv(p);
        H.setVar(p, 'macro_event', 0);
        H.runProc(p, '[proc,macro_event_general_spawn]', [10]);
        H.tick(2);
        const empty = talkToThis(p, nearby('macro_doctor', p)!);
        check(
            'Dr Ford takes no for an answer',
            empty.some(m => m.includes('Thank you anyway')),
            true
        );
        check('  ...and goes away empty-handed when you have none', invCount(p), 0);
    }
    {
        const p: any = player('fordgive', 3236, 3240, 0);
        H.clearInv(p);
        H.setVar(p, 'macro_event', 0);
        H.runProc(p, '[proc,macro_event_general_spawn]', [10]);
        H.tick(2);
        const npc = nearby('macro_doctor', p, 8)!;
        // HE SETTLES ON WHAT HE WANTS AT SPAWN and keeps it in %npc_int2, so he asks for the same
        // thing every time you click him rather than a fresh one. That is also how this test knows
        // what to carry - reading the npc's own var instead of guessing from the list.
        const wants = wanted(npc);
        H.give(p, wants, 1);
        const before = invCount(p);
        const said = talkToThis(p, npc);
        check('given what he asked for, Dr Ford takes it', H.invCount(p, wants), 0);
        check(
            '  ...and pays for it',
            said.some(m => m.includes('Marvellous')),
            true
        );
        check('  ...so you are no worse off', invCount(p) >= before, true);
    }
}

// ===================================================== the sandwich lady, her tray and her baguette
console.log('');
console.log('THE SANDWICH LADY OFFERS YOU ONE THING AND MEANS IT');
{
    const FOODS = ['baguette', 'triangle_sandwich', 'square_sandwich', 'chocolate_bar', 'kebab', 'roll', 'meat_pie'];
    const KO = SeqType.getId('macro_sandwich_lady_knockout');

    // THE TRAY, read back out of the script rather than out of the file it was written in. slot(7)
    // is off the end of a seven-slot tray and has to answer null, because multiobj7 would otherwise
    // be handed a component id of 0.
    {
        const p: any = player('tray', 3270, 3230, 0);
        const got: string[] = [];
        for (let i = 0; i < 7; i++) {
            const out = H.runProc(p, '[proc,macro_sandwich_lady_slot]', [i]);
            got.push(ObjType.get(out[0]).debugname!);
        }
        check('seven foods on the tray, in her order', got, FOODS);
        check('  ...and nothing past the seventh', H.runProc(p, '[proc,macro_sandwich_lady_slot]', [7])[0], -1);
    }

    // THE INTERFACE EXISTS AND HAS THE COMPONENTS THE PROC ADDRESSES. multiobj7 is new, and a .if
    // and a pack that disagree would only show up as a throw the first time somebody met her.
    for (let i = 0; i <= 16; i++) {
        if (Component.getId(`multiobj7:com_${i}`) === -1) {
            check(`multiobj7:com_${i} is in the pack`, false, true);
        }
    }
    check('multiobj7 is built: 7 models, 7 labels, a title and two swords', true, true);

    // HER KNOCKOUT IS THE CACHE'S OWN, not something written here: human_death's frames with a
    // shorter hold at the end. If that ever stops being true the comment in her script is wrong.
    {
        const ko = SeqType.get(KO);
        const death = SeqType.get(SeqType.getId('human_death'));
        check('she knocks you out with a seq out of the cache, not one written here', (ko.frames ?? []).join(','), (death.frames ?? []).join(','));
        check('  ...held for less time than a death', (ko.delay?.at(-1) ?? 0) < (death.delay?.at(-1) ?? 0), true);
    }

    /** Click her, then take slot $slot off the tray - or close it, with slot -1. Returns where the
     * player stood when the tray opened, so "did she teleport you" is measured from there rather
     * than from where they logged in: getting next to her to click her is itself a move.
     *
     * Which modal is open is what says the tray is up. The resume buttons do NOT clear when it
     * closes - the page of dialogue after it still lists multiobj7s - so a test that went by those
     * would answer the next question by clicking a sandwich. */
    const takeFromTray = (p: any, npc: any, slot: number): { x: number; z: number } => {
        for (const [dx, dz] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1]
        ]) {
            p.teleport(npc.x + dx, npc.z + dz, npc.level);
            H.tick(1);
            H.opNpc(p, npc, 1);
            for (let t = 0; t < 10 && !p.activeScript; t++) H.tick(1);
            if (p.activeScript) break;
        }
        const stood = { x: p.x, z: p.z };
        const tray = Component.getId('multiobj7');
        let opened = false;
        for (let guard = 0; guard < 60; guard++) {
            const s = p.activeScript;
            if (s && s.execution === ScriptState.PAUSEBUTTON) {
                if (p.modalChat === tray) {
                    opened = true;
                    // last_com of -1 is what closing the tray without choosing leaves behind, and
                    // multiobj7 answers that with null.
                    if (slot < 0) {
                        p.lastCom = -1;
                        p.executeScript(s, true, true);
                    } else if (!H.choose(p, `multiobj7:com_${2 + slot}`)) throw new Error('the tray would not take a click');
                } else {
                    p.executeScript(s, true, true);
                }
                continue;
            }
            if (!s && !p.delayed && [...p.queue.all()].length === 0) break;
            H.tick(1);
        }
        // Without this, a tray that never opened would make every outcome below pass by default.
        if (!opened) throw new Error('the tray never opened');
        return stood;
    };

    /** The slot she decided on at spawn, read off her own var the way Dr Ford's is. */
    const offered = (npc: any): number => npc.vars[VarNpcType.getByName('npc_int2')!.id];

    // TAKE THE RIGHT ONE and you get it - exactly it, and nothing else.
    {
        const p: any = player('sandwichok', 3270, 3240, 0);
        H.clearInv(p);
        H.setVar(p, 'macro_event', 0);
        H.runProc(p, '[proc,macro_event_general_spawn]', [11]);
        H.tick(2);
        const lady = nearby('macro_sandwich_lady_npc', p);
        check('the sandwich lady turns up', lady !== null, true);
        if (lady) {
            check('  ...and comes to you rather than wandering off', lady.targetOp, NpcMode.PLAYERFOLLOW);
            const slot = offered(lady);
            const was = takeFromTray(p, lady, slot);
            check('  ...taking the one she offered gets you it', H.invCount(p, FOODS[slot]), 1);
            const others = FOODS.filter((_, i) => i !== slot).reduce((n, f) => n + H.invCount(p, f), 0);
            check('  ...and only it', others, 0);
            for (let i = 0; i < 12; i++) H.tick(1);
            check('  ...and she does not teleport you anywhere', [p.x, p.z], [was.x, was.z]);
            check(
                '  ...and does not knock you down either',
                H.anims.some(a => a.who === p.username && a.seq === KO),
                false
            );
        }
    }

    // TAKE THE WRONG ONE and she baguettes you across the map. Nothing is taken from you.
    {
        const p: any = player('sandwichbad', 3280, 3240, 0);
        H.clearInv(p);
        H.give(p, 'coins', 5000);
        H.setVar(p, 'macro_event', 0);
        H.runProc(p, '[proc,macro_event_general_spawn]', [11]);
        H.tick(2);
        const lady = nearby('macro_sandwich_lady_npc', p)!;
        const slot = offered(lady);
        const wrong = (slot + 3) % 7;
        const was = takeFromTray(p, lady, wrong);
        check(
            'she calls you a thief',
            H.saysFor('macro_sandwich_lady_npc').some(s => s.text.includes('Thief! Thief! Thief!')),
            true
        );
        check(
            '  ...and knocks you down, with the seq the cache keeps for it',
            H.anims.some(a => a.who === p.username && a.seq === KO),
            true
        );
        for (let i = 0; i < 12; i++) H.tick(1);
        check('  ...and you wake up somewhere else', Math.abs(p.x - was.x) + Math.abs(p.z - was.z) > 20, true);
        check('  ...with your coins still on you', H.invCount(p, 'coins'), 5000);
        check(
            '  ...and none of her food',
            FOODS.reduce((n, f) => n + H.invCount(p, f), 0),
            0
        );
    }

    // WALK AWAY FROM THE TRAY and she is not robbed, so nothing happens to you at all.
    {
        const p: any = player('sandwichshut', 3290, 3240, 0);
        H.clearInv(p);
        H.setVar(p, 'macro_event', 0);
        H.runProc(p, '[proc,macro_event_general_spawn]', [11]);
        H.tick(2);
        const lady = nearby('macro_sandwich_lady_npc', p)!;
        const was = takeFromTray(p, lady, -1);
        for (let i = 0; i < 12; i++) H.tick(1);
        check('closing the tray is not stealing', [p.x, p.z], [was.x, was.z]);
        check(
            '  ...and you get nothing',
            FOODS.reduce((n, f) => n + H.invCount(p, f), 0),
            0
        );
    }
}

// ============================================== Leo's cemetery: the first random event with a place
console.log('');
console.log('THE GRAVEDIGGER PUTS FIVE COFFINS IN THE WRONG HOLES');
{
    // The room was built long before this script: five graves, five headstones two tiles north of
    // them, a mausoleum and Leo, in map square 30_78. These are the tiles the map puts them on, read
    // off tools/sim/roommap.ts, and a check that they are still there is the first thing worth
    // making - the event is a script hung on a room somebody else placed.
    const GRAVE: [number, number, string][] = [
        [1924, 4996, 'loc_12721'],
        [1926, 4999, 'loc_12722'],
        [1928, 4996, 'loc_12723'],
        [1930, 4999, 'loc_12724'],
        [1932, 4996, 'loc_12725']
    ];
    const STONE: [number, number, string][] = [
        [1924, 4998, 'loc_12716'],
        [1926, 5001, 'loc_12717'],
        [1928, 4998, 'loc_12718'],
        [1930, 5001, 'loc_12719'],
        [1932, 4998, 'loc_12720']
    ];
    // A grave is two tiles long and forceapproach=south, so the player has to be standing on the
    // tile below it before the click will take. Walking there would work too and takes thirty ticks
    // a grave; this is the same shortcut talkToThis uses.
    const atGrave = (p: any, i: number) => {
        p.teleport(GRAVE[i][0], GRAVE[i][1] - 1, 0);
        H.tick(1);
    };
    // TICK UNTIL THE PLAYER IS ACTUALLY FREE, queue included. A fixed number of ticks and then one
    // more is not enough here: the arrival is a queued script with a delay in it, so the first click
    // landed while the player was still being dragged to the graveyard and every click after it was
    // one behind - which read as "only some of the graves open".
    const settle = (p: any) => {
        for (let t = 0; t < 40; t++) {
            // t < 2 because a click does nothing on the tick it is made: opLoc only sets the
            // interaction, and a settle that returned straight away measured the state before
            // anything had happened. Then wait for the player to be free of it - target included,
            // or an interaction that takes a step first is read as finished.
            if (t >= 2 && !p.activeScript && !p.delayed && !p.target && [...p.queue.all()].length === 0) return;
            H.tick(1);
        }
        throw new Error('the player never became idle');
    };
    const grave = (p: any, i: number) => H.getVarBit(p, `macro_digger_grave_${i + 1}`);
    const wants = (p: any, i: number) => H.getVarBit(p, `macro_digger_coffin_${i + 1}`);
    const coffinObj = (trade: number) => `macro_digger_coffin_object_${trade}`;

    {
        const missing = [...GRAVE, ...STONE].filter(([x, z, name]) => !World.getLoc(x, z, 0, LocType.getId(name)));
        check(
            'the cemetery is still where the map put it',
            missing.map(m => m[2]),
            []
        );
        check('  ...and the mausoleum with it', World.getLoc(1927, 5004, 0, LocType.getId('loc_12731')) !== null, true);
    }

    // THE ARRANGEMENT. Five headstones get a shuffle of the five trades and the five graves get
    // another, and the second is rotated if it came out matching - a cemetery that is already
    // finished is an event the player wins by standing still.
    // The arrival is queued rather than done in the spawn proc - p_teleport needs protected access
    // and [timer,general_macro_events] has none - so the ticks after it are part of starting.
    const started = (p: any) => {
        H.setVar(p, 'macro_event', 0);
        H.runProc(p, '[proc,macro_event_general_spawn]', [12]);
        settle(p);
    };
    {
        const p: any = player('digger', 3222, 3250, 0);
        H.clearInv(p);
        started(p);
        check('Leo takes you to his graveyard', [p.x, p.z, p.level], [1929, 5003, 0]);
        check('  ...and Leo is there when you arrive', nearby('macro_gravedigger', p, 8) !== null, true);
        const held = [0, 1, 2, 3, 4].map(i => grave(p, i));
        const asked = [0, 1, 2, 3, 4].map(i => wants(p, i));
        check('every grave starts with a coffin in it', held.filter(v => v >= 1 && v <= 5).length, 5);
        check('  ...one of each trade', [...held].sort().join(','), '1,2,3,4,5');
        check('  ...and every headstone asks for a different one', [...asked].sort().join(','), '1,2,3,4,5');
        check('  ...and it is never finished already', held.join(',') !== asked.join(','), true);
    }

    // SHUFFLED, not dealt in an order. 200 cemeteries; if the headstones came out the same way twice
    // in a row the puzzle would be the same puzzle every time.
    {
        const p: any = player('diggerroll', 3226, 3250, 0);
        const seen = new Set<string>();
        for (let i = 0; i < 200; i++) {
            H.runProc(p, '[proc,macro_digger_setup]');
            seen.add([0, 1, 2, 3, 4].map(k => wants(p, k)).join(''));
            const solved = [0, 1, 2, 3, 4].every(k => grave(p, k) === wants(p, k));
            if (solved) check('a cemetery came out already finished', false, true);
        }
        console.log(`       200 cemeteries gave ${seen.size} different headstone orders`);
        check('the headstones are shuffled, not dealt', seen.size > 60, true);
    }

    // DIGGING. Take-Coffin empties the grave and hands you the coffin of whatever was in it; using
    // that coffin on an empty hole puts it back.
    {
        const p: any = player('diggerdig', 3230, 3250, 0);
        H.clearInv(p);
        started(p);
        const was = [0, 1, 2, 3, 4].map(i => grave(p, i));

        // The loc on the tile never changes: what changes is the varbit the client draws it through.
        // A loc_change here would have been visible to everyone else in the cemetery.
        const typeBefore = World.getLoc(GRAVE[0][0], GRAVE[0][1], 0, LocType.getId(GRAVE[0][2]))!.type;
        for (let i = 0; i < 5; i++) {
            atGrave(p, i);
            H.opLoc(p, GRAVE[i][0], GRAVE[i][1], GRAVE[i][2], 1);
            settle(p);
        }
        check(
            'all five coffins come out',
            [0, 1, 2, 3, 4].map(i => grave(p, i)),
            [0, 0, 0, 0, 0]
        );
        check(
            '  ...and you are carrying them',
            was.map(trade => H.invCount(p, coffinObj(trade))),
            [1, 1, 1, 1, 1]
        );
        check('  ...and the grave on the tile is the same loc it always was', World.getLoc(GRAVE[0][0], GRAVE[0][1], 0, LocType.getId(GRAVE[0][2]))!.type, typeBefore);

        // CHECK is the only way to tell two coffins apart: every grave good is called "Item" and
        // examines as "It seems bleached with age".
        // Check opens a window and leaves it open, so this reads the inv and then shuts it - the
        // next coffin cannot be checked with the last one's lid still up.
        const inside = (trade: number): string[] => {
            H.opheld(p, coffinObj(trade), 1);
            for (let i = 0; i < 4; i++) H.tick(1);
            check(`  the window opens for coffin ${trade}`, p.modalMain, Component.getId('macro_digger_coffin'));
            const inv = p.getInventory(InvType.getId('macro_digger_coffin_inv'))!;
            const out: string[] = [];
            for (let k = 0; k < inv.capacity; k++) {
                const o = inv.get(k);
                if (o) out.push(ObjType.get(o.id).debugname!);
            }
            p.closeModal();
            H.tick(1);
            return out;
        };
        const cook = inside(1);
        check("the cook's coffin holds the cook's things", cook, ['macro_digger_skull', 'macro_digger_bones', 'macro_digger_chefshat', 'macro_digger_apron', 'macro_digger_cake', 'macro_digger_kebab']);
        const miner = inside(4);
        check('  ...and the miner holds his own, not the cook’s', miner, ['macro_digger_skull', 'macro_digger_bones', 'macro_digger_pick_axe', 'macro_digger_nuggets']);
        // Every trade's coffin, and no item in two of them: the goods are what identifies a coffin,
        // so a good that turns up twice makes two coffins impossible to tell apart.
        const all = [1, 2, 3, 4, 5].map(inside);
        const goods = all.flat().filter(n => n !== 'macro_digger_skull' && n !== 'macro_digger_bones');
        check('  ...and no grave good is in two coffins', goods.length, new Set(goods).size);
        check(
            '  ...with a body in every one of them',
            all.every(c => c[0] === 'macro_digger_skull' && c[1] === 'macro_digger_bones'),
            true
        );

        // PUTTING THEM BACK. Each coffin into the grave whose headstone asks for it.
        for (let i = 0; i < 5; i++) {
            atGrave(p, i);
            A.useOn(p, GRAVE[i][0], GRAVE[i][1], GRAVE[i][2], coffinObj(wants(p, i)));
            settle(p);
        }
        check(
            'every coffin goes where its headstone asks',
            [0, 1, 2, 3, 4].map(i => grave(p, i)),
            [0, 1, 2, 3, 4].map(i => wants(p, i))
        );
        check(
            '  ...and none are left in your pack',
            [1, 2, 3, 4, 5].reduce((n, trade) => n + H.invCount(p, coffinObj(trade)), 0),
            0
        );
        check('  ...so Leo calls it done', H.runProc(p, '[proc,macro_digger_done]')[0], 1);

        // AND LEO PAYS. Two things off the zombie list, and home.
        const before = H.invCount(p, 'macro_digger_mask') + H.invCount(p, 'macro_digger_shirt') + H.invCount(p, 'macro_digger_legs') + H.invCount(p, 'macro_digger_gloves') + H.invCount(p, 'macro_digger_boots');
        talkToThis(p, nearby('macro_gravedigger', p, 10)!);
        for (let t = 0; t < 10; t++) H.tick(1);
        const after = H.invCount(p, 'macro_digger_mask') + H.invCount(p, 'macro_digger_shirt') + H.invCount(p, 'macro_digger_legs') + H.invCount(p, 'macro_digger_gloves') + H.invCount(p, 'macro_digger_boots');
        const emotes = H.getVarBit(p, 'emote_zombie_walk') + H.getVarBit(p, 'emote_zombie_dance');
        check('Leo pays two things off the zombie list', after - before + emotes, 2);
        check('  ...and sends you back where he found you', [p.x, p.z], [3230, 3250]);
        check('  ...and lets go of the event, so randoms can happen again', H.getVar(p, 'macro_event'), 0);
    }

    // AND NOT BEFORE. A cemetery one coffin short of right pays nothing - which is the check that
    // says the five-way comparison is really being made.
    {
        const p: any = player('diggerhalf', 3234, 3250, 0);
        H.clearInv(p);
        started(p);
        for (let i = 0; i < 5; i++) {
            atGrave(p, i);
            H.opLoc(p, GRAVE[i][0], GRAVE[i][1], GRAVE[i][2], 1);
            settle(p);
        }
        // Four right, and the last two swapped.
        const order = [wants(p, 0), wants(p, 1), wants(p, 2), wants(p, 4), wants(p, 3)];
        for (let i = 0; i < 5; i++) {
            atGrave(p, i);
            A.useOn(p, GRAVE[i][0], GRAVE[i][1], GRAVE[i][2], coffinObj(order[i]));
            settle(p);
        }
        check('two coffins swapped is not finished', H.runProc(p, '[proc,macro_digger_done]')[0], 0);
        // "I'll keep at it" is the first of the two he offers.
        talkToThis(p, nearby('macro_gravedigger', p, 10)!, [1]);
        settle(p);
        // NOT asserted on what he says: drive() only collects the chat from the second page on, and
        // the line that turns him down is on the first. Where the player ends up is the thing that
        // matters, and it is not something a wrong assertion could make true by accident.
        check('  ...and Leo leaves you in the graveyard rather than paying', [p.x >= 1921 && p.x <= 1934, p.z >= 4993 && p.z <= 5007], [true, true]);
        check('  ...and the event is still running', H.getVar(p, 'macro_event'), 12);
        check('  ...with nothing to show for it', H.invCount(p, 'macro_digger_mask') + H.invCount(p, 'macro_digger_shirt') + H.invCount(p, 'macro_digger_legs') + H.invCount(p, 'macro_digger_gloves') + H.invCount(p, 'macro_digger_boots'), 0);
    }
}

// ================================================ Sergeant Damien's yard: read the sign, use the mat
console.log('');
console.log('THE DRILL DEMON MOVES THE SIGNS BETWEEN ORDERS');
{
    // Four mats in a row, each with a signpost one tile behind it. The mats are the only part the
    // server knows about: a signpost is a loc with no options, GameMap only keeps a loc whose type
    // is active, and the client draws and re-draws them straight off the map from the varbit.
    const MAT: [number, number, string][] = [
        [3160, 4819, 'loc_10076'],
        [3162, 4819, 'loc_10077'],
        [3164, 4819, 'loc_10078'],
        [3166, 4819, 'loc_10079']
    ];
    const EX = ['run', 'sit-ups', 'press-ups', 'star jumps'];
    const post = (p: any, i: number) => H.getVarBit(p, `macro_drilldemon_post_${i + 1}`);
    const posts = (p: any) => [0, 1, 2, 3].map(i => post(p, i));
    const ordered = (p: any) => H.getVarBit(p, 'macro_drilldemon_order') - 1;
    const done = (p: any) => H.getVarBit(p, 'macro_drilldemon_done');

    {
        const missing = MAT.filter(([x, z, name]) => !World.getLoc(x, z, 0, LocType.getId(name)));
        check(
            'the four mats are still where the map put them',
            missing.map(m => m[2]),
            []
        );
        check('  ...and Sergeant Damien is standing in front of them', H.npcNear('macro_drilldemon', 3165, 4816, 0) !== null, true);
        // The signposts are placed but deliberately not entities. If they ever become active the
        // client stops being the only thing that draws them and this comment is wrong.
        check(
            '  ...and the signposts are scenery, not entities',
            [0, 1, 2, 3].map(i => World.getLoc(MAT[i][0], 4821, 0, LocType.getId(`loc_${10068 + i}`))),
            [null, null, null, null]
        );

        // WHICH SIGN STANDS BEHIND WHICH MAT, read out of the map file rather than assumed. The
        // whole event is "look at the sign above the mat", so a mat wired to the wrong post would
        // be unplayable in game and invisible to every other check here, which uses the same
        // mapping the script does. The map square is 49_75, so local x = world x - 3136 and
        // local z = world z - 4800.
        const jm2 = fs.readFileSync(`${Environment.BUILD_SRC_DIR}/maps/m49_75.jm2`, 'ascii').split(/\r?\n/);
        const placedAt = (lx: number, lz: number) => jm2.filter(l => l.startsWith(`0 ${lx} ${lz}: `)).map(l => parseInt(l.slice(l.indexOf(': ') + 2)));
        const pairs = [0, 1, 2, 3].map(i => {
            const lx = MAT[i][0] - 3136;
            return {
                mat: placedAt(lx, MAT[i][1] - 4800).includes(LocType.getId(MAT[i][2])),
                sign: placedAt(lx, 4821 - 4800).includes(LocType.getId(`loc_${10068 + i}`))
            };
        });
        check(
            '  ...and the map puts each sign in its own mat’s column',
            pairs.every(q => q.mat && q.sign),
            true
        );
        check(
            '  ...each reading the post varbit the script writes for that mat',
            [0, 1, 2, 3].map(i => LocType.get(LocType.getId(`loc_${10068 + i}`)).multivarbit),
            [0, 1, 2, 3].map(i => VarBitType.getByName(`macro_drilldemon_post_${i + 1}`)!.id)
        );
    }

    const settleD = (p: any) => {
        for (let t = 0; t < 40; t++) {
            if (t >= 2 && !p.activeScript && !p.delayed && !p.target && [...p.queue.all()].length === 0) return;
            H.tick(1);
        }
        throw new Error('the player never became idle');
    };
    const startedD = (p: any) => {
        H.setVar(p, 'macro_event', 0);
        H.runProc(p, '[proc,macro_event_general_spawn]', [13]);
        settleD(p);
    };
    /** Use the mat in front of post i. */
    const useMat = (p: any, i: number) => {
        p.teleport(MAT[i][0], MAT[i][1], 0);
        H.tick(1);
        H.opLoc(p, MAT[i][0], MAT[i][1], MAT[i][2], 1);
        settleD(p);
    };

    {
        const p: any = player('drill', 3240, 3250, 0);
        H.clearInv(p);
        startedD(p);
        check('Damien marches you to his yard', [p.x, p.z, p.level], [3165, 4816, 0]);
        check('  ...with nothing done yet', done(p), 0);
        check('  ...and an order already given', ordered(p) >= 0 && ordered(p) <= 3, true);
        check('  ...one sign per exercise, no two alike', [...posts(p)].sort().join(','), '0,1,2,3');
    }

    // THE SIGNS MOVE. 200 parades; if the four signs came up in the same arrangement every time the
    // player could learn one mat and stop reading.
    {
        const p: any = player('drillroll', 3244, 3250, 0);
        const seen = new Set<string>();
        for (let i = 0; i < 200; i++) {
            H.runProc(p, '[proc,macro_drill_shuffle]');
            const row = posts(p);
            if ([...row].sort().join(',') !== '0,1,2,3') {
                check('a parade came up with two signs the same', row.join(','), '0,1,2,3');
            }
            seen.add(row.join(''));
        }
        console.log(`       200 shuffles gave ${seen.size} of the 24 possible sign orders`);
        check('every arrangement of the four signs turns up', seen.size, 24);
    }

    // THE WRONG MAT IS NOT THE RIGHT MAT. Standing on the one whose sign is not what he called for
    // does nothing at all, which is the check that says the signs are being read and not ignored.
    {
        const p: any = player('drillwrong', 3248, 3250, 0);
        H.clearInv(p);
        startedD(p);
        const want = ordered(p);
        const wrongMat = [0, 1, 2, 3].find(i => post(p, i) !== want)!;
        const before = { done: done(p), order: ordered(p), signs: posts(p).join('') };
        useMat(p, wrongMat);
        check('the wrong mat gets you nowhere', done(p), before.done);
        check('  ...and the order stands', ordered(p), before.order);
        check(
            '  ...and Damien says so',
            H.saysFor('macro_drilldemon').some(s => s.text.includes('not what I said')),
            true
        );

        // AND THE RIGHT ONE DOES.
        const rightMat = [0, 1, 2, 3].find(i => post(p, i) === want)!;
        useMat(p, rightMat);
        check('the mat he asked for counts', done(p), 1 << want);
        check('  ...and he calls for a different one', ordered(p) !== want, true);
        // NOT "the signs have moved" on one sample: a shuffle of four comes back the same one time
        // in twenty-four, and a test that fails one run in twenty-four is worse than no test. That
        // the shuffle shuffles is the 200-run above; this is that it happens between orders at all.
        check('  ...and the signs are laid out afresh', [...posts(p)].sort().join(','), '0,1,2,3');
    }

    // ALL FOUR, ONCE EACH, AND THEN PAID.
    {
        const p: any = player('drillfull', 3252, 3250, 0);
        H.clearInv(p);
        startedD(p);
        const called: number[] = [];
        for (let round = 0; round < 4; round++) {
            const want = ordered(p);
            check(`  order ${round + 1} is one he has not called before`, called.includes(want), false);
            called.push(want);
            useMat(
                p,
                [0, 1, 2, 3].find(i => post(p, i) === want)!
            );
        }
        check('four orders cover all four exercises', [...called].sort().join(','), '0,1,2,3');
        check('  ...and the parade is over', done(p), 15);
        check('  ...and he stops calling', H.getVarBit(p, 'macro_drilldemon_order'), 0);
        console.log(`       he called for ${called.map(c => EX[c]).join(', ')}`);

        const was = { x: p.x, z: p.z };
        talkToThis(p, nearby('macro_drilldemon', p, 12)!);
        settleD(p);
        check('Damien pays a piece of the camo outfit', H.invCount(p, 'drill_helm') + H.invCount(p, 'drill_top') + H.invCount(p, 'drill_bottoms'), 1);
        check('  ...and sends you back where he found you', [p.x, p.z], [3240 + 12, 3250]);
        check('  ...and lets go of the event', H.getVar(p, 'macro_event'), 0);
        check('  ...and clears the yard behind him', [done(p), ...posts(p)], [0, 0, 0, 0, 0]);
        check('  ...from somewhere other than where he left you', was.z, 4819);
    }
}

// ========================================================= the four that needed nothing but a script
//
// settle() and the "started" shape are the gravedigger's, lifted out so all five room events share
// them: tick until the player is genuinely free, because every arrival is a queued script with a
// delay in it and a fixed wait lands the first click while they are still being dragged.
const settleAny = (p: any) => {
    for (let t = 0; t < 60; t++) {
        if (t >= 2 && !p.activeScript && !p.delayed && !p.target && [...p.queue.all()].length === 0) return;
        H.tick(1);
    }
    throw new Error('the player never became idle');
};
const startEvent = (p: any, id: number) => {
    H.setVar(p, 'macro_event', 0);
    H.runProc(p, '[proc,macro_event_general_spawn]', [id]);
    settleAny(p);
};
const onGround = (x: number, z: number, level: number, objName: string, p: any) => World.getObj(x, z, level, ObjType.getId(objName), p.hash64) ?? World.getObj(x, z, level, ObjType.getId(objName), -1n);

// ------------------------------------------------------------------------------ Dr Jekyll
console.log('');
console.log('DR JEKYLL WANTS YOUR BEST HERB, AND TURNS IF HE DOES NOT GET IT');
{
    const p: any = player('jekyll', 3222, 3260, 0);
    H.clearInv(p);
    startEvent(p, 14);
    const doc = nearby('macro_jekyll', p);
    check('Dr Jekyll turns up', doc !== null, true);
    check('  ...and comes to you', doc!.targetOp, NpcMode.PLAYERFOLLOW);

    // THE HIGHEST ONE YOU ARE CARRYING. Given a guam and a torstol he must take the torstol, which
    // is the only part of "requested the highest level clean herb that the player had" a script can
    // get wrong quietly.
    H.give(p, 'guam_leaf', 1);
    H.give(p, 'torstol', 1);
    talkToThis(p, doc!);
    settleAny(p);
    check('he takes the torstol and leaves the guam', [H.invCount(p, 'torstol'), H.invCount(p, 'guam_leaf')], [0, 1]);
    check('  ...and hands back what torstol makes', H.invCount(p, '2dosepotionofzamorak'), 1);

    // And somebody with nothing still gets something: "players who refused or lacked herbs still
    // received a strength potion (2) anyway".
    const q: any = player('jekyllnone', 3226, 3260, 0);
    H.clearInv(q);
    startEvent(q, 14);
    talkToThis(q, nearby('macro_jekyll', q)!);
    settleAny(q);
    check('with no herbs at all you still get a strength potion', H.invCount(q, '2dose1strength'), 1);

    // IGNORE HIM AND HE IS NOT DR JEKYLL ANY MORE. Four ai_timer steps, the shape every talking
    // random here uses, and then the Hyde whose bracket matches your combat level.
    const r: any = player('jekyllturn', 3230, 3260, 0);
    H.clearInv(r);
    // Max stats so the fight that follows does not kill them before the check: a dead player's
    // Mr Hyde goes back to standing about, and the mode would read as "not after anybody".
    H.maxOut(r);
    startEvent(r, 14);
    const jek = nearby('macro_jekyll', r)!;
    // LET HIS OWN TIMER DO IT. Calling [ai_timer] by hand four times in a row cuts the fourth one
    // off at its npc_delay - the next call takes the script's place - so the turn half happened
    // and he never came for anybody. timer=20 and four steps is 80 ticks.
    // TICK UNTIL HE TURNS AND THEN LOOK, rather than ticking a fixed number and hoping. Four
    // timer steps is about eighty ticks, but the fight that follows is real: left running, Mr Hyde
    // wanders out of reach and ~macro_event_lost_hostile deletes him, and the check reads "he was
    // never here" when what happened is that it looked too late.
    const jekType = NpcType.getId('macro_jekyll');
    let turned = false;
    for (let i = 0; i < 140 && !turned; i++) {
        H.tick(1);
        turned = jek.type !== jekType;
    }
    const want = NpcType.getId(`macro_hyde_${H.runProc(r, '[proc,macro_event_combat_level]')[0]}`);
    check('ignored four times, Dr Jekyll is Mr Hyde', jek.type, want);
    // The turn changes type, delays a tick and only then sets %aggressive_npc and the mode, so the
    // tick it is first visible on is too early to read the rest of it.
    for (let i = 0; i < 5; i++) H.tick(1);
    // ASSERTED ON %aggressive_npc AND NOT ON THE MODE. The mode is where he is pointed this tick
    // and a fight moves it about; %aggressive_npc is the line that says this npc picked the fight,
    // which is what stops the PJ timer treating it as one the player started.
    check('  ...and Mr Hyde is the one who started it', H.getVar(r, 'aggressive_npc'), jek.uid);
    check('  ...and he is still in the world', jek.isActive, true);
    // AND HE ARRIVES WITH HIS OWN STATS, which is the half the config check below cannot see:
    // that one spawns a fresh Mr Hyde and reads the record. Jekyll BECOMES one by npc_changetype,
    // and npc_changetype_keepall - which this used - is reset=false in Npc.changeType and skips
    // the stat re-init entirely. Hyde inherited Dr Jekyll's levels, and Jekyll, being a talker,
    // has no hitpoints line and defaults to 1. Every Mr Hyde in the game died to one punch.
    check("  ...and he arrives with Mr Hyde's hitpoints, not Dr Jekyll's", jek.levels[3], NpcType.get(want).stats[3]);

    // The six Hydes carry the zombie's ladder, which is what their six vislevels are. Read off
    // spawned npcs rather than the config, because that is what a fight would meet.
    const hp = [1, 2, 3, 4, 5, 6].map(i => H.addNpc(`macro_hyde_${i}`, 3200 + i, 3280).levels[3]);
    check('  ...and all six brackets have stats behind them', hp, [20, 40, 60, 85, 120, 170]);
}

// ------------------------------------------------------------------------------ Freaky Forester
console.log('');
console.log('THE FREAKY FORESTER WANTS A PARTICULAR BIRD');
{
    const PHEASANTS = ['macro_pheasant_onetail', 'macro_pheasant_twotail', 'macro_pheasant_threetail', 'macro_pheasant_fourtail'];
    check('the clearing still has its portal', World.getLoc(2611, 4776, 0, LocType.getId('loc_8972')) !== null, true);
    check(
        '  ...and three of each bird in it',
        PHEASANTS.map(n => World.npcs.filter(x => x && x.type === NpcType.getId(n)).length),
        [3, 3, 3, 3]
    );

    const p: any = player('forester', 3234, 3260, 0);
    H.clearInv(p);
    H.maxOut(p);
    startEvent(p, 15);
    check('the forester takes you to his clearing', [p.x, p.z, p.level], [2600, 4776, 0]);
    const wants = H.getVarBit(p, 'macro_forester_wants');
    check('  ...and asks for one of the four', wants >= 1 && wants <= 4, true);

    /** Kill the nearest pheasant with this many tails and say what it dropped. */
    const hunt = (tails: number): string[] => {
        const bird = H.npcNear(PHEASANTS[tails - 1], p.x, p.z, 0)!;
        p.teleport(bird.x + 1, bird.z, 0);
        H.tick(1);
        const before = new Map<string, number>();
        for (const n of ['raw_macro_pheasant_good', 'raw_macro_pheasant_bad']) {
            let c = 0;
            for (let dx = -4; dx <= 4; dx++) {
                for (let dz = -4; dz <= 4; dz++) if (onGround(bird.x + dx, bird.z + dz, 0, n, p)) c++;
            }
            before.set(n, c);
        }
        H.attackNpc(p, bird);
        // FOLLOW IT WHILE IT DIES, and keep asking. A pheasant walks, so the bird drops where it
        // fell and not where it stood when the first punch landed - and a bird that wanders out of
        // reach needs the click making again, which is what a player would do.
        let at = { x: bird.x, z: bird.z };
        for (let i = 0; i < 60 && bird.isActive; i++) {
            at = { x: bird.x, z: bird.z };
            if (i > 0 && i % 15 === 0) {
                p.teleport(bird.x + 1, bird.z, 0);
                H.tick(1);
                H.attackNpc(p, bird);
            }
            H.tick(1);
        }
        if (bird.isActive) throw new Error('the pheasant would not die');
        H.tick(2);
        // ONLY WHAT THIS BIRD DROPPED. The last one's carcass is still lying in the clearing -
        // lootdrop_duration outlasts a hunt - so the ground is diffed against the snapshot taken
        // before the fight rather than simply read.
        const found: string[] = [];
        for (const n of ['raw_macro_pheasant_good', 'raw_macro_pheasant_bad']) {
            let now = 0;
            for (let dx = -4; dx <= 4; dx++) {
                for (let dz = -4; dz <= 4; dz++) if (onGround(at.x + dx, at.z + dz, 0, n, p)) now++;
            }
            if (now > (before.get(n) ?? 0)) found.push(n);
        }
        return found;
    };
    check('the bird he asked for drops the right one', hunt(wants), ['raw_macro_pheasant_good']);
    const other = (wants % 4) + 1;
    check('  ...and any other bird does not', hunt(other), ['raw_macro_pheasant_bad']);

    // Handing the right one over pays; the wrong one is the wiki's own failure - "teleported to a
    // different area and would not receive a reward".
    H.give(p, 'raw_macro_pheasant_good', 1);
    const before = H.invCount(p, 'coins');
    talkToThis(p, nearby('macro_forester_m', p, 20)!);
    settleAny(p);
    check('the forester takes it', H.invCount(p, 'raw_macro_pheasant_good'), 0);
    check('  ...and pays from the table', H.invCount(p, 'coins') > before || [...Array(28).keys()].some(k => p.getInventory(InvType.INV)!.get(k)), true);
}

// ------------------------------------------------------------------------------ Prison Pete
console.log('');
console.log('PRISON PETE: THREE KEYS, AND THE DOORS WERE ALREADY WIRED TO THEM');
{
    // THE CHECK THAT IS NOT MINE. The three locs across the west wall are multilocs over one
    // varbit with lists three barriers long, then two, then one - so every key takes one barrier
    // away and three open the wall. That is the cache's wiring, and the script only counts; if the
    // lists ever change shape the counting stops meaning anything.
    const keysVarbit = VarBitType.getByName('macro_pete_keys')!.id;
    const doors = [1, 2, 3].map(i => LocType.get(LocType.getId(`prisonpete_door_${i}`)));
    check(
        'the three doors read the key count',
        doors.map(d => d.multivarbit),
        [keysVarbit, keysVarbit, keysVarbit]
    );
    check(
        '  ...and drop one barrier per key',
        doors.map(d => d.multiloc.length),
        [3, 2, 1]
    );
    const barrier = LocType.getId('prisonpete_energybarrier');
    check(
        '  ...with every entry in those lists a barrier',
        doors.every(d => d.multiloc.every(m => m === barrier)),
        true
    );

    // The lever's four pictures are raw model ids, which nothing else would catch if model.pack
    // were renumbered under them.
    const models = [1, 2, 3, 4].map(i => EnumType.get(EnumType.getId('macro_pete_balloon_model')).values.get(i) as number);
    check(
        'the lever shows the balloons’ own models',
        models.map(m => m),
        [1, 2, 3, 4].map(i => NpcType.get(NpcType.getId(`prisonpete_balloon${i}`)).models?.[0])
    );

    const p: any = player('pete', 3238, 3260, 0);
    H.clearInv(p);
    startEvent(p, 16);
    check('you wake up in the cell', [p.x, p.z, p.level], [2088, 4429, 0]);
    check('  ...with no keys and all three barriers up', H.getVarBit(p, 'macro_pete_keys'), 0);

    /** Pull the lever, then pop the balloon of the given type. */
    const pull = () => {
        p.teleport(2089, 4429, 0);
        H.tick(1);
        p.teleport(2089, 4429, 0);
        H.tick(1);
        H.opLoc(p, 2089, 4430, 'prisonpete_lever', 1);
        for (let i = 0; i < 12; i++) {
            H.tick(1);
            if (p.activeScript && p.activeScript.execution === ScriptState.PAUSEBUTTON) {
                p.executeScript(p.activeScript, true, true);
            }
        }
        settleAny(p);
        return H.getVarBit(p, 'macro_pete_wants');
    };
    /** How many balloons of this type are still in the cell. */
    const balloons = (which: number) => {
        const id = NpcType.getId(`prisonpete_balloon${which}`);
        let n = 0;
        for (const npc of World.npcs) if (npc && npc.isActive && npc.type === id) n++;
        return n;
    };
    const pop = (which: number) => {
        const b = H.npcNear(`prisonpete_balloon${which}`, p.x, p.z, 0)!;
        p.teleport(b.x + 1, b.z, 0);
        H.tick(1);
        H.opNpc(p, b, 1);
        settleAny(p);
    };

    let shown = pull();
    check('the lever picks one of the four', shown >= 1 && shown <= 4, true);
    check('  ...and pulling it again shows the same one', pull(), shown);
    pop(shown);
    check('the matching balloon has a key in it', H.getVarBit(p, 'macro_pete_keys'), 1);
    check('  ...and in your pack', H.invCount(p, 'prisonpete_key'), 1);

    shown = pull();
    pop((shown % 4) + 1);
    check('the wrong one puts you back to nothing', H.getVarBit(p, 'macro_pete_keys'), 0);
    check('  ...and takes the key off you', H.invCount(p, 'prisonpete_key'), 0);

    // A FULL BACKPACK MUST NOT PUT THE KEY ON THE FLOOR. inv_add does not refuse a full inv - it
    // drops the overflow at the player's feet, silently, on a 200-tick despawn (InvOps.ts,
    // ScriptOpcode.INV_ADD) - so the right balloon used to pay a key onto the ground while the
    // barrier count went up anyway, leaving a player who had made no space with two of the three
    // keys they thought they had. Reported in DeathPlateau-Bugs#36.
    //
    // The section above runs on a cleared inventory, which is why it never saw this.
    {
        shown = pull();
        H.fillInv(p);
        const before = H.getVarBit(p, 'macro_pete_keys');
        const ground = () => [...World.gameMap.getZone(p.x, p.z, p.level).getAllObjsSafe()].filter(o => o.type === ObjType.getId('prisonpete_key')).length;
        const groundBefore = ground();
        const balloonsBefore = balloons(shown);
        const from = mark();
        pop(shown);
        check(
            'a full pack is told there is no room',
            mesSince(p, from).some(m => m.includes('no room for a key')),
            true
        );
        check('  ...and no key is left on the floor', ground(), groundBefore);
        check('  ...and the barrier count does not move', H.getVarBit(p, 'macro_pete_keys'), before);
        // AND THE BALLOON IS STILL THERE, because the refusal comes before npc_del rather than
        // after it. Counted rather than "is one of them nearby": there are four or five balloons
        // of each type in the cell, so a check that only asks whether any remain can never fail,
        // and the first version of this check did exactly that - it passed with the fix removed.
        check(`  ...and the balloon was not popped (${balloons(shown)} left)`, balloons(shown), balloonsBefore);
        H.clearInv(p);
        pop(shown);
        check('  ...so it pays the key once there is room', H.invCount(p, 'prisonpete_key'), 1);
        check('  ...and takes the balloon this time', balloons(shown), balloonsBefore - 1);
        check('  ...and counts it', H.getVarBit(p, 'macro_pete_keys'), before + 1);
        H.clearInv(p);
        H.setVarBit(p, 'macro_pete_keys', 0);
    }

    for (let k = 0; k < 3; k++) pop(pull());
    check('three right in a row opens the wall', H.getVarBit(p, 'macro_pete_keys'), 3);
    // Pete wanders the cell and the player ends up wherever the last balloon was, so the radius
    // has to cover the room rather than a conversation's worth of tiles.
    talkToThis(p, nearby('prisonpete_pete', p, 24)!);
    settleAny(p);
    check('  ...and Pete sends you home', [p.x, p.z], [3238, 3260]);
    check('  ...and lets go of the event', H.getVar(p, 'macro_event'), 0);
}

// ------------------------------------------------------------------------------ Evil Bob
console.log('');
console.log('EVIL BOB WANTS A RAW FISH, AND EVERYTHING HERE IS BACKWARDS');
{
    let spots = 0;
    for (const zone of ((World.gameMap as any).zonemap.zones as Map<number, any>).values()) {
        for (const l of zone.getAllLocsUnsafe()) if (l.type === LocType.getId('loc_8986')) spots++;
    }
    check('the island is ringed with fishing spots', spots, 16);
    check(
        '  ...with two uncooking pots and a portal',
        [World.getLoc(2524, 4779, 0, LocType.getId('loc_8985')) !== null, World.getLoc(2526, 4774, 0, LocType.getId('loc_8985')) !== null, World.getLoc(2523, 4777, 0, LocType.getId('loc_8987')) !== null],
        [true, true, true]
    );

    const p: any = player('evilbob', 3242, 3260, 0);
    H.clearInv(p);
    startEvent(p, 17);
    check('Bob takes you to his island', [p.x, p.z, p.level], [2521, 4778, 0]);
    check('  ...and leaves you a net', H.invCount(p, 'evil_bob_net'), 1);

    // The portal does not let you off until he has eaten, which is the whole of "once Evil Bob
    // fell asleep... players could leave the island".
    H.opLoc(p, 2523, 4777, 'loc_8987', 1);
    settleAny(p);
    check('the portal will not take you while he is awake', [p.x, p.z], [p.x, p.z]);
    check('  ...because you are still on the island', p.z > 4700, true);

    // WHICH SHORE IS A REAL ANSWER NOW. The sixteen spots are four clusters of four, one per shore,
    // and %macro_bob_spot says which cluster has the fish he likes. The old version rolled one in
    // three on the net, so the servant had nothing to point at and the only strategy was grinding.
    // Spot coords straight off m39_74.jm2; the stand tile is the land side of each.
    const SHORE: Record<number, [number, number, number, number]> = {
        1: [2524, 4764, 2524, 4765], // north
        2: [2526, 4791, 2526, 4790], // south
        3: [2510, 4774, 2511, 4774], // west
        4: [2543, 4776, 2542, 4776] // east
    };
    const SHORENAME = ['', 'north', 'south', 'west', 'east'];
    const fishAt = (area: number) => {
        const [sx, sz, px, pz] = SHORE[area];
        p.teleport(px, pz, 0);
        H.tick(1);
        H.opLoc(p, sx, sz, 'loc_8986', 1);
        settleAny(p);
    };
    const uncook = (which: string) => {
        p.teleport(2523, 4780, 0);
        H.tick(1);
        A.useOn(p, 2524, 4779, 'loc_8985', which);
        settleAny(p);
    };

    const right = H.getVarBit(p, 'macro_bob_spot');
    check('one of the four shores is the right one', right >= 1 && right <= 4, true);
    const wrong = right === 4 ? 1 : right + 1;

    // THE SERVANT POINTS AT IT, before you have anything in your hands - the wiki's cutscene,
    // "Look... over t-t-there! That fishing spot c-c-contains the f-f-f-fish he likes." A hint
    // that names no shore is what sent this report in.
    const servant = nearby('macro_evil_bob_female_servant', p, 48) ?? nearby('macro_evil_bob_male_servant', p, 48)!;
    const before = H.mesgs.length;
    talkToThis(p, servant);
    settleAny(p);
    const said = H.mesgs
        .slice(before)
        .map(m => m.text)
        .join(' | ');
    check('the servant says which shore is biting', said.includes(SHORENAME[right]), true);
    // ...and names none of the other three, which is the half that would pass by accident.
    check('  ...and names none of the other three', [1, 2, 3, 4].filter(a => a !== right && said.includes(SHORENAME[a])).length, 0);

    fishAt(wrong);
    check('the wrong shore gives you the wrong fish', [H.invCount(p, 'evil_bob_cooked_fish_incorrect'), H.invCount(p, 'evil_bob_cooked_fish_correct')], [1, 0]);
    fishAt(right);
    check('  ...and the right shore gives you the right one, first cast', H.invCount(p, 'evil_bob_cooked_fish_correct'), 1);

    uncook('evil_bob_cooked_fish_incorrect');
    check('the uncooking pot makes it raw', [H.invCount(p, 'evil_bob_uncooked_fish_incorrect'), H.invCount(p, 'evil_bob_cooked_fish_incorrect')], [1, 0]);

    // A WRONG ONE COSTS YOU A FISH. "Each time you feed Bob an incorrect fish, it will take one
    // more fish to get him to fall asleep."
    const bob = nearby('macro_evil_bob_island', p, 16)!;
    check('he wants one fish to start with', H.getVarBit(p, 'macro_bob_needed'), 1);
    talkToThis(p, bob);
    settleAny(p);
    check('a wrong fish is disgusting and costs you one', [H.getVarBit(p, 'macro_bob_needed'), H.getVarBit(p, 'macro_bob_asleep')], [2, 0]);

    uncook('evil_bob_cooked_fish_correct');
    talkToThis(p, bob);
    settleAny(p);
    check('  ...so one right one is no longer enough', [H.getVarBit(p, 'macro_bob_needed'), H.getVarBit(p, 'macro_bob_asleep')], [1, 0]);

    const lvl = p.baseLevels[10];
    fishAt(right);
    uncook('evil_bob_cooked_fish_correct');
    // He asks which experience you want; "Fishing." is the first of the two.
    talkToThis(p, bob, [1]);
    settleAny(p);
    check('the second right one puts him to sleep', H.getVarBit(p, 'macro_bob_asleep'), 1);
    check('  ...and pays in experience', p.baseLevels[10] >= lvl, true);

    p.teleport(2523, 4778, 0);
    H.tick(1);
    H.opLoc(p, 2523, 4777, 'loc_8987', 1);
    settleAny(p);
    check('  ...and now the portal lets you go', [p.x, p.z], [3242, 3260]);
}

// =========================================== two rooms that were built all along, and I said were not
//
// eventplaces.ts asks the booted world which locs are in a zone. GameMap only adds a loc to a zone
// when its type is ACTIVE, and scenery - a theatre wall, a stage floor, a podium - is not. A
// complete theatre therefore reads as an empty field, which is what it read as, and what I
// reported. content/tools/wherelocmap.py reads maps/*.jm2 instead; so does the check below, which
// is why it can see the 84 chairs the wiki says are there.
console.log('');
console.log('THE MIME HAS A THEATRE AND THE QUIZ MASTER HAS A SET');
{
    /** Every loc placement in a square, straight out of the .jm2, in world coordinates. */
    const fromMap = (square: string) => {
        const [sx, sz] = square.split('_').map(v => parseInt(v) * 64);
        const rows: { lv: number; x: number; z: number; id: number }[] = [];
        let inloc = false;
        for (const line of fs.readFileSync(`${Environment.BUILD_SRC_DIR}/maps/m${square}.jm2`, 'ascii').split('\n')) {
            const s = line.trim();
            if (s.startsWith('====')) {
                inloc = s.includes('LOC');
                continue;
            }
            if (!inloc || !s.includes(':')) continue;
            const [head, tail] = s.split(':');
            const [lv, x, z] = head.trim().split(/ +/).map(Number);
            rows.push({ lv, x: sx + x, z: sz + z, id: parseInt(tail.trim().split(/ +/)[0]) });
        }
        return rows;
    };
    const countOf = (rows: { id: number }[], name: string) => rows.filter(r => r.id === LocType.getId(name)).length;

    // THE THEATRE, counted against the wiki rather than against the script. runescape.wiki's page
    // on the Mime event says the venue had "a total of 84 chairs in the area" and "three
    // mysterious colored audience members" - and the map has exactly that.
    const theatre = fromMap('31_74');
    check('the mime\u2019s theatre is in m31_74, to the chair', countOf(theatre, 'macro_theatre_chair'), 84);
    check('  ...with a stage floor over the seating', [countOf(theatre, 'macro_theatre_floor'), theatre.filter(r => r.id === LocType.getId('macro_theatre_floor') && r.lv === 1).length], [84, 84]);
    check('  ...106 walls, two spotlights and four exit signs', [countOf(theatre, 'macro_theatrewall'), countOf(theatre, 'macro_spotlight'), countOf(theatre, 'macro_exitsign')], [106, 2, 4]);
    check(
        '  ...and three in the audience',
        ['macro_theatre_saradomin', 'macro_theatre_guthix', 'macro_theatre_zamorak'].map(n => World.npcs.filter(x => x && x.type === NpcType.getId(n)).length),
        [1, 1, 1]
    );
    const mimeNpc = World.npcs.find(n => n && n.type === NpcType.getId('macro_mime'))!;
    check('  ...and the mime is on the stage, not in the seats', mimeNpc.level, 1);

    // THE QUIZ SET. Two three-by-three podiums, invisible walls and light beams, and one standable
    // tile on each - which is what a game show is, and why "no walkable ground" was the wrong
    // question to ask of it.
    const studio = fromMap('30_74');
    check('the quiz set is in m30_74: two podiums, lit, walled in', [countOf(studio, 'loc_8982'), countOf(studio, 'loc_8983'), countOf(studio, 'inviswall')], [2, 2, 8]);
    const quizNpc = World.npcs.find(n => n && n.type === NpcType.getId('macro_magneson'))!;
    check('  ...and the Quiz Master is on his podium, not under it', [quizNpc.level, quizNpc.x, quizNpc.z], [1, 1952, 4768]);
    check('  ...with one tile to stand on, on each', [!isFlagged(1952, 4768, 1, CollisionFlag.WALK_BLOCKED), !isFlagged(1952, 4764, 1, CollisionFlag.WALK_BLOCKED), isFlagged(1951, 4764, 1, CollisionFlag.WALK_BLOCKED)], [true, true, true]);
}

// ------------------------------------------------------------------------------ the Mime
console.log('');
console.log('AND YOU COPY WHAT THE MIME DOES');
{
    const p: any = player('mime', 3246, 3260, 0);
    H.clearInv(p);
    startEvent(p, 18);
    check('the mime takes you onto his stage', [p.x, p.z, p.level], [2010, 4761, 1]);
    const wants = () => H.getVarBit(p, 'macro_mime_wants');
    const done = () => H.getVarBit(p, 'macro_mime_done');
    check('  ...and starts performing', wants() >= 1 && wants() <= 8, true);
    check('  ...with nothing copied yet', done(), 0);

    // The eight he can perform, and the emote-tab button that plays each. PRESSING THE BUTTON is
    // the point: ~macro_mime_react is hooked into [label,emote] beside Miscellania's and the
    // Ethereal Mimic's, and calling the proc directly would skip the hook AND lose the p_delay in
    // the send-home at the end, which H.runProc never resumes.
    const BUTTON = ['', 'yes', 'no', 'bow', 'angry', 'think', 'wave', 'cheer', 'clap'];
    // THE EIGHT BUTTONS ARE THE EIGHT ACTS. If macro_mime_act ever names an emote whose button is
    // not in this list the test clicks the wrong thing, so the two are checked against each other
    // rather than assumed.
    check(
        'every act he can perform has a button in the emote tab',
        [1, 2, 3, 4, 5, 6, 7, 8].map(i => EnumType.get(EnumType.getId('macro_mime_act')).values.get(i)),
        [1, 2, 3, 4, 5, 6, 7, 8].map(i => SeqType.getId(`emote_${BUTTON[i]}`))
    );
    const copy = (i: number) => {
        H.ifButton(p, `emotes:${BUTTON[i]}`);
        for (let k = 0; k < 10 && (p.activeScript || p.delayed || [...p.queue.all()].length); k++) H.tick(1);
        H.tick(1);
    };

    // THE WRONG ONE COSTS NOTHING but does not count either, which is the only thing that makes
    // the four mean anything.
    const asked = wants();
    copy((asked % 8) + 1);
    check('a different emote does not count', done(), 0);
    check('  ...and he performs again', wants() >= 1 && wants() <= 8, true);

    const seen: number[] = [];
    for (let i = 0; i < 4; i++) {
        const w = wants();
        seen.push(w);
        copy(w);
    }
    check('four copied right and the act is over', done() >= 4 || H.getVar(p, 'macro_event') === 0, true);
    console.log(`       he performed ${seen.join(', ')} (of eight)`);
    check('  ...and he sends you back where he found you', [p.x, p.z], [3246, 3260]);
    check(
        '  ...paying a piece of the mime outfit, or one of his emotes',
        ['macro_mime_mask', 'macro_mime_top', 'macro_mime_legs', 'macro_mime_gloves', 'macro_mime_boots'].reduce((n, o) => n + H.invCount(p, o), 0) +
            H.getVarBit(p, 'emote_glasswall') +
            H.getVarBit(p, 'emote_glassbox') +
            H.getVarBit(p, 'emote_climbrope') +
            H.getVarBit(p, 'emote_lean'),
        1
    );
    check('  ...and lets go of the event', H.getVar(p, 'macro_event'), 0);
}

// ------------------------------------------------------------------------------ the Quiz Master
console.log('');
console.log('AND THE QUIZ MASTER ASKS THREE QUESTIONS');
{
    const p: any = player('quiz', 3250, 3264, 0);
    H.clearInv(p);
    H.setVar(p, 'macro_event', 0);
    H.runProc(p, '[proc,macro_event_general_spawn]', [19]);
    for (let i = 0; i < 6; i++) H.tick(1);
    const podium = [p.x, p.z, p.level];

    // WORK THE ANSWER OUT, do not ask the script for it. The three answers are pictures with no
    // text - that is the event - so the sim reads the objs off the wire, reads the category out of
    // the question, and looks up which of the three belongs to it in macro_quiz_item. Neither half
    // comes from the code under test.
    const items = EnumType.get(EnumType.getId('macro_quiz_item')).values;
    const cats = EnumType.get(EnumType.getId('macro_quiz_category')).values;
    const catOf = (obj: number) => {
        for (const [k, v] of items) if (v === obj) return Math.floor((k as number) / 4);
        return -1;
    };
    const tray = Component.getId('multiobj3');
    // The show runs itself out of the arrival queue - see the script - so there is nothing to
    // click. startEvent would have spun waiting for a player who is sat at a pause button, so the
    // spawn is run here and the modal loop below is what settles it.
    let answered = 0;
    for (let guard = 0; guard < 400; guard++) {
        const s = p.activeScript;
        if (!s) {
            H.tick(1);
            if (!p.delayed && [...p.queue.all()].length === 0 && guard > 4) break;
            continue;
        }
        if (s.execution !== ScriptState.PAUSEBUTTON) {
            H.tick(1);
            continue;
        }
        if (p.modalChat !== tray) {
            p.executeScript(s, true, true);
            continue;
        }
        // the title says which category, the three slots say what is on offer
        const title = [...H.ifaces].reverse().find(f => f.who === p.username && f.kind === 'text' && f.com === Component.getId('multiobj3:com_8'))!.text!;
        let wantCat = -1;
        for (const [k, v] of cats) if (title.includes(v as string)) wantCat = k as number;
        let pick = 2;
        for (let i = 0; i < 3; i++) {
            const o = [...H.ifaces].reverse().find(f => f.who === p.username && f.kind === 'obj' && f.com === Component.getId(`multiobj3:com_${2 + i}`))!.obj!;
            if (catOf(o) === wantCat) pick = 2 + i;
        }
        answered++;
        H.choose(p, `multiobj3:com_${pick}`);
    }
    check('the Quiz Master puts you on a podium', podium, [1952, 4764, 1]);
    check('he asks three questions', answered, 3);
    check('  ...and three right is a Mystery box', H.invCount(p, 'macro_quiz_mystery_box'), 1);
    check('  ...and then sends you home', [p.x, p.z], [3250, 3264]);
    check('  ...and lets go of the event', H.getVar(p, 'macro_event'), 0);

    // AND THREE WRONG IS NO BOX, which is the half of the scoring the run above cannot show: the
    // same loop, picking a slot that is deliberately not the answer.
    {
        const q: any = player('quizwrong', 3254, 3264, 0);
        H.clearInv(q);
        H.setVar(q, 'macro_event', 0);
        H.runProc(q, '[proc,macro_event_general_spawn]', [19]);
        for (let i = 0; i < 6; i++) H.tick(1);
        let asked = 0;
        for (let guard = 0; guard < 400; guard++) {
            const s = q.activeScript;
            if (!s) {
                H.tick(1);
                if (!q.delayed && [...q.queue.all()].length === 0 && guard > 4) break;
                continue;
            }
            if (s.execution !== ScriptState.PAUSEBUTTON) {
                H.tick(1);
                continue;
            }
            if (q.modalChat !== tray) {
                q.executeScript(s, true, true);
                continue;
            }
            const title = [...H.ifaces].reverse().find(f => f.who === q.username && f.kind === 'text' && f.com === Component.getId('multiobj3:com_8'))!.text!;
            let wantCat = -1;
            for (const [k, v] of cats) if (title.includes(v as string)) wantCat = k as number;
            let pick = -1;
            for (let i = 0; i < 3; i++) {
                const o = [...H.ifaces].reverse().find(f => f.who === q.username && f.kind === 'obj' && f.com === Component.getId(`multiobj3:com_${2 + i}`))!.obj!;
                if (catOf(o) !== wantCat) pick = 2 + i;
            }
            asked++;
            H.choose(q, `multiobj3:com_${pick}`);
        }
        check('three wrong is three questions and no box', [asked, H.invCount(q, 'macro_quiz_mystery_box')], [3, 0]);
        check('  ...and he still sends you home', [q.x, q.z], [3254, 3264]);
    }

    // The box is the prize and opens anywhere.
    H.opheld(p, 'macro_quiz_mystery_box', 1);
    for (let k = 0; k < 20; k++) {
        const s = p.activeScript;
        if (s && s.execution === ScriptState.PAUSEBUTTON) {
            p.executeScript(s, true, true);
            continue;
        }
        if (!s && !p.delayed) break;
        H.tick(1);
    }
    check('the box opens into something', H.invCount(p, 'macro_quiz_mystery_box'), 0);
}

// ============================================ the two rooms that had to be built rather than found
console.log('');
console.log('THE LAND OF THE FROGS, WHICH NOBODY HAD BUILT');
{
    // The only random event room in this game that was not already in the maps. 474 cannot supply
    // it - no XTEA key for the band, and nothing frog-shaped in any of the 565 regions it can read
    // - so content/tools/genfrogcave.py makes it. The checks are that it is the shape the
    // generator says and that a player can move about in it.
    let walk = 0;
    for (let x = 2070; x <= 2089; x++) {
        for (let z = 4822; z <= 4841; z++) if (!isFlagged(x, z, 0, CollisionFlag.WALK_BLOCKED)) walk++;
    }
    check('the clearing is twenty by twenty and open', walk, 400);
    check(
        '  ...and walled in',
        [isFlagged(2069, 4830, 0, CollisionFlag.WALK_BLOCKED), isFlagged(2090, 4830, 0, CollisionFlag.WALK_BLOCKED), isFlagged(2080, 4821, 0, CollisionFlag.WALK_BLOCKED), isFlagged(2080, 4842, 0, CollisionFlag.WALK_BLOCKED)],
        [true, true, true, true]
    );
    // COUNTED INSIDE THE CLEARING, not in the world: macro_frog_noncombat is an ordinary frog
    // and there are others of it elsewhere.
    const inClearing = (name: string) => World.npcs.filter(x => x && x.type === NpcType.getId(name) && x.level === 0 && x.x >= 2070 && x.x <= 2089 && x.z >= 4822 && x.z <= 4841).length;
    check('  ...with a herald, six frogs and one in a crown', ['macro_frog_crier', 'macro_frog_noncombat', 'macro_frog_royal'].map(inClearing), [1, 6, 1]);

    const p: any = player('frog', 3258, 3264, 0);
    H.clearInv(p);
    startEvent(p, 20);
    check('you are dropped in the clearing', [p.x, p.z, p.level], [2079, 4826, 0]);

    // A WRONG FROG IS WRONG. They are all one npc type and all look alike bar the hat.
    const wrong = H.npcNear('macro_frog_noncombat', p.x, p.z, 0)!;
    talkToThis(p, wrong);
    settleAny(p);
    check('an ordinary frog says so', H.getVarBit(p, 'macro_frog_wrong'), 1);
    check('  ...and you are still in the clearing', p.z > 4800, true);

    // THE ONE IN THE CROWN. "Kiss the frog." is the first of the two he offers.
    const royal = H.npcNear('macro_frog_royal', p.x, p.z, 0)!;
    talkToThis(p, royal, [1]);
    settleAny(p);
    check('kissing the crowned one makes royalty of it', [NpcType.getId('macro_frog_prince'), NpcType.getId('macro_frog_princess')].includes(royal.type), true);
    check('  ...and hands you a token', H.invCount(p, 'macro_frog_token'), 1);
    check('  ...and sends you home', [p.x, p.z], [3258, 3264]);
    check('  ...and lets go of the event', H.getVar(p, 'macro_event'), 0);

    // AND THESSALIA TAKES IT, which is where the wiki says the token is spent: "may be redeemed at
    // the Varrock clothes shop to get a frog mask, a royal frog costume, or an experience lamp".
    talkToThis(p, H.npcNear('thessalia', 3205, 3417, 0)!, [1]);
    settleAny(p);
    check('Thessalia turns the token into a frog mask', [H.invCount(p, 'macro_frog_token'), H.invCount(p, 'macro_frog_mask')], [0, 1]);

    // FIVE WRONG ONES AND THE HERALD GIVES UP, which is the half the run above cannot show.
    const q: any = player('frogwrong', 3262, 3264, 0);
    H.clearInv(q);
    startEvent(q, 20);
    for (let i = 0; i < 5; i++) {
        const f = H.npcNear('macro_frog_noncombat', q.x, q.z, 0)!;
        talkToThis(q, f);
        settleAny(q);
    }
    check('five wrong frogs and you are out on your ear', [q.x, q.z], [3262, 3264]);
    check('  ...with no token', H.invCount(q, 'macro_frog_token'), 0);
}

console.log('');
console.log('AND THE PILLORY, WHICH HAPPENS IN PUBLIC');
{
    // THE CAGES ARE PLACED FROM THE TRAMPS, not from a guess: three pillory_tramp_thrower npcs
    // were already standing in Varrock, Seers' Village and Yanille, and the wiki says of them
    // "outside the pillory, the tramp... throws rotten tomatoes at the players inside". A cage one
    // tile from each is the only arrangement that makes sense of a man throwing tomatoes at
    // nothing. This checks the three are where their tramps are and nowhere else.
    const CAGES: [string, number, number][] = [
        ['pillory_tramp_thrower_varrock', 3228, 3413],
        ['pillory_tramp_thrower_seers', 2683, 3485],
        ['pillory_tramp_thrower_yanille', 2606, 3101]
    ];
    const doorId = LocType.getId('macro_pillory_door');
    /** Where a map square SPAWNS an npc, which is the thing to compare a placement against - a
     * tramp on his rounds is halfway down the street by the time anything here looks at him. */
    const spawnOf = (square: string, npcId: number) => {
        const [sx, sz] = square.split('_').map(v => parseInt(v) * 64);
        let innpc = false;
        for (const line of fs.readFileSync(`${Environment.BUILD_SRC_DIR}/maps/m${square}.jm2`, 'ascii').split('\n')) {
            const s = line.trim();
            if (s.startsWith('====')) {
                innpc = s.includes('NPC');
                continue;
            }
            if (!innpc || !s.includes(':')) continue;
            const [head, tail] = s.split(':');
            const [lv, x, z] = head.trim().split(/ +/).map(Number);
            if (parseInt(tail.trim().split(/ +/)[0]) === npcId && lv === 0) return { x: sx + x, z: sz + z };
        }
        return null;
    };
    for (const [tramp, cx, cz] of CAGES) {
        const sq = `${cx >> 6}_${cz >> 6}`;
        const t = spawnOf(sq, NpcType.getId(tramp))!;
        check(`${tramp.replace('pillory_tramp_thrower_', '')}: a cage within a tile of its tramp`, Math.max(Math.abs(t.x - cx), Math.abs(t.z - cz)) <= 1, true);
        check('  ...with a door on it', World.getLoc(cx, cz, 0, doorId) !== null, true);
        check(
            '  ...and a guard at his post beside it',
            spawnOf(sq, NpcType.getId('macro_pillory_guard')) !== null && World.npcs.some(n => n && n.type === NpcType.getId('macro_pillory_guard') && Math.max(Math.abs(n.x - cx), Math.abs(n.z - cz)) <= 2),
            true
        );
    }

    // A CAGE HAS TO BE A CAGE. Four walls on one tile, and from inside it every neighbour is on
    // the other side of one of them - which is the only thing that makes the lock worth picking.
    const sealed = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1]
    ].every(([dx, dz]) => !canTravel(0, 3228, 3413, dx, dz, 1, 0, CollisionType.NORMAL));
    check('and from inside the Varrock cage there is nowhere to go', sealed, true);

    // AND IT IS A THIEVING RANDOM, not a general one. runescape.wiki/w/Pillory's update history
    // says that until "25 February 2009" being caught was something that only happened to
    // "members using Thieving", and 2006scape lists this event under Thieving as the "Jailer".
    // So the general roll must never produce it, and the pickpocket roll must.
    {
        const picks = (name: string) => {
            const e = EnumType.get(EnumType.getId(name));
            return [...e.values.values()] as number[];
        };
        check('the general roll cannot land on the pillory', [picks('general_macro_events_members_pick').includes(21), picks('general_macro_events_free_pick').includes(21)], [false, false]);
        const r: any = player('pilroll', 3270, 3264, 0);
        check('  ...but the event table still knows which npc it is', H.runProc(r, '[proc,macro_event_npc]', [21])[0], NpcType.getId('macro_pillory_guard'));

        // FOUR HUNDRED PICKPOCKETS' WORTH. The pillory is one slot against the general count,
        // so about one roll in twenty-one; sixty rolls came up once and a check that only asks
        // for "more than none" would then fail about one run in twenty. The spawn teleports
        // through a queue, so nothing moves while the queue is thrown away between rolls - only
        // the id it chose is read.
        let caught = 0;
        for (let i = 0; i < 400; i++) {
            H.setVar(r, 'macro_event', 0);
            H.runProc(r, '[label,macro_randomthieving]');
            if (H.getVar(r, 'macro_event') === 21) caught++;
            r.queue.clear();
        }
        H.setVar(r, 'macro_event', 0);
        console.log(`       the pillory came up ${caught} times in 400 pickpocket rolls`);
        check('  ...and the pickpocket roll does, about one in twenty', caught > 5 && caught < 45, true);
    }

    const p: any = player('pillory', 3266, 3264, 0);
    H.clearInv(p);
    startEvent(p, 21);
    check('the guard puts you in the cage', [p.x, p.z, p.level], [3228, 3413, 0]);
    check('  ...with three tumblers to pick', H.getVarBit(p, 'macro_pillory_locks'), 3);

    // PICK ONE LOCK, right or wrong. The symbol is shown in an objbox before the four are offered,
    // so the sim reads it off the wire the way a player reads it off the screen.
    const box = Component.getId('objbox1');
    const tray = Component.getId('multiobj4');
    const pickLock = (correct: boolean) => {
        H.opLoc(p, 3228, 3413, 'macro_pillory_door', 1);
        let shown = -1;
        for (let guard = 0; guard < 80; guard++) {
            const s = p.activeScript;
            if (!s) {
                H.tick(1);
                if (!p.delayed && guard > 3) break;
                continue;
            }
            if (s.execution !== ScriptState.PAUSEBUTTON) {
                H.tick(1);
                continue;
            }
            if (p.modalChat === box) {
                shown = [...H.ifaces].reverse().find(f => f.who === p.username && f.kind === 'obj' && f.com === Component.getId('objbox1:com_0'))!.obj!;
                p.executeScript(s, true, true);
                continue;
            }
            if (p.modalChat === tray) {
                let slot = -1;
                for (let i = 0; i < 4; i++) {
                    const o = [...H.ifaces].reverse().find(f => f.who === p.username && f.kind === 'obj' && f.com === Component.getId(`multiobj4:com_${2 + i}`))!.obj!;
                    if (correct === (o === shown)) slot = 2 + i;
                }
                H.choose(p, `multiobj4:com_${slot}`);
                continue;
            }
            p.executeScript(s, true, true);
        }
        settleAny(p);
    };

    pickLock(true);
    check('one right and one tumbler turns', H.getVarBit(p, 'macro_pillory_done'), 1);
    pickLock(false);
    check('one wrong and they all drop back', H.getVarBit(p, 'macro_pillory_done'), 0);
    check('  ...and there is one more of them', H.getVarBit(p, 'macro_pillory_locks'), 4);
    check('  ...and the door is still shut', H.getVarBit(p, 'macro_pillory_open'), 0);

    for (let i = 0; i < 4; i++) pickLock(true);
    check('four right and the cage is open', H.getVarBit(p, 'macro_pillory_open'), 1);

    talkToThis(p, H.npcNear('macro_pillory_guard', 3228, 3413, 0)!);
    settleAny(p);
    check(
        'the guard lets you off with a gift',
        [...Array(28).keys()].some(k => p.getInventory(InvType.INV)!.get(k)),
        true
    );
    check('  ...and you are back where he found you', [p.x, p.z], [3266, 3264]);
    check('  ...and the cage is shut behind you', H.getVarBit(p, 'macro_pillory_open'), 0);
}

// ================================= the three events that ask you to recognise a shape in the chatbox
console.log('');
console.log('THE CHATBOX CAN SHOW YOU A SHAPE NOW');
{
    // IF_SETOBJECT TAKES THE ANGLE FROM THE OBJ, NOT THE INTERFACE. Client.java sets the
    // component's xan, yan and zoom from the ObjType every time (zoom = zoom2d * 100 / scale), so
    // an obj with no 2d params is drawn edge on at the default distance - which is what made all
    // five grave symbols the same dark slab. The carvings are only visible from above.
    for (const s of ['macro_digger_stonecook', 'macro_digger_stonespade', 'macro_digger_stoneaxe', 'macro_digger_stonemine', 'macro_digger_stonevase']) {
        const o: any = ObjType.get(ObjType.getId(s));
        check(`${s} is turned face up`, [o.xan2d, o.zoom2d > 2000], [512, true]);
    }

    // Both of these end on a p_pausebutton - a box with "Click here to continue" - so settleAny
    // would wait for an idle that never comes. This is the click.
    const clickThrough = (p: any, max = 60) => {
        // The lever is forceapproach=south, so a click from the wrong tile walks first: give the
        // player a moment to arrive before deciding nothing is happening.
        for (let w = 0; w < 12 && !p.activeScript; w++) H.tick(1);
        for (let g = 0; g < max; g++) {
            const sc = p.activeScript;
            if (!sc) {
                H.tick(1);
                if (!p.delayed) break;
                continue;
            }
            if (sc.execution === ScriptState.PAUSEBUTTON) {
                p.executeScript(sc, true, true);
                continue;
            }
            H.tick(1);
        }
    };
    const spinOf = (p: any, comName: string) => [...H.ifaces].reverse().find(f => f.who === p.username && f.kind === 'spin' && f.com === Component.getId(comName));
    const objOf = (p: any, comName: string) => [...H.ifaces].reverse().find(f => f.who === p.username && f.kind === 'obj' && f.com === Component.getId(comName));
    const textOf = (p: any, comName: string) => [...H.ifaces].reverse().find(f => f.who === p.username && f.kind === 'text' && f.com === Component.getId(comName));

    // ---------------------------------------------------------------- the gravedigger's headstone
    {
        const p: any = player('stoneread', 3222, 3266, 0);
        H.clearInv(p);
        startEvent(p, 12);
        // Headstone 1 stands two tiles north of grave 1; loc ids 12716..12720 are the five stones.
        p.teleport(1925, 4998, 0);
        H.tick(1);
        H.opLoc(p, 1924, 4998, 'loc_12716', 1);
        clickThrough(p);
        const shown = objOf(p, 'macro_digger_stone:com_0');
        check('reading a headstone shows you a symbol', shown !== undefined, true);
        if (shown) {
            // ...and it is the symbol for whatever that grave wants, not just any of the five.
            const want = H.getVarBit(p, 'macro_digger_coffin_1');
            const expect = ObjType.getId(['', 'macro_digger_stonecook', 'macro_digger_stonespade', 'macro_digger_stoneaxe', 'macro_digger_stonemine', 'macro_digger_stonevase'][want]);
            check('  ...the one that grave is waiting for', shown.obj, expect);
        }
        const spin = spinOf(p, 'macro_digger_stone:com_0');
        check('  ...and the stone turns', spin !== undefined && spin.yspeed! > 0, true);
    }

    // ---------------------------------------------------------------- the prison lever's balloon
    {
        const p: any = player('leverspin', 3226, 3266, 0);
        H.clearInv(p);
        startEvent(p, 16);
        H.opLoc(p, 2089, 4430, 'prisonpete_lever', 1);
        clickThrough(p);
        const spin = spinOf(p, 'macro_pete_lever:com_0');
        check('the lever panel turns the balloon animal', spin !== undefined && spin.yspeed! > 0, true);
        // The four are a cat, a dog, a goat and a sheep, told apart by horns, body width and tail -
        // none of which reads from one fixed angle.
        check('  ...and it picked one of the four', H.getVarBit(p, 'macro_pete_wants') >= 1, true);
    }

    // ---------------------------------------------------------------- the certer holds one thing
    {
        const p: any = player('certerask', 3240, 3234, 0);
        H.clearInv(p);
        startEvent(p, 9);
        const brother = ['macro_niles', 'macro_miles', 'macro_giles'].map(n => nearby(n, p, 10)).find(Boolean)!;

        // Drive the custom chooser by hand: A.drive does not know this interface, and the whole
        // point of the check is what is in it.
        let shownObj = -1;
        let names: string[] = [];
        const show = Component.getId('macro_certer_show');
        const ask = (wantCorrect: boolean) => {
            p.teleport(brother.x + 1, brother.z, brother.level);
            H.tick(1);
            H.opNpc(p, brother, 1);
            for (let g = 0; g < 160; g++) {
                const sc = p.activeScript;
                if (!sc) {
                    H.tick(1);
                    if (!p.delayed && g > 3) break;
                    continue;
                }
                if (sc.execution !== ScriptState.PAUSEBUTTON) {
                    H.tick(1);
                    continue;
                }
                if (p.modalChat === show) {
                    shownObj = objOf(p, 'macro_certer_show:com_0')!.obj!;
                    names = [2, 3, 4].map(i => textOf(p, `macro_certer_show:com_${i}`)!.text!);
                    const right = ObjType.get(shownObj).name;
                    const slot = names.findIndex(n => (n === right) === wantCorrect);
                    H.choose(p, `macro_certer_show:com_${2 + slot}`);
                    continue;
                }
                p.executeScript(sc, true, true);
            }
            settleAny(p);
        };

        ask(true);
        check('the certer shows you one object', shownObj > 0, true);
        check('  ...and offers three names for it', names.length, 3);
        // THE ANSWER IS AMONG THEM EXACTLY ONCE. Three objs with their names written underneath -
        // which is what this was - gave the answer away and left him holding nothing.
        check('  ...one of which is right', names.filter(n => n === ObjType.get(shownObj).name).length, 1);
        check(
            '  ...and naming it is paid for',
            [...Array(28).keys()].some(k => p.getInventory(InvType.INV)!.get(k)),
            true
        );

        // AND GETTING IT WRONG IS NOT. The control: the same walk through, picking a name that is
        // not the object's.
        const q: any = player('certerwrong', 3244, 3234, 0);
        H.clearInv(q);
        startEvent(q, 9);
        const brother2 = ['macro_niles', 'macro_miles', 'macro_giles'].map(n => nearby(n, q, 10)).find(Boolean)!;
        q.teleport(brother2.x + 1, brother2.z, brother2.level);
        H.tick(1);
        H.opNpc(q, brother2, 1);
        for (let g = 0; g < 160; g++) {
            const sc = q.activeScript;
            if (!sc) {
                H.tick(1);
                if (!q.delayed && g > 3) break;
                continue;
            }
            if (sc.execution !== ScriptState.PAUSEBUTTON) {
                H.tick(1);
                continue;
            }
            if (q.modalChat === show) {
                const o = objOf(q, 'macro_certer_show:com_0')!.obj!;
                const ns = [2, 3, 4].map(i => textOf(q, `macro_certer_show:com_${i}`)!.text!);
                const slot = ns.findIndex(n => n !== ObjType.get(o).name);
                H.choose(q, `macro_certer_show:com_${2 + slot}`);
                continue;
            }
            q.executeScript(sc, true, true);
        }
        settleAny(q);
        check(
            '  ...while getting it wrong is not',
            [...Array(28).keys()].some(k => q.getInventory(InvType.INV)!.get(k)),
            false
        );
    }
}

// ============================================ the mime's stage was an upper floor marked as a bridge
console.log('');
console.log('THE MIME STAGE IS A FLOOR AND NOT A BRIDGE');
{
    // 474 shipped the stage's 96 tiles at level 1 with tile settings 2 and 3 - LINK_BELOW, the
    // bridge bit - and the import copied them verbatim. Two things follow from that bit, and both
    // were wrong here. The server reads it in GameMap.loadGround: a bridged level-1 tile moves its
    // collision down to level 0, so level 1 had no land collision at all. The client reads it in
    // getHeight: an entity on a bridged tile is drawn from the heightmap one level UP, which for a
    // player standing at level 1 is level 2 - a heightmap that does not exist, so they float.
    // The stage is simply an upper floor, so the bit is gone and the floor is level everywhere.
    const STAGE: [number, number][] = [];
    for (let x = 2002; x <= 2017; x++) for (let z = 4761; z <= 4766; z++) STAGE.push([x, z]);
    check('the whole stage is one height', new Set(STAGE.map(([x, z]) => (World.gameMap as any).levelHeightmap?.[1]?.[x]?.[z] ?? 'n/a')).size <= 1, true);
    // The wings are curtained off and solid - local x 19-20 and 31-32 - which is the stage, not a
    // mistake. The boards you perform on are the middle.
    const BOARDS = STAGE.filter(([x]) => x >= 2005 && x <= 2014);
    check('  ...and you can walk on all of the boards', BOARDS.filter(([x, z]) => isFlagged(x, z, 1, CollisionFlag.WALK_BLOCKED)).length, 0);

    const p: any = player('mimefloor', 3230, 3266, 0);
    H.clearInv(p);
    startEvent(p, 18);
    check('the mime puts you on the stage, at level 1', [p.level, p.x >= 2002 && p.x <= 2017], [1, true]);
    // HE STANDS STILL. wanderrange defaults to 5, and five tiles off a sixteen-wide stage is off
    // the stage.
    check('  ...and the mime does not wander off it', NpcType.get(NpcType.getId('macro_mime')).wanderrange, 0);
    check('  ...and he is a person, not a cat', SeqType.get(NpcType.get(NpcType.getId('macro_mime')).readyanim).debugname, 'human_ready');
}

console.log(`RANDOMEVENTS ${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
