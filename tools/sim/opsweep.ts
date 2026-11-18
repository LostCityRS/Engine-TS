// EVERY OPTION THE CACHE OFFERS THAT NO SCRIPT ANSWERS - the whole game, in about forty seconds.
//
//   npx tsx tools/sim/opsweep.ts                 the report
//   npx tsx tools/sim/opsweep.ts --baseline      rewrite tools/sim/opsweep-baseline.txt
//   npx tsx tools/sim/opsweep.ts --check         fail on a new dead option a player can REACH
//
// --check fails on a new dead option on a loc the map PLACES, and records one on a loc it does
// not. See the note above placedLines for why the line is drawn there and what it costs.
//   npx tsx tools/sim/opsweep.ts --area 3200 3150 3300 3250
//
// WHY THIS AND NOT THE FUZZER. The fuzzer answers "what breaks". This answers "what was never
// written", and it does not need a bot to walk there. A fuzzing bot finds a dead option by being
// in the right place holding the right thing at the right moment; measured on the 2 November build,
// eight of them took 6,000 ticks to reach 1.9% of the triggers, so the odds of one wandering into
// any particular dead option are poor. But the question is not a runtime question at all: the cache
// says a loc has a "Search" option, the script table says nothing claims [oploc2] for it, and those
// two facts are on disk. No walking required.
//
// a1lib already had deadLocOps/deadNpcOps, which is this for a rectangle you name, and
// audit3sweep.ts, which is this for a debugname prefix you name. Both are tools for an audit
// somebody has already decided to do. The point of this one is that it needs no prefix and no
// rectangle: it is the whole list, so it can be committed as a baseline and a build that adds a
// dead option fails rather than waiting for a playtest report.
//
// WHAT IT CHECKS, AND THE THREE TRAPS IT HAD TO LEARN
//
//   1. op AND ap. A click runs [oploc1] if there is one and [aploc1] if there is not, so an option
//      with only an ap trigger is alive. Checking only op would report hundreds of live options.
//   2. multiloc / multinpc. A tree stump's options may be declared on the stump but handled on the
//      tree that turns into it. The shells are followed, both ways.
//   3. THE GLOBAL FALLBACK. ScriptProvider.getByTrigger falls back to the no-subject script, and
//      this build has one for [opheld2] - every Wear and Wield in the game. An obj whose op2 is
//      "Extinguish" therefore has a "handler", and it is the equip code, which silently wears the
//      item or prints a debug line. That is how eighty-six of these hid from the first opheld audit
//      (see opheld2.ts). So the lookup here is getByTriggerSpecific, type then category, and a
//      global-only match is reported in its own section rather than counted as handled.
//
// WHAT IS ACTUALLY LEFT IN IT is triaged in tools/sim/opsweep-backlog.md - which buckets are live
// bugs, which are cache slots Jagex never used, which are whole systems nobody has started, and
// the worked precedent to follow for the mining ones. The number this prints is not a to-do list
// on its own: read that file before treating a line as urgent. For the 175 rocks in it,
// tools/sim/deadrocks.ts goes further and works out which ore each one is supposed to hold.
import fs from 'fs';
import path from 'path';

import * as H from './harness.js';
import Component from '#/cache/config/Component.js';
import { isVisibleOp } from '#/cache/config/OpVisibility.js';
import { namesAppearingInContent, namesAppearingInScripts, namesSpawnedInScripts } from '#/cache/config/ObjReach.js';
import { SPELLBOOKS } from '#/engine/bot/BotInput.js';
import LocType from '#/cache/config/LocType.js';
import NpcType from '#/cache/config/NpcType.js';
import ObjType from '#/cache/config/ObjType.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import World from '#/engine/World.js';

const argv = process.argv.slice(2);
const WRITE_BASELINE = argv.includes('--baseline');
const CHECK = argv.includes('--check');
const BASELINE_FILE = path.join('tools', 'sim', 'opsweep-baseline.txt');
const areaAt = argv.indexOf('--area');
const AREA = areaAt === -1 ? null : argv.slice(areaAt + 1, areaAt + 5).map(n => parseInt(n));

await H.boot();

/** A specific or category trigger, never the global: see trap 3 in the header. */
function claimed(trigger: number, type: number, category: number): boolean {
    if (ScriptProvider.getByTriggerSpecific(trigger, type, -1)) {
        return true;
    }
    return category !== -1 && !!ScriptProvider.getByTriggerSpecific(trigger, -1, category);
}

