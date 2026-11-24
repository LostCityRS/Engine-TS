// THE QUEST HELPER'S STEP TABLE, read out of the sim manifests that already prove it.
//
//   npx tsx tools/quest/ExportHelper.ts [out.json]
//
// WHY THE MANIFESTS AND NOT A NEW FILE. tools/sim/quest_*_run.ts already holds, for 108 quests,
// the ordered steps a player takes: who to talk to, which loc to click and where it is, what to be
// carrying, and - in `stage:` markers - the value of the quest's own varp after each leg. That is
// a quest helper's data exactly, and the nightly job RUNS it: a wrong coordinate or a renamed npc
// fails a sim. A hand-written helper script would be a second copy of the same knowledge with
// nothing checking it, which is how RuneLite's helpers drift from the game.
//
// READ WITH THE TYPESCRIPT AST, not by importing. Each manifest is a `const m: Manifest` inside a
// script whose first statement is `await H.boot()`, so importing one boots a world for forty
// seconds and the object is not exported anyway. The literals are static data - strings, numbers,
// arrays, nested objects - so the compiler's own parser reads them with no engine in the room, and
// nothing in tools/sim has to change to be exportable.
//
// WHAT IS DROPPED, and why the helper is not just the manifest re-emitted. A manifest is written
// for a robot that can teleport and set varps:
//
//   setpos   927 of them - a teleport to the start of a leg. A player walks; this becomes a
//            "travel to" marker rather than an instruction, because the manifest deliberately
//            does NOT record the route (the sims assert reachability separately).
//   stage    841 - the robot writing the quest's varp to skip ahead. These are the SEGMENT KEYS
//            here, not steps: everything between two of them is what you do at that stage.
//   rng      the dice pinned for a step. Meaningless to a player.
//   wait     a tick count for an animation.
//   level    a plane change the engine does; the loc click above it is the player's instruction.
//
// WHAT IS KEPT is talk/loc/held/worn/useNpc/useObj (the clicks), has/hasnt (the item list), go
// (a real walk the sim makes on foot), and the `note` lines, which carry the wiki's own step
// wording and are what the panel shows.
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { manifestOf as evalManifestOf } from './EvalManifest.js';
import NpcType from '#/cache/config/NpcType.js';
import LocType from '#/cache/config/LocType.js';
import ObjType from '#/cache/config/ObjType.js';
import VarPlayerType from '#/cache/config/VarPlayerType.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';
import ServerTriggerType from '#/engine/script/ServerTriggerType.js';
import VarBitType from '#/cache/config/VarBitType.js';

const SIM = path.join(import.meta.dirname, '..', 'sim');

/** A step as the helper needs it: something to do, or something to be carrying. */
type HelperStep = {
    /** What the panel shows. */
    text: string;
    /** 'talk' | 'loc' | 'obj' | 'walk' | 'note' - decides the icon and what gets highlighted. */
    kind: string;
    /** The npc or loc to highlight, by debugname, or null for a step with no target. */
    target?: string;
    /**
     * And its numeric id, which is the only form the client has.
     *
     * A plugin sees `Actor.npcId` and `SceneLoc.id`; debugnames exist on the server and are not
     * in the cache the client loads, and `ctx.getLocName` answers the display name ("Door"), of
     * which there are hundreds. So the name is resolved here, where NpcType and LocType are
     * already loaded, and the step carries the number. An unresolved name leaves this -1 and the
     * step still shows its text - it just cannot be highlighted.
     */
    id?: number;
    /**
     * What a PLAYER calls it: "Door", "Restless ghost", "Ghostspeak amulet".
     *
     * The debugname is the server's handle and some of them say nothing to anybody - the panel
     * read "loc 1530" and "ghostx" where it meant a churchyard door and the ghost. The cache has
     * the display name and the exporter has the cache, so it is resolved here; the client's
     * getLocName could answer for locs but there is no equivalent for an npc that is not already
     * standing in the scene, which is exactly the one the step is sending you to find.
     */
    label?: string;
    /**
     * The OTHER npcs this step would take, as ids, for a step whose target comes in a crowd.
     *
     * Pollnivneach has three villagers to pickpocket, Rat Catchers six rats, Sheep Herder four
     * sick sheep. The sim used whichever one it met, so the marker pointed at that one across town
     * while an identical one stood next to the player.
     *
     * These are the ids the SERVER would run the same script on for this step's op, which is its
     * own answer to "will this one do instead?" - not a guess from the names, which would be
     * wrong in both directions: The Feud takes any of its three villagers for Pickpocket, two of
     * them for Lure and one for Knock-Out.
     */
    also?: number[];
    /** Where it is, when the manifest says. */
    at?: number[];
    /**
     * The obj the step is HOLDING, for a step that uses one thing on another.
     *
     * "Use Battered key on Odd looking wall" is a loc step whose target is the wall; the key is
     * the other half of it, and the plugin needs the id to find it in the bag - to highlight the
     * slot, and to tell how far into the leg the player has got. An `obj` step's own `id` is
     * already the item, so this is only set where the target is something else.
     */
    item?: number;
    /**
     * What this step HANDED OVER, as obj ids: the step's receipt.
     *
     * A manifest asserts what the player is holding right after the click that gave it to them -
     * `{ talk: 'feud_ali_m', why: 'the headpiece' }, { has: 'feud_karidian_turban' }` - and 549
     * of the 901 assertions sit directly behind a step like that. That is the only record in the
     * game that a talk happened: the quest's own varp moves once a leg and says nothing about the
     * five steps inside it, so holding what a step handed over is how the client can tell that
     * step is behind you.
     */
    gives?: number[];
    /**
     * What this step put ON, as obj ids: a receipt that is only true while it is worn.
     *
     * Separate from `gives` because the difference is the whole step. "Wear Ghostspeak amulet"
     * is followed by `{ worn: ... }`, and an amulet in the BAG is that step still waiting to be
     * taken - counting it as carried-or-worn declared the step done the moment you picked the
     * amulet up.
     */
    wears?: number[];
    /** Which right-click option, when it is not the first. */
    op?: number;
    /** Dialogue options to choose, in order. */
    picks?: string[];
    /** The sim's own note about this step, shown under the instruction rather than as it. */
    why?: string;
};

type HelperStage = {
    /** The quest varp value this leg begins at. */
    from: number;
    /**
     * The wiki headings for this leg, each with the step it is written in front of.
     *
     * A LIST, because a leg often spans two of them and because a single `heading` put every
     * quest's wording one leg late: "wiki step 1: Father Aereck" sits BEFORE the talk step it
     * introduces and before the `stage:` that closes the leg, so holding it for the next stage
     * described Father Aereck above the walk to Father Urhney's shack. A heading describes the
     * steps that follow it inside the leg it is written in, and nothing else.
     *
     * AND WITH `at`, THE STEP IT INTRODUCES, for the same reason one leg late was wrong. 199 of
     * the 892 legs carry more than one heading - Elemental Workshop I is one leg with eleven, the
     * whole quest, because its varp only moves at the end - so a panel that showed the first of
     * them described the bookcase while the player was at the furnace. With the index, the panel
     * can show the heading the step it is naming actually sits under.
     */
    headings: { at: number; text: string }[];
    /**
     * The quest's own flags, and the step each one is true from: "feud_var_drink is 3 by here".
     *
     * THE SECOND HAND ON THE CLOCK. A quest's progress varp moves once a leg and says nothing
     * about the steps inside it, but the quests keep their own working flags as they go - how
     * many beers Drunken Ali has had, which gangs have been asked - and the sims already assert
     * them, 278 times, as `{ varis: 'feud_var_drink', to: 3 }`. Those were dropped as robot-only
     * checks. They are the opposite: they are the only thing in the game that can say a step
     * whose only trace is a flag has been taken.
     *
     * `at` is the index of the step the flag is true FROM, so everything before it is done; a
     * mark at the end of the list says the leg itself is finished, whatever its varp still says.
     */
    marks: { at: number; var: number; varbit: boolean; is: number }[];
    steps: HelperStep[];
    /**
     * Everything the player must be holding by the end of this leg, with the obj id.
     *
     * The id is what makes the list a CHECKLIST rather than a note: the plugin ticks a row off
     * with ctx.countObj(id), which needs the number. Emitted as strings at first, which left the
     * panel unable to tell "you need a hammer" from "you have one".
     *
     * `bring` SEPARATES THE SHOPPING LIST FROM THE QUEST'S OWN ITEMS, and it is the difference
     * between a useful list and a nagging one. A sim hands itself what a player would bring from
     * the bank (`give: 'knife'`) and ASSERTS what the quest hands over as it goes (`has:
     * 'elemental_workshop_key'`). Both end up in this list because both have to be in the bag,
     * but only the first is something to go and fetch: the panel was telling a player to bring a
     * key that is sewn into a book they have not found yet.
     */
    items: { name: string; id: number; n: number; bring: boolean; handle?: string }[];
    /** What must be WORN by the end of it - an equip is a different instruction from a carry. */
    worn: { name: string; id: number; bring: boolean; handle?: string }[];
};

