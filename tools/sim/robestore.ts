// THE MAGIC GUILD ROBE STORE OPENS.
// Usage: npx tsx tools/sim/robestore.ts   (exit code is the verdict)
//
// magic_store_owner2 has carried op1=Talk-to and op3=Trade since the 377 cache with nothing behind
// either, so both clicks did nothing at all. Its stock list was already in the 727 dump, unused.
import * as H from './harness.js';
import { check, R, player, talk, saw } from './a1lib.js';
import NpcType from '#/cache/config/NpcType.js';
import ParamType from '#/cache/config/ParamType.js';
import ObjType from '#/cache/config/ObjType.js';
import Component from '#/cache/config/Component.js';
import World from '#/engine/World.js';

await H.boot();

const nparam = (nm: string, key: string): unknown => (NpcType.get(NpcType.getId(nm)) as unknown as { params?: Map<number, unknown> }).params?.get(ParamType.getId(key));

console.log('== the shopkeeper has a till');
{
    check('it owns a shop inventory', nparam('magic_store_owner2', 'owned_shop') !== undefined, true);
    check('  and it is the robe one, not its neighbour', nparam('magic_store_owner2', 'owned_shop') !== nparam('magic_store_owner', 'owned_shop'), true);
    check('  the haggle delta matches its neighbour', nparam('magic_store_owner2', 'shop_delta'), nparam('magic_store_owner', 'shop_delta'));
    check(
        '  as do the multipliers',
        [nparam('magic_store_owner2', 'shop_sell_multiplier'), nparam('magic_store_owner2', 'shop_buy_multiplier')],
        [nparam('magic_store_owner', 'shop_sell_multiplier'), nparam('magic_store_owner', 'shop_buy_multiplier')]
    );
}

console.log('\n== Trade opens it');
{
    const p: any = player('robetrade', 2594, 3092, 1);
    const npc = H.npcNear('magic_store_owner2', 2594, 3090, 1);
    check('the robe seller is upstairs in the guild', npc !== null, true);
    if (npc) {
        // THE SHOPKEEPER WANDERS. Teleporting beside where npcNear found him and clicking a tick
        // later caught him mid-step often enough to fail about one run in ten - the click then
        // became a walk, and four ticks was not always enough to arrive. Standing next to where he
        // IS, immediately before the click, is the fix; the extra ticks cover the walk if he moves
        // anyway.
        H.tick(1);
        // A SIDE THE ROUTE FINDER AGREES IS A SIDE. He stands behind his counter, so the tile east
        // of him - which this used to teleport to - answers "I can't reach that!" and the shop
        // never opens (tracker issue 21).
        check('  there is a tile he can be reached from', H.standBeside(p, npc), true);
        H.opNpc(p, npc, 3);
        for (let t = 0; t < 10 && !p.containsModalInterface(); t++) H.tick(1);
        check('  the shop is open', p.modalTop === Component.getId('shop_template') || p.containsModalInterface(), true);
    }
}

console.log('\n== Talk-to asks first, then opens it');
{
    const p: any = player('robetalk', 2594, 3092, 1);
    const npc = H.npcNear('magic_store_owner2', 2594, 3090, 1);
    if (npc) {
        H.tick(1);
        check('  there is a tile he can be reached from', H.standBeside(p, npc), true);
        const lines = talk(p, 'magic_store_owner2', ['Yes please.'], 1, false);
        check('  it greets you', saw(lines, 'Robe Store'), true);
        for (let t = 0; t < 10 && !p.containsModalInterface(); t++) H.tick(1);
        check('  and saying yes opens the shop', p.containsModalInterface(), true);
    }
}

console.log('\n== and the till it opens holds the mystic set, and nothing else');
{
    // Read the shop's OWN inventory rather than checking the five items merely exist - a shop
    // pointed at the wrong stock list would pass that and sell the wrong things.
    const shop = nparam('magic_store_owner2', 'owned_shop') as number;
    const inv = World.getInventory(shop);
    check('the shop inventory is loaded', inv !== null, true);
    if (inv) {
        const stocked = [...inv.items]
            .filter(Boolean)
            .map(i => ObjType.get(i!.id).debugname ?? String(i!.id))
            .sort();
        check('  it stocks exactly the mystic set', stocked, ['mystic_boots', 'mystic_gloves', 'mystic_hat', 'mystic_robe_bottom', 'mystic_robe_top']);
    }
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
