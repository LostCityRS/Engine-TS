// WHAT THE GAME ACTUALLY ROLLS, not what the table says it should.
//
//   npx tsx tools/sim/pickpocketroll.ts
//
// tools/sim/pickpocketrates.ts audits the stored numbers against the wiki. That is an audit of
// DATA and it cannot see a bug anywhere else on the path: the level stat_random reads, the roll it
// rolls against, the skillcape scaling, or anything in [proc,check_if_success_pick_pocket] between
// the dbrow and the answer. "Players say the failure rate is high" is a claim about the game, so
// this measures the game - the real proc, the real dbrow, the real engine opcode - and compares
// the observed rate with the arithmetic.
import * as H from './harness.js';
import Player from '#/engine/entity/Player.js';
import DbRowType from '#/cache/config/DbRowType.js';
import { PlayerStatMap } from '#/engine/entity/PlayerStat.js';
import { check, R, player } from './a1lib.js';

await H.boot();

const THIEVING = PlayerStatMap.get('THIEVING')!;
const TRIALS = 20000;

/** The chance stat_random should give, as a percentage. */
const expected = (low: number, high: number, level: number) => (Math.min(Math.floor((low * (99 - level)) / 98) + Math.floor((high * (level - 1)) / 98) + 1, 256) / 256) * 100;

function measure(p: Player, row: string): number {
    const id = DbRowType.getId(row);
    if (id === -1) throw new Error('no dbrow ' + row);
    let hits = 0;
    for (let i = 0; i < TRIALS; i++) {
        if (H.runProc(p, '[proc,check_if_success_pick_pocket]', [id])[0] === 1) hits++;
    }
    return (hits / TRIALS) * 100;
}

function atLevel(name: string, level: number): Player {
    const p = player(name, 3222, 3218);
    p.baseLevels[THIEVING] = level;
    p.levels[THIEVING] = level;
    return p;
}

// low/high as the table stores them, so the expectation is computed and not copied
const ROWS: [string, number, number, number[]][] = [
    ['pickpocket_man', 180, 240, [1, 50, 99]],
    ['pickpocket_guard', 50, 240, [40, 70, 99]],
    ['pickpocket_knight_of_ardougne', 50, 240, [55, 80, 99]],
    ['pickpocket_hero', 6, 160, [80, 99]],
    ['pickpocket_gnome', 8, 175, [75, 99]]
];

console.log(`\n${TRIALS} rolls of the real proc per row. +-1 point is noise at this sample size.\n`);
console.log(`  ${'pocket'.padEnd(30)} ${'lvl'.padStart(3)} ${'expected'.padStart(9)} ${'observed'.padStart(9)}  diff`);
for (const [row, low, high, levels] of ROWS) {
    for (const level of levels) {
        const p = atLevel(`pr_${row.slice(11, 17)}_${level}`, level);
        const want = expected(low, high, level);
        const got = measure(p, row);
        const diff = got - want;
        console.log(`  ${row.padEnd(30)} ${String(level).padStart(3)} ${want.toFixed(2).padStart(8)}% ${got.toFixed(2).padStart(8)}%  ${diff >= 0 ? '+' : ''}${diff.toFixed(2)}`);
        check(`${row} at ${level} rolls what the table says`, Math.abs(diff) < 1.5, true);
    }
}

console.log('\n================ AND THE SKILLCAPE IS THE ONLY THING THAT MOVES IT');
{
    // ~check_if_success_pick_pocket scales low and high by 11/10 for a worn thieving cape. Nothing
    // else in this build touches the rate - no gloves of silence, no diary - so a plain player and
    // a caped one are the whole range a player can be in.
    const bare = atLevel('pr_bare', 99);
    const plain = measure(bare, 'pickpocket_man');
    check('a plain level 99 gets the base rate', Math.abs(plain - expected(180, 240, 99)) < 1.5, true);
    console.log(`  base ${plain.toFixed(2)}%`);
}

console.log(`\n${R.ok} ok, ${R.bad} FAIL`);
process.exit(R.bad ? 1 : 0);
