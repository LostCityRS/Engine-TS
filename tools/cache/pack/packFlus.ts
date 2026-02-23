import fs from 'fs';
import path from 'path';

import FluType from '#/cache/config/FluType.js';
import { CompressionType } from '#/io/CompressionType.js';
import Packet from '#/io/Packet.js';
import { unpackJs5Group } from '#/io/Js5Group.js';
import Environment from '#/util/Environment.js';
import { encodeFlu, encodeFluWithOpcodes } from '#tools/cache/lib/fluCodec.js';
import {
    arraysEqual,
    ensureDir,
    parsePackFile,
    combineGroupFiles,
    compressJs5Group,
} from '#tools/cache/lib/js5Tools.js';

type Args = {
    src: string;
    out: string;
    index: number;
    archive: number;
    exact: boolean;
    debug: boolean;
    help: boolean;
};

function parseArgs(argv: string[]): Args {
    const args: Args = {
        src: path.join(Environment.BUILD_SRC_DIR, 'scripts', '_unpack', '530', 'all.flu'),
        out: 'data/pack',
        index: 2,
        archive: 1,
        exact: false,
        debug: false,
        help: false
    };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];

        if (arg === '--src') {
            args.src = argv[++i];
        } else if (arg === '--out') {
            args.out = argv[++i];
        } else if (arg === '--index') {
            args.index = Number(argv[++i]);
        } else if (arg === '--archive') {
            args.archive = Number(argv[++i]);
        } else if (arg === '--exact') {
            args.exact = true;
        } else if (arg === '--no-exact') {
            args.exact = false;
        } else if (arg === '--debug') {
            args.debug = true;
        } else if (arg === '--help' || arg === '-h') {
            args.help = true;
        }
    }

    return args;
}

type OpcodeValue = {
    code: number;
    value?: any;
};

type ParsedFluSource = {
    config: FluType;
    opcodes: OpcodeValue[];
};

function parseSourceFlus(content: string, nameToId: Map<string, number>): Map<number, ParsedFluSource> {
    const flus = new Map<number, ParsedFluSource>();
    const lines = content.split('\n');

    let currentId = -1;
    let currentConfig: FluType | null = null;
    let currentOpcodes: OpcodeValue[] = [];

    const finalize = () => {
        if (currentConfig && currentId >= 0) {
            flus.set(currentId, {
                config: currentConfig,
                opcodes: currentOpcodes
            });
        }
    };

    for (const rawLine of lines) {
        const line = rawLine.trim();

        if (line.length === 0 || line.startsWith('//')) {
            continue;
        }

        if (line.startsWith('[') && line.endsWith(']')) {
            finalize();

            const name = line.substring(1, line.length - 1);
            let id = nameToId.get(name);

            if (id === undefined) {
                if (name.startsWith('flu_')) {
                    const num = parseInt(name.substring(4));
                    if (!isNaN(num)) {
                        id = num;
                    }
                }
            }

            if (id === undefined) {
                throw new Error(`Unknown floor underlay name: ${name}`);
            }

            currentId = id;
            currentConfig = new FluType(id);
            currentConfig.debugname = nameToId.get(name) !== undefined ? name : null;
            currentOpcodes = [];
            continue;
        }

        if (!currentConfig) {
            continue;
        }

        const eq = line.indexOf('=');
        if (eq === -1) {
            continue;
        }

        const key = line.substring(0, eq).trim();
        const value = line.substring(eq + 1).trim();

        if (key === 'colour') {
            const colourValue = value.startsWith('0x') ? parseInt(value, 16) : parseInt(value);
            currentConfig.colour = colourValue;
            currentOpcodes.push({ code: 1, value: colourValue });
        } else if (key === 'material') {
            const matValue = parseInt(value);
            currentConfig.material = matValue;
            currentOpcodes.push({ code: 2, value: matValue });
        } else if (key === 'materialscale') {
            const scaleValue = parseInt(value);
            currentConfig.materialscale = scaleValue;
            currentOpcodes.push({ code: 3, value: scaleValue });
        } else if (key === 'hardshadow') {
            currentConfig.hardshadow = value === 'yes' || value === 'true';
            if (!currentConfig.hardshadow) {
                currentOpcodes.push({ code: 4 });
            }
        }
    }

    finalize();
    return flus;
}

