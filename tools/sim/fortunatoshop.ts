// FORTUNATO'S TALK-TO, which logged the player out.
// Usage: NODE_MEMBERS=true npx tsx tools/sim/fortunatoshop.ts   (exit code is the verdict)
//
// Reported from play (DeathPlateau-Bugs#94): "if you talk to fortunato in draynor, ask to see his
// wares it logs you out". It did, and the report is literally accurate rather than loose.
//
// WHAT HAPPENED. He carries category=shop_keeper, so shop/scripts/shop.rs2's [opnpc1,_shop_keeper]
// answered his Talk-to, asked "Can I help you at all?", and on "Yes please" called
// ~openshop_activenpc - which reads the till off npc_param(owned_shop). He is the ONLY one of the
// 175 shopkeepers in that category without that param, because his till is picked by script: he
// has three, for free players, members, and members once Rag and Bone Man has started. So it read
// null, inv_transmit was handed -1, and ScriptRunner's error path does this:
//
//     if (Environment.NODE_PRODUCTION) {
//         state.self.logout();
//         state.self.loggingOut = true;
//     }
//
// A missing param on one npc is a disconnect, not a message. That is why the guard added to
// ~openshop_activenpc matters beyond this npc, and why the sweep below is the check worth keeping.
import * as H from './harness.js';
import * as A from './a1lib.js';
import { check, R, player } from './a1lib.js';
import InvType from '#/cache/config/InvType.js';
import NpcType from '#/cache/config/NpcType.js';
import ParamType from '#/cache/config/ParamType.js';
import CategoryType from '#/cache/config/CategoryType.js';

await H.boot();
H.loginOrder();

const OWNED_SHOP = ParamType.getId('owned_shop');
const SHOP_KEEPER = CategoryType.getId('shop_keeper');
const paramsOf = (t: NpcType) => (t as unknown as { params?: Map<number, unknown> }).params;

// A SCRIPT ERROR IS VISIBLE FROM HERE, which is what makes these checks mean anything. ScriptRunner
// catches the throw, logs it, and only calls logout() under NODE_PRODUCTION - so out here nothing
// is raised and no shop opens, which is indistinguishable from "the click did nothing". It does
// write the message to the player, and harness.ts hooks messageGame, so the backtrace lands in
// H.mesgs and can be asserted on. Without this the two guard checks below passed with the guard
// reverted, over nothing.
const scriptError = (p: { username: string }) => H.mesgs.filter(m => m.who === p.username && m.text.startsWith('script error:')).map(m => m.text);

const npc = A.findNpc('rag_wine_merchant', player('probe', 3084, 3253, 0));
const tillName = (id: number) => {
    for (const n of ['wine_merchant', 'wine_merchant_free', 'wine_vinegar_merchant']) {
        if (InvType.getId(n) === id) return n;
    }
    return 'id ' + id;
};

// Talk-to him, say yes, and report the till that opened. -1 for "nothing opened", which is what a
// crash looks like from out here.
const askAndOpen = (name: string, rag: number, op: number) => {
    const p: any = player(name, npc.x + 1, npc.z, npc.level);
    H.maxOut(p);
    H.clearInv(p);
    H.setVar(p, 'rag_quest', rag);
    H.tick(2);
    H.clearLogs();
    H.opNpc(p, npc, op);
    for (let t = 0; t < 20 && !p.activeScript; t++) H.tick(1);
    A.drive(p, op === 1 ? ['Yes please'] : []);
    H.tick(2);
    return { till: p.modalMain > 0 ? tillName(H.getVar(p, 'shop')) : 'NOTHING OPENED', p, err: scriptError(p) };
};

console.log('== he is the one shopkeeper whose till is not on a param');
{
    const t = NpcType.getByName('rag_wine_merchant')!;
    check('Fortunato is in the shop_keeper category', t.category, SHOP_KEEPER);
    check('  ...and has no owned_shop param, which is why the generic Talk-to could not serve him', paramsOf(t)?.has(OWNED_SHOP) ?? false, false);
}

