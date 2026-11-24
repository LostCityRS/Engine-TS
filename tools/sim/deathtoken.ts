// The Death token, the Undertaker and the veteran, asked of the running engine.
//
// What is worth testing here is the RULE, not the art: a token is paid for a kill that counts
// towards a Slayer task AND happens in the Wilderness, and for nothing else. Either half alone is a
// different game - on-task alone pays for standing in Zanaris, in-the-Wilderness alone pays for
// killing rats under Edgeville - so the sim drives the real queue that counts a task kill, from
// both sides of the Wilderness line.
import * as H from './harness.ts';
import { check, R, player } from './a1lib.ts';
import InvType from '#/cache/config/InvType.js';
import NpcType from '#/cache/config/NpcType.js';
import ObjType from '#/cache/config/ObjType.js';
import ParamType from '#/cache/config/ParamType.js';
import Player from '#/engine/entity/Player.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import World from '#/engine/World.js';
import EnumType from '#/cache/config/EnumType.js';

await H.boot();

const TOKEN = ObjType.getId('death_token');
const paramOf = (npcName: string, paramName: string): unknown => {
    const t = NpcType.get(NpcType.getId(npcName));
    return t.params.get(ParamType.getId(paramName));
};

console.log('THE TOKEN ITSELF');
{
    const t = ObjType.get(TOKEN);
    check('  it exists and is named', t.name, 'Death token');
    check('  it stacks, because a currency must', !!t.stackable, true);
    // Untradeable is the whole design: an untradeable currency buying tradeable goods is a gold
    // laundry, and this one can only be earned where it is spent.
    check('  and it cannot be traded', (t as unknown as { tradeable: boolean }).tradeable, false);
}

console.log('\nTHE TWO WHO STAND AT EITHER END');
{
    const und = NpcType.get(NpcType.getId('undertaker'));
    check('  the Undertaker is there', und.name, 'The Undertaker');
    check('  with Talk-to and Trade', [und.op?.[0], und.op?.[3]], ['Talk-to', 'Trade']);
    check('  his shop is paid for in death tokens', paramOf('undertaker', 'shop_currency'), TOKEN);
    check('  and it has stock', paramOf('undertaker', 'owned_shop') !== undefined, true);
    const vet = NpcType.get(NpcType.getId('wilderness_veteran'));
    check('  the veteran is there too', vet.name, 'One-armed veteran');
    check('  and talks', vet.op?.[0], 'Talk-to');
    check('  both have a script on their Talk-to', [!!ScriptProvider.getByName('[opnpc1,undertaker]'), !!ScriptProvider.getByName('[opnpc1,wilderness_veteran]')], [true, true]);
}

console.log('\nWHERE A TOKEN COMES FROM');
{
    // The roll is a proc, so it can be asked directly - once from each side of the line, many
    // times, because what is being tested is a rate and a single roll says nothing.
    const held = (p: Player) => H.invCount(p, 'death_token');
    const rolls = (p: Player, n: number): number => {
        H.clearInv(p);
        for (let i = 0; i < n; i++) {
            H.runProc(p, '[proc,death_token_roll]', []);
        }
        return held(p);
    };

    // Edgeville, one tile south of the Wilderness line: not the Wilderness.
    const safe: Player = player('tokensafesim', 3094, 3519);
    const got = rolls(safe, 400);
    check('  no token is ever paid south of the line', got, 0);
    H.despawn(safe);

    // Level 1 of the Wilderness, and then deep: the deep roll must be the better one.
    const shallow: Player = player('tokenshallowsim', 3094, 3525);
    const deep: Player = player('tokendeepsim', 3094, 3900);
    const a = rolls(shallow, 4000);
    const b = rolls(deep, 4000);
    check('  tokens are paid at level 1', a > 0, true);
    check('  and more often deep in', b > a, true);
    // The rule is "three times as often by level 30", so the deep rate should be comfortably more
    // than double and not wildly more than treble. A loose band: a sim that demands an exact ratio
    // of a random process is a sim that fails on a Tuesday.
    check('  by roughly the factor the constant promises', b > a * 1.6 && b < a * 4.5, true);
    console.log(`    (${a} tokens from 4,000 kills at level 1, ${b} deep in)`);
    H.despawn(shallow, deep);
}

