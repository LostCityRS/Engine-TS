import fs from 'fs';
import path from 'path';

import { unpackJs5Group } from '#/io/Js5Group.js';
import { parseJs5ArchiveIndex, splitGroupFiles } from '#/io/Js5ArchiveIndex.js';
import { ensureDir, loadIndexPacked, readGroupBytes } from '#tools/cache/lib/js5Tools.js';

type Args = {
    archive: number;
    group: number;
    groupsDir: string;
    indexPath: string;
    openrs2: boolean;
    outDir: string;
    previewBytes: number;
    help: boolean;
};

function parseArgs(argv: string[]): Args {
    const args: Args = {
        archive: 2,
        group: 21,
        groupsDir: 'data/cache',
        indexPath: '',
        openrs2: false,
        outDir: '',
        previewBytes: 24,
        help: false
    };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--archive') {
            args.archive = Number(argv[++i]);
        } else if (arg === '--group') {
            args.group = Number(argv[++i]);
        } else if (arg === '--groups-dir') {
            args.groupsDir = argv[++i];
        } else if (arg === '--index') {
            args.indexPath = argv[++i];
        } else if (arg === '--openrs2') {
            args.openrs2 = true;
        } else if (arg === '--out-dir') {
            args.outDir = argv[++i];
        } else if (arg === '--preview-bytes') {
            args.previewBytes = Math.max(0, Number(argv[++i]));
        } else if (arg === '--help' || arg === '-h') {
            args.help = true;
        }
    }

    if (!args.indexPath) {
        args.indexPath = `data/cache/255/${args.archive}.dat`;
    }

    return args;
}

function bytesToHex(data: Uint8Array, count: number): string {
    const end = Math.min(data.length, count);
    const out: string[] = new Array(end);

    for (let i = 0; i < end; i++) {
        out[i] = data[i].toString(16).padStart(2, '0');
    }

    return out.join(' ');
}

async function main() {
    const args = parseArgs(process.argv.slice(2));

    const indexPacked = await loadIndexPacked(args.archive, args.indexPath, args.openrs2);
    const indexUnpacked = unpackJs5Group(indexPacked);
    const archiveIndex = parseJs5ArchiveIndex(indexUnpacked);
    const fileIds = archiveIndex.fileIdsByGroup.get(args.group);

    if (!fileIds) {
        throw new Error(`Group ${args.group} does not exist in archive ${args.archive}.`);
    }

    const groupPacked = await readGroupBytes(args.archive, args.group, args.groupsDir, args.openrs2);
    if (!groupPacked) {
        throw new Error(`Missing group data for archive ${args.archive}, group ${args.group}.`);
    }

    const groupUnpacked = unpackJs5Group(groupPacked);
    const files = splitGroupFiles(groupUnpacked, fileIds);

    console.log(`Archive ${args.archive}, Group ${args.group}`);
    console.log(`Packed bytes: ${groupPacked.length}`);
    console.log(`Unpacked bytes: ${groupUnpacked.length}`);
    console.log(`Files in group: ${fileIds.length}`);

    let outputDir = '';
    if (args.outDir) {
        outputDir = path.join(args.outDir, String(args.archive), String(args.group));
        ensureDir(outputDir);
    }

    for (const fileId of fileIds) {
        const fileData = files.get(fileId) ?? new Uint8Array(0);
        const preview = args.previewBytes > 0 ? bytesToHex(fileData, args.previewBytes) : '';

        console.log(`- file ${fileId}: ${fileData.length} bytes${preview ? ` | ${preview}` : ''}`);

        if (outputDir) {
            fs.writeFileSync(path.join(outputDir, `${fileId}.bin`), fileData);
        }
    }

    if (outputDir) {
        console.log(`Wrote decoded files to: ${outputDir}`);
    }
}

try {
    await main();
} catch (err) {
    console.error(err);
    process.exit(1);
}
