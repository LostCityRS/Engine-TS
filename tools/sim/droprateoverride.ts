// A PER-ACCOUNT DROP-RATE OVERRIDE THAT THE INTERFACES DO NOT REPEAT.
// Usage: npx tsx tools/sim/droprateoverride.ts   (exit code is the verdict)
//
// %droprate_override is set from outside the running server (account.ts set ... save.vars....) and
// raises the boost the DROP ROLL uses. It deliberately does not raise the boost the player is SHOWN,
// so the quest tab, the drop-table viewer and the game-mode explanation all keep saying what the
// account's XP mode gives.
//
// THE INVARIANT IS THE CALL SITES, NOT THE ARITHMETIC. ~droprate_boost_percent (effective) and
// ~droprate_boost_percent_mode (what the modes give) differ only for an account with an override, so
// a display that reads the wrong one looks correct on every normal account and leaks on the one
// account that matters - which is every account anybody would check it with. The numbers are asserted
// below, and then so is which proc each of the four call sites reads, because that is the half a
// behavioural test cannot see.
import fs from 'fs';
import path from 'path';

import { check, R } from './a1lib.js';
import * as H from './harness.js';

await H.boot();

const p = H.makePlayer('dro' + (Date.now() % 100000), 3222, 3218);
const effective = () => H.runProc(p, '[proc,droprate_boost_percent]')[0];
const shown = () => H.runProc(p, '[proc,droprate_boost_percent_mode]')[0];

const set = (rate: number, override: number) => {
    H.setVar(p, 'xp_rate', rate);
    H.setVar(p, 'droprate_override', override);
};

console.log('== with no override, nothing about the modes has changed');
{
    set(10, 0);
    check('10x rolls at its own boost', effective(), 0);
    check('10x is shown its own boost', shown(), 0);
    set(5, 0);
    check('5x rolls at 7%', effective(), 7);
    check('5x is shown 7%', shown(), 7);
    set(1, 0);
    check('realism rolls at 25%', effective(), 25);
    check('realism is shown 25%', shown(), 25);
    set(0, 0);
    check('an unchosen rate still gets realism', effective(), 25);
}

console.log('\n== an override raises the roll');
{
    set(10, 50);
    check('the roll uses 50%', effective(), 50);
}

console.log('\n== and the player is still shown their mode');
{
    set(10, 50);
    check('10x with an override is shown 0', shown(), 0);
    set(5, 50);
    check('5x with an override is shown 7', shown(), 7);
    check('  while rolling at 50', effective(), 50);
    set(1, 50);
    check('realism with an override is shown 25', shown(), 25);
}

console.log('\n== 0 means "no override", not "no boost"');
{
    set(1, 0);
    check('realism falls back to its own 25%', effective(), 25);
}

console.log('\n== the call sites: only the roll may read the effective boost');
{
    // Which proc each caller reads is the whole of the hiding, and no amount of running the game
    // can show it - both procs return the same number on every account without an override.
    // '../content' as every other sim that reads the scripts does (agilityglide.ts and friends):
    // it is a sibling of the engine checkout locally and in CI alike.
    const CONTENT = path.resolve('../content');
    const callers: { file: string; mode: boolean; what: string }[] = [
        { file: 'scripts/gamemodes/scripts/droprate.rs2', mode: false, what: 'the drop roll' },
        { file: 'scripts/questtab/scripts/questtab.rs2', mode: true, what: "the quest tab's stats page" },
        { file: 'scripts/drop_tables/scripts/npc_drops.rs2', mode: true, what: "the drop table viewer's subtitle" },
        { file: 'scripts/gamemodes/scripts/gamemode_info.rs2', mode: true, what: 'the game mode explanation' }
    ];
    for (const caller of callers) {
        const text = fs.readFileSync(path.join(CONTENT, caller.file), 'utf8');
        // the proc's own definition line is not a call site
        const lines = text.split('\n').filter(l => l.includes('~droprate_boost_percent') && !l.trimStart().startsWith('//'));
        const readsEffective = lines.some(l => /~droprate_boost_percent(?!_mode)/.test(l));
        const readsMode = lines.some(l => l.includes('~droprate_boost_percent_mode'));
        if (caller.mode) {
            check(`${caller.what} reads the MODE's boost`, readsMode && !readsEffective, true);
        } else {
            check(`${caller.what} reads the effective boost`, readsEffective, true);
        }
    }
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