console.log('\nAND THE SHOP TAKES THEM');
{
    const p: Player = player('tokenshopsim', 3094, 3499);
    H.clearInv(p);
    H.give(p, 'death_token', 50);
    const inv = p.getInventory(InvType.getId('inv'))!;
    let stack = 0;
    for (let i = 0; i < inv.capacity; i++) {
        const o = inv.get(i);
        if (o && o.id === TOKEN) {
            stack += o.count;
        }
    }
    check('  fifty tokens take one slot', [stack, H.invCount(p, 'death_token')], [50, 50]);
    H.despawn(p);
}

console.log('\nTHE OUTFIT: STATUS, NOT POWER');
{
    // Corey's rule, 12 October: the shelf sells status and never power - nothing that changes a
    // combat number, nothing that can be pointed at another player. A rule nothing checks is a rule
    // that lasts until the next tired evening, so this walks the pieces and reads their params.
    const PIECES = ['undertaker_hat', 'undertaker_coat', 'undertaker_trousers', 'undertaker_boots', 'undertaker_cane'];
    const COMBAT = ['stabattack', 'slashattack', 'crushattack', 'magicattack', 'rangeattack', 'stabdefence', 'slashdefence', 'crushdefence', 'magicdefence', 'rangedefence', 'strengthbonus', 'rangedbonus', 'magicdamage', 'prayerbonus'];
    const armed: string[] = [];
    const sellable: string[] = [];
    const keepable: string[] = [];
    for (const name of PIECES) {
        const t = ObjType.get(ObjType.getId(name));
        for (const pname of COMBAT) {
            const pid = ParamType.getId(pname);
            if (pid !== -1 && t.params.get(pid)) {
                armed.push(`${name}.${pname}`);
            }
        }
        if ((t as unknown as { tradeable: boolean }).tradeable) {
            sellable.push(name);
        }
        // destroy_death does NOT destroy anything - it means "not eligible to be one of the items
        // you keep". It is what stops Protect Item saving a piece and making the stake conditional.
        if (!t.params.get(ParamType.getId('destroy_death'))) {
            keepable.push(name);
        }
    }
    check(
        '  all five pieces exist',
        PIECES.every(n => ObjType.getId(n) !== -1),
        true
    );
    check('  and not one carries a combat bonus', armed, []);
    check('  none of them can be traded', sellable, []);
    check('  and none can be kept on death or saved by Protect Item', keepable, []);
}

console.log('\nTHE BOUNTY CANNOT PRINT TOKENS');
{
    // THE invariant. Tokens are untradeable, so paying a killer is the only route one can take from
    // one account to another; the piece is destroyed when it pays, so a boosting pair spends the
    // shop price to collect the bounty. Strictly below cost, that loses them tokens. At or above it,
    // the same pair prints them for free. Swept over the WHOLE obj table, not just today's five.
    const bountyParam = ParamType.getId('pvp_token_bounty');
    check('  the param exists', bountyParam !== -1, true);
    const carriers: string[] = [];
    const broken: string[] = [];
    for (let id = 0; id < ObjType.count; id++) {
        const t = ObjType.get(id);
        const bounty = t.params.get(bountyParam) as number | undefined;
        if (!bounty) {
            continue;
        }
        carriers.push(t.debugname ?? String(id));
        if (bounty >= t.cost) {
            broken.push(`${t.debugname}: ${bounty} >= ${t.cost}`);
        }
    }
    check('  every item that pays a bounty pays LESS than it costs', broken, []);
    console.log(`    (${carriers.length} items carry one: ${carriers.join(', ')})`);
}

// H.invCount reads the BACKPACK, and a worn hat is never in it - so "it is gone" asserted with
// invCount is an assertion that was already true before the proc ran. The first run of this file
// passed that check against a hat it had not touched. Count the slot the thing is actually in.
const wornCount = (p: Player, objName: string): number => {
    const id = ObjType.getId(objName);
    const worn = p.getInventory(InvType.getId('worn'))!;
    let n = 0;
    for (let i = 0; i < worn.capacity; i++) {
        const slot = worn.get(i);
        if (slot && slot.id === id) {
            n += slot.count;
        }
    }
    return n;
};

