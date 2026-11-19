import fs from 'fs';
import zlib from 'zlib';

import Jagfile from '#/io/Jagfile.js';
import Packet from '#/io/Packet.js';
import Environment from '#/util/Environment.js';

// A trading post listing drawn as a picture, for the Discord feed - BY THE SERVER, with no JVM and
// no dependency.
//
// tools/models/MarketCard.java draws the same card with the real client classes, and that is the
// reference: it is what the look was designed and agreed in. It cannot be what SHIPS, because the
// live box runs Node and has no Java on it. So the three things that card is made of are done here
// instead, and each is small because the formats are:
//
//   the font    PixFont's own, read out of this server's own cache (data/pack/client/title). Not a
//               lookalike typeface and not a copy of the glyphs: the same bytes the client draws
//               from, so the card cannot drift from the game.
//   the icon    a 32x32 RGBA PNG per obj, which tools/models/ObjIconFiles.java already renders for
//               the website with the real models and textures. Colour type 6, bit depth 8, not
//               interlaced, one IDAT - the simplest PNG there is, which is why decoding it here is
//               sixty lines rather than a library.
//   the output  a PNG, colour type 2, one filter byte per row and zlib for the rest.
//
// WITHOUT THE ICONS IT STILL DRAWS. MARKET_CARD_ICONS points at the folder ObjIconFiles wrote (on
// the live box, the website's public/icons). Unset, or missing the obj, and the card comes out with
// an empty slot rather than not at all - a feed that stops because one item has no picture is worse
// than a card with a gap in it.

// THE SITE'S PALETTE, from DeathPlateauWeb src/app/globals.css. The Java card carries the same list
// and the same comments; if one moves, move both.
//
// SHARED WITH THE BROADCAST CARD, which is why the palette, encodePng and loadFonts are exported
// below rather than kept to this file. They are not the market's - they are how this server draws
// a card at all - and a second file with its own copy of nine colours is how two cards come to
// disagree about the server's red. If a third card ever appears, lift all three out to a kit of
// their own; two does not earn the move.
const BG = 0x1a1a1a; // --ground
const SLOT = 0x141414; // --ink
const EDGE = 0x3a3a3a; // --line
const RULE = 0x5a2420; // --edge-red
const ACCENT = 0xb83228; // --blood
const TEXT = 0xd0d0d0; // --text
const DIM = 0x8a8a8a; // --text-dim
const STEEL = 0xdddddd; // --knob

const CARD_W = 540;
const CARD_H = 172;
const SCALE = 2;

/** The same colours, by the same names, for anything else that draws one of these. */
export const CARD_PALETTE = { BG, SLOT, EDGE, RULE, ACCENT, TEXT, DIM, STEEL, SCALE } as const;

// ---------------------------------------------------------------- PNG

const CRC_TABLE: Int32Array = ((): Int32Array => {
    const table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
        table[n] = c;
    }
    return table;
})();

function crc32(buf: Buffer): number {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
        c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body), 0);
    return Buffer.concat([len, body, crc]);
}