/** Only the global `_` script claims it - alive in the sense that something runs, but probably not this. */
function globalOnly(trigger: number, type: number, category: number): boolean {
    return !claimed(trigger, type, category) && !!ScriptProvider.getByTriggerSpecific(trigger, -1, -1);
}

type Row = { line: string; where: string[]; instances: number };
const dead: Row[] = [];
const swallowed: Row[] = [];

function add(into: Row[], line: string, where: string[], instances: number): void {
    into.push({ line, where, instances });
}

// ------------------------------------------------------------------------------ where things are

/**
 * How many of each loc and npc type the live map actually has, and where the first few are. A dead
 * option on a type the map never places is real but unreachable, and a dead option on a type the
 * map places four hundred times is something players click every day. The report sorts by it, which
 * is the difference between a list and a work queue.
 */
const locPlaces = new Map<number, string[]>();
const npcPlaces = new Map<number, string[]>();
const locCount = new Map<number, number>();
const npcCount = new Map<number, number>();

function note(places: Map<number, string[]>, counts: Map<number, number>, type: number, at: string): void {
    counts.set(type, (counts.get(type) ?? 0) + 1);
    const list = places.get(type);
    if (!list) {
        places.set(type, [at]);
    } else if (list.length < 3) {
        list.push(at);
    }
}

const inArea = (x: number, z: number) => !AREA || (x >= AREA[0] && z >= AREA[1] && x <= AREA[2] && z <= AREA[3]);

// existingZones, not a loop over every possible zone index: getZone ALLOCATES on a miss, so asking
// for all 16.7 million of them builds 16.7 million Zone objects and runs the process out of memory.
// This did exactly that the first time it was run, which is why GameMap.existingZones now exists.
for (const zone of World.gameMap.existingZones()) {
    for (const loc of zone.getAllLocsUnsafe()) {
        if (inArea(loc.x, loc.z)) {
            note(locPlaces, locCount, loc.type, `${loc.x},${loc.z},${loc.level}`);
        }
    }
}
for (const npc of World.npcs) {
    if (npc && inArea(npc.x, npc.z)) {
        note(npcPlaces, npcCount, npc.type, `${npc.x},${npc.z},${npc.level}`);
    }
}

// ------------------------------------------------------------------------------------------- locs

// multiloc: a shell's options may be answered on one of its children, or the other way round.
const locFamily = new Map<number, number[]>();
for (let id = 0; id < LocType.count; id++) {
    const type = LocType.get(id);
    const kin = (type.multiloc ?? []).filter(i => i >= 0);
    if (!kin.length) {
        continue;
    }
    locFamily.set(id, [id, ...kin]);
    for (const child of kin) {
        locFamily.set(child, [...new Set([...(locFamily.get(child) ?? [child]), id, ...kin])]);
    }
}

for (let id = 0; id < LocType.count; id++) {
    const type = LocType.get(id);
    if (!type || !type.op) {
        continue;
    }
    const family = locFamily.get(id) ?? [id];
    const instances = family.reduce((n, f) => n + (locCount.get(f) ?? 0), 0);
    if (AREA && instances === 0) {
        continue;
    }
    for (let op = 0; op < type.op.length; op++) {
        const label = type.op[op];
        // isHiddenOp, not `=== 'hidden'`: the content writes the marker both ways (674 lowercase,
        // 103 capitalised) and the capitalised ones are hidden too. Comparing exactly put a hundred
        // options that no client ever draws into this report - and, less harmlessly, past the
        // server's own check until that was fixed to use the same helper.
        if (!isVisibleOp(label)) {
            continue;
        }
        const anyKinClaims = family.some(f => {
            const t = LocType.get(f);
            return claimed(ServerTriggerType.OPLOC1 + op, f, t.category) || claimed(ServerTriggerType.APLOC1 + op, f, t.category);
        });
        const where = family.flatMap(f => locPlaces.get(f) ?? []).slice(0, 3);
        const line = `loc  ${type.debugname ?? id} op${op + 1}="${label}"`;
        if (!anyKinClaims) {
            const anyGlobal = family.some(f => globalOnly(ServerTriggerType.OPLOC1 + op, f, LocType.get(f).category));
            add(anyGlobal ? swallowed : dead, line, where, instances);
        }
    }
}

// ------------------------------------------------------------------------------------------- npcs

