import fs from 'fs';
import path from 'path';
import Packet from '#/io/Packet.js';
import { getGroup } from '#/util/OpenRS2.js';
import { unpackJs5Group } from '#/io/Js5Group.js';
import {
    loadIndexPacked,
    parseGroupIdsFromIndexPacked,
    readJs5Id
} from '#tools/cache/lib/js5Tools.js';

type Args = {
    archive: number;
    groupsDir: string;
    indexPath: string;
    openrs2: boolean;
    help: boolean;
};

function parseArgs(argv: string[]): Args {
    const args: Args = {
        archive: 17,
        groupsDir: 'data/pack',
        indexPath: '',
        openrs2: false,
        help: false
    };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--archive') {
            args.archive = Number(argv[++i]);
        } else if (arg === '--groups-dir') {
            args.groupsDir = argv[++i];
        } else if (arg === '--index') {
            args.indexPath = argv[++i];
        } else if (arg === '--openrs2') {
            args.openrs2 = true;
        } else if (arg === '--help' || arg === '-h') {
            args.help = true;
        }
    }

    if (!args.indexPath) {
        args.indexPath = `data/cache/255/${args.archive}.dat`;
    }

    return args;
}


function parseGroupCrcs(indexUnpacked: Uint8Array): Map<number, number> {
    const packet = new Packet(indexUnpacked);

    const format = packet.g1();
    if (format < 5 || format > 7) {
        throw new Error(`Unsupported JS5 index format: ${format}`);
    }

    if (format >= 6) {
        packet.g4s();
    }

    const flags = packet.g1();
    const hasNames = (flags & 0x1) !== 0;

    const groupCount = readJs5Id(packet, format);
    const groupIds: number[] = new Array(groupCount);

    let previousGroupId = 0;
    for (let i = 0; i < groupCount; i++) {
        previousGroupId += readJs5Id(packet, format);
        groupIds[i] = previousGroupId;
    }

    if (hasNames) {
        for (let i = 0; i < groupCount; i++) {
            packet.g4s();
        }
    }

    const crcs = new Map<number, number>();
    for (let i = 0; i < groupCount; i++) {
        const crc = packet.g4s() >>> 0;
        crcs.set(groupIds[i], crc);
    }

    return crcs;
}


function toHex(value: number): string {
    return `0x${(value >>> 0).toString(16).padStart(8, '0')}`;
}

async function main() {
    const args = parseArgs(process.argv.slice(2));

    const indexPacked = await loadIndexPacked(args.archive, args.indexPath, args.openrs2);
    const indexUnpacked = unpackJs5Group(indexPacked);
    const groupCrcs = parseGroupCrcs(indexUnpacked);
    const groupIds = parseGroupIdsFromIndexPacked(indexPacked);

    let mismatches = 0;
    let checked = 0;

    for (const groupId of groupIds) {
        const groupPath = path.join(args.groupsDir, String(args.archive), `${groupId}.dat`);
        if (!fs.existsSync(groupPath)) {
            mismatches++;
            console.log(`Group ${groupId}: MISSING (no local group data)`);
            continue;
        }

        const groupPacked = new Uint8Array(fs.readFileSync(groupPath));
        const groupUnpacked = unpackJs5Group(groupPacked);
        const actualCrc = Packet.getcrc(groupUnpacked, 0, groupUnpacked.length) >>> 0;
        checked++;

        if (args.openrs2) {
            const remotePacked = await getGroup(args.archive, groupId);
            const remoteUnpacked = unpackJs5Group(new Uint8Array(remotePacked));
            const expectedCrc = Packet.getcrc(remoteUnpacked, 0, remoteUnpacked.length) >>> 0;

            if (actualCrc !== expectedCrc) {
                mismatches++;
                console.log(`Group ${groupId}: CRC MISMATCH (expected ${toHex(expectedCrc)}, got ${toHex(actualCrc)})`);
            }
            continue;
        }

        const expectedCrc = groupCrcs.get(groupId) ?? 0;
        if (actualCrc !== expectedCrc) {
            mismatches++;
            console.log(`Group ${groupId}: CRC MISMATCH (expected ${toHex(expectedCrc)}, got ${toHex(actualCrc)})`);
        }
    }

    console.log(`CRC checked groups: ${checked}`);
    console.log(`CRC mismatches: ${mismatches}`);

    if (mismatches > 0) {
        process.exitCode = 1;
    }
}

try {
    await main();
} catch (err) {
    console.error(err);
    process.exit(1);
}