console.log('\nAND THE OUTFIT IS LOST WHERE IT IS WORN');
{
    const WORN = InvType.getId('worn');
    const hat = ObjType.getId('undertaker_hat');
    const bounty = ObjType.get(hat).params.get(ParamType.getId('pvp_token_bounty')) as number;

    // Deep in the Wilderness, with somebody standing over the body.
    const victim: Player = player('tokenvictimsim', 3094, 3700);
    const killer: Player = player('tokenkillersim', 3095, 3700);
    H.equip(victim, { hat: 'undertaker_hat' });
    check('  the hat is on his head to begin with', wornCount(victim, 'undertaker_hat'), 1);
    const owed = H.runProc(victim, '[proc,undertaker_outfit_destroy]', [WORN])[0];
    check('  and is destroyed north of the line', wornCount(victim, 'undertaker_hat'), 0);
    check('  and it reports exactly what it destroyed', owed, bounty);

    H.runProc(victim, '[proc,undertaker_outfit_pay]', [killer.uid, owed], killer);
    const paid = World.getObj(victim.x, victim.z, victim.level, TOKEN, killer.hash64);
    check('  the tokens land in the pile, flagged to the killer', paid?.count ?? 0, bounty);
    // The whole exploit defence in one line: what the killer gains is less than what the victim
    // must spend to put the hat back on.
    check('  and are worth less than the hat cost', (paid?.count ?? 0) < ObjType.get(hat).cost, true);
    H.despawn(victim, killer);
}

{
    // South of the line it is just a hat.
    const WORN = InvType.getId('worn');
    const safe: Player = player('tokensafehatsim', 3094, 3519);
    H.equip(safe, { hat: 'undertaker_hat' });
    const owed = H.runProc(safe, '[proc,undertaker_outfit_destroy]', [WORN])[0];
    check('  nothing is destroyed south of it', [wornCount(safe, 'undertaker_hat'), owed], [1, 0]);
    H.despawn(safe);
}

console.log('\nAND THE FOUR-PIECE SET PAYS - THE CANE IS NOT ONE OF THE FOUR');
{
    // The bonus is a percentage, so it can only be read off a rate, and a rate needs volume: a
    // thousand rolls would not separate 10% from noise. Both runs sit on the same tile at the same
    // depth, so the only difference between them is what the player is wearing.
    const N = 40000;
    const rolls = (p: Player): number => {
        H.clearInv(p);
        for (let i = 0; i < N; i++) {
            H.runProc(p, '[proc,death_token_roll]', []);
        }
        return H.invCount(p, 'death_token');
    };

    const bare: Player = player('tokenbaresim', 3094, 3700);
    const suited: Player = player('tokensuitsim', 3095, 3700);
    H.equip(suited, {
        hat: 'undertaker_hat',
        torso: 'undertaker_coat',
        legs: 'undertaker_trousers',
        feet: 'undertaker_boots'
    });
    check('  the four pieces read as a set', H.runProc(suited, '[proc,undertaker_set_worn]', [])[0], 1);
    check('  and three of them do not', H.runProc(bare, '[proc,undertaker_set_worn]', [])[0], 0);

    // THE CANE IS NOT REQUIRED, which is the whole reason the set is four and not five: it takes
    // the weapon hand, and a player who cannot fight cannot earn a token to be paid a bonus on.
    H.equip(bare, {
        hat: 'undertaker_hat',
        torso: 'undertaker_coat',
        legs: 'undertaker_trousers',
        feet: 'undertaker_boots',
        rhand: 'undertaker_cane'
    });
    check('  the cane neither makes nor breaks it', H.runProc(bare, '[proc,undertaker_set_worn]', [])[0], 1);
    H.despawn(bare);

    const plain: Player = player('tokenplainsim', 3094, 3700);
    const a = rolls(plain);
    const b = rolls(suited);
    const gain = Math.round(((b - a) / a) * 1000) / 10;
    console.log(`    (${a} bare, ${b} suited over ${N.toLocaleString()} kills each: +${gain}%)`);
    // The constant says 10. A band rather than a number, because this is a random process and a sim
    // that demands an exact ratio of one is a sim that fails on a Tuesday - but a tight enough band
    // that the OLD integer-odds roll, which turned a 10% bonus into 33%, would not pass it.
    check('  the set pays about the ten per cent the constant promises', gain > 4 && gain < 18, true);
    H.despawn(plain, suited);
}

