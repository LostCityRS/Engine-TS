import fs from 'fs';
import path from 'path';

import FluType from '#/cache/config/FluType.js';
import { CompressionType } from '#/io/CompressionType.js';
import { unpackJs5Group } from '#/io/Js5Group.js';
import Environment from '#/util/Environment.js';
import {
    parseBracketedConfigSource,
    parseConfigBoolean,
    parseConfigInteger,
    resolveSectionId
} from '#tools/cache/lib/configSource.js';
import { encodeFlu, encodeFluWithOpcodes } from '#tools/cache/lib/fluCodec.js';
import {
    arraysEqual,
    ensureDir,
    parsePackFile,
    loadArchiveFileIds,
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
    const sections = parseBracketedConfigSource(content);

    for (const section of sections) {
        const id = resolveSectionId(section.name, nameToId, 'flu_');
        if (id === null) {
            throw new Error(`Unknown floor underlay name: ${section.name}`);
        }

        const config = new FluType(id);
        config.debugname = nameToId.get(section.name) !== undefined ? section.name : null;
        const opcodes: OpcodeValue[] = [];

        for (const field of section.fields) {
            const { key, value } = field;

            if (key === 'colour') {
                const colourValue = parseConfigInteger(value);
                config.colour = colourValue;
                opcodes.push({ code: 1, value: colourValue });
            } else if (key === 'material') {
                const matValue = parseConfigInteger(value);
                config.material = matValue;
                opcodes.push({ code: 2, value: matValue });
            } else if (key === 'materialscale') {
                const scaleValue = parseConfigInteger(value);
                config.materialscale = scaleValue;
                opcodes.push({ code: 3, value: scaleValue });
            } else if (key === 'hardshadow') {
                config.hardshadow = parseConfigBoolean(value);
                if (!config.hardshadow) {
                    opcodes.push({ code: 4 });
                }
            }
        }

        flus.set(id, { config, opcodes });
    }

    return flus;
}

async function main() {
    const args = parseArgs(process.argv.slice(2));


    if (!fs.existsSync(args.src)) {
        throw new Error(`Source file not found: ${args.src}`);
    }

    const fileIds = await loadArchiveFileIds(args.index, args.archive, true);

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