console.log('\n== Talk-to and "Yes please" opens a till instead of disconnecting');
{
    // THE REPORTED CLICK. Before the fix this reached inv_transmit(-1) and the player was logged
    // out, so "a till opened at all" is the whole of the bug.
    const { till, err } = askAndOpen('fort_talk', 0, 1);
    check('his Talk-to raises no script error', err, []);
    check('  ...opens a shop', till !== 'NOTHING OPENED', true);
    check('  ...and it is one of his own three tills', till.startsWith('wine_'), true);
}

console.log('\n== all three tills, and Talk-to agrees with Trade on every one');
{
    // His script picks the till from membership and from Rag and Bone Man. Whatever it picks, the
    // two ways in have to agree - a Talk-to that opens a different shop from Trade is the same
    // class of bug as the one being fixed, one step quieter.
    for (const [tag, rag] of [
        ['not started', 0],
        ['started', 1],
        ['bones wanted', 5]
    ] as [string, number][]) {
        const trade = askAndOpen('tr' + rag, rag, 3).till;
        const talk = askAndOpen('tk' + rag, rag, 1).till;
        check(`${tag}: Trade opens ${trade}`, trade !== 'NOTHING OPENED', true);
        check('  ...and Talk-to opens the same till', talk, trade);
    }
}

console.log('\n== the vinegar only appears once the Odd Old Man has asked for it');
{
    const before = askAndOpen('vin0', 0, 1).till;
    const after = askAndOpen('vin1', 1, 1).till;
    check('before the quest his till has no vinegar', before, 'wine_merchant');
    check('  ...and after it does', after, 'wine_vinegar_merchant');
}

console.log('\n== and no other shopkeeper can fall into the same hole');
{
    // THE CHECK THAT WOULD HAVE CAUGHT THIS. A shopkeeper in this category needs either the param
    // the generic Talk-to reads, or a Talk-to of its own. Fortunato had neither. Nobody else did
    // then and nobody should later.
    const bad: string[] = [];
    for (let i = 0; i < NpcType.count; i++) {
        const t = NpcType.get(i);
        if (!t || t.category !== SHOP_KEEPER) continue;
        if (paramsOf(t)?.has(OWNED_SHOP)) continue;
        if (H.hasScript(`[opnpc1,${t.debugname}]`)) continue;
        bad.push(t.debugname ?? String(i));
    }
    check('every shop_keeper npc has a till on a param or a Talk-to of its own', bad, []);
}

console.log('\n== and a shopkeeper with no till says so rather than dropping the connection');
{
    // THE GUARD, TESTED BY TAKING A TILL AWAY. Fortunato no longer qualifies - he has his own
    // Talk-to now - so this borrows another shopkeeper, deletes the param the generic path reads,
    // and puts it back. Without the guard in ~openshop_activenpc this is the original crash.
    let victim: NpcType | null = null;
    for (let i = 0; i < NpcType.count; i++) {
        const t = NpcType.get(i);
        if (!t || t.category !== SHOP_KEEPER || !paramsOf(t)?.has(OWNED_SHOP)) continue;
        if (H.hasScript(`[opnpc1,${t.debugname}]`)) continue;
        const found = A.findNpc(t.debugname!, player('vprobe', 3084, 3253, 0));
        if (found) {
            victim = t;
            break;
        }
    }
    check('a shopkeeper to borrow was found', victim !== null, true);
    if (victim) {
        const live = A.findNpc(victim.debugname!, player('vprobe2', 3084, 3253, 0));
        const saved = paramsOf(victim)!.get(OWNED_SHOP);
        paramsOf(victim)!.delete(OWNED_SHOP);
        const p: any = player('notill', live.x + 1, live.z, live.level);
        H.maxOut(p);
        H.tick(2);
        H.clearLogs();
        let threw = '';
        try {
            H.opNpc(p, live, 1);
            for (let t = 0; t < 20 && !p.activeScript; t++) H.tick(1);
            A.drive(p, ['Yes please']);
            H.tick(2);
        } catch (e) {
            threw = (e as Error).message;
        }
        const err = scriptError(p);
        paramsOf(victim)!.set(OWNED_SHOP, saved as never);
        check(`${victim.debugname} with its till removed does not throw`, threw, '');
        check('  ...and raises no script error either', err, []);
        check('  ...and opens no shop', p.modalMain, -1);
        check('  ...and the param is put back', paramsOf(victim)!.get(OWNED_SHOP), saved);
    }
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
