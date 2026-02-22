import fs from 'fs';
import path from 'path';

import {
    arraysEqual,
    loadIndexPacked,
    parseGroupIdsFromIndexPacked
} from '#tools/cache/lib/js5Tools.js';

import { getGroup } from '#/util/OpenRS2.js';

type Args = {
    archive: number;
    groupsDir: string;
    indexPath: string;
    openrs2: boolean;
    warnOnly: boolean;
    help: boolean;
};

function parseArgs(argv: string[]): Args {
    const args: Args = {
        archive: 17,
        groupsDir: 'data/pack',
        indexPath: '',
        openrs2: true,
        warnOnly: false,
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
        } else if (arg === '--no-openrs2') {
            args.openrs2 = false;
        } else if (arg === '--warn-only') {
            args.warnOnly = true;
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

    const indexPacked = await loadIndexPacked(args.archive, args.indexPath, args.openrs2);
    const groupIds = parseGroupIdsFromIndexPacked(indexPacked);

    let mismatches = 0;
    let checked = 0;

    for (const groupId of groupIds) {
        const localPath = path.join(args.groupsDir, String(args.archive), `${groupId}.dat`);
        if (!fs.existsSync(localPath)) {
            mismatches++;
            console.log(`Group ${groupId}: MISSING (no local group data)`);
            continue;
        }

        const localBytes = new Uint8Array(fs.readFileSync(localPath));
        let expectedBytes: Uint8Array;

        if (args.openrs2) {
            expectedBytes = new Uint8Array(await getGroup(args.archive, groupId));
        } else {
            const expectedPath = path.join('data/cache', String(args.archive), `${groupId}.dat`);
            if (!fs.existsSync(expectedPath)) {
                mismatches++;
                console.log(`Group ${groupId}: MISSING (no cache group data)`);
                continue;
            }
            expectedBytes = new Uint8Array(fs.readFileSync(expectedPath));
        }

        checked++;
        if (!arraysEqual(localBytes, expectedBytes)) {
            mismatches++;
            console.log(`Group ${groupId}: COMPRESSED BYTES MISMATCH`);
        }
    }

    console.log(`Compressed groups checked: ${checked}`);
    console.log(`Compressed mismatches: ${mismatches}`);

    if (mismatches > 0 && args.warnOnly) {
        console.log('Compressed mismatches detected (warn-only mode).');
    }

    if (mismatches > 0 && !args.warnOnly) {
        process.exitCode = 1;
    }
}

try {
    await main();
} catch (err) {
    console.error(err);
    process.exit(1);
}