/** An opaque RGB PNG. The card has no transparency, so colour type 2 and no palette. */
export function encodePng(px: Int32Array, w: number, h: number): Buffer {
    const raw = Buffer.alloc(h * (1 + w * 3));
    let p = 0;
    for (let y = 0; y < h; y++) {
        raw[p++] = 0; // filter: none. The image is flat colour and runs of it, which deflate eats.
        for (let x = 0; x < w; x++) {
            const c = px[y * w + x];
            raw[p++] = (c >> 16) & 0xff;
            raw[p++] = (c >> 8) & 0xff;
            raw[p++] = c & 0xff;
        }
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0);
    ihdr.writeUInt32BE(h, 4);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 2; // colour type: truecolour
    return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/**
 * A 32x32 RGBA icon, as 0x00RRGGBB with 0 meaning transparent.
 *
 * Only the shape ObjIconFiles writes is accepted - 8-bit, colour type 6, not interlaced - and
 * anything else returns null rather than being guessed at. A wrong guess here would not throw, it
 * would draw confetti.
 */
/**
 * As decodeIcon, but says how big the picture was.
 *
 * The market's icons are all 32x32 and that file can assume it. The skill icons the broadcast card
 * draws are 18x23 and 25x25 - whatever ObjIconFiles' sibling wrote - so something has to carry the
 * size out, and guessing it from the array length only works for a square.
 */
export function decodeIconSized(buf: Buffer): { px: Int32Array; w: number; h: number } | null {
    return decodeIconInner(buf);
}

export function decodeIcon(buf: Buffer): Int32Array | null {
    return decodeIconInner(buf)?.px ?? null;
}

function decodeIconInner(buf: Buffer): { px: Int32Array; w: number; h: number } | null {
    if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) {
        return null;
    }
    let w = 0;
    let h = 0;
    const idat: Buffer[] = [];
    let p = 8;
    while (p + 8 <= buf.length) {
        const len = buf.readUInt32BE(p);
        const type = buf.toString('ascii', p + 4, p + 8);
        const data = buf.subarray(p + 8, p + 8 + len);
        if (type === 'IHDR') {
            w = data.readUInt32BE(0);
            h = data.readUInt32BE(4);
            if (data[8] !== 8 || data[9] !== 6 || data[12] !== 0) {
                return null;
            }
        } else if (type === 'IDAT') {
            idat.push(data);
        } else if (type === 'IEND') {
            break;
        }
        p += 12 + len;
    }
    if (w <= 0 || h <= 0 || !idat.length) {
        return null;
    }

    const raw = zlib.inflateSync(Buffer.concat(idat));
    const bpp = 4;
    const stride = w * bpp;
    const out = new Int32Array(w * h);
    const line = Buffer.alloc(stride);
    const prev = Buffer.alloc(stride);
    let q = 0;
    for (let y = 0; y < h; y++) {
        const filter = raw[q++];
        raw.copy(line, 0, q, q + stride);
        q += stride;
        // The five PNG filters, undone. Every one of them is "add something already decoded".
        for (let i = 0; i < stride; i++) {
            const a = i >= bpp ? line[i - bpp] : 0;
            const b = prev[i];
            const c = i >= bpp ? prev[i - bpp] : 0;
            let add = 0;
            if (filter === 1) {
                add = a;
            } else if (filter === 2) {
                add = b;
            } else if (filter === 3) {
                add = (a + b) >> 1;
            } else if (filter === 4) {
                const pa = Math.abs(b - c);
                const pb = Math.abs(a - c);
                const pc = Math.abs(a + b - 2 * c);
                add = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
            }
            line[i] = (line[i] + add) & 0xff;
        }
        for (let x = 0; x < w; x++) {
            const i = x * bpp;
            // Alpha is on or off in these icons; anything not solid is the slot showing through.
            out[y * w + x] = line[i + 3] < 128 ? 0 : (line[i] << 16) | (line[i + 1] << 8) | line[i + 2];
        }
        line.copy(prev);
    }
    return { px: out, w, h };
}

// ---------------------------------------------------------------- the font

/**
 * One of the game's bitmap fonts, parsed exactly as jagex2.graphics.PixFont parses it.
 *
 * The advances are not stored in the file: PixFont DERIVES them, by looking at whether a glyph's
 * first and last columns are empty and tightening by a pixel for each. That is reproduced here
 * rather than approximated, because a font measured differently from the way it is drawn gives
 * text that is correctly spaced and in the wrong place.
 */
export class GameFont {
    readonly mask: Uint8Array[] = [];
    readonly maskW: number[] = [];
    readonly maskH: number[] = [];
    readonly offX: number[] = [];
    readonly offY: number[] = [];
    readonly advance: number[] = [];
    height = 0;

    constructor(jag: Jagfile, name: string) {
        const data: Packet | null = jag.read(`${name}.dat`);
        const index: Packet | null = jag.read('index.dat');
        if (!data || !index) {
            throw new Error(`MarketCard: ${name}.dat or index.dat is not in the archive`);
        }
        index.pos = data.g2() + 4;
        const palCount = index.g1();
        if (palCount > 0) {
            index.pos += (palCount - 1) * 3;
        }
        for (let c = 0; c < 256; c++) {
            this.offX[c] = index.g1();
            this.offY[c] = index.g1();
            const w = (this.maskW[c] = index.g2());
            const h = (this.maskH[c] = index.g2());
            const order = index.g1();
            const mask = new Uint8Array(w * h);
            if (order === 0) {
                for (let i = 0; i < w * h; i++) {
                    mask[i] = data.g1();
                }
            } else {
                for (let x = 0; x < w; x++) {
                    for (let y = 0; y < h; y++) {
                        mask[w * y + x] = data.g1();
                    }
                }
            }
            this.mask[c] = mask;
            if (h > this.height && c < 128) {
                this.height = h;
            }
            this.offX[c] = 1;
            this.advance[c] = w + 2;
            let space = 0;
            for (let y = (h / 7) | 0; y < h; y++) {
                space += mask[w * y];
            }
            if (space <= ((h / 7) | 0)) {
                this.advance[c]--;
                this.offX[c] = 0;
            }
            space = 0;
            for (let y = (h / 7) | 0; y < h; y++) {
                space += mask[w * y + (w - 1)];
            }
            if (space <= ((h / 7) | 0)) {
                this.advance[c]--;
            }
        }
        // A space is as wide as a lower-case i, which is what the client does for a non-quill font.
        this.advance[32] = this.advance[105];
    }

