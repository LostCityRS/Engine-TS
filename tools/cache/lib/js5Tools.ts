import fs from 'fs';

import Packet from '#/io/Packet.js';
import { getGroup } from '#/util/OpenRS2.js';
import { unpackJs5Group } from '#/io/Js5Group.js';
import { CompressionType } from '#/io/CompressionType.js';

export function readJs5Id(packet: Packet, format: number): number {
    if (format >= 7) {
        return packet.gSmart2or4();
    }

    return packet.g2();
}

export function parseGroupIdsFromIndex(indexUnpacked: Uint8Array): number[] {
    const packet = new Packet(indexUnpacked);

    const format = packet.g1();
    if (format < 5 || format > 7) {
        throw new Error(`Unsupported JS5 index format: ${format}`);
    }

    if (format >= 6) {
        packet.g4s();
    }

    packet.g1();

    const groupCount = readJs5Id(packet, format);
    const groupIds: number[] = new Array(groupCount);

    let previousGroupId = 0;
    for (let i = 0; i < groupCount; i++) {
        previousGroupId += readJs5Id(packet, format);
        groupIds[i] = previousGroupId;
    }

    return groupIds;
}

export function parseGroupIdsFromIndexPacked(indexPacked: Uint8Array): number[] {
    return parseGroupIdsFromIndex(unpackJs5Group(indexPacked));
}

export function arraysEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) {
        return false;
    }

    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
            return false;
        }
    }

    return true;
}

export function packedContainerLength(bytes: Uint8Array, offset: number): number {
    const compression = bytes[offset];
    const compressedLength =
        ((bytes[offset + 1] << 24) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 8) | bytes[offset + 4]) >>> 0;

    if (compression === 0) {
        return 5 + compressedLength;
    }

    return 9 + compressedLength;
}

export function readInt32BE(bytes: Uint8Array, offset: number): number {
    return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) | 0;
}

export function writeInt32BE(value: number, out: Uint8Array, offset: number): void {
    out[offset] = (value >>> 24) & 0xff;
    out[offset + 1] = (value >>> 16) & 0xff;
    out[offset + 2] = (value >>> 8) & 0xff;
    out[offset + 3] = value & 0xff;
}

export async function loadIndexPacked(
    archive: number,
    indexPath: string,
    openrs2: boolean
): Promise<Uint8Array> {
    if (openrs2) {
        const raw = await getGroup(255, archive);
        return new Uint8Array(raw);
    }

    if (!fs.existsSync(indexPath)) {
        throw new Error(`Index file not found: ${indexPath}`);
    }

    return new Uint8Array(fs.readFileSync(indexPath));
}

export async function readGroupBytes(
    archive: number,
    groupId: number,
    dir: string,
    fromOpenrs2: boolean
): Promise<Uint8Array | null> {
    if (fromOpenrs2) {
        const data = await getGroup(archive, groupId);
        return data && data.length ? new Uint8Array(data) : null;
    }

    const path = `${dir}/${archive}/${groupId}.dat`;
    if (!fs.existsSync(path)) {
        return null;
    }

    return new Uint8Array(fs.readFileSync(path));
}

export function ensureDir(dirPath: string): void {
    fs.mkdirSync(dirPath, { recursive: true });
}

export function parsePackFile(packPath: string): Map<string, number> {
    if (!fs.existsSync(packPath)) {
        return new Map();
    }

    const content = fs.readFileSync(packPath, 'utf-8');
    const nameToId = new Map<string, number>();

    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.length === 0 || trimmed.startsWith('#')) {
            continue;
        }

        const eq = trimmed.indexOf('=');
        if (eq === -1) {
            continue;
        }

        const id = parseInt(trimmed.substring(0, eq));
        const name = trimmed.substring(eq + 1);

        if (!isNaN(id) && name.length > 0) {
            nameToId.set(name, id);
        }
    }

    return nameToId;
}

export type Js5ArchiveIndex = {
    groupIds: number[];
    fileIdsByGroup: Map<number, number[]>;
};