const npcFamily = new Map<number, number[]>();
for (let id = 0; id < NpcType.count; id++) {
    const type = NpcType.get(id);
    const kin = (type.multinpc ?? []).filter(i => i >= 0);
    if (!kin.length) {
        continue;
    }
    npcFamily.set(id, [id, ...kin]);
    for (const child of kin) {
        npcFamily.set(child, [...new Set([...(npcFamily.get(child) ?? [child]), id, ...kin])]);
    }
}

for (let id = 0; id < NpcType.count; id++) {
    const type = NpcType.get(id);
    if (!type || !type.op) {
        continue;
    }
    const family = npcFamily.get(id) ?? [id];
    const instances = family.reduce((n, f) => n + (npcCount.get(f) ?? 0), 0);
    if (AREA && instances === 0) {
        continue;
    }
    for (let op = 0; op < type.op.length; op++) {
        const label = type.op[op];
        if (!isVisibleOp(label)) {
            continue;
        }
        // Attack is the engine's, not the content's: there is no [opnpc2,goblin] for it and there
        // should not be. Reporting it would bury the report in two thousand false rows.
        if (/^attack$/i.test(label)) {
            continue;
        }
        const anyKinClaims = family.some(f => {
            const t = NpcType.get(f);
            return claimed(ServerTriggerType.OPNPC1 + op, f, t.category) || claimed(ServerTriggerType.APNPC1 + op, f, t.category);
        });
        const where = family.flatMap(f => npcPlaces.get(f) ?? []).slice(0, 3);
        const line = `npc  ${type.debugname ?? id} op${op + 1}="${label}"`;
        if (!anyKinClaims) {
            const anyGlobal = family.some(f => globalOnly(ServerTriggerType.OPNPC1 + op, f, NpcType.get(f).category));
            add(anyGlobal ? swallowed : dead, line, where, instances);
        }
    }
}

// ------------------------------------------------------------------------------------- objs (held)

if (!AREA) {
    for (let id = 0; id < ObjType.count; id++) {
        const type = ObjType.get(id);
        if (!type || !type.debugname || type.certtemplate !== -1) {
            continue;
        }
        for (let op = 0; op < type.iop.length; op++) {
            const label = type.iop[op];
            // Drop is the engine's own, like Attack above - and so is Destroy, since drop.rs2's
            // [opheld5,_] reads oc_iop and branches on the label. Both are handled by that one
            // global and there is no per-item script to write for either. The OTHER iop5 labels
            // are not: Move, Dismantle and Release still fall through to the drop, which is the
            // wrong behaviour and stays in this report until somebody writes the feature.
            if (!isVisibleOp(label) || /^(drop|destroy)$/i.test(label)) {
                continue;
            }
            // AND SO IS WEARING SOMETHING, which is the other half of the same point and took a
            // while to admit. Trap 3 in this file's header is about the global [opheld2,_] hiding
            // dead options behind the equip code, and the cure over-corrected: it reported all
            // 1,338 Wear, Wield, Equip and Hold labels in the game as "answered only by the global
            // fallback", because that is literally true and completely uninteresting. equip.rs2's
            // [opheld2,_] ~equip(last_slot) IS the handler for wearing a helmet - there is no
            // per-item script to write and never was. A third of this report was items that work.
            //
            // The labels below are the ones the global equip code is FOR. Anything else on iop2 -
            // "Extinguish", "Play-With" - still gets reported, because the equip code will try to
            // wear it, which is trap 3's actual bug.
            if (op === 1 && /^(wear|wield|equip|hold)$/i.test(label)) {
                continue;
            }
            const line = `obj  ${type.debugname} iop${op + 1}="${label}"`;
            if (!claimed(ServerTriggerType.OPHELD1 + op, id, type.category)) {
                add(globalOnly(ServerTriggerType.OPHELD1 + op, id, type.category) ? swallowed : dead, line, [], 0);
            }
        }
        // Ground ops, which nothing had ever swept: a chest on the floor with a "Search" on it.
        for (let op = 0; op < type.op.length; op++) {
            const label = type.op[op];
            if (!isVisibleOp(label) || /^take$/i.test(label)) {
                continue;
            }
            const line = `obj  ${type.debugname} op${op + 1}="${label}" (on the ground)`;
            if (!claimed(ServerTriggerType.OPOBJ1 + op, id, type.category) && !claimed(ServerTriggerType.APOBJ1 + op, id, type.category)) {
                add(globalOnly(ServerTriggerType.OPOBJ1 + op, id, type.category) ? swallowed : dead, line, [], 0);
            }
        }
    }

    // ------------------------------------------------------- inventory grid ops (bank, shop, trade)
    for (let id = 0; id < Component.count; id++) {
        const com = Component.get(id);
        if (!com || !com.iop) {
            continue;
        }
        for (let op = 0; op < com.iop.length; op++) {
            const label = com.iop[op];
            if (!isVisibleOp(label)) {
                continue;
            }
            const line = `grid ${com.comName ?? id} op${op + 1}="${label}"`;
            if (!ScriptProvider.getByTriggerSpecific(ServerTriggerType.INV_BUTTON1 + op, id, -1)) {
                add(dead, line, [], 0);
            }
        }
    }
}

