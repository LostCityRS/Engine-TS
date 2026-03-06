import fs from 'fs';
import path from 'path';

import MesanimType from '#/cache/config/MesanimType.js';
import { splitGroupFiles } from '#/io/Js5ArchiveIndex.js';
import { CompressionType } from '#/io/CompressionType.js';
import { unpackJs5Group } from '#/io/Js5Group.js';
import Environment from '#/util/Environment.js';
import {
    parseBracketedConfigSource,
    parseConfigInteger,
    resolveSectionId
} from '#tools/cache/lib/configSource.js';
import { encodeMesanim, encodeMesanimWithOpcodes } from '#tools/cache/lib/mesanimCodec.js';
import {
    arraysEqual,
    ensureDir,
    parsePackFile,
    loadArchiveFileIds,
    combineGroupFiles,
    compressJs5Group
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

type OpcodeValue = {
    code: number;
    value?: number;
};

type ParsedMesanimSource = {
    config: MesanimType;
    opcodes: OpcodeValue[];
};

function parseArgs(argv: string[]): Args {
    const args: Args = {
        src: path.join(Environment.BUILD_SRC_DIR, 'scripts', '_unpack', '530', 'all.mesanim'),
        out: 'data/pack',
        index: 2,
        archive: 7,
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

function parseSourceMesanims(content: string, nameToId: Map<string, number>): Map<number, ParsedMesanimSource> {
    const mesanims = new Map<number, ParsedMesanimSource>();
    const sections = parseBracketedConfigSource(content);

    for (const section of sections) {
        const id = resolveSectionId(section.name, nameToId, 'mesanim_');
        if (id === null) {
            throw new Error(`Unknown mesanim name: ${section.name}`);
        }

        const config = new MesanimType(id);
        config.debugname = `mesanim_${id}`;
        const opcodes: OpcodeValue[] = [];

        for (const field of section.fields) {
            const { key, value } = field;
            const lenMatch = /^len([1-4])$/.exec(key);
            if (!lenMatch) {
                continue;
            }

            const code = Number(lenMatch[1]);
            const parsed = parseConfigInteger(value);
            config.len[code - 1] = parsed;
            opcodes.push({ code, value: parsed });
        }

        mesanims.set(id, { config, opcodes });
    }

    return mesanims;
}

async function main() {
    const args = parseArgs(process.argv.slice(2));

    if (!fs.existsSync(args.src)) {
        throw new Error(`Source file not found: ${args.src}`);
    }

    const fileIds = await loadArchiveFileIds(args.index, args.archive, true);

    const primaryPackPath = path.join(Environment.BUILD_SRC_DIR, 'pack', 'mesanim.pack');
    const fallbackPackPath = path.join(path.dirname(args.src), 'pack', 'mesanim.pack');
    const packPath = fs.existsSync(primaryPackPath) ? primaryPackPath : fallbackPackPath;
    const nameToId = parsePackFile(packPath);

    const content = fs.readFileSync(args.src, 'utf-8');
    const mesanims = parseSourceMesanims(content, nameToId);

    const encodedFiles = new Map<number, Uint8Array>();

    for (const [id, parsed] of mesanims) {
        const encoded = parsed.opcodes.length > 0
            ? encodeMesanimWithOpcodes(parsed.config, parsed.opcodes)
            : encodeMesanim(parsed.config);

        encodedFiles.set(id, encoded);
    }

    for (const fileId of fileIds) {
        if (!encodedFiles.has(fileId)) {
            encodedFiles.set(fileId, new Uint8Array([0x00]));
        }
    }

    const combined = combineGroupFiles(encodedFiles, fileIds);

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

            throw new Error('Exact mode mismatch: generated uncompressed payload differs from reference cache.');
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
