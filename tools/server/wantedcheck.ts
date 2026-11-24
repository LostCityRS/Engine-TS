/**
 * WHO IS STRANDED PART-WAY THROUGH WANTED! (custom, 2026-11-24).
 *
 * The quest gained its Old School entry requirements - 32 quest points, The Lost Tribe, Priest in
 * Peril and Enter the Abyss - and they are checked where Old School checks them: when you ask Sir
 * Tiffy to start. Nothing re-checks a player who was ALREADY past that point when the requirements
 * landed, which is right (taking a quest away from somebody mid-run would be worse), but it does
 * mean a player can be carrying a commorb for a quest they could no longer begin. If such a player
 * ever drops back to the start - a bug, a rollback, a reset - Tiffy will refuse them and the quest
 * becomes unfinishable with no way to see why from in game.
 *
 * So this says who those players are, before somebody reports it as a broken quest.
 *
 *   npx tsx tools/server/wantedcheck.ts              mid-quest players who no longer qualify
 *   npx tsx tools/server/wantedcheck.ts --all        every player who has touched the quest
 *   npx tsx tools/server/wantedcheck.ts --name "iron sgt"
 *   npx tsx tools/server/wantedcheck.ts --profile main
 *
 * IT ONLY EVER READS. There is no --fix and there should not be: what to do about a stranded
 * player is a judgement (grant the missing quest? roll their stage back? leave them be?), and
 * account.ts already does each of those properly, refusing to write while they are logged in.
 *
 * A SAVE IS STALE WHILE ITS OWNER IS ONLINE. The server holds the character in memory and writes
 * the file at logout, so a player who is logged in right now reads here as whatever they were when
 * they last logged out. That is noted in the output rather than hidden, because a quest stage that
 * looks wrong is the first thing somebody would chase.
 */
// World FIRST, and not alphabetically - Player and NetworkPlayer are a cycle and only World's
// module graph pulls them in the order that resolves. Same line, same reason, as account.ts.
import World from '#/engine/World.js';

import fs from 'fs';
import path from 'path';

import VarBitType from '#/cache/config/VarBitType.js';
import VarPlayerType from '#/cache/config/VarPlayerType.js';
import type Player from '#/engine/entity/Player.js';
import { PlayerLoading } from '#/engine/entity/PlayerLoading.js';
import Packet from '#/io/Packet.js';
import Environment from '#/util/Environment.js';

function parseArgs(argv: string[]): Record<string, string | boolean> {
    const out: Record<string, string | boolean> = {};
    for (let i = 0; i < argv.length; i++) {
        if (!argv[i].startsWith('--')) continue;
        const next = argv[i + 1];
        out[argv[i].slice(2)] = next === undefined || next.startsWith('--') ? true : (i++, next);
    }
    return out;
}
const args = parseArgs(process.argv.slice(2));
const profile = typeof args.profile === 'string' ? args.profile : Environment.NODE_PROFILE;

function fail(why: string): never {
    console.error(why);
    process.exit(1);
}

// ---------------------------------------------------------------- the numbers, from the content
//
// READ OUT OF THE CONTENT RATHER THAN TYPED HERE. Every value below lives in a .constant file in
// the content repository, and they are exactly the kind that move - 32 quest points is Old
// School's number today, and the whole reason this tool exists is that the requirements CHANGED.
// A copy typed into the engine would be right this afternoon and quietly wrong the next time
// somebody edits the quest, and "quietly wrong" here means telling Corey a player is fine when
// they are not.
const NEEDED = ['wanted_req_questpoints', 'wanted_complete', 'lost_tribe_complete', 'priestperil_complete', 'miniquest_abyssal_complete'] as const;

type Test = { varName: string; constName: string; gte?: boolean };
type Quest = { points: string; kind: 'eq' | 'gte' | 'either' | 'bit' | 'unknown'; tests: Test[]; cond?: string };