console.log('\nNOTHING YOU CAN SWING CRASHES THE MELEE SCRIPT');
{
    // From a live backtrace on 12 October: "sound_synth An input number was null(-1)",
    // player_melee.rs2:91, swinging the Undertaker's cane.
    //
    // ~combat_swing_anim_and_synth sends a weapon with NO category to the unarmed swing, which is
    // why the cache's own Black cane never did this. A weapon WITH a category goes on to read the
    // anim and the sound for the damage type - and crushattack_anim defaults (to a kick) while
    // crush_sound DEFAULTS TO NULL. The missing sound is the crash; the missing anim was only why
    // it looked like a kick.
    //
    // Swept over every wieldable in the game rather than the one that broke, because the trap is
    // the param default and not the cane: anything given a category without a sound is the same
    // crash waiting for somebody to equip it.
    // rangeattack_sound counts: a bow is read down the ranged branch of the same switch, and every
    // bow, crossbow, dart and knife in the game would otherwise be reported here.
    const SOUND_OF = ['stab_sound', 'slash_sound', 'crush_sound', 'rangeattack_sound'];
    const silent: string[] = [];
    for (let id = 0; id < ObjType.count; id++) {
        const t = ObjType.get(id);
        if (t.wearpos !== 3 || t.category === -1 || t.category === undefined) {
            continue; // not held in the right hand, or no category: the unarmed swing catches it
        }
        const has = SOUND_OF.some(p => {
            const pid = ParamType.getId(p);
            return pid !== -1 && t.params.get(pid) !== undefined;
        });
        if (!has) {
            silent.push(t.debugname ?? String(id));
        }
    }
    // NOT a failure any more, because player_melee.rs2 guards the call now - which is the fix that
    // covers everything, including whatever gets a category next. Printed rather than asserted so
    // the list stays visible: none of these ten wants a sound of its own, because none of them is a
    // weapon, and inventing one for a banana would be inventing content to satisfy a check.
    console.log(`    (${silent.length} held items carry a category and no swing sound, all of them` + ` pre-existing and all of them harmless now: ${silent.join(', ')})`);
    const cane = ObjType.get(ObjType.getId('undertaker_cane'));
    check('  and the cane in particular', [cane.params.get(ParamType.getId('crush_sound')) !== undefined, cane.params.get(ParamType.getId('crushattack_anim')) !== undefined], [true, true]);
    // A nicer animation and nothing else: attackrate is left at its default of 4, a bare fist's,
    // and the cache cane's +16 crush and +13 strength are deliberately not copied.
    for (const pname of ['attackrate', 'crushattack', 'stabattack', 'slashattack', 'strengthbonus']) {
        const pid = ParamType.getId(pname);
        check(`  the cane has no ${pname}`, pid === -1 || cane.params.get(pid) === undefined, true);
    }
}

console.log('\nTHE GRAVEDIGGER KIT CHANGES THE LOOK AND NOTHING ELSE');
{
    // An ornament kit cannot sell power by construction - the result copies the base item's stats -
    // but "by construction" holds only while somebody keeps typing the same numbers, so they are
    // compared here rather than trusted. poh_battery makes this comparison for the fourteen OSRS
    // colours; the Gravedigger is the one it does not know about, because it is not one of them.
    const differs = (a: string, b: string): string[] => {
        const A = ObjType.get(ObjType.getId(a));
        const B = ObjType.get(ObjType.getId(b));
        const out: string[] = [];
        for (const pname of [
            'stabdefence',
            'slashdefence',
            'crushdefence',
            'magicdefence',
            'rangedefence',
            'stabattack',
            'slashattack',
            'crushattack',
            'magicattack',
            'rangeattack',
            'strengthbonus',
            'prayerbonus',
            'slayer_headgear',
            'slayer_helmet',
            'slayer_imbued'
        ]) {
            const pid = ParamType.getId(pname);
            if (pid === -1) {
                continue;
            }
            if (String(A.params.get(pid)) !== String(B.params.get(pid))) {
                out.push(pname);
            }
        }
        return out;
    };
    check('  the plain Gravedigger is the plain helmet, stat for stat', differs('slayer_helm_gravedigger', 'slayer_helm'), []);
    check('  and the imbued one is the imbued helmet', differs('slayer_helm_gravedigger_i', 'slayer_helm_i'), []);

    const par = (o: string, p: string) => ObjType.get(ObjType.getId(o)).params.get(ParamType.getId(p));
    check('  the kit is named by both base helmets', [par('slayer_helm', 'ornament_kit'), par('slayer_helm_i', 'ornament_kit')], [ObjType.getId('gravedigger_kit'), ObjType.getId('gravedigger_kit')]);
    check('  each base turns into its own Gravedigger', [par('slayer_helm', 'ornament_into'), par('slayer_helm_i', 'ornament_into')], [ObjType.getId('slayer_helm_gravedigger'), ObjType.getId('slayer_helm_gravedigger_i')]);
    check('  and each Gravedigger remembers what it came from', [par('slayer_helm_gravedigger', 'ornament_from'), par('slayer_helm_gravedigger_i', 'ornament_from')], [ObjType.getId('slayer_helm'), ObjType.getId('slayer_helm_i')]);

    // Revert sits on iop5, because a slayer helmet already spends iop4 on Disassemble. A Revert
    // trigger on a slot the item does not declare is an option that silently does nothing.
    for (const n of ['slayer_helm_gravedigger', 'slayer_helm_gravedigger_i']) {
        check('  ' + n + ' declares Revert where its trigger looks', ObjType.get(ObjType.getId(n)).iop?.[4], 'Revert');
    }
    check(
        '  neither it nor the kit can be traded',
        [(ObjType.get(ObjType.getId('gravedigger_kit')) as unknown as { tradeable: boolean }).tradeable, (ObjType.get(ObjType.getId('slayer_helm_gravedigger')) as unknown as { tradeable: boolean }).tradeable],
        [false, false]
    );
}

