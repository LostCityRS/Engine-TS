import fs from 'fs';
import path from 'path';

import Packet from '#/io/Packet.js';
import { unpackJs5Group } from '#/io/Js5Group.js';
import { ensureDir, loadIndexPacked, readJs5Id } from '#tools/cache/lib/js5Tools.js';

type Scope = 'group' | 'file' | 'both';
type Algo = 'js5' | 'jag';

type Args = {
    archive?: number;
    type?: string;
    indexPath?: string;
    openrs2: boolean;
    scope: Scope;
    group?: number;
    id?: number;
    text?: string;
    out?: string;
    algo: Algo;
    help: boolean;
};

type ParsedHashes = {
    archive: number;
    hasNames: boolean;
    format: number;
    version?: number;
    groupHashes: Map<number, number>;
    fileHashesByGroup: Map<number, Map<number, number>>;
};

const TYPE_TO_ARCHIVE: Record<string, number> = {
    flu: 1,
    flo: 4,
    inv: 5,
    midi: 6,
    enum: 17,
    quickchat: 24,
    quickchat_global: 25,
    chatcat: 24,
    chatphrase: 24,
    global_chatcat: 25,
    global_chatphrase: 25
};

function parseArgs(argv: string[]): Args {
    const args: Args = {
        openrs2: false,
        scope: 'group',
        algo: 'js5',
        help: false
    };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];

        if (arg === '--archive') {
            args.archive = Number(argv[++i]);
        } else if (arg === '--type') {
            args.type = argv[++i]?.toLowerCase();
        } else if (arg === '--index') {
            args.indexPath = argv[++i];
        } else if (arg === '--openrs2') {
            args.openrs2 = true;
        } else if (arg === '--scope') {
            const scope = argv[++i] as Scope;
            if (scope === 'group' || scope === 'file' || scope === 'both') {
                args.scope = scope;
            }
        } else if (arg === '--group') {
            args.group = Number(argv[++i]);
        } else if (arg === '--id') {
            args.id = Number(argv[++i]);
        } else if (arg === '--text') {
            args.text = argv[++i];
        } else if (arg === '--out') {
            args.out = argv[++i];
        } else if (arg === '--algo') {
            const algo = argv[++i]?.toLowerCase();
            if (algo === 'js5' || algo === 'jag') {
                args.algo = algo;
            }
        } else if (arg === '--help' || arg === '-h') {
            args.help = true;
        }
    }

    return args;
}

function hashJs5(text: string): number {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        hash = ((hash * 31) + text.charCodeAt(i)) | 0;
    }
    return hash;
}

function hashJag(text: string): number {
    let hash = 0;
    const upper = text.toUpperCase();
    for (let i = 0; i < upper.length; i++) {
        hash = (hash * 61 + upper.charCodeAt(i) - 32) | 0;
    }
    return hash;
}

function resolveArchive(args: Args): number {
    if (typeof args.archive === 'number' && !Number.isNaN(args.archive)) {
        return args.archive;
    }

    if (args.type) {
        const numericType = Number(args.type);
        if (!Number.isNaN(numericType)) {
            return numericType;
        }

        const alias = TYPE_TO_ARCHIVE[args.type];
        if (typeof alias === 'number') {
            return alias;
        }
    }

    throw new Error('Missing archive. Use --archive <id> or --type <known alias like midi>.');
}

function defaultOutPath(archive: number, type?: string): string {
    const label = type && type.length > 0 ? type : `archive_${archive}`;
    return path.join('data', 'pack', `${label}.hash`);
}