// ------------------------------------------------------- can a player ever hold this obj at all?
//
// opsweep tells you whether a loc or npc is PLACED on the map, and that is most of what makes its
// loc and npc sections readable: 1,005 options a player can walk up to are a different problem
// from 1,729 on scenery the map never puts anywhere. There was no equivalent test for an obj, and
// it is why the obj section read far worse than it is - 142 of the 144 dead "Read" entries are
// clue scroll variants, and not one of them is named in any script, drop table or reward table, so
// nobody can hold one to read it.
//
// THE TEST ONLY WORKS IN ONE DIRECTION and the report says so. If an obj's name appears nowhere in
// the content sources then nothing can hand it out, which is conclusive: no script adds it, no
// table lists it, no shop stocks it, nothing degrades or uncerts into it. Being named proves
// nothing in return - a name in a comment counts - so the sections are "nobody can hold one" and
// "somebody might", not "unobtainable" and "obtainable".
//
// AN OBJ CONFIG DECLARING ITS OWN NAME IS NOT A WAY TO GET IT, so [name] header lines in .obj
// files are skipped. The key=value lines are kept, because param=fixed and certlink are how a
// degraded or certed obj is reached from one that is.
const NAMED = namesAppearingInContent();
// AND THE SAME TEST FOR AN NPC THE MAP NEVER PLACES. "Not placed" means unreachable for scenery and
// means nothing for an npc, because npc_add reaches one too - 21 woodcutting Ents sat in that
// bucket looking handled while the anti-macro event spawned them at every ordinary tree in the game
// and the player could not chop one. A script naming the npc is not proof it spawns it, so the
// section is headed "a script names it" rather than "reachable".
const SPAWNED = namesAppearingInScripts();
const SPAWNED_HERE = namesSpawnedInScripts();
/** The obj name a report line is about, or null when the line is not about an obj. */
function objOf(line: string): string | null {
    const m = /^obj\s+([a-zA-Z0-9_]+) /.exec(line);
    return m ? m[1] : null;
}

/** The npc name a report line is about, or null when the line is not about an npc. */
function npcOf(line: string): string | null {
    const m = /^npc\s+([a-zA-Z0-9_]+) /.exec(line);
    return m ? m[1] : null;
}

// --------------------------------------------------------------------------------------- the report

const byInstances = (a: Row, b: Row) => b.instances - a.instances || a.line.localeCompare(b.line);
dead.sort(byInstances);
swallowed.sort(byInstances);

const placed = dead.filter(r => r.instances > 0);
const unplaced = dead.filter(r => r.instances === 0);

console.log(`OPTIONS NO SCRIPT ANSWERS${AREA ? ` in ${AREA.join(',')}` : ''}`);
console.log(`  ${dead.length} dead options (${placed.length} on something the map actually places)`);
console.log(`  ${swallowed.length} more reach only the global fallback script, which is a different bug and usually a quieter one`);
console.log(
    `  of the dead, ${
        dead.filter(r => {
            const o = objOf(r.line);
            return o !== null && !NAMED.has(o);
        }).length
    } are on an obj nothing in content can hand to a player`
);
console.log('');

console.log(`-- dead, and on the map (${placed.length}) - these are what a player clicks`);
for (const row of placed.slice(0, 80)) {
    console.log(`   ${row.line}  x${row.instances} ${row.where.join(' ')}`);
}
if (placed.length > 80) {
    console.log(`   ... and ${placed.length - 80} more`);
}