type HelperQuest = {
    /** The varp or varbit id behind stageVar, for the same reason step ids exist. */
    stageVarId?: number;
    /** True when stageVar is a varbit rather than a varp - the client reads them differently. */
    stageIsVarbit?: boolean;
    /**
     * WHERE A VARBIT'S BITS LIVE: its parent varp and the inclusive bit range inside it. The real
     * client does not need this - getVarbit reads the same three numbers out of the cache's own
     * varbit table - and it is here for the thing that has no cache.
     *
     * tools/clienttests/QuestHelperTest.java sweeps every quest at every leg by writing the leg's
     * progress and drawing. It cannot write a varbit, because writing one means setting bits in a
     * parent varp the harness has no table to look up, so 28 quests were swept at their first leg
     * only and 225 legs were drawn by nothing. With these three numbers the harness builds the
     * varbit entries it needs by hand and reaches all of them.
     *
     * Only for a varbit: a varp quest leaves it out.
     */
    stageBits?: { varp: number; lsb: number; msb: number };
    id: string;
    name: string;
    source: string;
    stageVar: string;
    done: number;
    start: number[];
    stages: HelperStage[];
};

// ---------------------------------------------------------------- reading the literal

/**
 * Named coordinates out of a sim file's own top-level consts.
 *
 * Most manifests do not write a tile twice: they declare `const NARNODE = [2466, 3495, 0]` and
 * then use the name, which is how a reader can tell "back to the King" from "to Glough". Without
 * resolving those, 86 of the 108 manifests read as non-static and the export covered a fifth of
 * the quests - the identifier is the ONLY thing that was not a literal in most of them.
 */
function constants(src: ts.SourceFile): Map<string, unknown> {
    const env = new Map<string, unknown>();
    for (const st of src.statements) {
        if (!ts.isVariableStatement(st)) continue;
        for (const d of st.declarationList.declarations) {
            if (!ts.isIdentifier(d.name) || !d.initializer) continue;
            const v = literal(d.initializer, env);
            if (v !== undefined) env.set(d.name.text, v);
        }
    }
    return env;
}

/** A literal node to a plain JS value, or undefined for anything that is not static data. */
function literal(node: ts.Node, env?: Map<string, unknown>): unknown {
    if (ts.isIdentifier(node)) return env?.get(node.text);
    if (ts.isStringLiteralLike(node)) return node.text;
    if (ts.isNumericLiteral(node)) return Number(node.text);
    if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (node.kind === ts.SyntaxKind.NullKeyword) return null;
    // `-1` is a prefix expression, not a numeric literal, and coordinates use it.
    if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken) {
        const inner = literal(node.operand, env);
        return typeof inner === 'number' ? -inner : undefined;
    }
    // `1 << 2` for the bitfield stages.
    if (ts.isBinaryExpression(node)) {
        const l = literal(node.left, env);
        const r = literal(node.right, env);
        if (typeof l !== 'number' || typeof r !== 'number') return undefined;
        if (node.operatorToken.kind === ts.SyntaxKind.LessThanLessThanToken) return l << r;
        if (node.operatorToken.kind === ts.SyntaxKind.PlusToken) return l + r;
        if (node.operatorToken.kind === ts.SyntaxKind.MinusToken) return l - r;
        return undefined;
    }
    if (ts.isAsExpression(node) || ts.isParenthesizedExpression(node)) return literal(node.expression, env);
    // TOWER_CORNER[0] - a tile named once and then indexed, which is how the manifests write
    // "two tiles east of the corner". 1257 of these, the single commonest non-literal.
    if (ts.isElementAccessExpression(node)) {
        const obj = literal(node.expression, env);
        const idx = literal(node.argumentExpression, env);
        if (Array.isArray(obj) && typeof idx === 'number') return obj[idx];
        return undefined;
    }
    if (ts.isArrayLiteralExpression(node)) {
        const out: unknown[] = [];
        for (const el of node.elements) {
            const v = literal(el, env);
            if (v === undefined) return undefined;
            out.push(v);
        }
        return out;
    }
    if (ts.isObjectLiteralExpression(node)) {
        const out: Record<string, unknown> = {};
        for (const prop of node.properties) {
            if (!ts.isPropertyAssignment(prop)) return undefined;
            const key = ts.isIdentifier(prop.name) || ts.isStringLiteralLike(prop.name) ? prop.name.text : undefined;
            if (key === undefined) return undefined;
            const v = literal(prop.initializer, env);
            if (v === undefined) return undefined;
            out[key] = v;
        }
        return out;
    }
    return undefined;
}

/**
 * The `const m: Manifest = {...}` out of one sim file, or null when it has none.
 *
 * A manifest that SPREADS A FUNCTION CALL into its steps - `...southIn()`, and there are 107 of
 * them - cannot be read without running the generator, and a quest exported without those steps
 * would have a silent hole in the middle of it. A helper that quietly skips three steps is worse
 * than one that admits it does not know the quest, so those are refused here and named in the
 * report rather than half-exported.
 */