console.log('\nAND EVERYTHING ONLY HE SELLS IS ON THE COLLECTION LOG');
{
    // The page and the shelf are two lists of the same things, kept in two files, and nothing makes
    // them agree. This is what makes them agree: add a row to the shop and forget the page, and the
    // item is unloggable and the check says so.
    //
    // The Scroll of imbuing is the one exception and it is deliberate - he sells it, but it is a
    // drop first and belongs to Slayer's page, not his.
    // EnumType.values is a Map, not a plain object - the first version read it as one and found
    // nothing, which passed as "0 items in the whole log" instead of failing honestly.
    const logged = new Set<number>();
    for (const v of EnumType.get(EnumType.getId('collection_log_items')).values.values()) {
        logged.add(Number(v));
    }
    check('  the log has items in it at all', logged.size > 0, true);
    const shop = InvType.getId('death_token_shop');
    const missing: string[] = [];
    // THE WHOLE SHELF, not a hardcoded eight. The shelf grew to 17 rows when the nine whip colour
    // kits landed, and a fixed bound here would have gone on passing while checking none of them -
    // which is the one way a check like this fails silently.
    for (let i = 0; i < InvType.get(shop).size; i++) {
        const o = World.getInventory(shop)?.get(i);
        if (!o || o.id === ObjType.getId('slayer_imbue_scroll')) {
            continue;
        }
        if (!logged.has(o.id)) {
            missing.push(ObjType.get(o.id).debugname ?? String(o.id));
        }
    }
    check('  every row he alone sells can be logged', missing, []);
    console.log(`    (${logged.size} items in the whole log)`);
}

console.log('\nTHE ROYAL SEED POD STOPS AT LEVEL 30');
{
    // Old School's own cap for this item, and the same one the amulet of glory carries here. It is
    // also the whole reason a teleport is allowed on a shelf whose rule says no escape from the
    // Wilderness: below 30 a player can already leave with runes or jewellery, so the pod sells
    // convenience and not capability. Above 30 it must refuse, or that argument is worth nothing.
    const podAt = (tag: string, z: number): boolean => {
        const p: Player = player('podsim' + tag, 3094, z);
        H.clearInv(p);
        H.give(p, 'royal_seed_pod', 1);
        const from = { x: p.x, z: p.z };
        H.opheld(p, 'royal_seed_pod', 1);
        for (let i = 0; i < 8; i++) {
            World.cycle(); // the teleport sits behind a p_delay
        }
        const moved = p.x !== from.x || p.z !== from.z;
        H.despawn(p);
        return moved;
    };
    const deep: Player = player('podlevelprobe', 3094, 3760);
    const shallow: Player = player('podlvlshallow', 3094, 3650);
    const deepLvl = H.runProc(deep, '[proc,wilderness_level]', [deep.coord])[0];
    const shallowLvl = H.runProc(shallow, '[proc,wilderness_level]', [shallow.coord])[0];
    H.despawn(deep, shallow);
    console.log(`    (z 3650 is wilderness level ${shallowLvl}, z 3760 is ${deepLvl})`);
    check('  the two test tiles straddle the cap', [shallowLvl <= 30, deepLvl > 30], [true, true]);
    check('  it works below the cap', podAt('lo', 3650), true);
    check('  and is blocked above it', podAt('hi', 3760), false);
}