function parseNameHashes(indexUnpacked: Uint8Array, archive: number): ParsedHashes {
    const packet = new Packet(indexUnpacked);

    const format = packet.g1();
    if (format < 5 || format > 7) {
        throw new Error(`Unsupported JS5 index format: ${format}`);
    }

    let version: number | undefined;
    if (format >= 6) {
        version = packet.g4s();
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

    const groupHashes = new Map<number, number>();
    if (hasNames) {
        for (let i = 0; i < groupCount; i++) {
            groupHashes.set(groupIds[i], packet.g4s());
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

    const fileHashesByGroup = new Map<number, Map<number, number>>();
    if (hasNames) {
        for (let i = 0; i < groupCount; i++) {
            const groupId = groupIds[i];
            const fileIds = fileIdsByGroup.get(groupId) ?? [];
            const hashMap = new Map<number, number>();

            for (let j = 0; j < fileIds.length; j++) {
                hashMap.set(fileIds[j], packet.g4s());
            }

            fileHashesByGroup.set(groupId, hashMap);
        }
    }

    return {
        archive,
        hasNames,
        format,
        version,
        groupHashes,
        fileHashesByGroup
    };
}

function buildLines(parsed: ParsedHashes, scope: Scope, groupFilter?: number): string[] {
    const lines: string[] = [];

    if (scope === 'group' || scope === 'both') {
        const groupIds = Array.from(parsed.groupHashes.keys()).sort((a, b) => a - b);
        for (const groupId of groupIds) {
            lines.push(`${groupId}=${parsed.groupHashes.get(groupId)}`);
        }
    }

    if (scope === 'file' || scope === 'both') {
        const groupIds = Array.from(parsed.fileHashesByGroup.keys()).sort((a, b) => a - b);
        for (const groupId of groupIds) {
            if (typeof groupFilter === 'number' && groupFilter !== groupId) {
                continue;
            }

            const fileHashMap = parsed.fileHashesByGroup.get(groupId);
            if (!fileHashMap) {
                continue;
            }

            const fileIds = Array.from(fileHashMap.keys()).sort((a, b) => a - b);
            for (const fileId of fileIds) {
                lines.push(`${groupId}:${fileId}=${fileHashMap.get(fileId)}`);
            }
        }
    }

    return lines;
}

function verifyTarget(parsed: ParsedHashes, args: Args): void {
    if (typeof args.id !== 'number' && typeof args.text !== 'string') {
        return;
    }

    const computed = typeof args.text === 'string'
        ? (args.algo === 'jag' ? hashJag(args.text) : hashJs5(args.text))
        : undefined;

    if (typeof args.text === 'string') {
        console.log(`text='${args.text}' algo=${args.algo} hash=${computed}`);
    }

    if (typeof args.id !== 'number') {
        return;
    }

    if (args.scope === 'file') {
        if (typeof args.group !== 'number') {
            throw new Error('--scope file with --id requires --group to disambiguate file IDs.');
        }

        const fileHash = parsed.fileHashesByGroup.get(args.group)?.get(args.id);
        if (typeof fileHash === 'undefined') {
            console.log(`No file hash found for group ${args.group}, file ${args.id}`);
            return;
        }

        console.log(`target=file ${args.group}:${args.id} hash=${fileHash}`);
        if (typeof computed === 'number') {
            console.log(`match=${computed === fileHash}`);
        }
        return;
    }

    const groupHash = parsed.groupHashes.get(args.id);
    if (typeof groupHash === 'undefined') {
        console.log(`No group hash found for group ${args.id}`);
        return;
    }

    console.log(`target=group ${args.id} hash=${groupHash}`);
    if (typeof computed === 'number') {
        console.log(`match=${computed === groupHash}`);
    }
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        process.exit(0);
    }

    const archive = resolveArchive(args);
    const indexPath = args.indexPath || `data/cache/255/${archive}.dat`;
    const indexPacked = await loadIndexPacked(archive, indexPath, args.openrs2);
    const indexUnpacked = unpackJs5Group(indexPacked);

    const parsed = parseNameHashes(indexUnpacked, archive);

    console.log(`archive=${archive} format=${parsed.format} version=${parsed.version ?? 'n/a'} hasNames=${parsed.hasNames}`);

    if (!parsed.hasNames) {
        console.log('This archive index does not contain name-hash tables (flags & 0x1 == 0).');
        return;
    }

    verifyTarget(parsed, args);

    const lines = buildLines(parsed, args.scope, args.group);
    const outPath = args.out || defaultOutPath(archive, args.type);
    ensureDir(path.dirname(outPath));
    fs.writeFileSync(outPath, lines.join('\n') + '\n', 'utf-8');
    console.log(`Wrote ${lines.length} entries to ${outPath}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
