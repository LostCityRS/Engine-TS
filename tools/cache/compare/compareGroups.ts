import fs from 'fs';

import {
    arraysEqual,
    parseGroupIdsFromIndexPacked,
    readGroupBytes
} from '#tools/cache/lib/js5Tools.js';
import { unpackJs5Group } from '#/io/Js5Group.js';

type Args = {
    archive: number;
    leftDir: string;
    rightDir: string;
    indexPath: string;
    mode: 'compressed' | 'uncompressed';
    openrs2Left: boolean;
    openrs2Right: boolean;
    help: boolean;
};

function parseArgs(argv: string[]): Args {
    const args: Args = {
        archive: 17,
        leftDir: 'data/cache',
        rightDir: 'data/pack/server-enum',
        indexPath: '',
        mode: 'compressed',
        openrs2Left: false,
        openrs2Right: false,
        help: false
    };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--archive') {
            args.archive = Number(argv[++i]);
        } else if (arg === '--left-dir') {
            args.leftDir = argv[++i];
        } else if (arg === '--right-dir') {
            args.rightDir = argv[++i];
        } else if (arg === '--index') {
            args.indexPath = argv[++i];
        } else if (arg === '--mode') {
            const mode = argv[++i];
            if (mode === 'compressed' || mode === 'uncompressed') {
                args.mode = mode;
            }
        } else if (arg === '--openrs2-left') {
            args.openrs2Left = true;
        } else if (arg === '--openrs2-right') {
            args.openrs2Right = true;
        } else if (arg === '--help' || arg === '-h') {
            args.help = true;
        }
    }

    if (!args.indexPath) {
        args.indexPath = `data/cache/255/${args.archive}.dat`;
    }

    return args;
}


async function main() {
    const args = parseArgs(process.argv.slice(2));

    if (!fs.existsSync(args.indexPath)) {
        throw new Error(`Index file not found: ${args.indexPath}`);
    }

    const indexPacked = new Uint8Array(fs.readFileSync(args.indexPath));
    const groupIds = parseGroupIdsFromIndexPacked(indexPacked);

    let mismatches = 0;
    let missing = 0;
    let compared = 0;

    for (const groupId of groupIds) {
        const left = await readGroupBytes(args.archive, groupId, args.leftDir, args.openrs2Left);
        const right = await readGroupBytes(args.archive, groupId, args.rightDir, args.openrs2Right);

        if (!left || !right) {
            missing++;
            console.log(`Group ${groupId}: MISSING (${left ? 'right' : 'left'} side)`);
            continue;
        }

        let leftCompare = left;
        let rightCompare = right;
        if (args.mode === 'uncompressed') {
            leftCompare = unpackJs5Group(left);
            rightCompare = unpackJs5Group(right);
        }

        compared++;
        if (!arraysEqual(leftCompare, rightCompare)) {
            mismatches++;
            console.log(`Group ${groupId}: MISMATCH`);
        }
    }

    console.log(`Groups compared: ${compared}`);
    console.log(`Groups missing: ${missing}`);
    console.log(`Groups mismatched: ${mismatches}`);

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
