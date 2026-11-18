// THE SAWMILL OPERATOR'S CONSTRUCTION SUPPLIES.
//
//   npx tsx tools/sim/sawmillshop.ts
//
// Steel nails had no source in the game but a smithing anvil at level 34, and Dragon Slayer asks
// for thirty of them to plank the Lady Lumbridge - so a player under 34 Smithing could not finish
// the quest at all on a world with no Grand Exchange. OSRS sells them at this counter; the npc was
// already standing here with his Trade option deliberately left off for want of a shop inv.
//
// WHAT THIS PINS. The stock, and the prices, against the figures the OSRS wiki publishes for this
// shop. The prices are not stored anywhere - they fall out of each item's cost times the shop's
// multipliers - so this is the only thing that would notice either one drifting.
import * as H from './harness.js';
import InvType from '#/cache/config/InvType.js';
import ObjType from '#/cache/config/ObjType.js';
import NpcType from '#/cache/config/NpcType.js';
import ParamType from '#/cache/config/ParamType.js';
import { check, R, player, talk, findNpc } from './a1lib.js';
import Component from '#/cache/config/Component.js';

await H.boot();

const shop = InvType.getByName('construction_supplies');
check('the shop inv exists', !!shop, true);

const operator = NpcType.getByName('sawmill_operator')!;
const param = (name: string) => operator.params?.get(ParamType.getId(name));
check('the operator owns it', InvType.get(Number(param('owned_shop')))?.debugname, 'construction_supplies');
check('and offers Trade', operator.op?.includes('Trade'), true);

// The shop's own arithmetic: price = cost * multiplier / 1000 (shop.rs2 ~calc_shop_value, with
// shop_delta 0 so there is no drift term).
const sell = Number(param('shop_sell_multiplier'));
const buy = Number(param('shop_buy_multiplier'));
check('sells at 130%', sell, 1300);
check('buys back at 50%', buy, 500);
check('and does not drift', Number(param('shop_delta')), 0);

const priced = (objName: string, mult: number) => Math.floor((ObjType.get(ObjType.getId(objName)).cost * mult) / 1000);

// What the OSRS wiki lists for Construction Supplies: stock of 1000 each.
const WIKI: [string, number, number][] = [
    // obj, price to buy, price it buys back at
    ['saw', 13, 5],
    ['bolt_of_cloth', 650, 250],
    ['nails_bronze', 2, 1],
    ['nails_iron', 5, 2],
    ['nails', 3, 1]
];

console.log(`\n  ${'item'.padEnd(16)} ${'cost'.padStart(5)} ${'buy'.padStart(5)} ${'wiki'.padStart(5)}  ${'sell'.padStart(5)} ${'wiki'.padStart(5)}`);
for (const [obj, wantBuy, wantSell] of WIKI) {
    const cost = ObjType.get(ObjType.getId(obj)).cost;
    console.log(`  ${obj.padEnd(16)} ${String(cost).padStart(5)} ${String(priced(obj, sell)).padStart(5)} ${String(wantBuy).padStart(5)}  ${String(priced(obj, buy)).padStart(5)} ${String(wantSell).padStart(5)}`);
    check(`${obj} costs ${wantBuy}`, priced(obj, sell), wantBuy);
    check(`...and sells back for ${wantSell}`, priced(obj, buy), wantSell);
}

console.log("\n================ THE STOCK IS THE WIKI'S, AND NOTHING ELSE");
{
    const objs = shop!.stockobj!;
    const counts = shop!.stockcount!;
    const rates = shop!.stockrate!;
    const stocked: string[] = [];
    for (let slot = 0; slot < objs.length; slot++) {
        if (objs[slot] === 0) continue;
        stocked.push(ObjType.get(objs[slot]).debugname ?? String(objs[slot]));
    }
    console.log(`  stocked: ${stocked.join(', ')}`);
    check('exactly the five the wiki lists', [...stocked].sort(), WIKI.map(w => w[0]).sort());
    // A thousand of each, as the wiki gives it.
    for (let slot = 0; slot < stocked.length; slot++) {
        check(`${stocked[slot]} stocks 1000`, counts[slot], 1000);
    }
    // The saw is the fastest-restocking line in the shop, which the wiki calls out by name.
    const sawSlot = stocked.indexOf('saw');
    check('the saw restocks faster than the rest', rates[sawSlot] < rates[stocked.indexOf('nails')], true);
}

console.log('\n================ AND DRAGON SLAYER IS BUYABLE AGAIN');
{
    // 30 steel nails at 3 coins is 90, against the 34 Smithing it used to take.
    check('thirty steel nails cost 90 coins', priced('nails', sell) * 30, 90);
}

console.log('\n================ AND IT OPENS, BOTH WAYS');
{
    // The config being right is not the same as the op being wired: [opnpc4] has to exist and the
    // dialogue branch has to reach ~openshop_activenpc with the npc still in scope.
    const shopIf = Component.getId('shop_template');
    const opened = (p: { username: string }) => H.ifaces.some(f => f.who === p.username && (f.com === shopIf || Component.get(f.com)?.comName?.startsWith('shop_template')));

    const byTrade = player('sawtrade', 3222, 3218);
    const npc = findNpc('sawmill_operator', byTrade);
    byTrade.teleport(npc.x + 1, npc.z, npc.level);
    H.tick(1);
    H.clearLogs();
    H.opNpc(byTrade, npc, 4);
    H.tick(6);
    check('Trade opens the shop', opened(byTrade), true);

    const byTalk = player('sawtalk', 3222, 3218);
    H.clearLogs();
    talk(byTalk, 'sawmill_operator', ['sell me some supplies', 'see the counter']);
    check('and so does the dialogue', opened(byTalk), true);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
