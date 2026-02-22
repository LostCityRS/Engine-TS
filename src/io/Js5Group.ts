import BZip2 from '#/io/BZip2.js';
import { CompressionType } from '#/io/CompressionType.js';
import { decompressGz } from '#/io/GZip.js';

export function unpackJs5Group(bytes: Uint8Array): Uint8Array {
    if (!isJs5GroupContainer(bytes)) {
        return bytes;
    }

    const type = bytes[0];
    const compressedLength = readU32BE(bytes, 1);

    if (type === CompressionType.NONE) {
        return bytes.subarray(5, 5 + compressedLength);
    }

    const uncompressedLength = readU32BE(bytes, 5);
    const payload = bytes.subarray(9, 9 + compressedLength);

    if (type === CompressionType.BZIP2) {
        return BZip2.decompress(payload, uncompressedLength, true);
    }

    if (type === CompressionType.GZIP) {
        const decompressed = decompressGz(payload);
        if (!decompressed) {
            throw new Error('Failed to decompress JS5 group (gzip).');
        }
        return decompressed;
    }

    throw new Error(`Unsupported JS5 compression type: ${type}`);
}

export function isJs5GroupContainer(bytes: Uint8Array): boolean {
    if (bytes.length < 5) {
        return false;
    }

    const type = bytes[0];
    if (type !== CompressionType.NONE && type !== CompressionType.BZIP2 && type !== CompressionType.GZIP) {
        return false;
    }

    const compressedLength = readU32BE(bytes, 1);
    const headerLength = type === CompressionType.NONE ? 5 : 9;

    if (bytes.length < headerLength) {
        return false;
    }

    return bytes.length === headerLength + compressedLength;
}

function readU32BE(bytes: Uint8Array, offset: number): number {
    return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}