async function main() {
    const args = parseArgs(process.argv.slice(2));

    if (args.help) {
        console.log('Usage: bun run tools/cache/pack/packFlus.ts [options]');
        console.log('');
        console.log('Options:');
        console.log('  --src <path>      Source file path (default: <BUILD_SRC_DIR>/scripts/_unpack/530/all.flu)');
        console.log('  --out <path>      Output directory (default: data/pack)');
        console.log('  --index <num>     Cache index (default: 2)');
        console.log('  --archive <num>   Archive number (default: 1)');
        console.log('  --exact           Use original compression exactly (requires cache)');
        console.log('  --no-exact        Recompress (default)');
        console.log('  --debug           Print first file mismatch details');
        console.log('  --help, -h        Show this help message');
        return;
    }

    if (!fs.existsSync(args.src)) {
        throw new Error(`Source file not found: ${args.src}`);
    }

    const { getGroup } = await import('#/util/OpenRS2.js');
    const indexData = await getGroup(255, args.index);
    const indexUnpacked = unpackJs5Group(new Uint8Array(indexData));
    const indexPacket = new Packet(indexUnpacked);

    const format = indexPacket.g1();
    if (format >= 6) {
        indexPacket.g4s();
    }

    const flags = indexPacket.g1();

    function readJs5Id(packet: Packet, format: number): number {
        if (format >= 7) {
            return packet.gSmart2or4();
        }
        return packet.g2();
    }

    const groupCount = readJs5Id(indexPacket, format);
    const groupIds: number[] = new Array(groupCount);
    let previousGroupId = 0;
    for (let i = 0; i < groupCount; i++) {
        previousGroupId += readJs5Id(indexPacket, format);
        groupIds[i] = previousGroupId;
    }

    const archiveIndex = groupIds.indexOf(args.archive);
    if (archiveIndex === -1) {
        throw new Error(`Archive ${args.archive} not found in index ${args.index}`);
    }

    if ((flags & 0x1) !== 0) {
        for (let i = 0; i < groupCount; i++) {
            indexPacket.g4s();
        }
    }
    for (let i = 0; i < groupCount; i++) {
        indexPacket.g4s();
    }
    for (let i = 0; i < groupCount; i++) {
        indexPacket.g4s();
    }

    const fileCounts: number[] = new Array(groupCount);
    for (let i = 0; i < groupCount; i++) {
        fileCounts[i] = readJs5Id(indexPacket, format);
    }

    for (let i = 0; i < archiveIndex; i++) {
        for (let j = 0; j < fileCounts[i]; j++) {
            readJs5Id(indexPacket, format);
        }
    }

    const fileIds: number[] = [];
    let previousFileId = 0;
    for (let j = 0; j < fileCounts[archiveIndex]; j++) {
        previousFileId += readJs5Id(indexPacket, format);
        fileIds.push(previousFileId);
    }

    const primaryPackPath = path.join(Environment.BUILD_SRC_DIR, 'pack', 'flu.pack');
    const fallbackPackPath = path.join(path.dirname(args.src), 'pack', 'flu.pack');
    const packPath = fs.existsSync(primaryPackPath) ? primaryPackPath : fallbackPackPath;
    const nameToId = parsePackFile(packPath);

    const content = fs.readFileSync(args.src, 'utf-8');
    const flus = parseSourceFlus(content, nameToId);

    const encodedFiles = new Map<number, Uint8Array>();
    let emptyCount = 0;
    let nonEmptyCount = 0;

    for (const [id, parsed] of flus) {
        const fluConfig = parsed.config;
        const encoded = parsed.opcodes.length > 0
            ? encodeFluWithOpcodes(fluConfig, parsed.opcodes)
            : encodeFlu(fluConfig);

        encodedFiles.set(id, encoded);

        if (encoded.length === 1 && encoded[0] === 0) {
            emptyCount++;
        } else {
            nonEmptyCount++;
        }
    }

    console.log(`Encoded: ${emptyCount} empty, ${nonEmptyCount} non-empty`);

    const files = encodedFiles;
    for (const fileId of fileIds) {
        if (!files.has(fileId)) {
            files.set(fileId, new Uint8Array([0x00]));
            emptyCount++;
        }
    }

    const orderedFileIds = fileIds;

    const combined = combineGroupFiles(files, orderedFileIds);

    ensureDir(args.out);
    const indexDir = path.join(args.out, String(args.index));
    ensureDir(indexDir);

    const groupPath = path.join(indexDir, `${args.archive}.dat`);
    const origPath = `data/cache/${args.index}/${args.archive}.dat`;

    if (args.exact) {
        if (!fs.existsSync(origPath)) {
            throw new Error(`Exact mode requires reference cache group: ${origPath}`);
        }

        const originalContainer = new Uint8Array(fs.readFileSync(origPath));
        const originalUncompressed = unpackJs5Group(originalContainer);

        if (!arraysEqual(originalUncompressed, combined)) {
            if (args.debug) {
                reportFirstMismatch(originalUncompressed, combined, fileIds);
            }
            throw new Error(
                'Exact mode mismatch: generated uncompressed payload differs from reference cache.'
            );
        }

        fs.writeFileSync(groupPath, originalContainer);
    } else {
        let compressionType = CompressionType.GZIP;
        if (fs.existsSync(origPath)) {
            const origData = fs.readFileSync(origPath);
            compressionType = origData[0];
        }

        const compressed = await compressJs5Group(combined, compressionType);
        fs.writeFileSync(groupPath, compressed);
    }
    console.log(`Wrote ${groupPath}`);
}

function splitGroupFiles(groupData: Uint8Array, fileIds: number[]): Map<number, Uint8Array> {
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

function reportFirstMismatch(reference: Uint8Array, generated: Uint8Array, fileIds: number[]): void {
    const refFiles = splitGroupFiles(reference, fileIds);
    const genFiles = splitGroupFiles(generated, fileIds);

    for (const fileId of fileIds) {
        const ref = refFiles.get(fileId) ?? new Uint8Array(0);
        const gen = genFiles.get(fileId) ?? new Uint8Array(0);

        if (ref.length !== gen.length) {
            console.warn(`Mismatch file ${fileId}: size ${gen.length} vs ${ref.length}`);
            return;
        }

        for (let i = 0; i < ref.length; i++) {
            if (ref[i] !== gen[i]) {
                console.warn(`Mismatch file ${fileId}: first diff at offset ${i} (gen=${gen[i]}, ref=${ref[i]})`);
                return;
            }
        }
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
