// WHAT THE AFFLICTED OF MORT'TON SAY, which is not words.
//
// Twenty-nine villagers stand in Mort'ton and every one of them offers Talk-to. Until now nothing
// in the content answered it, so the click ended at Player.defaultOp. What the real game says is
// one to six "words" drawn at random, with replacement, from an eleven-word list - and then a blue
// line telling the player they understood none of it. The town cannot tell you what happened to
// it, which is the clue the quest opens with.
//
// WHAT IS WORTH TESTING is the generator, not the words: that a phrase is never empty and never
// longer than six, that every word in it comes from the list, that all eleven can come up, and
// that a word can appear twice in one phrase - "nots nots nots nots nots nots" is one of Old
// School's own examples, and it is the difference between drawing with replacement and shuffling.
// Two hundred conversations, because one says nothing about a distribution - roughly 700 draws, so
// a word that can come up and never does would have to miss (10/11)^700 times. It takes 20s.
import * as H from './harness.ts';
import { check, R, player, drive, useOnNpc } from './a1lib.ts';
import EnumType from '#/cache/config/EnumType.js';
import Npc from '#/engine/entity/Npc.js';
import Player from '#/engine/entity/Player.js';
import ScriptProvider from '#/engine/script/ScriptProvider.js';

await H.boot();

const AFFLICTED = ['mort_afflicted_man', 'mort_afflicted_woman', 'mort_afflicted_man2', 'mort_afflicted_woman2'];
const BLUE = "@blu@~ This person doesn't make any sense at all. ~";

/** The eleven words, read out of the enum rather than written down twice. */
const WORDS: string[] = (() => {
    const e = EnumType.get(EnumType.getId('mortton_babble'));
    const out: string[] = [];
    for (let i = 0; i < 64; i++) {
        const v = e.values.get(i);
        if (typeof v !== 'string' || !v.length) break;
        out.push(v);
    }
    return out;
})();

/** Click Talk-to from a tile beside the villager and hand back every line the player was shown. */
function talkTo(p: Player, npc: Npc): string[] {
    const from = H.ifaces.length;
    if (!H.standBeside(p, npc)) {
        throw new Error(`nowhere to stand beside ${npc.x},${npc.z},${npc.level}`);
    }
    H.opNpc(p, npc, 1);
    for (let t = 0; t < 10 && !p.activeScript; t++) {
        H.tick(1);
    }
    drive(p, []);
    return H.ifaces
        .slice(from)
        .filter(i => i.who === p.username && i.kind === 'text' && i.text)
        .map(i => i.text!);
}

/** The gibberish line out of a conversation: the one made only of words from the list. */
function phraseOf(lines: string[]): string | null {
    for (const line of lines) {
        const parts = line.split(' ');
        if (parts.length && parts.every(w => WORDS.includes(w))) {
            return line;
        }
    }
    return null;
}

console.log('THE WORD LIST');
{
    check('  the enum holds eleven words', WORDS.length, 11);
    // Verbatim from oldschool.runescape.wiki/w/Transcript:Afflicted, in its order.
    check('  and they are the transcript\'s own', WORDS, ['ughugh', "knows'is", 'nots', 'pirsl', "wot's", 'zurgle', 'gurghl', "mee's", 'seysyi', 'sfriess', 'says']);
    for (const n of AFFLICTED) {
        check(`  ${n} has a Talk-to script`, !!ScriptProvider.getByName(`[opnpc1,${n}]`), true);
        // The serum rows were already there and this must not have disturbed them.
        check(`  ${n} still takes a serum dose`, !!ScriptProvider.getByName(`[opnpcu,${n}]`), true);
    }
}

console.log('\nTWO HUNDRED CONVERSATIONS');
{
    const p = player('afflicted_a', 3465, 3307);
    const lengths = new Set<number>();
    const seen = new Set<string>();
    let repeatedWithin = 0;
    let blue = 0;
    let bad = 0;
    const samples: string[] = [];
    for (let i = 0; i < 200; i++) {
        const npc = H.npcNear(AFFLICTED[i % 4], 3465, 3307);
        if (!npc) {
            throw new Error(`no ${AFFLICTED[i % 4]} is placed in Mort'ton`);
        }
        const lines = talkTo(p, npc);
        if (lines.includes(BLUE)) {
            blue++;
        }
        const phrase = phraseOf(lines);
        if (!phrase) {
            bad++;
            continue;
        }
        const parts = phrase.split(' ');
        lengths.add(parts.length);
        for (const w of parts) {
            seen.add(w);
        }
        if (new Set(parts).size < parts.length) {
            repeatedWithin++;
        }
        if (samples.length < 6) {
            samples.push(phrase);
        }
    }
    for (const s of samples) {
        console.log(`    "${s}"`);
    }
    check('  every conversation produced a phrase of nothing but list words', bad, 0);
    check('  and the blue line every time', blue, 200);
    check('  the shortest is one word and the longest six', [Math.min(...lengths), Math.max(...lengths)], [1, 6]);
    check('  all six lengths come up', lengths.size, 6);
    check('  all eleven words come up', seen.size, 11);
    // With replacement: P(no repeat) over 400 draws of 1-6 words is tiny, so zero here means the
    // generator is shuffling a list instead of drawing independently.
    check('  and a word can appear twice in one phrase', repeatedWithin > 20, true);
}

console.log('\nTHE SERUM STILL CURES, briefly');
{
    const p = player('afflicted_b', 3465, 3307);
    H.give(p, 'mort_serum4', 1);
    const from = H.ifaces.length;
    useOnNpc(p, 'mort_afflicted_woman', 'mort_serum4');
    const lines = H.ifaces
        .slice(from)
        .filter(i => i.who === p.username && i.kind === 'text' && i.text)
        .map(i => i.text!);
    check('  a dose comes off the vial', H.invCount(p, 'mort_serum3'), 1);
    check('  and they surface for a moment', lines.some(l => l.includes('only just arrived')), true);
}

console.log(`\n${R.ok} ok, ${R.bad} failed`);
process.exit(R.bad ? 1 : 0);