    width(text: string): number {
        let n = 0;
        for (let i = 0; i < text.length; i++) {
            n += this.advance[text.charCodeAt(i) & 0xff] ?? 0;
        }
        return n;
    }

    /**
     * y is the BASELINE, as the client's drawString takes it.
     *
     * THE HEIGHT COMES FROM THE BUFFER, not from a constant. This used to clip against CARD_H,
     * which was right while the market card was the only card and silently wrong the moment a
     * second one was a different height - text below 172 rows would simply not be drawn, on a
     * card that looked fine in every other respect.
     */
    draw(px: Int32Array, stride: number, x: number, y: number, colour: number, text: string): number {
        const rows = (px.length / stride) | 0;
        const top = y - this.height;
        for (let i = 0; i < text.length; i++) {
            const c = text.charCodeAt(i) & 0xff;
            const w = this.maskW[c];
            const h = this.maskH[c];
            const mask = this.mask[c];
            if (c !== 32 && mask) {
                const dx = x + this.offX[c];
                const dy = top + this.offY[c];
                for (let gy = 0; gy < h; gy++) {
                    const ty = dy + gy;
                    if (ty < 0 || ty >= rows) {
                        continue;
                    }
                    for (let gx = 0; gx < w; gx++) {
                        if (mask[gy * w + gx] === 0) {
                            continue;
                        }
                        const tx = dx + gx;
                        if (tx < 0 || tx >= stride) {
                            continue;
                        }
                        px[ty * stride + tx] = colour;
                    }
                }
            }
            x += this.advance[c];
        }
        return x;
    }
}

let fonts: { p11: GameFont; p12: GameFont; b12: GameFont } | null = null;

export function loadFonts(): { p11: GameFont; p12: GameFont; b12: GameFont } {
    if (!fonts) {
        // "_full" is what tools/pack/sprite/title.ts names them; "p11" is not in the archive at all.
        const jag = Jagfile.load('data/pack/client/title');
        fonts = {
            p11: new GameFont(jag, 'p11_full'),
            p12: new GameFont(jag, 'p12_full'),
            b12: new GameFont(jag, 'b12_full')
        };
    }
    return fonts;
}

// ---------------------------------------------------------------- the card

export type MarketCardListing = {
    id: number;
    obj: number;
    name: string;
    count: number;
    seller: string;
    buyout: number;
};

/** 30000 -> "30,000". The game writes coin counts this way and so should a card about coins. */
export function commas(n: number): string {
    const s = Math.trunc(n).toString();
    let out = '';
    for (let i = 0; i < s.length; i++) {
        if (i > 0 && (s.length - i) % 3 === 0) {
            out += ',';
        }
        out += s[i];
    }
    return out;
}

/**
 * Why the slot came out empty, in a sentence - or where the icon was read from.
 *
 * AN EMPTY SLOT IS SILENT BY DESIGN, because a feed that stops because one item has no picture is
 * worse than a card with a gap in it. That is right for the live feed and wrong for the tool you
 * run to set it up: "the card drew but the slot is blank" is the one failure that looks identical
 * whether the path is unset, wrong, unreadable, or simply missing that obj.
 */
export function iconReport(obj: number): string {
    const dir = Environment.MARKET_CARD_ICONS;
    if (!dir) {
        return 'no icon: MARKET_CARD_ICONS is not set. On the live box it wants /opt/deathplateau/web/public/icons';
    }
    const path = `${dir}/${obj}.png`;
    try {
        if (!fs.existsSync(path)) {
            return `no icon: nothing at ${path} - either the icons are somewhere else, or obj ${obj} has none`;
        }
        if (!decodeIcon(fs.readFileSync(path))) {
            return `no icon: ${path} is not a 32x32 RGBA PNG this can read`;
        }
    } catch (err) {
        return `no icon: ${path} could not be read - ${String((err as { message?: unknown })?.message ?? err)}`;
    }
    return `icon: ${path}`;
}