function readContent(dir: string): { consts: Record<string, number>; quests: Quest[] } | null {
    const root = path.join(dir, 'scripts');
    if (!fs.existsSync(root)) return null;
    const consts: Record<string, number> = {};
    let counter = '';
    const walk = (d: string) => {
        for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
            const full = path.join(d, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (entry.name.endsWith('.constant')) {
                for (const line of fs.readFileSync(full, 'utf8').split('\n')) {
                    const m = /^\^(\w+)\s*=\s*(-?\d+)\s*(?:\/\/.*)?$/.exec(line.trim());
                    if (m) consts[m[1]] = Number(m[2]);
                }
            } else if (entry.name === 'quests.rs2') {
                counter = fs.readFileSync(full, 'utf8');
            }
        }
    };
    walk(root);
    if (!counter) return null;

    // QUEST POINTS ARE NOT IN THE SAVE AT ALL. %qp has no `scope=perm`, so it is never written to
    // the file - the server recomputes it with ~count_questpoints at login, from every quest's own
    // varp. Reading `qp` off a save gives 0 for everybody, which would have had this tool report
    // "0/32 quest points" against every player on the box and call them all stranded.
    //
    // So the count is reproduced by reading that proc, which is the game's own source of truth and
    // follows it when a quest is added. But it is NOT uniform - 109 quests award points through
    // five different shapes of test:
    //
    //     if (%runemysteries = ^runemysteries_complete)                    exact
    //     if (%elenaquest >= ^elena_complete)                              at-or-past
    //     if (%blackarmgang = ^x | %phoenixgang = ^y)                      either gang
    //     if (testbit(%elemental_workshop_bits, ^complete) = ^true)        a bit
    //     if (~get_cog_progress = ^quest_cog_complete)                     A PROCEDURE CALL
    //
    // That last one cannot be evaluated by reading text, and pretending otherwise is how a tool
    // reports a confident wrong number. So each block is classified, the ones that can be decided
    // are decided, and the rest are carried as an UNKNOWN WORTH - giving a floor and a ceiling
    // instead of a single figure that would be wrong for the players who have done the most.
    const body = /\[proc,count_questpoints\]([\s\S]*?)\n\[/.exec(counter);
    if (!body) return null;
    const quests: Quest[] = [];
    // THE `[ \t]*(?:\/\/[^\n]*)?` IS NOT DECORATION. Several of these blocks carry a trailing line
    // comment after the brace - "// 80 = armadyl completion, 90 = lucien completion" - and without
    // somewhere for it to go the non-greedy condition runs on PAST the end of its own block and
    // swallows the next one. That silently cost 4 quests and mangled the conditions it reported.
    const re = /if\s*\(([\s\S]*?)\)\s*\{[ \t]*(?:\/\/[^\n]*)?\s*\$questpoints\s*=\s*add\(\$questpoints,\s*\^(\w+)\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body[1])) !== null) {
        const cond = m[1].trim();
        const points = m[2];
        const simple = /^%(\w+)\s*(>=|=)\s*\^(\w+)$/.exec(cond);
        if (simple) {
            quests.push({ points, kind: simple[2] === '>=' ? 'gte' : 'eq', tests: [{ varName: simple[1], constName: simple[3] }] });
            continue;
        }
        // The two gangs of Shield of Arrav: either side completes it, and a player can only ever
        // have done one of them.
        const parts = cond.split('|').map(x => x.trim());
        if (parts.length > 1 && parts.every(x => /^%(\w+)\s*(>=|=)\s*\^(\w+)$/.test(x))) {
            quests.push({
                points,
                kind: 'either',
                tests: parts.map(x => {
                    const q = /^%(\w+)\s*(>=|=)\s*\^(\w+)$/.exec(x)!;
                    return { varName: q[1], constName: q[3], gte: q[2] === '>=' };
                })
            });
            continue;
        }
        const bit = /^testbit\(%(\w+),\s*\^(\w+)\)\s*=\s*\^true$/.exec(cond);
        if (bit) {
            quests.push({ points, kind: 'bit', tests: [{ varName: bit[1], constName: bit[2] }] });
            continue;
        }
        quests.push({ points, kind: 'unknown', tests: [], cond });
    }
    if (quests.length === 0) return null;
    for (const name of NEEDED) if (!(name in consts)) return null;
    return { consts, quests };
}

const contentDir = typeof args.content === 'string' ? args.content : '../content';
const content = readContent(contentDir);
if (!content) {
    fail(
        `Could not read the quest rules from ${contentDir}.\n` +
            "This tool reproduces the game's own quest-point count out of the content, because quest\n" +
            'points are not stored in a save file - the server recomputes them at login. Without the\n' +
            'content beside the engine there is no honest number to report, so it stops rather than\n' +
            'guessing. Pass --content <path> if it lives somewhere else.'
    );
}
const C = content.consts;

