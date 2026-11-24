/**
 * Oziach's Trade option, and what is behind it.
 *
 * "ending of dragon slayer is wrong and oziach shop is wrong" - DeathPlateau-Bugs#88, filed from
 * his hut in Edgeville.
 *
 * THE TRADE OPTION DID NOT OPEN THE SHOP. [opnpc3,oziach] - op3 is Trade on his npc config - ends
 * with ~openshop_activenpc, and the line above it jumps away before ever reaching it:
 *
 *     if (%dragonquest = ^dragon_complete) {
 *         @oziach_dragon_complete;      // "I have slain the dragon!" / "Well done!"
 *     }
 *     ~openshop_activenpc;              // unreachable once the quest is done
 *
 * @ is a jump and not a call, so for every player who has finished the quest - the only players
 * allowed to buy from him at all - Trade replayed the post-quest conversation instead of opening
 * the till. The shop is still reachable, through a choice inside that conversation, which is why
 * this reads as "the shop is wrong" rather than "the shop is missing".
 *
 * WHAT THIS SIM DOES NOT SETTLE. The other half of the report is the ending, and the ending is
 * sourced: elvarg.rs2 cites a video of the era beside `queue(dragon_complete, 0, 0)` on her death,
 * so completing on the kill is deliberate. The 2005-2006 guides quest_dragon.rs2 cites are on
 * web.archive.org, which cannot be reached from here, so this sim pins the shop and the ending is
 * left alone and asked about on the tracker.
 */
import * as H from './harness.js';
import { check, R, player } from './a1lib.js';
import World from '#/engine/World.js';
import Component from '#/cache/config/Component.js';
import NpcType from '#/cache/config/NpcType.js';
import ObjType from '#/cache/config/ObjType.js';
import ParamType from '#/cache/config/ParamType.js';

await H.boot();

const OZIACH: [number, number] = [3069, 3517];
const DRAGON_COMPLETE = 10;

function nparam(npc: string, param: string) {
    const type = NpcType.get(NpcType.getId(npc));
    const id = ParamType.getId(param);
    return type.params?.get(id);
}

function freshAtOziach(who: string, quest: number) {
    const npc = H.npcNear('oziach', OZIACH[0], OZIACH[1], 0);
    if (!npc) return null;
    const p = player(who, npc.x + 1, npc.z, 0);
    H.setVar(p, 'tutorial', 1000);
    H.clearInv(p);
    H.setVar(p, 'dragonquest', quest);
    return { p, npc };
}

/**
 * Whether the shop panel itself is what is open.
 *
 * modalMain, NOT modalTop: ~openshop_activenpc ends in if_openmain_side(shop_template,
 * shop_template_side), so the till lands in the main modal slot. Reading modalTop found -1 and
 * reported a shop that was plainly open - its own title and prices were in the captured text.
 */
function shopOpen(p: { modalMain: number; modalSide: number }) {
    return p.modalMain === Component.getId('shop_template') && p.modalSide === Component.getId('shop_template_side');
}

/**
 * Every line of dialogue written to this player since a mark, joined.
 *
 * READING THE WORDS AND NOT containsModalInterface(), which is true for the conversation just as
 * much as for the shop - the first draft of this file asked that and passed on the bug.
 */
function saidSince(who: string, from: number) {
    return H.ifaces
        .slice(from)
        .filter(f => f.who === who && f.kind === 'text' && f.text)
        .map(f => f.text)
        .join(' | ');
}

// ---- 1. he is the npc the report is about, and he does own a till -----------------------------
{
    const npc = H.npcNear('oziach', OZIACH[0], OZIACH[1], 0);
    check('Oziach is standing in his hut', npc !== null, true);
    check('  ...with Trade on op3', NpcType.get(NpcType.getId('oziach')).op?.[2], 'Trade');
    check('  ...and a shop of his own', nparam('oziach', 'owned_shop') !== undefined, true);
}

// ---- 2. before the quest he refuses, which is right ------------------------------------------
{
    const at = freshAtOziach('oz_before', 0);
    if (!at) check('Oziach exists', false, true);
    else {
        H.opNpc(at.p, at.npc, 3);
        H.tick(6);
        check('before the quest, Trade opens no shop', shopOpen(at.p), false);
    }
}
{
    const at = freshAtOziach('oz_during', 5);
    if (!at) check('Oziach exists', false, true);
    else {
        H.opNpc(at.p, at.npc, 3);
        H.tick(6);
        check('part way through, Trade opens no shop either', shopOpen(at.p), false);
    }
}

// ---- 3. AND AFTER IT, TRADE HAS TO OPEN THE SHOP ----------------------------------------------
// The report. Trade is the one click whose whole job is the till.
{
    const at = freshAtOziach('oz_after', DRAGON_COMPLETE);
    if (!at) check('Oziach exists', false, true);
    else {
        const from = H.ifaces.length;
        H.opNpc(at.p, at.npc, 3);
        H.tick(6);
        const said = saidSince('oz_after', from);
        check('with the quest done, Trade opens the shop', shopOpen(at.p), true);
        // NOT containsModalInterface(): that is true of the conversation too, which is how the
        // first draft of this check passed against the bug it was written for.
        check(`  ...and does not replay the conversation (${said.slice(0, 40)})`, said.includes('slain the dragon'), false);
    }
}

// ---- 4. and Talk-to still tells him you slew the dragon --------------------------------------
// The conversation is not being deleted, only moved off the Trade click - so op1 has to keep it.
{
    const at = freshAtOziach('oz_talk', DRAGON_COMPLETE);
    if (!at) check('Oziach exists', false, true);
    else {
        const from = H.ifaces.length;
        H.opNpc(at.p, at.npc, 1);
        H.tick(6);
        const said = saidSince('oz_talk', from);
        check(`Talk-to still opens the post-quest conversation (${said.slice(0, 44)})`, said.includes('slain the dragon'), true);
    }
}

// ---- 5. what is in the till, against Old School's own table ----------------------------------
// Sells at 130%, buys at 40%, 3.0% per item, two of each on a 500-tick restock. Every one of those
// is what the wiki's shop table says, so the stock is NOT wrong - see the tracker issue for the
// one item Old School has that this does not, and why it is absent on purpose.
{
    const shop = nparam('oziach', 'owned_shop') as number;
    const inv = World.getInventory(shop);
    check('the till is loaded', inv !== null, true);
    if (inv) {
        const names: string[] = [];
        for (let i = 0; i < inv.capacity; i++) {
            const obj = inv.get(i);
            if (obj) names.push(`${ObjType.get(obj.id).debugname}x${obj.count}`);
        }
        check(`it stocks exactly two lines (${names.join(', ')})`, names.length, 2);
        check(
            '  ...a rune platebody',
            names.some(n => n.startsWith('rune_platebody')),
            true
        );
        check(
            '  ...and a green dragonhide body',
            names.some(n => n.startsWith('dragonhide_body')),
            true
        );
    }
    check('he sells at 130%', nparam('oziach', 'shop_sell_multiplier'), 1300);
    check('  ...buys at 40%', nparam('oziach', 'shop_buy_multiplier'), 400);
    check('  ...and moves 3% an item', nparam('oziach', 'shop_delta'), 30);
}

console.log(R.bad ? `FAILED: ${R.bad} of ${R.ok + R.bad}` : `${R.ok} ok`);
process.exit(R.bad ? 1 : 0);