function iconFor(obj: number): Int32Array | null {
    const dir = Environment.MARKET_CARD_ICONS;
    if (!dir) {
        return null;
    }
    try {
        const path = `${dir}/${obj}.png`;
        if (!fs.existsSync(path)) {
            return null;
        }
        return decodeIcon(fs.readFileSync(path));
    } catch {
        return null;
    }
}

export function renderMarketCard(listing: MarketCardListing): Buffer {
    const { p11, p12, b12 } = loadFonts();
    const px = new Int32Array(CARD_W * CARD_H);

    const rect = (x: number, y: number, w: number, h: number, colour: number): void => {
        for (let j = Math.max(0, y); j < Math.min(CARD_H, y + h); j++) {
            for (let i = Math.max(0, x); i < Math.min(CARD_W, x + w); i++) {
                px[j * CARD_W + i] = colour;
            }
        }
    };

    rect(0, 0, CARD_W, CARD_H, BG);
    rect(0, 0, CARD_W, 1, EDGE);
    rect(0, CARD_H - 1, CARD_W, 1, EDGE);
    rect(CARD_W - 1, 0, 1, CARD_H, EDGE);
    // The red spine: the one piece of colour, and the gesture Discord itself makes with an embed
    // stripe, so the card sits with the client rather than against it.
    rect(0, 0, 3, CARD_H, ACCENT);
    rect(3, 28, CARD_W - 4, 1, RULE);

    b12.draw(px, CARD_W, 18, 21, ACCENT, 'DEATH PLATEAU');
    p11.draw(px, CARD_W, 18 + b12.width('DEATH PLATEAU') + 10, 21, DIM, 'trading post');
    if (listing.id > 0) {
        const tag = `#${listing.id}`;
        p11.draw(px, CARD_W, CARD_W - 16 - p11.width(tag), 21, DIM, tag);
    }

    const sx = 20;
    const sy = 46;
    const cell = 64;
    rect(sx, sy, cell, cell, SLOT);
    rect(sx, sy, cell, 1, EDGE);
    rect(sx, sy + cell - 1, cell, 1, EDGE);
    rect(sx, sy, 1, cell, EDGE);
    rect(sx + cell - 1, sy, 1, cell, EDGE);
    const icon = iconFor(listing.obj);
    if (icon) {
        for (let y = 0; y < 32; y++) {
            for (let x = 0; x < 32; x++) {
                const c = icon[y * 32 + x];
                if (c !== 0) {
                    rect(sx + x * 2, sy + y * 2, 2, 2, c);
                }
            }
        }
    }

    const tx = sx + cell + 20;
    const heading = listing.count > 1 ? `${commas(listing.count)} x ${listing.name}` : listing.name;
    b12.draw(px, CARD_W, tx, 62, STEEL, heading);
    p12.draw(px, CARD_W, tx, 84, TEXT, `Listed by ${listing.seller}`);
    if (listing.buyout > 0) {
        const after = p12.draw(px, CARD_W, tx, 110, DIM, 'Buy it now ');
        p12.draw(px, CARD_W, after, 110, STEEL, `${commas(listing.buyout)} gp`);
    } else {
        p12.draw(px, CARD_W, tx, 110, DIM, 'No buyout price');
    }
    // The line that makes this card this server's: a wanted ad has no equivalent.
    p11.draw(px, CARD_W, tx, 130, DIM, 'or offer for it - coins, items, or both');

    rect(3, CARD_H - 24, CARD_W - 4, 1, EDGE);
    // ONE TRADING POST, AND IT IS IN EDGEVILLE - loc 15396, placed once, at 3084,3492. Naming the
    // place is also the point: Edgeville is meant to be where people end up.
    p11.draw(px, CARD_W, 18, CARD_H - 8, DIM, 'At the trading post in Edgeville');

    // Enlarged last, nearest-neighbour. The font is 11px and Discord shows an attachment about 400
    // across; drawn at 1x and doubled, the pixels stay square.
    const w = CARD_W * SCALE;
    const h = CARD_H * SCALE;
    const big = new Int32Array(w * h);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            big[y * w + x] = px[((y / SCALE) | 0) * CARD_W + ((x / SCALE) | 0)];
        }
    }
    return encodePng(big, w, h);
}