// ---------------------------------------------------------------- reading a save
if (!fs.existsSync('data/pack')) {
    fail('data/pack is empty or missing - there is no cache here to read varp and varbit names from.\nBuild it first (npm run build), or start the server once, then run this again.');
}
World.reload();
if (VarPlayerType.count === 0) {
    fail('The cache loaded but has no varps in it, so every reading below would be zero. Rebuild data/pack.');
}

// A QUEST VAR IS SOMETIMES A VARP AND SOMETIMES A VARBIT, and the content writes both as %name
// with nothing to tell them apart. wanted_main and lost_tribe_quest are varbits (slices of
// quest_wanted and lost_tribe); priestperil and abyssal_miniquest are varps. So this resolves a
// name the way the compiler does - varp first, then varbit - rather than making the caller know.
function readVar(player: Player, name: string): number {
    const pid = VarPlayerType.getId(name);
    if (pid !== -1) return player.vars[pid] ?? 0;
    const bid = VarBitType.getId(name);
    if (bid === -1) fail(`This build has no varp or varbit called ${name}. Is data/pack older than the content?`);
    // A VARBIT IS A SLICE OF A VARP, not a variable of its own. Reading the base varp whole would
    // be right only until something else is packed into the spare bits above it.
    const vb = VarBitType.get(bid);
    const bits = vb.endbit - vb.startbit + 1;
    const mask = bits >= 31 ? 0x7fffffff : (1 << bits) - 1;
    return ((player.vars[vb.basevar] ?? 0) >>> vb.startbit) & mask;
}

// A FLOOR AND A CEILING, not a figure. Everything this tool can decide is decided; everything it
// cannot - the procedure call, and any shape added later that the parser does not know - is worth
// somewhere between nothing and its full value, so it widens the gap instead of being guessed at.
//
// WHY THAT IS ENOUGH TO ANSWER THE QUESTION. If the floor already clears 32 the player qualifies
// whatever the unknowns are worth, and if the ceiling is under 32 they cannot. Only a player
// between the two needs a human to look, and the tool says exactly which quests it could not read.
function questPoints(player: Player): { floor: number; ceiling: number; unknown: string[] } {
    let floor = 0;
    let unknownWorth = 0;
    const unknown: string[] = [];
    for (const q of content!.quests) {
        const worth = C[q.points];
        if (worth === undefined) continue;
        if (q.kind === 'unknown') {
            unknownWorth += worth;
            unknown.push(q.cond ?? '?');
            continue;
        }
        const holds = (t: Test, gte: boolean) => {
            const want = C[t.constName];
            if (want === undefined) return false;
            const got = readVar(player, t.varName);
            return q.kind === 'bit' ? ((got >>> want) & 1) === 1 : gte ? got >= want : got === want;
        };
        const ok = q.kind === 'either' ? q.tests.some(t => holds(t, t.gte === true)) : q.tests.every(t => holds(t, q.kind === 'gte'));
        if (ok) floor += worth;
    }
    return { floor, ceiling: floor + unknownWorth, unknown };
}

const dir = path.join('data/players', profile);
if (!fs.existsSync(dir)) fail(`No saves at ${dir} - is --profile right? (this one is "${profile}")`);

function savedNames(): string[] {
    return fs
        .readdirSync(dir)
        .filter(f => f.endsWith('.sav'))
        .map(f => f.slice(0, -4));
}

const names = (typeof args.name === 'string' ? [args.name.toLowerCase().replace(/ /g, '_')] : savedNames()).sort();

type Row = { name: string; stage: number; qp: { floor: number; ceiling: number; unknown: string[] }; missing: string[] };
const rows: Row[] = [];
let unreadable = 0;