export function parseJs5ArchiveIndex(indexData: Uint8Array): Js5ArchiveIndex {
    const packet = new Packet(indexData);

    const format = packet.g1();
    if (format >= 6) {
        packet.g4s();
    }

    const flags = packet.g1();

    const groupCount = readJs5Id(packet, format);
    const groupIds: number[] = new Array(groupCount);
    let previousGroupId = 0;
    for (let i = 0; i < groupCount; i++) {
        previousGroupId += readJs5Id(packet, format);
        groupIds[i] = previousGroupId;
    }

    if ((flags & 0x01) !== 0) {
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

    const fileCounts = new Array<number>(groupCount);
    for (let i = 0; i < groupCount; i++) {
        fileCounts[i] = readJs5Id(packet, format);
    }

    const fileIdsByGroup = new Map<number, number[]>();

    for (let i = 0; i < groupCount; i++) {
        const fileCount = fileCounts[i];
        const fileIds: number[] = new Array(fileCount);

        let previousFileId = 0;
        for (let j = 0; j < fileCount; j++) {
            previousFileId += readJs5Id(packet, format);
            fileIds[j] = previousFileId;
        }

        fileIdsByGroup.set(groupIds[i], fileIds);
    }

    return {
        groupIds,
        fileIdsByGroup
    };
}

export function loadReferenceArchiveIndex(archive: number): Js5ArchiveIndex | null {
    const indexPath = `data/cache/255/${archive}.dat`;
    if (!fs.existsSync(indexPath)) {
        return null;
    }

    const indexRaw = new Uint8Array(fs.readFileSync(indexPath));
    const indexData = unpackJs5Group(indexRaw);
    return parseJs5ArchiveIndex(indexData);
}

export function combineGroupFiles(files: Map<number, Uint8Array>, orderedFileIds: number[]): Uint8Array {
    if (orderedFileIds.length === 0) {
        throw new Error('Cannot combine empty file list.');
    }

    if (orderedFileIds.length === 1) {
        const only = files.get(orderedFileIds[0]);
        if (!only) {
            throw new Error('Missing expected file data for single-file group.');
        }
        return only;
    }

    const fileCount = orderedFileIds.length;
    const fileSizes: number[] = new Array(fileCount).fill(0);
    let totalDataSize = 0;

    for (let i = 0; i < fileCount; i++) {
        const fileId = orderedFileIds[i];
        const data = files.get(fileId);
        if (data && data.length > 0) {
            fileSizes[i] = data.length;
            totalDataSize += data.length;
        }
    }

    // Use 1 stripe for simplicity
    const stripes = 1;
    const tableLength = stripes * fileCount * 4;
    const totalSize = totalDataSize + tableLength + 1;

    const output = new Uint8Array(totalSize);
    const view = new DataView(output.buffer);

    // Write file data in order (for single stripe, just write files sequentially)
    let dataPos = 0;
    for (let i = 0; i < fileCount; i++) {
        const fileId = orderedFileIds[i];
        const fileData = files.get(fileId);
        if (fileData && fileData.length > 0) {
            output.set(fileData, dataPos);
            dataPos += fileData.length;
        }
    }

    // Write chunk table
    // For JS5 multi-file format: each entry is delta from previous chunk length in the stripe
    let tablePos = dataPos;
    for (let stripe = 0; stripe < stripes; stripe++) {
        let prevChunkLength = 0;
        for (let i = 0; i < fileCount; i++) {
            const chunkLength = fileSizes[i];
            const delta = chunkLength - prevChunkLength;
            view.setInt32(tablePos, delta, false); // big-endian
            tablePos += 4;
            prevChunkLength = chunkLength;
        }
    }

    // Write stripe count
    output[totalSize - 1] = stripes;

    return output;
}

export async function compressJs5Group(uncompressed: Uint8Array, compressionType: number): Promise<Uint8Array> {
    let compressed: Uint8Array | null;
    
    if (compressionType === CompressionType.BZIP2) {
        const BZip2 = (await import('#/io/BZip2.js')).default;
        compressed = BZip2.compress(uncompressed, false, true, 1);
    } else if (compressionType === CompressionType.GZIP) {
        const { compressGz } = await import('#/io/GZip.js');
        compressed = compressGz(uncompressed);
    } else {
        throw new Error(`Unsupported compression type: ${compressionType}`);
    }
    
    if (!compressed) {
        throw new Error(`Failed to compress with type ${compressionType}`);
    }

    const output = new Uint8Array(9 + compressed.length);

    output[0] = compressionType;
    
    // Compressed length (big-endian u32)
    const compLen = compressed.length;
    output[1] = (compLen >>> 24) & 0xff;
    output[2] = (compLen >>> 16) & 0xff;
    output[3] = (compLen >>> 8) & 0xff;
    output[4] = compLen & 0xff;

    // Uncompressed length (big-endian u32)
    const uncompLen = uncompressed.length;
    output[5] = (uncompLen >>> 24) & 0xff;
    output[6] = (uncompLen >>> 16) & 0xff;
    output[7] = (uncompLen >>> 8) & 0xff;
    output[8] = uncompLen & 0xff;

    // Compressed payload
    output.set(compressed, 9);

    return output;
}
