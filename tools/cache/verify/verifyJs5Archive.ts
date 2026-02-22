import fs from 'fs';
import path from 'path';

import {
    arraysEqual,
    packedContainerLength,
    parseGroupIdsFromIndexPacked,
    readInt32BE
} from '#tools/cache/lib/js5Tools.js';

type Args = {
    archive: number;
    js5: string;
    groupsDir: string;
    indexPath: string;
    help: boolean;
};

function parseArgs(argv: string[]): Args {
    const args: Args = {
        archive: 17,
        js5: '',
        groupsDir: 'data/pack',
        indexPath: '',
        help: false
    };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--archive') {
            args.archive = Number(argv[++i]);
        } else if (arg === '--js5') {
            args.js5 = argv[++i];
        } else if (arg === '--groups-dir') {
            args.groupsDir = argv[++i];
        } else if (arg === '--index') {
            args.indexPath = argv[++i];
        } else if (arg === '--help' || arg === '-h') {
            args.help = true;
        }
    }

    if (!args.js5) {
        args.js5 = `data/pack/archive.${args.archive}.js5`;
    }

    if (!args.indexPath) {
        args.indexPath = `data/cache/255/${args.archive}.dat`;
    }

    return args;
}


function main() {
    const args = parseArgs(process.argv.slice(2));

    if (!fs.existsSync(args.js5)) {
        throw new Error(`JS5 file not found: ${args.js5}`);
    }

    if (!fs.existsSync(args.indexPath)) {
        throw new Error(`Index file not found: ${args.indexPath}`);
    }

    const js5 = new Uint8Array(fs.readFileSync(args.js5));
    const indexPacked = new Uint8Array(fs.readFileSync(args.indexPath));
    const groupIds = parseGroupIdsFromIndexPacked(indexPacked);

    const indexLengthInJs5 = packedContainerLength(js5, 0);
    const indexFromJs5 = js5.slice(0, indexLengthInJs5);
    const indexMatches = arraysEqual(indexFromJs5, indexPacked);

    const lengthsTableBytes = groupIds.length * 4;
    const lengthsTableStart = js5.length - lengthsTableBytes;
    const lengthsTable = js5.slice(lengthsTableStart);

    let pos = indexLengthInJs5;
    let groupMismatches = 0;
    let lengthMismatches = 0;

    for (let i = 0; i < groupIds.length; i++) {
        const groupId = groupIds[i];
        const expectedLength = readInt32BE(lengthsTable, i * 4) >>> 0;
        const expectedPath = path.join(args.groupsDir, String(args.archive), `${groupId}.dat`);

        if (!fs.existsSync(expectedPath)) {
            if (expectedLength !== 0) {
                lengthMismatches++;
            }
            continue;
        }

        const expectedBytes = new Uint8Array(fs.readFileSync(expectedPath));
        if (expectedBytes.length !== expectedLength) {
            lengthMismatches++;
        }

        const actualBytes = js5.slice(pos, pos + expectedLength);
        pos += expectedLength;

        if (!arraysEqual(actualBytes, expectedBytes)) {
            groupMismatches++;
        }
    }

    const consumedExactly = pos === lengthsTableStart;
    const reconstructed = new Uint8Array(js5.length);
    reconstructed.set(indexPacked, 0);
    let writePos = indexPacked.length;

    const rebuiltLengths = new Uint8Array(lengthsTableBytes);
    for (let i = 0; i < groupIds.length; i++) {
        const groupId = groupIds[i];
        const expectedPath = path.join(args.groupsDir, String(args.archive), `${groupId}.dat`);
        const expectedBytes = fs.existsSync(expectedPath) ? new Uint8Array(fs.readFileSync(expectedPath)) : new Uint8Array(0);
        reconstructed.set(expectedBytes, writePos);
        writePos += expectedBytes.length;

        rebuiltLengths[i * 4] = (expectedBytes.length >>> 24) & 0xff;
        rebuiltLengths[i * 4 + 1] = (expectedBytes.length >>> 16) & 0xff;
        rebuiltLengths[i * 4 + 2] = (expectedBytes.length >>> 8) & 0xff;
        rebuiltLengths[i * 4 + 3] = expectedBytes.length & 0xff;
    }

    reconstructed.set(rebuiltLengths, writePos);
    const fullMatch = arraysEqual(js5, reconstructed);

    console.log(`Archive ${args.archive}: ${groupIds.length} groups in index`);
    console.log(`Index bytes match: ${indexMatches ? 'YES' : 'NO'}`);
    console.log(`Group length table mismatches: ${lengthMismatches}`);
    console.log(`Group payload mismatches: ${groupMismatches}`);
    console.log(`Layout consumed exactly: ${consumedExactly ? 'YES' : 'NO'}`);
    console.log(`Full archive reconstruction match: ${fullMatch ? 'YES' : 'NO'}`);

    if (!indexMatches || groupMismatches > 0 || lengthMismatches > 0 || !consumedExactly || !fullMatch) {
        process.exitCode = 1;
    }
}

try {
    main();
} catch (err) {
    console.error(err);
    process.exit(1);
}
