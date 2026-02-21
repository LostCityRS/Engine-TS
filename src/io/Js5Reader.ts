import zlib from 'zlib';
import Packet from '#/io/Packet.js';
import { CompressionType } from '#/io/CompressionType.js';

/**
 * Generic JS5 archive reader for unpacking cache files.
 * 
 * JS5 Format:
 * - Packed index group (contains metadata about all groups)
 * - Packed data groups in sequence
 * - Optional trailing length table
 */
export default class Js5Reader {
    private data: Uint8Array;
    private pos: number = 0;

    constructor(data: Uint8Array) {
        this.data = data;
    }

    /**
     * Parse the JS5 archive and extract all groups.
     * @returns Map of groupId -> decompressed group data
     */
    read(): Map<number, Uint8Array> {
        const groups = new Map<number, Uint8Array>();

        const indexData = this.unpackGroup();
        const index = this.parseIndex(indexData);

        // Read all group data in order
        for (let i = 0; i < index.groupIds.length; i++) {
            const groupData = this.unpackGroup();
            groups.set(index.groupIds[i], groupData);
        }

        return groups;
    }

    /**
     * Parse the index group to extract group IDs and metadata.
     */
    private parseIndex(data: Buffer): { groupIds: number[] } {
        const packet = new Packet(new Uint8Array(data));

        const format = packet.g1();
        if (format !== 7) {
            throw new Error(`Unsupported JS5 index format: ${format}`);
        }

        const version = packet.g4s();
        if (version < 0) {
            throw new Error(`Invalid JS5 index version: ${version}`);
        }

        const _flags = packet.g1();
        const groupCount = packet.gSmart2or4();

        // Read group IDs with delta encoding
        const groupIds: number[] = [];
        let previousGroupId = 0;
        for (let i = 0; i < groupCount; i++) {
            const delta = packet.gSmart2or4();
            const groupId = previousGroupId + delta;
            groupIds.push(groupId);
            previousGroupId = groupId;
        }

        return { groupIds };
    }

    /**
     * Read and unpack a single group from the archive.
     * Handles compression types: 0 (none), 1 (bzip2), 2 (gzip)
     */
    private unpackGroup(): Buffer {
        if (this.pos >= this.data.length) {
            throw new Error('Unexpected end of JS5 archive while reading group');
        }

        const compression = this.data[this.pos++];

        if (compression === CompressionType.NONE) {
            const length = Buffer.from(this.data).readUInt32BE(this.pos);
            this.pos += 4;
            const data = Buffer.from(this.data.slice(this.pos, this.pos + length));
            this.pos += length;
            return data;
        } else if (compression === CompressionType.BZIP2) {
            const compressedLength = Buffer.from(this.data).readUInt32BE(this.pos);
            this.pos += 4;
            const _uncompressedLength = Buffer.from(this.data).readUInt32BE(this.pos);
            this.pos += 4;
            const compressedData = Buffer.from(this.data.slice(this.pos, this.pos + compressedLength));
            this.pos += compressedLength;

            const decompressed = zlib.brotliDecompressSync(compressedData);
            return decompressed;
        } else if (compression === CompressionType.GZIP) {
            const compressedLength = Buffer.from(this.data).readUInt32BE(this.pos);
            this.pos += 4;
            const _uncompressedLength = Buffer.from(this.data).readUInt32BE(this.pos);
            this.pos += 4;
            const compressedData = Buffer.from(this.data.slice(this.pos, this.pos + compressedLength));
            this.pos += compressedLength;

            const decompressed = zlib.gunzipSync(compressedData);
            return decompressed;
        } else {
            // Try to detect and handle unknown compression types
            this.pos--;
            
            // Check for gzip magic bytes (0x1f 0x8b)
            if (this.pos + 1 < this.data.length && 
                this.data[this.pos] === 0x1f && 
                this.data[this.pos + 1] === 0x8b) {
                // This looks like raw gzip data without length prefix
                const remaining = Buffer.from(this.data.slice(this.pos));
                try {
                    const decompressed = zlib.gunzipSync(remaining);
                    this.pos = this.data.length;
                    return decompressed;
                } catch {
                    throw new Error(`Unable to decompress gzip data at position ${this.pos}`);
                }
            }

            throw new Error(`Unsupported compression type: ${compression} at position ${this.pos - 1}`);
        }
    }
}
