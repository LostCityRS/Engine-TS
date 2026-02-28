import fs from 'fs';
import path from 'path';

import { unpackJs5Group } from '#/io/Js5Group.js';
import Environment from '#/util/Environment.js';
import { resolvePatchPathByName } from '#tools/pack/sources/PatchSource.js';
import {
    arraysEqual,
    ensureDir,
    parsePackFile,
    compressJs5Group,
    parseGroupIdsFromIndexPacked,
    readGroupBytes,
    writeInt32BE
} from '#tools/cache/lib/js5Tools.js';

type Args = {
    src: string;
    out: string;
    archive: number;
    exact: boolean;
    help: boolean;
};

function parseArgs(argv: string[]): Args {
    const args: Args = {
        src: path.join(Environment.BUILD_SRC_DIR, 'pack', 'patch.pack'),
        out: 'data/pack',
        archive: 15,
        exact: false,
        help: false,
    };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--src') {
            args.src = argv[++i];
        } else if (arg === '--out') {
            args.out = argv[++i];
        } else if (arg === '--archive') {
            args.archive = Number(argv[++i]);
        } else if (arg === '--exact') {
            args.exact = true;
        } else if (arg === '--no-exact') {
            args.exact = false;
        } else if (arg === '--help' || arg === '-h') {
            args.help = true;
        }
    }

    return args;
}

async function main() {
    const args = parseArgs(process.argv.slice(2));

    if (!fs.existsSync(args.src)) {
        throw new Error(`Pack file not found: ${args.src}`);
    }

    ensureDir(args.out);

    const patchPack = parsePackFile(args.src);
    const indexPath = `data/cache/255/${args.archive}.dat`;

    if (!fs.existsSync(indexPath)) {
        throw new Error(`Index file not found: ${indexPath}`);
    }

    const indexPacked = new Uint8Array(fs.readFileSync(indexPath));
    const groupIds = parseGroupIdsFromIndexPacked(indexPacked);
    const validGroupIds = new Set(groupIds);

    const patchData = new Map<number, Uint8Array>();
    let missingFiles = 0;
    let skippedIds = 0;

    for (const [name, id] of patchPack) {
        if (!validGroupIds.has(id)) {
            skippedIds++;
            continue;
        }

        const filePath = resolvePatchPathByName(name);
        if (!filePath) {
            missingFiles++;
            continue;
        }

        patchData.set(id, new Uint8Array(fs.readFileSync(filePath)));
    }

    const compressedGroups = new Map<number, Uint8Array>();

    for (const groupId of groupIds) {
        let originalContainer: Uint8Array | null = null;

        const localGroupPath = `data/cache/${args.archive}/${groupId}.dat`;

        if (fs.existsSync(localGroupPath)) {
            originalContainer = new Uint8Array(fs.readFileSync(localGroupPath));
        } else {
            originalContainer = await readGroupBytes(args.archive, groupId, 'data/cache', true);
            if (!originalContainer) {
                throw new Error(`Reference cache group not found: data/cache/${args.archive}/${groupId}.dat`);
            }
        }

        const payload = patchData.get(groupId);

        if (!payload) {
            compressedGroups.set(groupId, originalContainer);
            continue;
        }

        if (args.exact) {
            const originalUncompressed = unpackJs5Group(originalContainer);

            if (!arraysEqual(originalUncompressed, payload)) {
                throw new Error(
                    `Exact mode mismatch for group ${groupId}: generated payload differs from reference cache.`
                );
            }

            compressedGroups.set(groupId, originalContainer);
        } else {
            const compressed = await compressJs5Group(payload, originalContainer[0]);
            compressedGroups.set(groupId, compressed);
        }
    }

    const groupBuffers: Uint8Array[] = new Array(groupIds.length);
    const groupLengths: number[] = new Array(groupIds.length).fill(0);

    for (let i = 0; i < groupIds.length; i++) {
        const groupId = groupIds[i];
        const compressed = compressedGroups.get(groupId);

        if (!compressed) {
            throw new Error(`Missing packed data for group ${groupId}`);
        }

        groupBuffers[i] = compressed;
        groupLengths[i] = compressed.length;
    }

    const lengthTable = new Uint8Array(groupIds.length * 4);
    for (let i = 0; i < groupLengths.length; i++) {
        writeInt32BE(groupLengths[i], lengthTable, i * 4);
    }

    const totalGroupBytes = groupLengths.reduce((sum, length) => sum + length, 0);
    const totalSize = indexPacked.length + totalGroupBytes + lengthTable.length;
    const js5Data = new Uint8Array(totalSize);

    let offset = 0;
    js5Data.set(indexPacked, offset);
    offset += indexPacked.length;

    for (const group of groupBuffers) {
        js5Data.set(group, offset);
        offset += group.length;
    }

    js5Data.set(lengthTable, offset);

    const serverOut = path.join(args.out, 'server.patches.js5');
    const clientOut = path.join(args.out, 'client.patches.js5');

    fs.writeFileSync(serverOut, js5Data);
    fs.writeFileSync(clientOut, js5Data);

    console.log(`Packed ${compressedGroups.size} patches from ${patchPack.size} pack entries`);
    if (missingFiles > 0) {
        console.log(`Missing source patch files for ${missingFiles} pack entries`);
    }
    if (skippedIds > 0) {
        console.log(`Skipped ${skippedIds} pack entries not present in archive ${args.archive} index`);
    }
    console.log(`Wrote ${serverOut}`);
    console.log(`Wrote ${clientOut}`);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
