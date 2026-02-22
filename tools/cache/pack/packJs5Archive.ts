import fs from 'fs';
import path from 'path';

import { parseGroupIdsFromIndexPacked, writeInt32BE } from '#tools/cache/lib/js5Tools.js';

type Args = {
    archive: number;
    groupsDir: string;
    indexPath: string;
    out: string;
    help: boolean;
};

function parseArgs(argv: string[]): Args {
    const args: Args = {
        archive: 17,
        groupsDir: 'data/pack',
        indexPath: '',
        out: '',
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
        } else if (arg === '--out') {
            args.out = argv[++i];
        } else if (arg === '--help' || arg === '-h') {
            args.help = true;
        }
    }

    if (!args.indexPath) {
        args.indexPath = `data/cache/255/${args.archive}.dat`;
    }

    if (!args.out) {
        args.out = `data/pack/archive.${args.archive}.js5`;
    }

    return args;
}


function main() {
    const args = parseArgs(process.argv.slice(2));

    if (!fs.existsSync(args.indexPath)) {
        throw new Error(`Index file not found: ${args.indexPath}`);
    }

    const indexPacked = new Uint8Array(fs.readFileSync(args.indexPath));
    const groupIds = parseGroupIdsFromIndexPacked(indexPacked);

    const groupBuffers: Uint8Array[] = new Array(groupIds.length);
    const groupLengths: number[] = new Array(groupIds.length).fill(0);

    for (let i = 0; i < groupIds.length; i++) {
        const groupId = groupIds[i];
        const groupPath = path.join(args.groupsDir, String(args.archive), `${groupId}.dat`);

        if (!fs.existsSync(groupPath)) {
            groupBuffers[i] = new Uint8Array(0);
            continue;
        }

        const bytes = new Uint8Array(fs.readFileSync(groupPath));
        groupBuffers[i] = bytes;
        groupLengths[i] = bytes.length;
    }

    const lengthTable = new Uint8Array(groupIds.length * 4);
    for (let i = 0; i < groupLengths.length; i++) {
        writeInt32BE(groupLengths[i], lengthTable, i * 4);
    }

    const totalGroupBytes = groupLengths.reduce((sum, length) => sum + length, 0);
    const totalSize = indexPacked.length + totalGroupBytes + lengthTable.length;
    const output = new Uint8Array(totalSize);

    let pos = 0;
    output.set(indexPacked, pos);
    pos += indexPacked.length;

    for (const group of groupBuffers) {
        if (group.length === 0) {
            continue;
        }
        output.set(group, pos);
        pos += group.length;
    }

    output.set(lengthTable, pos);

    const outDir = path.dirname(args.out);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(args.out, output);

    console.log(`Archive ${args.archive}: ${groupIds.length} index groups`);
    console.log(`Index bytes: ${indexPacked.length}`);
    console.log(`Group bytes: ${totalGroupBytes}`);
    console.log(`Length table bytes: ${lengthTable.length}`);
    console.log(`Wrote ${args.out}`);
}

try {
    main();
} catch (err) {
    console.error(err);
    process.exit(1);
}