const unheld = unplaced.filter(r => {
    const obj = objOf(r.line);
    return obj !== null && !NAMED.has(obj);
});
const unheldSet = new Set(unheld);
const spawnable = unplaced.filter(r => {
    if (unheldSet.has(r)) {
        return false;
    }
    const npc = npcOf(r.line);
    return npc !== null && SPAWNED.has(npc);
});
const spawnableSet = new Set(spawnable);
const rest = unplaced.filter(r => !unheldSet.has(r) && !spawnableSet.has(r));

console.log(`\n-- dead, not placed, but on an npc a SCRIPT NAMES (${spawnable.length}) - npc_add reaches these,`);
console.log('   so "not placed" says nothing about whether a player meets one. Read these first, and the');
console.log('   ones marked <- npc_add first of all: a name sitting on an npc_add line is the strongest');
console.log('   evidence here. A name WITHOUT the mark is not cleared - an npc can be spawned through a');
console.log('   constant or an enum whose name differs - it is only weaker evidence.');
const spawnMark = (line: string): string => {
    const npc = npcOf(line);
    return npc !== null && SPAWNED_HERE.has(npc) ? '  <- npc_add' : '';
};
spawnable.sort((a, b) => spawnMark(b.line).length - spawnMark(a.line).length || a.line.localeCompare(b.line));
for (const row of spawnable.slice(0, 40)) {
    console.log(`   ${row.line}${spawnMark(row.line)}`);
}
if (spawnable.length > 40) {
    console.log(`   ... and ${spawnable.length - 40} more`);
}

console.log(`\n-- dead, not placed anywhere on the map (${rest.length}) - real, but nobody can reach them today`);
for (const row of rest.slice(0, 25)) {
    console.log(`   ${row.line}`);
}
if (rest.length > 25) {
    console.log(`   ... and ${rest.length - 25} more`);
}

console.log(`\n-- dead on an obj whose name appears NOWHERE in content (${unheld.length}) - nothing can hand it`);
console.log('   out, so nobody can hold one to click it. Cache slots, not missing content.');
for (const row of unheld.slice(0, 25)) {
    console.log(`   ${row.line}`);
}
if (unheld.length > 25) {
    console.log(`   ... and ${unheld.length - 25} more`);
}

// THE SAME SPLIT HERE, and it matters more in this section than in the dead one. 96 of these are
// iop5="Move" on the sliding-puzzle and reinitialisation sprites, which are objs the cache uses to
// draw a puzzle inside an interface and which nothing hands to anybody - so "clicking Move drops
// it" is not a thing that can happen to a player. Ten lines are on an item somebody can hold, and
// those ten are the whole of what this section is worth reading for.
const swallowedUnheld = swallowed.filter(r => {
    const obj = objOf(r.line);
    return obj !== null && !NAMED.has(obj);
});
const swallowedHeld = swallowed.filter(r => !swallowedUnheld.includes(r));

console.log(`\n-- answered only by the global fallback (${swallowed.length}) - see trap 3 in this file's header`);
console.log(`   ${swallowedHeld.length} on something a player can actually have:`);
for (const row of swallowedHeld.slice(0, 40)) {
    console.log(`   ${row.line}  x${row.instances} ${row.where.join(' ')}`);
}
if (swallowedHeld.length > 40) {
    console.log(`   ... and ${swallowedHeld.length - 40} more`);
}
if (swallowedUnheld.length) {
    console.log(`   and ${swallowedUnheld.length} on an obj whose name appears nowhere in content, so nobody can hold one:`);
    for (const row of swallowedUnheld.slice(0, 10)) {
        console.log(`      ${row.line}`);
    }
    if (swallowedUnheld.length > 10) {
        console.log(`      ... and ${swallowedUnheld.length - 10} more`);
    }
}

// SPELLBOOK DRIFT. BotInput.castableComs casts only from the books it knows by name, because
// actionTarget is set all over the cache on things that are not spells. If the content grows a
// fourth book, the fuzzer would silently never cast from it - so any other interface that LOOKS
// like a spellbook is printed here as a line to read.
const strangers = new Set<string>();
for (let id = 0; id < Component.count; id++) {
    const com = Component.get(id);
    const name = com?.comName;
    if (!com || !name || !com.actionTarget) {
        continue;
    }
    const colon = name.indexOf(':');
    const iface = colon === -1 ? name : name.slice(0, colon);
    if (!SPELLBOOKS.has(iface) && iface.includes('magic')) {
        strangers.add(iface);
    }
}
console.log(`\n-- spellbooks the fuzzer casts from: ${[...SPELLBOOKS].sort().join(', ')}`);
if (strangers.size) {
    console.log(`   NOT cast from, and the name looks like a spellbook: ${[...strangers].sort().join(', ')}`);
    console.log('   if one of those is a real book, add it to SPELLBOOKS in src/engine/bot/BotInput.ts');
}

