import zlib from 'zlib';
import { deflateRaw } from 'pako';

import Packet from '#/io/Packet.js';

function compressGz(
    src: Uint8Array,
    off: number = 0,
    len: number = src.length,
): Uint8Array | null {
    try {
        const slice = src.subarray(off, off + len);
        const deflated = deflateRaw(slice, {
            level: 6,
            memLevel: 8,
            strategy: 0
        });

        const out = new Uint8Array(10 + deflated.length + 8);

        out[0] = 0x1f;
        out[1] = 0x8b;
        out[2] = 0x08; // deflate
        out[3] = 0x00; // FLG
        out[4] = 0x00; // MTIME
        out[5] = 0x00;
        out[6] = 0x00;
        out[7] = 0x00;
        out[8] = 0x00; // XFL
        out[9] = 0x00; // OS

        out.set(deflated, 10);

        const crc = Packet.getcrc(slice, 0, slice.length) >>> 0;
        const isize = slice.length >>> 0;
        const trailerPos = 10 + deflated.length;

        // Trailer: CRC32 + ISIZE (little-endian)
        out[trailerPos] = crc & 0xff;
        out[trailerPos + 1] = (crc >>> 8) & 0xff;
        out[trailerPos + 2] = (crc >>> 16) & 0xff;
        out[trailerPos + 3] = (crc >>> 24) & 0xff;
        out[trailerPos + 4] = isize & 0xff;
        out[trailerPos + 5] = (isize >>> 8) & 0xff;
        out[trailerPos + 6] = (isize >>> 16) & 0xff;
        out[trailerPos + 7] = (isize >>> 24) & 0xff;

        return out;
    } catch (err) {
        console.error(err);
        return null;
    }
}

function decompressGz(
    src: Uint8Array,
    off: number = 0,
    len: number = src.length,
): Uint8Array | null {
    try {
        return new Uint8Array(zlib.gunzipSync(src.subarray(off, off + len)));
    } catch (err) {
        console.error(err);
        return null;
    }
}

export { compressGz, decompressGz };
