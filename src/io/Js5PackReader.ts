import fs from 'fs';

import BZip2 from '#/io/BZip2.js';
import { CompressionType } from '#/io/CompressionType.js';
import Packet from '#/io/Packet.js';
import { decompressGz } from '#/io/GZip.js';

type Js5IndexInfo = {
    groupIds: number[];
};

export default class Js5PackReader {
    private groups = new Map<number, Uint8Array>();

    static load(filePath: string): Js5PackReader {
        if (!fs.existsSync(filePath)) {
            throw new Error(`JS5 pack not found: ${filePath}`);
        }

        const data = new Uint8Array(fs.readFileSync(filePath));
        return new Js5PackReader(data);
    }

    constructor(data: Uint8Array) {
        this.parse(data);
    }

    getGroup(groupId: number): Uint8Array | undefined {
        return this.groups.get(groupId);
    }

    private parse(data: Uint8Array): void {
        const indexLength = this.packedContainerLength(data, 0);
        const indexPacked = data.slice(0, indexLength);
        const indexUnpacked = this.unpackGroup(indexPacked);
        const index = this.parseIndex(indexUnpacked);

        const lengthsTableBytes = index.groupIds.length * 4;
        const lengthsTableStart = data.length - lengthsTableBytes;
        const lengthsTable = data.slice(lengthsTableStart);

        let pos = indexLength;
        for (let i = 0; i < index.groupIds.length; i++) {
            const groupId = index.groupIds[i];
            const length = this.readInt32BE(lengthsTable, i * 4) >>> 0;

            if (length === 0) {
                this.groups.set(groupId, new Uint8Array(0));
                continue;
            }

            const end = pos + length;
            if (end > lengthsTableStart) {
                throw new Error(`JS5 pack group ${groupId} exceeds archive bounds.`);
            }

            this.groups.set(groupId, data.slice(pos, end));
            pos = end;
        }
    }

    private parseIndex(data: Uint8Array): Js5IndexInfo {
        const packet = new Packet(data);

        const format = packet.g1();
        if (format < 5 || format > 7) {
            throw new Error(`Unsupported JS5 index format: ${format}`);
        }

        if (format >= 6) {
            packet.g4s();
        }

        const flags = packet.g1();
        const hasNames = (flags & 0x1) !== 0;

        const groupCount = this.readJs5Id(packet, format);
        const groupIds: number[] = new Array(groupCount);

        let previousGroupId = 0;
        for (let i = 0; i < groupCount; i++) {
            previousGroupId += this.readJs5Id(packet, format);
            groupIds[i] = previousGroupId;
        }

        if (hasNames) {
            for (let i = 0; i < groupCount; i++) {
                packet.g4s();
            }
        }

        for (let i = 0; i < groupCount; i++) {
            packet.g4s();
        }

        for (let i = 0; i < groupCount; i++) {
            packet.g4s();
        }

        const fileCounts: number[] = new Array(groupCount);
        for (let i = 0; i < groupCount; i++) {
            fileCounts[i] = this.readJs5Id(packet, format);
        }

        for (let i = 0; i < groupCount; i++) {
            const count = fileCounts[i];
            let _previousFileId = 0;
            for (let j = 0; j < count; j++) {
                _previousFileId += this.readJs5Id(packet, format);
            }
        }

        return { groupIds };
    }

    private readJs5Id(packet: Packet, format: number): number {
        if (format >= 7) {
            return packet.gSmart2or4();
        }

        return packet.g2();
    }

    private unpackGroup(bytes: Uint8Array): Uint8Array {
        const type = bytes[0];
        const compressedLength = this.readU32BE(bytes, 1);

        if (type === CompressionType.NONE) {
            return bytes.subarray(5, 5 + compressedLength);
        }

        const uncompressedLength = this.readU32BE(bytes, 5);
        const payload = bytes.subarray(9, 9 + compressedLength);

        if (type === CompressionType.BZIP2) {
            return BZip2.decompress(payload, uncompressedLength, true);
        }

        if (type === CompressionType.GZIP) {
            const decompressed = decompressGz(payload);
            if (!decompressed) {
                throw new Error('Failed to decompress JS5 pack group (gzip).');
            }
            return decompressed;
        }

        throw new Error(`Unsupported JS5 compression type: ${type}`);
    }

    private packedContainerLength(bytes: Uint8Array, offset: number): number {
        const compression = bytes[offset];
        const compressedLength =
            ((bytes[offset + 1] << 24) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 8) | bytes[offset + 4]) >>> 0;

        if (compression === CompressionType.NONE) {
            return 5 + compressedLength;
        }

        return 9 + compressedLength;
    }

    private readU32BE(bytes: Uint8Array, offset: number): number {
        return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
    }

    private readInt32BE(bytes: Uint8Array, offset: number): number {
        return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) | 0;
    }
}