// ------------------------------------------------------------------------------------ the baseline

const signature = [...dead.map(r => `dead ${r.line}`), ...swallowed.map(r => `global ${r.line}`)].sort();

// WHICH NEW LINES ARE WORTH FAILING A BUILD OVER. A dead option on a loc the map never places is
// unreachable: real, worth recording, and nobody can click it. A dead option on a loc with spawns
// is a ticket waiting to be filed - log_withaxe (tracker #26) was exactly that, sitting in this
// file for months while a player walked up to it. So --check draws the line there, and the set
// below is what it draws it with.
//
// This LOOSENS the ratchet for unplaced lines on purpose, which is the part to be careful about.
// The argument for it: a gate that fires on something no player can reach trains whoever hits it
// to re-run --baseline, and a ratchet nobody believes is worse than one that fires less often.
// The argument against: unreachable today is not unreachable for ever - a map edit can place a
// loc years after its option died. That is why an unplaced line is still PRINTED and still goes
// into the baseline; it is the exit code that changes, not the record.
//
// The other half of this is siblings.ts, which fails on a new family where some members are
// answered and some are not. The two catch different things and neither subsumes the other: a
// brand-new loc wired to nothing has no answered sibling to give it away, and a dead member of an
// answered family can sit on a loc the map does not place. Both gates, deliberately.
const placedLines = new Set(dead.filter(r => r.instances > 0).map(r => `dead ${r.line}`));
if (WRITE_BASELINE) {
    fs.mkdirSync(path.dirname(BASELINE_FILE), { recursive: true });
    fs.writeFileSync(
        BASELINE_FILE,
        [
            '# Options the cache offers that no script answers, as of the build this was written on.',
            '# Rewritten with: npx tsx tools/sim/opsweep.ts --baseline',
            '# Checked with:   npx tsx tools/sim/opsweep.ts --check   (fails on anything NEW)',
            '#',
            '# This file is a ratchet, not an approval. Every line in it is an option a player can',
            '# click that does nothing. The number should only ever go down.',
            `# ${signature.length} lines at the time of writing.`,
            '',
            ...signature
        ].join('\n') + '\n',
        'utf8'
    );
    console.log(`\nbaseline written: ${BASELINE_FILE} (${signature.length} lines)`);
    process.exit(0);
}

if (CHECK) {
    let before: Set<string>;
    try {
        before = new Set(
            fs
                .readFileSync(BASELINE_FILE, 'utf8')
                .split(/\r?\n/)
                .filter(l => l && !l.startsWith('#'))
        );
    } catch {
        console.log(`\nno baseline at ${BASELINE_FILE} - run with --baseline first`);
        process.exit(1);
    }
    const added = signature.filter(l => !before.has(l));
    const fixed = [...before].filter(l => !signature.includes(l));

    // A new line fails unless it is a dead option on a loc the map never places - see the note by
    // placedLines above. `global` lines are not downgraded: an option that newly falls through to
    // a catch-all handler is a wiring change, not an unreachable one.
    const reachable = added.filter(l => !l.startsWith('dead ') || placedLines.has(l));
    const unreachable = added.filter(l => l.startsWith('dead ') && !placedLines.has(l));

    console.log(`\nAGAINST THE BASELINE: ${added.length} new (${reachable.length} reachable), ${fixed.length} fixed`);
    for (const line of reachable.slice(0, 40)) {
        console.log(`   NEW  ${line}`);
    }
    if (unreachable.length) {
        console.log(`\n   ${unreachable.length} of the new lines are on locs the map never places - recorded, not failed:`);
        for (const line of unreachable.slice(0, 10)) {
            console.log(`   new, unreachable  ${line}`);
        }
        if (unreachable.length > 10) {
            console.log(`   ... and ${unreachable.length - 10} more`);
        }
        console.log('   rerun with --baseline to bank them, and they stay unreachable only until somebody places one');
    }
    for (const line of fixed.slice(0, 10)) {
        console.log(`   fixed ${line}`);
    }
    if (fixed.length > 10) {
        console.log(`   ... and ${fixed.length - 10} more fixed - rerun with --baseline to bank them`);
    }
    process.exit(reachable.length ? 1 : 0);
}

process.exit(0);
