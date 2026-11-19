import { CARD_PALETTE, encodePng, GameFont, loadFonts } from '#/server/market/MarketCard.js';

// A world broadcast drawn as a picture, for the Discord feed. The market card's twin, and it shares
// that file's palette, its font reader and its PNG encoder on purpose - see the note there.
//
// WHAT IT DRAWS IS THE SENTENCE THE GAME ALREADY WROTE, not a reassembled version of it. A
// broadcast arrives here as one formatted string, built in content by ~broadcast_news or
// ~broadcast_milestone_news:
//
//   @sh1@@gre@[Server first!]@sh0@@bla@ Koda is the first to reach level @dre@99 Fishing@bla@.
//
// The label is the part before the player's name and the rest is the sentence, so the card is a
// badge and a line of prose. It is deliberately NOT parsed into a player and an achievement: the
// name sits in the middle of the sentence, the shape of the sentence differs per announcement, and
// a parser that is right about "is the first to reach level 99 Fishing" is wrong about the next
// thing somebody writes. The sentence is the content; the card's job is to frame it.
//
// NO PER-KIND COLOUR. In game the label's colour is the difference - gold for a rare drop, green
// for somebody's own milestone - and the obvious move here was to carry that across. It is not
// done, because the card's one piece of colour is the server's red and that is what was agreed for
// the market card; two cards from one server with different spines look like two servers. The badge
// text says which kind it is, which is the thing a reader actually needs.

const { BG, EDGE, RULE, ACCENT, TEXT, DIM, STEEL, SCALE } = CARD_PALETTE;

const CARD_W = 540;
/** Head, rule, badge. */
const BODY_TOP = 68;
const LINE_H = 19;
const BOTTOM_PAD = 16;
/** Three is enough for every line the game sends and keeps a pasted staff announcement in bounds. */
const MAX_LINES = 3;

export type BroadcastCardInput = {
    /** "Rare drop!", "[Milestone]", "[Server first!]" - whatever content put before the name. */
    label: string;
    /** The rest of the line, with the player's name in it, already stripped of its colour codes. */
    sentence: string;
    /** The word under the wordmark: what kind of announcement this is. */
    kind: string;
};

/**
 * Drop the game's text codes: @gre@, @sh1@, @dre@ and the rest are three characters between two
 * at-signs, and the client reads them as colour and shadow rather than drawing them.
 *
 * A yell cannot smuggle one in - the engine has already turned every '@' a player typed into
 * ChatText.LITERAL_AT - so this only ever removes codes content wrote itself.
 */
export function stripCodes(text: string): string {
    return toDrawable(text.replace(/@[a-z0-9]{3}@/g, ''));
}

/**
 * Letters the font can draw, and nothing else.
 *
 * THE FONT IS AN ARRAY OF 256 INDEXED BY THE CHARACTER, so anything above 255 has no glyph. It
 * does not throw here - GameFont masks the code and finds nothing - it draws a GAP, which is the
 * quieter and more confusing failure: a card that reads "they re" with a hole in it, and nothing
 * anywhere saying why. The client had the louder version of this same fact on 18 November, where
 * one curly apostrophe in a quest step took the whole helper panel down.
 *
 * So the handful of characters a person actually types instead of the ASCII ones are translated,
 * and anything else above 255 is dropped rather than left as a hole.
 */
function toDrawable(text: string): string {
    return (
        text
            .replace(/[\u2018\u2019\u201b]/g, "'")
            .replace(/[\u201c\u201d]/g, '"')
            .replace(/[\u2013\u2014]/g, '-')
            .replace(/\u2026/g, '...')
            .replace(/\u00a0/g, ' ')
            // Anything else the font has no glyph for, rather than a hole where it was. The range
            // starts at a space rather than at nought, so this takes the control characters with
            // it: a card is one line of prose and a tab or a newline in it is nothing good.
            .replace(/[^ -\u00ff]/g, '')
    );
}