function manifestOf(file: string): Record<string, unknown> | null {
    const src = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.ESNext, true);
    const env = constants(src);
    let decl: ts.Expression | null = null;
    const visit = (node: ts.Node) => {
        if (decl) return;
        if (ts.isVariableDeclaration(node) && node.type && node.type.getText(src) === 'Manifest' && node.initializer) {
            decl = node.initializer;
            return;
        }
        ts.forEachChild(node, visit);
    };
    ts.forEachChild(src, visit);
    if (!decl) return null;

    // A generated run of steps cannot be read without running the generator, and half a quest is
    // not a quest, so say so instead of exporting one with a hole in it.
    let spread = false;
    const findSpread = (n: ts.Node) => {
        if (ts.isSpreadElement(n)) {
            spread = true;
            return;
        }
        ts.forEachChild(n, findSpread);
    };
    findSpread(decl);
    // AND STEPS APPENDED AFTER THE LITERAL, which is the other way a manifest is generated and
    // was the one nothing looked for. Five runs build their middle with `m.steps.push(...)` after
    // the declaration - the ten bars of the barcrawl, the whole of Rag and Bone Man - and reading
    // only the literal took the first step of each quest and silently dropped the rest. 119 steps
    // across five quests, every one of them a thing a player has to click. A spread inside the
    // literal was the only shape this knew about because it was the only shape the first five
    // quests used.
    const appends = /\bsteps\s*\.\s*push\s*\(/.test(src.getFullText());
    if (spread || appends) {
        // A generated leg cannot be read from the syntax, so the file is RUN instead, against a
        // stubbed harness - see EvalManifest. Reading first and running only when reading fails
        // keeps 83 of the quests on the cheap path: the AST costs milliseconds and a process each
        // costs about a second.
        generated.push(path.basename(file));
        return evalManifestOf(file);
    }

    const v = literal(decl, env);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** Manifests refused because they build steps with a function call - reported, never half-read. */
const generated: string[] = [];

// ---------------------------------------------------------------- manifest to helper

// EVERY STEP KIND, CLASSIFIED ON PURPOSE. questrun's Step union has 37 members and guessing the
// kind from "the first key that is not an option" got six of them wrong - most visibly `go`, whose
// value is a TILE, so the exporter stringified [2146, 5105] into "2146,5105" and asked the cache
// for an item of that name. 668 lookups failed that way. Anything not named below still becomes a
// step and still shows its text; it just carries no target, which is the safe end of the mistake:
// a step with no highlight reads as "do this", a step with the wrong highlight points at a door in
// another kingdom.
const NPC_KINDS = new Set(['talk', 'useNpc', 'fight', 'herd']);
const LOC_KINDS = new Set(['loc', 'useLoc', 'castLoc']);
// `cast` names a spell ("magic:wind_blast"), which is neither an item nor anything standing in
// the scene, so it stays a text-only step. Left out of OBJ_KINDS deliberately rather than left to
// fail a lookup: four permanent entries in the unresolved report would hide the next real one.
// `use: ['knife', 'book']` is one item on another, and both halves are in the bag. It was
// landing in none of these sets, so 181 of them came out as a note with the sim's aside for its
// text ("The shirt.") and no item on them at all - which is exactly the step a helper should be
// pointing at, twice over: the thing in your hand and the thing you click.
// `useObj` is an item used on one lying on the ground - the drugged tea in Zogre Flesh Eaters is
// the only one in the corpus - and it was in none of these sets, so it came out as a note with
// the sim's aside for its text and nothing to say which items it was about. The comment at the
// top of this file claimed it was kept; it was not.
const OBJ_KINDS = new Set(['held', 'take', 'use', 'useObj']);
/** Tiles, not names: the instruction is "be here", and `at` already carries where. */
const WALK_KINDS = new Set(['go', 'mapexit', 'sneak']);
/** The sim asserting the game agrees with it. Not instructions. */
// `notworn` belongs here beside `hasnt` for the same reason, and leaving it out is how a new step
// kind leaks into the shipped table: an unknown kind falls through to prose, so Temple of Ikov's
// Armadyl row shipped a step reading "Ikov Pendantoflucien" - a server handle, no verb, no full
// stop - until WordingCheck caught it. A step kind added to questrun.ts has to be classified here.
const ASSERT_KINDS = new Set(['varis', 'count', 'zone', 'nearnpc', 'hasnt', 'notworn']);
/** The robot-only steps. See the header for why each one goes. */
// `wakehunt` is in here for a reason worth stating: it is the sim running an npc's hunt by hand
// because no real client is watching it. In a game with a player in it the hunt runs itself, so
// there is nothing for the player to do and the row read "Chompy bird."
// `press` was in here and should never have been: it is a BUTTON A PLAYER CLICKS. The Goblin Bow
// emote in front of Mistag, the combination dial on the Tribal Totem door, the valves on
// Regicide's still, the ruby ring in Family Crest's crafting window - twelve steps across seven
// quests, every one of them required, and dropping them left The Lost Tribe with a leg that had
// nothing to do in it at all. It carries no target a plugin can highlight, because an interface
// button is not a thing in the world, so it comes out as its own prose - which is the difference
// between telling a player to bow and telling them nothing.
const DROP = new Set(['stage', 'rng', 'wait', 'level', 'setpos', 'setvar', 'close', 'resume', 'say', 'sv', 'varbit', 'seed', 'wakehunt']);

/**
 * A note's wording, tidied for a player.
 *
 * The manifests write headings as "wiki step 8: Veliaf first, then the other five" - the prefix is
 * a cross-reference for whoever is comparing the sim against the guide, and it is noise in a panel.
 * The text after it is already the instruction, so the prefix comes off and the rest stays as the
 * person who read the wiki wrote it.
 */
function tidy(note: string): { heading: boolean; text: string } {
    const m = /^wiki(?: step)?s?\s*([0-9]+(?:\s*[-,and]+\s*[0-9]+)*)?\s*:?\s*(.*)$/i.exec(note.trim());
    if (!m) return { heading: false, text: note.trim() };

    // A leading comma or "and" is left behind when the prefix was "wiki steps 5 and the one
    // after it" - the number list stops at the first non-digit and the rest keeps its connective,
    // which put a heading on the page reading ", taken here because it is the same row of boxes".
    let text = (m[2] || '')
        .trim()
        .replace(/^[\s,;:-]+/, '')
        .replace(/^and\s+/i, '');

    // THE WIKI'S SENTENCE, AND NOT THE PARAGRAPH IT SITS IN. A run of notes is one comment, and
    // the guide's wording is only its opening: "the bookcase on the east wall of the house
    // south-west of the bank." is followed, in the same run, by "The house is a sealed 34-tile
    // pocket ... questrun walks on canTravel and canTravel does not open doors", which is the
    // author explaining the sim. The wrapping hides the join - "a knife or any slash weapon
    // opens" / "it. The 377 cache has no slashed-book obj" splits a sentence across two entries -
    // so the cut is made after joining, at the first sentence end, which is where the guide's
    // step reliably finishes and the commentary reliably starts.
    const end = /[.!?](?:\s|$)/.exec(text);
    if (end) text = text.slice(0, end.index + 1);
    return { heading: true, text: text.trim() };
}

/**
 * The sim's note, unless it only repeats the instruction above it.
 *
 * `{ held: 'amulet_of_ghostspeak', op: 2, why: 'wear it' }` becomes "Wear Ghostspeak amulet." with
 * "Wear it." under it, which is the same sentence twice and the second one less informative. A
 * note that opens on the same verb as the instruction is saying nothing the row has not said.
 */
function explanation(act: string, why: string): string | undefined {
    if (!why) return undefined;
    const verb = (t: string) =>
        t
            .trim()
            .split(/\s+/)[0]
            .toLowerCase()
            .replace(/[^a-z]/g, '');
    // ONLY A BARE RESTATEMENT GOES. Matching on the verb alone was too much: "open the coffin -
    // this is what summons the ghost" starts with the same word as "Open Coffin." and is the one
    // thing on the row worth reading. Three words or fewer is the restatement - "wear it",
    // "search it" - and anything longer has something of its own to say.
    if (verb(act) && verb(act) === verb(why) && why.trim().split(/\s+/).length <= 3) return undefined;
    // NOT THE NEXT SENTENCE OF A STORY. The manifests are written as running commentary, so 293
    // of these open on a conjunction - "and the helmet", "and he feels it" - which under an
    // instruction reads as narration rather than as what it is: which helmet, which attempt.
    return sentence(why.replace(/^(?:(?:and|then|but|so|also)\s+)+/i, ''));
}

/** How many paragraphs of sim commentary were left out, for the report. */
let commentary = 0;

// A walk's prose is a DESTINATION, not an instruction: "To the ruins of Uzer.", "Back to the
// priests.", "North to Edgeville and down.", "The south gate, from outside." As a row it reads as
// a label for somewhere rather than something to do, so it gets the verb it is missing. Which
// verb depends on what follows: a preposition or a bearing wants "Go", a bare place wants "Go to",
// and a phrase that already opens on a verb wants nothing.
const HEADS_WITH_GO = new Set([
    'to',
    'back',
    'into',
    'down',
    'up',
    'round',
    'across',
    'through',
    'out',
    'past',
    'along',
    'over',
    'inside',
    'outside',
    'north',
    'south',
    'east',
    'west',
    'north-west',
    'north-east',
    'south-west',
    'south-east',
    'northwest',
    'northeast',
    'southwest',
    'southeast',
    'upstairs',
    'downstairs',
    'in',
    'on',
    'behind',
    'beside',
    'toward',
    'towards',
    'via',
    'off'
]);
const ALREADY_A_VERB = new Set([
    'walk',
    'go',
    'head',
    'climb',
    'enter',
    'cross',
    'return',
    'follow',
    'leave',
    'run',
    'take',
    'stand',
    'step',
    'travel',
    'board',
    'ride',
    'swim',
    'jump',
    'squeeze',
    'descend',
    // Not ways of moving, but a leg's prose sometimes names what you went there to do - "ask
    // Jack what is still up there" - and "Go to ask Jack" is not a sentence.
    'ask',
    'tell',
    'speak',
    'find'
]);

// Three shapes of prose that are NOT a destination, each of which came out as a sentence that
// read like a translation. A phrase joined to the step before it ("and you are in the camp");
// a phrase naming the JOURNEY rather than its end ("the walk back north out of the swamp", "the
// long way round to the fountain"), where the destination is what follows the noun; and a whole
// STATEMENT about the route ("the walk from Falador to the fortress is open ground and not this
// quest"), which is a remark and not somewhere to go. Prefixing "Go to" to any of them produced
// "Go to the walk back north out of the swamp."
const JOINED = /^(?:and|then|so)\s+/i;
const JOURNEY = /^(?:to\s+|all\s+)?the\s+(?:long\s+|short\s+|quick\s+|same\s+|only\s+|last\s+|first\s+)?(?:walk|trip|journey|run|trek|hike|way)\s+/i;

/**
 * Whether the phrase makes a claim rather than naming a place.
 *
 * A SUBJECT AT THE FRONT AND ITS VERB BEFORE ANY BREAK, which is narrower than it sounds and has
 * to be. Hunting for a verb anywhere took "through the chamber to the crate the key is on" and
 * "back down the road he has not walked in two hundred years" - plain destinations with a
 * relative clause hanging off them - and stripped the instruction out of both. A statement in
 * this table opens on its own subject instead: "the walk back to Falador is not this quest".
 * So the phrase must START with one of the few words that can only be a subject here, and the
 * verb must reach it without crossing a comma, semicolon or full stop.
 */
const STATEMENT = /^(?:the|a|an|this|that|there|it|he|she|they|you|we)\b[^,;.]*?\b(?:is|are|was|were|has|have)\b/i;

function states(text: string): boolean {
    return STATEMENT.test(text);
}

/**
 * What a player calls an npc, following a MULTINPC to find out.
 *
 * An npc that changes with a varbit - the villager who is three different men, the Menaphite
 * leader who is invisible until he is not - carries no name of its own: the names are on the
 * children it switches between. The row read "Talk to Feud Villager Multi 2", which is the
 * server's handle for a thing the game calls a Villager. Any named child will do: they are the
 * same person in different clothes, and where they are not (a guard who becomes a corpse) the
 * first one is the one standing there when the quest sends you.
 */
function npcName(id: number): string | null {
    const type = id >= 0 ? NpcType.get(id) : null;
    if (!type) return null;
    if (type.name) return type.name;
    for (const child of type.multinpc ?? []) {
        if (child < 0 || child === id) continue;
        const name = NpcType.get(child)?.name;
        if (name) return name;
    }
    return null;
}

/** An npc's right-click word, from the same chain: the ops are on the children too. */
function npcOp(id: number, slot: number): string | null {
    const type = id >= 0 ? NpcType.get(id) : null;
    if (!type) return null;
    if (type.op?.[slot]) return type.op[slot];
    for (const child of type.multinpc ?? []) {
        if (child < 0 || child === id) continue;
        const word = NpcType.get(child)?.op?.[slot];
        if (word) return word;
    }
    return null;
}

/**
 * A server handle in a walk's prose, swapped for the name a player reads.
 *
 * The generated legs hand the thing they are walking to straight through as the note - a
 * `gardener('brother_althric', ...)` or a ledge out of a table of them - so the row came out as
 * "Go to brother_althric." and "Go to rocky_ledge2.", which are names out of the server's own
 * source. The cache knows what each one is, and it is the same lookup the clickable steps use:
 * npc first, then loc, then obj. An unknown handle at least loses its underscores.
 */
// Not a FILENAME: a note naming a script - "gnome_glider.rs2 has no teleport gate" - is already
// the word a reader needs, and looking it up turned it into "Gnome glider.rs2".
const HANDLE = /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b(?!\.[a-z0-9]{2,4}\b)/g;

function named(text: string): string {
    return text.replace(HANDLE, token => {
        for (const kind of ['talk', 'loc', 'obj']) {
            const id = idOf(kind, token);
            if (id < 0) continue;
            // locName, not LocType.get(id)?.name: a multiloc handle written in a sim's prose has the
            // same problem as one used as a target - see locName below. "down the burgh inn trapdoor
            // multiloc" is the same string in a sentence as it was in a row.
            const name = kind === 'talk' ? npcName(id) : kind === 'loc' ? locName(id) : ObjType.get(id)?.name;
            if (name) return name;
        }
        return token.replace(/_/g, ' ');
    });
}

/** A destination phrase as something to do: "To the circle." becomes "Go to the circle." */
function walkText(text: string): string {
    let t = named(text).trim().replace(JOINED, '');
    if (!t) return 'Travel here.';
    if (states(t)) return sentence(t);
    t = t.replace(JOURNEY, '');
    if (!t) return 'Travel here.';
    const first = t
        .split(/\s+/)[0]
        .toLowerCase()
        .replace(/[^a-z-]/g, '');
    if (ALREADY_A_VERB.has(first)) return sentence(t);
    // Lowercasing the first letter is right for "The south gate" and wrong for "Velorina's
    // house", and nothing in the string says which - so only the words that are certainly not
    // names get lowered: the articles and the prepositions and bearings listed above.
    const common = HEADS_WITH_GO.has(first) || first === 'the' || first === 'a' || first === 'an';
    const lead = common ? t.charAt(0).toLowerCase() + t.slice(1) : t;
    return sentence(HEADS_WITH_GO.has(first) ? `Go ${lead}` : `Go to ${lead}`);
}

/**
 * A debugname as a name, for the 447 steps whose target the cache has no name for.
 *
 * `fever_multi_cannon` is a handle out of the server's source and the quest has no other word for
 * that cannon, so the row has to use it. Lowercased with spaces it read as a typo in the middle of
 * a sentence - "Load fever multi cannon." - and capitalised it reads as the name of a thing.
 */
function titled(handle: string): string {
    return (
        handle
            .replace(/_/g, ' ')
            .replace(/\b[a-z]/g, c => c.toUpperCase())
            // `golem_golem` is a quest prefix in front of its own subject, and "Talk to Golem Golem."
            // is the handle showing through rather than a name.
            .replace(/\b(\w+) \1\b/gi, '$1')
    );
}

/** A fragment as a sentence: a capital at the front, a full stop at the back. */
function sentence(text: string): string {
    const t = text.trim();
    if (!t) return '';
    const head = t.charAt(0).toUpperCase() + t.slice(1);
    return /[.!?]$/.test(head) ? head : head + '.';
}

/**
 * The action a step is, as an imperative: "Search Bookcase", "Open Door", "Talk to Velorina".
 *
 * WHY NOT THE SIM'S OWN WORDS. A manifest's `why` is written to be read AFTER the step it
 * annotates - "open it; the only way into the house", "in, and beside the bookcase" - so as a
 * row's heading it is a lowercase fragment whose verb has nothing attached to it. The cache
 * already knows the verb: a loc carries its right-click ops, and op 1 of that door is "Open". Verb
 * and name both from there gives a line that reads as an instruction, and leaves `why` to be the
 * explanation underneath, which is what it was written as.
 */
function imperative(kind: string, name: string, op: number | undefined, id: number, item?: string | null): string | null {
    if (!name) return null;
    // THE RIGHT-CLICK WORD, when the sim names one. `{ talk: 'feud_villager_multi_2', op: 3 }`
    // is a PICKPOCKET, and the row said "Talk to" - which is a different thing to do, in a leg
    // whose heading is "pickpocket a villager, badly". Locs have read their ops since the start;
    // npcs carry the same five and were not being asked.
    if (kind === 'talk') {
        const word = op && op > 1 && id >= 0 ? npcOp(id, op - 1) : null;
        return word ? `${word} ${name}` : `Talk to ${name}`;
    }
    if (kind === 'fight') return `Kill ${name}`;
    if (kind === 'take') return `Pick up ${name}`;
    if (kind === 'herd') return `Herd ${name}`;
    // BEFORE THE OP LOOKUP BELOW, which reads ObjType for anything that is not a loc or a held
    // item - and `id` here is the loc or the npc being used ON, so that lookup was asking the obj
    // table for a loc's number and would answer with an unrelated item's right-click word.
    if (kind === 'useLoc' || kind === 'useNpc' || kind === 'use') {
        return item ? `Use ${item} on ${name}` : `Use an item on ${name}`;
    }
    if (kind === 'castLoc') return `Cast a spell on ${name}`;

    const slot = (op ?? 1) - 1;
    let verb: string | null = null;
    if (kind === 'loc' && id >= 0) verb = LocType.get(id)?.op?.[slot] ?? null;
    else if (kind === 'held' && id >= 0) verb = ObjType.get(id)?.iop?.[slot] ?? null;
    else if (id >= 0) verb = ObjType.get(id)?.op?.[slot] ?? null;

    if (verb) return `${verb} ${name}`;
    if (kind === 'loc' || kind === 'held') return `Use ${name}`;
    return name;
}

/**
 * A step's prose, with the tile taken off the end.
 *
 * The manifests write "across the entrance hall -> 3108,3163" so that somebody diffing the sim
 * against the map can see both. The panel draws the tile from `at`, so the arrow and the digits
 * are repetition in a one-line instruction.
 */
function prose(why: unknown): string {
    return (typeof why === 'string' ? why : '').replace(/\s*[-=]>\s*\d{3,5}\s*,\s*\d{3,5}\s*$/, '').trim();
}

function stepsOf(raw: unknown[]): { stages: HelperStage[]; dropped: Record<string, number> } {
    const dropped: Record<string, number> = {};
    /** Every handle the sim hands the player: the shopping list, gathered over the whole run. */
    const given = new Set<string>();
    const stages: HelperStage[] = [];
    let cur: HelperStage = { from: 0, headings: [], marks: [], steps: [], items: [], worn: [] };

    const push = () => {
        if (cur.steps.length || cur.items.length || cur.worn.length || cur.headings.length) stages.push(cur);
    };

    // The note run being gathered, joined and classified by flushNotes below.
    let noteRun: string[] = [];

    /**
     * Turn the gathered run into a heading, or throw it away.
     *
     * A run that opens "wiki step 3:" is the GUIDE's own wording for this leg, which is the one
     * thing in a manifest written for a person doing the quest. Everything else is the sim author
     * explaining the sim to the next developer - "The house is a sealed 34-tile pocket with one
     * shut door, so the door comes first - questrun walks on canTravel and canTravel does not open
     * doors", "The 377 cache has no slashed-book obj" - which is worth keeping in the sim and is
     * noise in a quest helper. Elemental Workshop showed eleven such rows above three real steps.
     */
    const flushNotes = () => {
        if (!noteRun.length) return;
        const joined = noteRun.join(' ').replace(/\s+/g, ' ').trim();
        noteRun = [];
        const { heading, text } = tidy(joined);
        // `cur.steps.length` is the index the NEXT step will take, which is the first step this
        // heading introduces: a heading is written before the steps it describes.
        if (heading && text) cur.headings.push({ at: cur.steps.length, text: sentence(text) });
        else if (!heading) commentary++;
    };

    for (const entry of raw) {
        if (!entry || typeof entry !== 'object') continue;
        const s = entry as Record<string, unknown>;

        // A `stage:` marker closes the current leg and opens the next one at that varp value.
        if ('stage' in s) {
            // A heading sits immediately before the stage it introduces, so the run has to be
            // settled onto THIS leg before the leg is closed.
            flushNotes();
            push();
            cur = { from: Number(s.stage), headings: [], marks: [], steps: [], items: [], worn: [] };
            continue;
        }

        const kind = Object.keys(s).find(k => !['why', 'picks', 'op', 'at', 'want', 'tries', 'until', 'soft', 'n', 'r', 'exact', 'obj', 'how', 'nomark'].includes(k));
        if (!kind) continue;

        if (ASSERT_KINDS.has(kind)) {
            // `varis` is the exception among the assertions: the others check the world agrees
            // with the sim, this one records how far the quest's own flags have moved. A target
            // of 0 is "not set yet", which is true before anything happens and marks nothing.
            // AND `nomark` WITHHOLDS THE MARK WITHOUT WITHDRAWING THE ASSERTION. A mark says "the
            // player who has this value has reached this step", which holds only where the leg's
            // steps are walked in order. Recipe for Disaster's fourth leg is 203 steps covering
            // eight sub-quests a player may start in any order, and its eight "started" varbits all
            // sat beside step 16 - so inspecting ANY plinth sent the panel to the first step of the
            // Mountain Dwarf's, whichever person the player had actually inspected
            // (DeathPlateau-Bugs#60). The run still checks the varbit moved; it just no longer
            // claims that means the player is standing at step 16.
            if (kind === 'varis' && s.nomark !== true && typeof s.varis === 'string' && typeof s.to === 'number' && s.to > 0) {
                const bit = VarBitType.getId(s.varis);
                const varp = bit === -1 ? VarPlayerType.getByName(s.varis) : null;
                const id = bit !== -1 ? bit : (varp?.id ?? -1);
                if (id >= 0) {
                    cur.marks.push({ at: cur.steps.length, var: id, varbit: bit !== -1, is: s.to });
                } else {
                    unresolved.set('var:' + s.varis, (unresolved.get('var:' + s.varis) ?? 0) + 1);
                }
            }
            dropped[kind] = (dropped[kind] ?? 0) + 1;
            continue;
        }

        if (DROP.has(kind)) {
            dropped[kind] = (dropped[kind] ?? 0) + 1;
            // A setpos is still worth a line: it is the walk between two legs.
            if (kind === 'setpos' && Array.isArray(s.setpos)) {
                cur.steps.push({ text: walkText(prose(s.why)), kind: 'walk', at: s.setpos as number[] });
            }
            continue;
        }

        // NOTES ARE A PARAGRAPH HARD-WRAPPED INTO SEVERAL ENTRIES, not several notes. A manifest
        // is source code with a line length, so one comment is written as a run of `{ note: ... }`
        // broken at about ninety characters. Treating each as its own step put a sentence fragment
        // in every row - "it. The 377 cache has", "questrun walks on canTravel and canTravel does
        // not open .." - so the run is gathered and joined before anything is decided about it.
        if (kind === 'note') {
            noteRun.push(String(s.note));
            continue;
        }
        flushNotes();

        // AN ASSERTION, NOT AN INSTRUCTION. `{ held: x, op: 2, why: 'wear it' }` is the click;
        // the `{ worn: x }` after it is the sim checking the click worked. Emitting both gave
        // every equip two lines, the second one invented by defaultText ("Wear amulet of
        // ghostspeak.") directly under the real one.
        if (kind === 'worn' && typeof s.why !== 'string') {
            const wid = idOf('obj', String(s.worn));
            // A `worn` assertion is a receipt too: the equip above it worked. On the BODY,
            // though - the same item in the bag is that step still waiting to be taken.
            if (cur.steps.length && wid >= 0) {
                const last = cur.steps[cur.steps.length - 1];
                if (last.kind !== 'note') (last.wears ??= []).push(wid);
            }
            cur.worn.push({
                name: (wid >= 0 ? ObjType.get(wid)?.name : null) || String(s.worn),
                id: wid,
                bring: false,
                handle: String(s.worn)
            });
            continue;
        }

        // `give` IS THE SHOPPING LIST. It reads like an instruction and is not one: it is the sim
        // handing the player an item before a leg, which is why a run ends by printing "items the
        // run had to be handed: steel_longsword, coins x10". That list is exactly what a helper
        // means by what you need to bring, so it joins `has` rather than becoming a step telling
        // somebody to give a hammer to a hammer.
        if (kind === 'give' || kind === 'has') {
            const item = String(kind === 'give' ? s.give : s.has);
            // THE RECEIPT FOR THE STEP ABOVE. `has` is the sim checking the click worked, which
            // means the thing is in the bag because of that step - and `give` is not: that is the
            // sim handing itself something out of the bank, which proves nothing about the quest.
            if (kind === 'has' && cur.steps.length) {
                const last = cur.steps[cur.steps.length - 1];
                const got = idOf('obj', item);
                if (got >= 0 && last.kind !== 'note') (last.gives ??= []).push(got);
            }
            const n = typeof s.n === 'number' ? s.n : 1;
            const id = idOf('obj', item);
            if (id < 0) unresolved.set('item:' + item, (unresolved.get('item:' + item) ?? 0) + 1);
            const shown = id >= 0 ? ObjType.get(id)?.name : null;
            // ONCE GIVEN, ALWAYS BROUGHT. A sim hands itself the knife at the top and asserts it
            // again three legs later; the second mention is the same knife out of the same bank
            // trip, not something the quest handed over, so the whole run's `give` list decides.
            // A `give` that says HOW the player gets the thing is the sim standing in for a step
            // of the quest (a cupboard that only answers when somebody is not standing beside
            // it, so it cannot be clicked in a run that has to pass every time). That is a step
            // to do, not an item to bring, so it becomes the step and stays off the shopping list.
            const how = kind === 'give' && typeof s.how === 'string' ? s.how.trim() : '';
            if (how) cur.steps.push({ kind: 'note', text: sentence(how) });
            else if (kind === 'give') given.add(item);
            const seen = cur.items.find(x => x.name === item);
            // The same item asked for twice in a leg means the larger count, not two rows.
            if (seen) seen.n = Math.max(seen.n, n);
            else cur.items.push({ name: shown || item, id, n, bring: false, handle: item });
            continue;
        }

        const why = prose(s.why);
        const npc = NPC_KINDS.has(kind);
        const loc = LOC_KINDS.has(kind);
        const obj = OBJ_KINDS.has(kind);
        const walk = WALK_KINDS.has(kind);
        // `fight: ['a','b']` is one npc that changes form mid-fight; the first name is the one
        // standing there when the player arrives, so that is what gets highlighted.
        const raw = s[kind];
        // THE SECOND HALF IS THE TARGET. `use: ['knife', 'book']` reads "use the knife on the
        // book": the book is what the step is about and the knife is what is in your hand, which
        // is the same shape as a useLoc with both halves in the inventory.
        const pair = kind === 'use' && Array.isArray(raw) && raw.length >= 2;
        const target = npc || loc || obj ? String(pair ? raw[1] : Array.isArray(raw) ? raw[0] : raw) : '';

        // THE NAME IS RESOLVED BEFORE THE SENTENCE IS WRITTEN, because the sentence uses it. A
        // step with no `why` falls back to "Talk to <name>", and taking the name from the
        // debugname produced "Talk to ahoy velorina." where the cache says Velorina.
        let id = -1;
        let shown: string | null = null;
        if (target) {
            id = npc ? idOf('talk', target) : loc ? idOf('loc', target) : idOf('obj', target);
            if (id >= 0) {
                shown = (npc ? npcName(id) : loc ? locName(id) : ObjType.get(id)?.name) ?? null;
            } else {
                unresolved.set(kind + ':' + target, (unresolved.get(kind + ':' + target) ?? 0) + 1);
            }
        }

        // The item a `useNpc`/`useLoc` is holding, so the row can say WHICH item: the manifest
        // carries it as `obj` beside the target, and without it every one of the 563 of them read
        // "Use an item on Cauldron." - true, and no use to somebody standing at the cauldron.
        let item: string | null = null;
        let itemId = -1;
        const held = typeof s.obj === 'string' && s.obj ? s.obj : pair ? String(raw[0]) : null;
        if (held) {
            const objId = idOf('obj', held);
            itemId = objId;
            item = (objId >= 0 ? ObjType.get(objId)?.name : null) ?? titled(held);
        }
        const act = imperative(kind, shown || titled(target), typeof s.op === 'number' ? s.op : undefined, id, item);
        const step: HelperStep = {
            kind: npc ? 'talk' : loc ? 'loc' : walk ? 'walk' : obj ? 'obj' : 'note',
            // The imperative leads the row. With no target to build one from - a walk - the sim's
            // own words are all there is, so they lead instead, as a sentence rather than a
            // fragment.
            text: act ? act + '.' : walk ? walkText(why) : sentence(why) || defaultText(kind, shown || target || String(raw)),
            // And the sim's words go underneath, where a fragment reads correctly.
            why: act ? explanation(act, why) : undefined
        };
        if (target) {
            step.target = target;
            if (id >= 0) step.id = id;
            if (shown) step.label = shown;
        }
        if (itemId >= 0) step.item = itemId;
        if (Array.isArray(s.at)) step.at = s.at as number[];
        else if (walk && Array.isArray(raw)) step.at = raw as number[];
        if (typeof s.op === 'number') step.op = s.op;
        if (npc && id >= 0) {
            const also = family(id, typeof s.op === 'number' ? s.op : undefined);
            if (also) step.also = also;
        }
        if (Array.isArray(s.picks)) step.picks = (s.picks as unknown[]).map(String);
        cur.steps.push(step);
    }
    // A quest whose last entry is a note - the closing remark most of them end on - would
    // otherwise lose it, and with it the heading of the final leg.
    flushNotes();
    push();
    // A WALK WITH NOTHING TO SAY TAKES THE NAME OF WHAT IT LEADS TO. 22 setposes carry no prose
    // at all and came out as "Travel here.", which is a row that tells a player nothing; the
    // step underneath nearly always names the thing they are being sent to.
    for (const stage of stages) {
        for (let i = 0; i < stage.steps.length; i++) {
            if (stage.steps[i].text !== 'Travel here.') continue;
            for (let j = i + 1; j < stage.steps.length; j++) {
                const next = stage.steps[j];
                if (next.kind === 'walk' || next.kind === 'note') continue;
                if (next.label) stage.steps[i].text = sentence(`Go to ${next.label}`);
                break;
            }
        }
    }
    // THE WHOLE RUN DECIDES, so this is settled here and not as each item is pushed: a knife
    // given at the top of the sim is a knife to bring in every leg that asks for it, and a leg
    // that only ever says `has` is asking for something the quest itself hands over.
    for (const stage of stages) {
        for (const item of [...stage.items, ...stage.worn]) {
            item.bring = item.handle !== undefined && given.has(item.handle);
        }
    }

    // ...AND "IN EVERY LEG THAT ASKS FOR IT" NOW MEANS IT. The line above has said that since it
    // was written, and it was not true: an item only ever landed in the list of whichever leg the
    // sim's `give` line happened to sit in, which for most runs is the first one. A player four
    // legs later, told to "Use Pestle and mortar on Black mushroom", was given no hint that a
    // pestle and mortar is something they have to go and fetch - it was named on a panel they
    // last saw at the start of the quest. Reported as "the golem. missing a few steps in helper
    // how to reprogram the golem" (DeathPlateau-Bugs#59), which is exactly that leg.
    //
    // THE STEPS THEMSELVES SAY WHICH LEG ASKS. Every use-step already carries the obj it is used
    // WITH, so a leg's own shopping list is derivable rather than something a manifest has to
    // repeat - and derived is the point: 122 of these were missing across 50 of the 108 quests,
    // and nobody was going to find them by rereading manifests.
    //
    // Only items the run was HANDED (`given`) are added. An item the quest itself produces is
    // already in the leg that produces it, and listing it again in the leg that spends it would
    // tell a player to go and fetch a golem program.
    const broughtIds = new Map<number, { name: string; handle: string }>();
    for (const stage of stages) {
        for (const item of stage.items) {
            if (item.bring && item.id >= 0 && item.handle !== undefined) broughtIds.set(item.id, { name: item.name, handle: item.handle });
        }
    }
    for (const stage of stages) {
        const already = new Set(stage.items.map(x => x.id));
        for (const step of stage.steps) {
            const used = (step as { item?: number }).item;
            if (used === undefined || used < 0 || already.has(used)) continue;
            const brought = broughtIds.get(used);
            if (!brought) continue;
            already.add(used);
            stage.items.push({ name: brought.name, id: used, n: 1, bring: true });
        }
    }
    for (const stage of stages) {
        for (const item of [...stage.items, ...stage.worn]) delete item.handle;
    }
    return { stages, dropped };
}

/**
 * A loc's name as a player reads it, THROUGH THE SHELL IF IT IS ONE.
 *
 * A multiloc is a placed container with no name of its own: what stands there is whichever CHILD
 * its varbit selects, and the child is what the player's mouse says. With no name on the shell,
 * the panel fell back to titling the internal one, and 295 steps across 30 quests told people to
 * "Use Burgh Inn Trapdoor Multiloc.", "Activate Desert Treasure Oblix1.", "Use 4to7." and - for
 * eight locs with no debugname either - "Use Iron sheet on Loc 14933."
 * Reported and measured as DeathPlateau-Bugs#79.
 *
 * EVERY ONE OF THE 144 IS A SHELL, AND EVERY ONE HAS A NAMED CHILD. That was worth checking before
 * writing this, because the issue was filed guessing the opposite - that 82 of them were plain locs
 * with no name anywhere, needing 82 names invented. There are none. So nothing here chooses a word:
 * it uses the name the cache already gives the thing standing on that tile.
 *
 * THE FIRST NAMED CHILD, which is multiloc[0] - the state the varbit selects at 0, before anything
 * in the quest has touched it. That is what a player walking up to the step sees: a Damaged wall
 * before they repair it, a Broken furnace before they fix it, a Trapdoor before it is opened. Where
 * a shell's children differ (burgh_bank_wall_multiloc is "Damaged wall" then "Repaired wall"), the
 * earlier one is the one the step is about. tools/sim/helperlocnames.ts prints every shell whose
 * children disagree, so the handful where that reads oddly are visible rather than buried.
 */
function locName(id: number): string | null {
    const real = (t: LocType | undefined): string | null => {
        const n = t?.name;
        return n && n !== 'null' ? String(n) : null;
    };
    const self = real(LocType.get(id));
    if (self) {
        return self;
    }
    const kids = (LocType.get(id) as unknown as { multiloc?: number[] })?.multiloc ?? [];
    for (const kid of kids) {
        if (kid < 0) {
            continue;
        }
        const n = real(LocType.get(kid));
        if (n) {
            return n;
        }
    }
    return null;
}

function defaultText(kind: string, target: string): string {
    const pretty = titled(String(target));
    if (kind === 'fight') return `Kill ${pretty}.`;
    if (kind === 'give') return `Give an item to ${pretty}.`;
    if (kind === 'take') return `Pick up ${pretty}.`;
    if (kind === 'cast') return `Cast ${pretty}.`;
    if (kind === 'castLoc') return `Cast a spell on ${pretty}.`;
    if (kind === 'useLoc') return `Use an item on ${pretty}.`;
    if (kind === 'use') return `Use ${pretty.replace(',', ' on ')}.`;
    if (kind === 'herd') return `Herd ${pretty}.`;
    if (kind === 'mapexit' || kind === 'sneak') return 'Go here.';
    if (kind === 'talk') return `Talk to ${pretty}.`;
    if (kind === 'loc') return `Use ${pretty}.`;
    if (kind === 'held') return `Use ${pretty} from your inventory.`;
    if (kind === 'worn') return `Wear ${pretty}.`;
    if (kind === 'useNpc') return `Use an item on ${pretty}.`;
    if (kind === 'go') return 'Walk here.';
    return pretty;
}

// ---------------------------------------------------------------- main

// The cache, without a world. World.start loads these from data/pack and then spawns 12,666 npcs
// and rolls for all of them; the four loaders are all this needs and they take no time.
ObjType.load('data/pack');
LocType.load('data/pack');
NpcType.load('data/pack');
VarPlayerType.load('data/pack');
VarBitType.load('data/pack');

// THE SCRIPTS TOO, for one question the cache cannot answer: which OTHER npcs a step would also
// accept. See `family` below.
ScriptProvider.load('data/pack');

/**
 * The npcs a step's op would run the SAME script on, which is the server's own answer to "will
 * this one do instead?".
 *
 * The reported case: The Feud sends you to pickpocket a villager, the sim happened to use
 * feud_villager_multi_2, and the marker pointed at that one across town while an identical
 * villager stood next to the player. Pollnivneach has three of them, Rat Catchers has six rats,
 * Sheep Herder four sick sheep.
 *
 * NOT A GUESS FROM THE NAMES, which would be wrong in both directions. The Feud binds opnpc3
 * (Pickpocket) on all three villagers, opnpc4 (Lure) on only the second and third, and opnpc5
 * (Knock-Out) on the third alone - so "any villager" is right for one step of that quest and
 * wrong for the next two. Asking which script the op resolves to gets each of them right, and
 * costs one walk of the npc table per op.
 *
 * ONLY A TYPE-SPECIFIC SCRIPT COUNTS. getByTrigger falls back to the category's script and then
 * to a global one, and a global fallback is shared by every npc that has no handler of its own -
 * grouping on that would make one family of half the cache. Passing -1 as the category leaves
 * only the type key and the global, and the global is what every id without a handler answers,
 * so an id whose answer IS the global has no script of its own and no family.
 */
const families = new Map<string, number[]>();
{
    for (let op = 1; op <= 5; op++) {
        const trigger = ServerTriggerType.OPNPC1 + op - 1;
        const groups = new Map<string, number[]>();
        for (let id = 0; id < NpcType.count; id++) {
            const script = ScriptProvider.getByTrigger(trigger, id, -1);
            // THE SCRIPT HAS TO BE THIS NPC'S OWN. getByTrigger falls back to the category's
            // script and then to a global one, and a fallback is shared by every npc with no
            // handler of its own, so grouping on one would make a family of half the cache.
            if (!script || script.info.lookupKey !== (trigger | (0x2 << 8) | (id << 10))) continue;
            // AND THE SAME WORD HAS TO BE OVER BOTH. The compiled body alone groups the sixty-six
            // npcs that share the generic pickpocket script - Man, Woman, Farmer, Guard, a whole
            // town - and a step about a farmer is not a step about a guard. Two npcs with one name
            // and one script are two the player cannot tell apart and the server does not either.
            const name = npcName(id);
            if (!name) continue;
            const key = JSON.stringify([name, script.opcodes, script.intOperands, script.stringOperands]);
            const seen = groups.get(key);
            if (seen) seen.push(id);
            else groups.set(key, [id]);
        }
        for (const ids of groups.values()) {
            if (ids.length < 2) continue;
            for (const id of ids) {
                families.set(`${op}:${id}`, ids);
            }
        }
    }
}

/** The other npcs this step would take, nearest-first being the client's business, or null. */
function family(id: number, op: number | undefined): number[] | null {
    if (id < 0) return null;
    const also = families.get(`${op ?? 1}:${id}`);
    if (!also) return null;
    const rest = also.filter(other => other !== id);
    return rest.length > 0 ? rest : null;
}

/** A debugname to its cache id, by what kind of step it came from. -1 when the cache has no such name. */
function idOf(kind: string, name: string): number {
    try {
        if (kind === 'talk' || kind === 'useNpc' || kind === 'apnpc') return NpcType.getId(name);
        if (kind === 'loc' || kind === 'useLoc') return LocType.getId(name);
        return ObjType.getId(name);
    } catch {
        return -1;
    }
}

const out: HelperQuest[] = [];
const unresolved = new Map<string, number>();
const skipped: string[] = [];
const allDropped: Record<string, number> = {};

for (const file of fs
    .readdirSync(SIM)
    .filter(f => /^quest_.*_run\.ts$/.test(f))
    .sort()) {
    const m = manifestOf(path.join(SIM, file));
    if (!m || !Array.isArray(m.steps) || typeof m.stageVar !== 'string') {
        skipped.push(file);
        continue;
    }
    const { stages, dropped } = stepsOf(m.steps);
    const done = Number(m.done ?? 0);
    for (const [k, v] of Object.entries(dropped)) allDropped[k] = (allDropped[k] ?? 0) + v;
    // A quest tracks progress in either a varp or a varbit, and the client reads the two
    // differently (getVarp by id; getVarbit decodes a range out of its parent varp), so which it
    // is has to travel with the number.
    let stageVarId = -1;
    let stageIsVarbit = false;
    let stageBits: { varp: number; lsb: number; msb: number } | undefined;
    const asVarp = VarPlayerType.getByName(m.stageVar);
    if (asVarp) {
        stageVarId = asVarp.id;
    } else {
        const asBit = VarBitType.getByName(m.stageVar);
        if (asBit) {
            stageVarId = asBit.id;
            stageIsVarbit = true;
            // The bits themselves, so a harness with no cache can still write this quest's
            // progress. Emitted only when all three are real: a -1 here would have the harness
            // writing into varp -1 and reading back a leg that never happened, which is worse
            // than the first-leg-only sweep it replaces.
            if (asBit.basevar >= 0 && asBit.startbit >= 0 && asBit.endbit >= asBit.startbit) {
                stageBits = { varp: asBit.basevar, lsb: asBit.startbit, msb: asBit.endbit };
            } else {
                unresolved.set('stageBits:' + m.stageVar, 1);
            }
        }
    }
    if (stageVarId < 0) unresolved.set('stageVar:' + m.stageVar, 1);
    out.push({
        stageVarId,
        stageIsVarbit,
        ...(stageBits ? { stageBits } : {}),
        id: file.replace(/^quest_|_run\.ts$/g, ''),
        name: String(m.quest ?? file),
        source: String(m.source ?? ''),
        stageVar: m.stageVar,
        done,
        start: Array.isArray(m.start) ? (m.start as number[]) : [],
        // NOTHING AFTER THE QUEST IS FINISHED. A sim does not stop at the last step: it goes on to
        // check what the quest paid out - the anvil in Doric's, the Salve amulet in Haunted Mine,
        // the Enchanted key hunt after Making History - and those rows were landing in the leg at
        // `done`, where the panel already reads the quest as complete and shows none of them. They
        // were invisible noise rather than a visible lie, but a quest helper's table should hold
        // the quest and stop. Nine quests carried them, and the Feud's own stuck-character fixture
        // would have been the tenth.
        stages: done > 0 ? stages.filter(st => st.from < done) : stages
    });
}

/**
 * THE TABLE IS READ BY A 2004 BITMAP FONT, so every string in it is printable ASCII.
 *
 * PixFont keeps one glyph per character in arrays of 256 indexed by the character itself, so a
 * character above 255 is an ArrayIndexOutOfBoundsException the moment the client measures or
 * draws it - and a plugin cannot catch that: five frames later the client has turned it off, and
 * a player who switches it back on lands on the same step and loses it again.
 *
 * WHICH IS WHAT SHIPPED. The sims' prose is written with typographic apostrophes, because that
 * is what prose looks like - "Go west to Doric’s hut" - and 32 rows across 16 quests carried one
 * into the table. The Knight's Sword had one in its FIRST leg, so the helper died on the first
 * step of an early quest. The client defends itself now (OverlayGraphics.drawable), and this is
 * the other end of it: what the sims write stays prose, and what the table ships is ASCII.
 */
function ascii(text: string): string {
    return text
        .replace(/[\u2018\u2019\u201A\u201B\u00B4]/g, "'")
        .replace(/[\u201C\u201D\u201E\u201F\u00AB\u00BB]/g, '"')
        .replace(/[\u2010-\u2015]/g, '-')
        .replace(/\u2026/g, '...')
        .replace(/[\u2022\u00B7]/g, '*')
        .replace(/[\u00A0\u2000-\u200A\u202F]/g, ' ')
        .replace(/\u00D7/g, 'x')
        .replace(/[^\x20-\x7E]/g, '?');
}

/** Every string in the table, through {@link ascii}. */
function asciiDeep(value: unknown): unknown {
    if (typeof value === 'string') return ascii(value);
    if (Array.isArray(value)) return value.map(asciiDeep);
    if (value && typeof value === 'object') {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = asciiDeep(v);
        return out;
    }
    return value;
}

const dest = process.argv[2] ?? path.join(import.meta.dirname, '..', '..', 'data', 'quests.json');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(asciiDeep({ quests: out }), null, 1));