for (const name of names) {
    const file = path.join(dir, `${name}.sav`);
    if (!fs.existsSync(file)) fail(`No save for "${name}" at ${file}`);
    let player: Player;
    try {
        player = PlayerLoading.load(name, new Packet(new Uint8Array(fs.readFileSync(file))), null);
    } catch {
        // A save this tool cannot read is worth one line, not a crash that hides the other 400.
        unreadable++;
        continue;
    }
    const stage = readVar(player, 'wanted_main');
    if (stage === 0 && args.all !== true) continue;

    const missing: string[] = [];
    const qp = questPoints(player);
    if (qp.ceiling < C.wanted_req_questpoints) missing.push(`${qp.ceiling}/${C.wanted_req_questpoints} quest points`);
    else if (qp.floor < C.wanted_req_questpoints) missing.push(`quest points uncertain (${qp.floor}-${qp.ceiling} of ${C.wanted_req_questpoints})`);
    // "<" and not "!=", exactly as wanted_tiffy.rs2 tests them: a player who finished Priest in
    // Peril and then earned holy-barrier access sits ABOVE the completion value, and != would
    // report precisely the players who had done the most.
    if (readVar(player, 'lost_tribe_quest') < C.lost_tribe_complete) missing.push('The Lost Tribe');
    if (readVar(player, 'priestperil') < C.priestperil_complete) missing.push('Priest in Peril');
    if (readVar(player, 'abyssal_miniquest') < C.miniquest_abyssal_complete) missing.push('Enter the Abyss');
    rows.push({ name, stage, qp, missing });
}

// ---------------------------------------------------------------- what it found
const STAGE: Record<number, string> = { 0: 'not started', 10: 'recruited', 20: 'briefed', 30: 'hunting', 40: 'cornered', 50: 'complete' };
const label = (s: number) => STAGE[s] ?? `stage ${s}`;

console.log(`Wanted! entry requirements, against ${names.length} save(s) in ${dir}`);
const unreadable2 = content.quests.filter(q => q.kind === 'unknown');
const unknownWorth = unreadable2.reduce((n, q) => n + (C[q.points] ?? 0), 0);
console.log(`  rules read live from ${contentDir}: ${content.quests.length} quests feed the quest-point count`);
if (unreadable2.length > 0) {
    // SAID OUT LOUD, every run. A quest-point count that is 6 short without saying so is the kind
    // of number somebody repeats in a bug report a month later.
    console.log(`  ${unreadable2.length} of them cannot be decided by reading the script (worth up to ${unknownWorth} points), so counts are shown as a range:`);
    for (const q of unreadable2) console.log(`      ${q.cond}`);
}
console.log(`  ${C.wanted_req_questpoints} quest points, The Lost Tribe, Priest in Peril, Enter the Abyss`);
if (unreadable > 0) console.log(`  ${unreadable} save(s) could not be read and were skipped`);
console.log('  a player who is logged in right now reads as of their last logout\n');

const stranded = rows.filter(r => r.stage > 0 && r.stage < C.wanted_complete && r.missing.length > 0);
const fine = rows.filter(r => !stranded.includes(r));

if (args.all === true || typeof args.name === 'string') {
    for (const r of rows.sort((a, b) => b.stage - a.stage)) {
        console.log(
            `  ${r.name.padEnd(14)} ${label(r.stage).padEnd(12)} qp ${(r.qp.floor === r.qp.ceiling ? String(r.qp.floor) : `${r.qp.floor}-${r.qp.ceiling}`).padStart(5)}  ${r.missing.length ? `missing: ${r.missing.join(', ')}` : 'meets the requirements'}`
        );
    }
    console.log('');
}

if (stranded.length === 0) {
    console.log(`Nobody is stranded: ${fine.length} player(s) have touched Wanted! and every one of them either finished it or still qualifies.`);
} else {
    console.log(`${stranded.length} player(s) are part-way through Wanted! and would NOT be able to start it today:\n`);
    for (const r of stranded) {
        console.log(`  ${r.name.padEnd(14)} ${label(r.stage).padEnd(12)} qp ${(r.qp.floor === r.qp.ceiling ? String(r.qp.floor) : `${r.qp.floor}-${r.qp.ceiling}`).padStart(5)}  missing: ${r.missing.join(', ')}`);
    }
    console.log('\nThey are not blocked right now - the requirements are only tested when Tiffy starts the quest.');
    console.log('It matters if one of them ever goes back to the beginning. account.ts is where to change anything.');
}

// AND STOP, EXPLICITLY. Loading the cache leaves handles open that nothing here closes, so falling
// off the end of this file leaves the process sitting there having already done its work. Piped
// into anything - `| less`, `| tee`, a cron mail - that reads as a tool that hangs and prints
// nothing, because a terminated process discards whatever stdout had buffered.
process.exit(0);
