import Packet from '#/io/Packet.js';
import { unpackJs5Group } from '#/io/Js5Group.js';

export type Js5ArchiveIndex = {
    groupIds: number[];
    fileIdsByGroup: Map<number, number[]>;
};

export function parseJs5ArchiveIndexFromPack(js5Data: Uint8Array): Js5ArchiveIndex {
    const indexLength = packedContainerLength(js5Data, 0);
    const indexPacked = js5Data.slice(0, indexLength);
    const indexUnpacked = unpackJs5Group(indexPacked);
    return parseJs5ArchiveIndex(indexUnpacked);
}

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

    return { groupIds, fileIdsByGroup };
}

export function splitGroupFiles(groupData: Uint8Array, fileIds: number[]): Map<number, Uint8Array> {
    const files = new Map<number, Uint8Array>();

    if (fileIds.length === 1) {
        files.set(fileIds[0], groupData);
        return files;
    }

    const stripes = groupData[groupData.length - 1] & 0xff;
    const fileCount = fileIds.length;
    const tableLength = stripes * fileCount * 4;
    const tableOffset = groupData.length - 1 - tableLength;

    if (tableOffset <= 0) {
        throw new Error('Invalid JS5 group chunk table.');
    }

    const view = new DataView(groupData.buffer, groupData.byteOffset, groupData.byteLength);
    const sizes = new Int32Array(fileCount);

    let tablePos = tableOffset;
    for (let stripe = 0; stripe < stripes; stripe++) {
        let chunkLength = 0;
        for (let file = 0; file < fileCount; file++) {
            chunkLength += view.getInt32(tablePos);
            tablePos += 4;
            sizes[file] += chunkLength;
        }
    }

    const outputs: Uint8Array[] = new Array(fileCount);
    for (let file = 0; file < fileCount; file++) {
        outputs[file] = new Uint8Array(sizes[file]);
    }

    const offsets = new Int32Array(fileCount);
    let dataPos = 0;
    tablePos = tableOffset;

    for (let stripe = 0; stripe < stripes; stripe++) {
        let chunkLength = 0;
        for (let file = 0; file < fileCount; file++) {
            chunkLength += view.getInt32(tablePos);
            tablePos += 4;

            outputs[file].set(groupData.subarray(dataPos, dataPos + chunkLength), offsets[file]);
            offsets[file] += chunkLength;
            dataPos += chunkLength;
        }
    }

    for (let i = 0; i < fileCount; i++) {
        files.set(fileIds[i], outputs[i]);
    }

    return files;
}

function readJs5Id(packet: Packet, format: number): number {
    if (format >= 7) {
        return packet.gSmart2or4();
    }

    return packet.g2();
}

function packedContainerLength(bytes: Uint8Array, offset: number): number {
    const compression = bytes[offset];
    const compressedLength =
        ((bytes[offset + 1] << 24) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 8) | bytes[offset + 4]) >>> 0;

    if (compression === 0) {
        return 5 + compressedLength;
    }

    return 9 + compressedLength;
}