/**
 * The label and the sentence, split out of one broadcast line.
 *
 * THE LABEL IS WHAT PRECEDES THE PLAYER'S NAME, and both procs in content put it first and follow
 * it with @sh0@@bla@ - a shadow-off and a colour-back-to-black - before the name. That pair is the
 * seam, and it is a better one than looking for brackets, because the news labels have none
 * ("Rare drop!") and the milestone ones do ("[Milestone]").
 *
 * Null when the line does not have that shape, which is the honest answer for a message that did
 * not come from either proc: the restart countdown, or anything a future caller writes by hand.
 * The feed drops those rather than drawing a card with an empty badge.
 */
export function splitBroadcast(raw: string): { label: string; sentence: string } | null {
    const seam = raw.indexOf('@sh0@');
    if (seam <= 0) {
        return null;
    }
    const label = stripCodes(raw.slice(0, seam)).trim();
    const sentence = stripCodes(raw.slice(seam + '@sh0@'.length)).trim();
    if (label.length === 0 || sentence.length === 0) {
        return null;
    }
    return { label, sentence };
}

/** Greedy wrap against the real font, so a long name breaks where the card actually runs out. */
function wrap(font: GameFont, text: string, width: number): string[] {
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
        const next = line.length === 0 ? word : `${line} ${word}`;
        if (font.width(next) <= width || line.length === 0) {
            line = next;
        } else {
            lines.push(line);
            line = word;
        }
    }
    if (line.length > 0) {
        lines.push(line);
    }
    if (lines.length <= MAX_LINES) {
        return lines;
    }
    // Cut rather than shrink, and say so with an ellipsis: a card that silently loses the end of a
    // sentence is worse than one that admits it.
    const kept = lines.slice(0, MAX_LINES);
    kept[MAX_LINES - 1] = `${kept[MAX_LINES - 1]}...`;
    return kept;
}

export function renderBroadcastCard(input: BroadcastCardInput): Buffer {
    const { p11, p12, b12 } = loadFonts();

    const textWidth = CARD_W - 18 - 18;
    const lines = wrap(p12, input.sentence, textWidth);
    const cardH = BODY_TOP + lines.length * LINE_H + BOTTOM_PAD;

    const px = new Int32Array(CARD_W * cardH);
    const rect = (x: number, y: number, w: number, h: number, colour: number): void => {
        for (let j = Math.max(0, y); j < Math.min(cardH, y + h); j++) {
            for (let i = Math.max(0, x); i < Math.min(CARD_W, x + w); i++) {
                px[j * CARD_W + i] = colour;
            }
        }
    };

    rect(0, 0, CARD_W, cardH, BG);
    rect(0, 0, CARD_W, 1, EDGE);
    rect(0, cardH - 1, CARD_W, 1, EDGE);
    rect(CARD_W - 1, 0, 1, cardH, EDGE);
    // The same red spine the market card has, for the same reason.
    rect(0, 0, 3, cardH, ACCENT);
    rect(3, 28, CARD_W - 4, 1, RULE);

    b12.draw(px, CARD_W, 18, 21, ACCENT, 'DEATH PLATEAU');
    p11.draw(px, CARD_W, 18 + b12.width('DEATH PLATEAU') + 10, 21, DIM, input.kind);

    // The badge, in the server's red: the only thing on the card that is not the game's own words.
    b12.draw(px, CARD_W, 18, 50, ACCENT, input.label);

    for (const [at, line] of lines.entries()) {
        // The first line in the brighter grey, the rest in the body colour - a long sentence then
        // reads as one thing with a beginning rather than three equal rows.
        p12.draw(px, CARD_W, 18, BODY_TOP + at * LINE_H, at === 0 ? STEEL : TEXT, line);
    }

    const w = CARD_W * SCALE;
    const h = cardH * SCALE;
    const big = new Int32Array(w * h);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            big[y * w + x] = px[((y / SCALE) | 0) * CARD_W + ((x / SCALE) | 0)];
        }
    }
    return encodePng(big, w, h);
}
