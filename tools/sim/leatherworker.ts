// THE RANGING GUILD LEATHERWORKER - her menu, and her prices.
//
//   npx tsx tools/sim/leatherworker.ts
//
// She is a tanner reached through dialogue rather than a Trade option (the cache gives her
// op1=Talk-to and nothing else), which is why no dead-op sweep has anything to say about her and
// why this is the only thing that can check her.
//
// HER PRICES ARE THE AL KHARID ONES - 1, 3 and 20 - and she gets them by NOT being Sbott:
// [label,tan_soft_leather] in area_alkharid/scripts/tanner.rs2 reads ^werewolftanner_*_cost only
// when npc_type is werewolftanner and falls through to ^tanner_*_cost otherwise. That is correct
// for her and it is correct by accident of structure rather than by anything naming her, so it is
// worth pinning: a future tanner added the same way inherits it silently.
import * as H from './harness.js';
import Player from '#/engine/entity/Player.js';
import { check, R, player, talk } from './a1lib.js';

await H.boot();

const GUILD: [number, number] = [2658, 3439];
function customer(name: string, hides: Record<string, number>, coins: number): Player {
    const p = player(name, GUILD[0], GUILD[1]);
    H.clearInv(p);
    for (const [obj, n] of Object.entries(hides)) H.give(p, obj, n);
    if (coins > 0) H.give(p, 'coins', coins);
    return p;
}
const saw = (lines: string[], text: string) => lines.some(l => l.includes(text));

console.log('\n================ SHE TANS, AT THE AL KHARID PRICE');
{
    const p = customer('lwsoft', { cow_hide: 3 }, 100);
    talk(p, 'ranging_guild_leatherworker', ['tan something', 'Soft leather']);
    check('three cowhides become three leather', H.invCount(p, 'leather'), 3);
    check('...for one coin each, not two', H.invCount(p, 'coins'), 97);
}
{
    const p = customer('lwdhide', { dragonhide_green: 2 }, 100);
    talk(p, 'ranging_guild_leatherworker', ['tan something', 'Dragon hide']);
    check('two dragonhides become two dragon leather', H.invCount(p, 'dragon_leather'), 2);
    check('...at twenty coins each, not forty-five', H.invCount(p, 'coins'), 60);
}

console.log('\n================ AND STILL ANSWERS THE OTHER QUESTION');
{
    // @multi2 is a jump that never returns, so the has-hides branch used to replace the menu
    // rather than add to it: one cowhide in the pack took "What do you do here?" away, and the
    // only way to hear what she does was to bank your hides first.
    // a pick is required: drive() throws on a menu it was given no answer for, which is how it
    // reports a conversation that went somewhere unexpected rather than hanging on it.
    const withHides = customer('lwboth', { cow_hide: 1 }, 50);
    const lines = talk(withHides, 'ranging_guild_leatherworker', ['No thanks.']);
    check('the tan option is offered', saw(lines, "I'd like you to tan something for me."), true);
    check('...and so is "What do you do here?"', saw(lines, 'What do you do here?'), true);
    check('...and "No thanks."', saw(lines, 'No thanks.'), true);

    // and the no-hides menu is unchanged
    const empty = customer('lwempty', {}, 50);
    const bare = talk(empty, 'ranging_guild_leatherworker', ['No thanks.']);
    check('with no hides she still asks what you want to know', saw(bare, 'What do you do here?'), true);
    check('...and does not offer to tan nothing', saw(bare, "I'd like you to tan something for me."), false);
}

console.log('\n================ AND THE BRANCH ACTUALLY GOES SOMEWHERE');
{
    const p = customer('lwtalk', { cow_hide: 1 }, 50);
    const lines = talk(p, 'ranging_guild_leatherworker', ['What do you do here?', 'Dragonhide leather.', 'No thanks.']);
    // A SHORT SUBSTRING, because what comes back is one entry per chatbox LINE and the chatbox
    // wraps: her sentence arrives split across several, so no full sentence matches any one of
    // them. The first draft looked for "It costs 20 coins each piece." and failed on a branch
    // that had worked perfectly.
    check('picking it with hides in hand reaches her dragonhide answer', saw(lines, '20 coins'), true);
    check('and nothing was tanned on the way', H.invCount(p, 'leather'), 0);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