const steps = out.reduce((a, q) => a + q.stages.reduce((b, s) => b + s.steps.length, 0), 0);
const items = out.reduce((a, q) => a + q.stages.reduce((b, s) => b + s.items.length, 0), 0);
const targets = out.reduce((a, q) => a + q.stages.reduce((b, s) => b + s.steps.filter(x => x.target).length, 0), 0);
console.log(`${out.length} quests, ${out.reduce((a, q) => a + q.stages.length, 0)} stages, ${steps} steps`);
console.log(`  ${targets} of those steps name an npc or loc to highlight, and ${items} items are listed`);
console.log(
    `  dropped as robot-only: ${Object.entries(allDropped)
        .map(([k, v]) => k + ' ' + v)
        .join(', ')}`
);
console.log(`  and ${commentary} paragraphs of sim commentary, which explain the sim rather than the quest`);
const rescued = generated.filter(f => !skipped.includes(f));
if (generated.length) {
    console.log(`  steps built by a function, so RUN rather than parsed (${generated.length}): ${rescued.length} read, ${generated.length - rescued.length} still refused`);
}
const unread = skipped.filter(f => !generated.includes(f));
// Not a failure to read: these sims have no step list to read. They drive their quest with
// direct harness calls and assert as they go - 15 checks each and no `steps:` anywhere - so
// there is nothing here to turn into a helper page. Writing manifests for them is a job for
// whoever wants those two quests helped, not something this tool can infer.
if (unread.length) console.log(`  not manifest-driven, so no steps to export (${unread.length}): ${unread.join(' ')}`);
const withId = out.reduce((a, q) => a + q.stages.reduce((b, st) => b + st.steps.filter(x => typeof x.id === 'number').length, 0), 0);
const varOk = out.filter(q => (q.stageVarId ?? -1) >= 0).length;
console.log(`  ${withId} of ${targets} targets resolved to a cache id; ${varOk} of ${out.length} quests resolved their progress var`);
// SAID OUT LOUD, because the harness's reach depends on it: a varbit quest with no bits is one
// the client-side sweep can only draw at its first leg, which is the shortfall these numbers
// exist to remove. Counted rather than assumed, so a cache that stops describing one is visible
// here rather than as a sweep that quietly got smaller.
const bitQuests = out.filter(q => q.stageIsVarbit);
const withBits = bitQuests.filter(q => q.stageBits);
console.log(`  ${withBits.length} of ${bitQuests.length} varbit quests carry their bit range, so the client harness can write ${withBits.reduce((a, q) => a + q.stages.length, 0)} of ${bitQuests.reduce((a, q) => a + q.stages.length, 0)} varbit legs`);
for (const q of bitQuests.filter(q => !q.stageBits)) {
    console.log(`    no bit range: ${q.name} (${q.stageVar}) - swept at its first leg only`);
}
if (unresolved.size) {
    const worst = [...unresolved].sort((a, b) => b[1] - a[1]).slice(0, 8);
    console.log(`  unresolved names (${unresolved.size}): ${worst.map(([k, n]) => k + (n > 1 ? ' x' + n : '')).join(', ')}`);
}
console.log(`  -> ${dest}`);
process.exit(unread.length > 4 ? 1 : 0);