console.log('\nAND THE SHELF SELLS THEM');
{
    const shop = InvType.getId('death_token_shop');
    const stocked: string[] = [];
    for (let i = 0; i < InvType.get(shop).size; i++) {
        const o = World.getInventory(shop)?.get(i);
        if (o) {
            stocked.push(ObjType.get(o.id).debugname ?? String(o.id));
        }
    }
    for (const want of ['slayer_imbue_scroll', 'undertaker_hat', 'undertaker_coat', 'undertaker_trousers', 'undertaker_boots', 'undertaker_cane', 'gravedigger_kit', 'undertaker_cape', 'royal_seed_pod']) {
        check(`  ${want}`, stocked.includes(want), true);
    }
    // THE SHELF CANNOT RUN OUT. It held one of each, server-wide, so the first player to buy a hat
    // left the next one waiting a minute for the restock - a shop whose stock is the limit, when the
    // limit was always meant to be how many tokens you had earned. The engine has no unlimited flag;
    // a big count topped up every tick is what unlimited means here.
    const t = InvType.get(shop);
    // Array.from, because these come off the cache as typed arrays - comparing a Uint16Array to a
    // plain one by value fails on the type, not on the numbers, which is what the first run did.
    const counts = Array.from((t as unknown as { stockcount: number[] }).stockcount ?? []);
    const rates = Array.from((t as unknown as { stockrate: number[] }).stockrate ?? []);
    const rowCount = InvType.get(shop).size;
    check('  every row holds a thousand', counts.slice(0, rowCount), new Array(rowCount).fill(1000));
    check('  and tops itself up every tick', rates.slice(0, rowCount), new Array(rowCount).fill(1));
    // Unstackable items a thousand at a time need ALWAYS_STACK or they want a thousand slots in a
    // shelf that has eight.
    check('  and the shelf always stacks, which is what lets it', !!(t as unknown as { stackall: boolean }).stackall, true);
}

console.log('\nAND THE FIGHTER TORSO (23 November)');
{
    // The one row on this shelf that is not a cosmetic, which the shelf's own comment says in as
    // many words. Barbarian Assault sells it for 375 Honour points in Old School and is not in this
    // build, so the Undertaker is the only way one exists; whether a Wilderness currency should buy
    // a melee upgrade is a judgement recorded on death_token_shop.inv, not here.
    const shop = InvType.getId('death_token_shop');
    const torso = ObjType.getId('fighter_torso');
    const stocked: number[] = [];
    for (let i = 0; i < InvType.get(shop).size; i++) {
        const o = World.getInventory(shop)?.get(i);
        if (o) stocked.push(o.id);
    }
    check('  he stocks it', stocked.includes(torso), true);

    // PRICED OFF THE OBJ, never copied: cost IS the token price at 1000 per mille, so a number
    // repeated here would go stale the moment the price moved.
    const t = ObjType.get(torso);
    const dearest = ['whip_kit_gravedigger', 'ancient_fabric', 'undertaker_cape'].map(n => ObjType.get(ObjType.getId(n)).cost);
    check('  at 500 tokens', t.cost, 500);
    check('  which is the top of his shelf, not above it', t.cost <= Math.max(...dearest), true);
    check('  and five times the scroll his comment benchmarks', t.cost / ObjType.get(ObjType.getId('slayer_imbue_scroll')).cost, 5);
    check('  it stays on the account that bought it', t.tradeable, false);

    // IT IS NOT PART OF THE OUTFIT CONTRACT, and that is deliberate: the five pieces and the cape
    // carry pvp_token_bounty and destroy_death so a cosmetic has a stake behind it. Giving those to
    // a 500-token body would mean losing it outright to any Wilderness death. Every other
    // non-outfit row here is the same - the whip kits, the seed pod, the fabric, the scroll.
    const bounty = ParamType.getId('pvp_token_bounty');
    const destroy = ParamType.getId('destroy_death');
    check('  no bounty is paid for killing someone wearing it', t.params.get(bounty), undefined);
    check('  and it is not destroyed on death', t.params.get(destroy), undefined);
    check('  as is true of the other non-outfit rows', ObjType.get(ObjType.getId('whip_kit_bone')).params.get(bounty), undefined);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
