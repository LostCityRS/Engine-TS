import fs from 'fs';
import path from 'path';

import FloType from '#/cache/config/FloType.js';
import { CompressionType } from '#/io/CompressionType.js';
import { unpackJs5Group } from '#/io/Js5Group.js';
import {
    parseBracketedConfigSource,
    parseConfigBoolean,
    parseConfigInteger,
    resolveSectionId
} from '#tools/cache/lib/configSource.js';
import { encodeFlo, encodeFloWithOpcodes } from '#tools/cache/lib/floCodec.js';
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
    help: boolean;
};

function parseArgs(argv: string[]): Args {
    const args: Args = {
        src: 'data/src/all.flo',
        out: 'data/pack',
        index: 2,
        archive: 4,
        exact: false,
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

type ParsedFloSource = {
    config: FloType;
    opcodes: OpcodeValue[];
};

function parseSourceFlos(content: string, nameToId: Map<string, number>): Map<number, ParsedFloSource> {
    const flos = new Map<number, ParsedFloSource>();
    const sections = parseBracketedConfigSource(content);

    for (const section of sections) {
        const id = resolveSectionId(section.name, nameToId, 'flo_');
        if (id === null) {
            throw new Error(`Unknown floor overlay name: ${section.name}`);
        }

        const config = new FloType(id);
        config.debugname = nameToId.get(section.name) !== undefined ? section.name : null;
        const opcodes: OpcodeValue[] = [];

        for (const field of section.fields) {
            const { key, value } = field;

            if (key === 'overlay') {
                continue;
            }

            if (key === 'code8') {
                config.code8 = parseConfigBoolean(value);
                opcodes.push({ code: 8 });
            } else if (key === 'colour') {
                const colourValue = parseConfigInteger(value);
                config.colour = colourValue;
                opcodes.push({ code: 1, value: colourValue });
            } else if (key === 'texture') {
                const matValue = parseConfigInteger(value);
                config.material = matValue;
                opcodes.push({ code: 2, value: matValue });
            } else if (key === 'material') {
                const matValue = parseConfigInteger(value);
                config.material = matValue;
                opcodes.push({ code: 3, value: matValue });
            } else if (key === 'occlude') {
                config.occlude = parseConfigBoolean(value);
                opcodes.push({ code: 5 });
            } else if (key === 'averagecolour') {
                const avgColourValue = parseConfigInteger(value);
                config.averagecolour = avgColourValue;
                opcodes.push({ code: 7, value: avgColourValue });
            } else if (key === 'materialscale') {
                const scaleValue = parseConfigInteger(value);
                config.materialscale = scaleValue;
                opcodes.push({ code: 9, value: scaleValue });
            } else if (key === 'hardshadow') {
                config.hardshadow = parseConfigBoolean(value);
                if (!config.hardshadow) {
                    opcodes.push({ code: 10 });
                }
            } else if (key === 'priority') {
                const priorityValue = parseConfigInteger(value);
                config.priority = priorityValue;
                opcodes.push({ code: 11, value: priorityValue });
            } else if (key === 'blend') {
                config.blend = parseConfigBoolean(value);
                opcodes.push({ code: 12 });
            } else if (key === 'waterfogcolour') {
                const fogColourValue = parseConfigInteger(value);
                config.waterfogcolour = fogColourValue;
                opcodes.push({ code: 13, value: fogColourValue });
            } else if (key === 'waterfogscale') {
                const fogScaleValue = parseConfigInteger(value);
                config.waterfogscale = fogScaleValue;
                opcodes.push({ code: 14, value: fogScaleValue });
            }
        }

        flos.set(id, { config, opcodes });
    }

    return flos;
}

async function main() {
    const args = parseArgs(process.argv.slice(2));

    if (!fs.existsSync(args.src)) {
        throw new Error(`Source file not found: ${args.src}`);
    }

    const fileIds = await loadArchiveFileIds(args.index, args.archive, true);

    // Read pack file to resolve names
    const packPath = path.join(path.dirname(args.src), 'pack', 'flo.pack');
    const nameToId = parsePackFile(packPath);

    // Parse source floor overlays
    const content = fs.readFileSync(args.src, 'utf-8');
    const flos = parseSourceFlos(content, nameToId);

    // Encode floor overlays to binary
    const encodedFiles = new Map<number, Uint8Array>();
    let emptyCount = 0;
    let nonEmptyCount = 0;
    
    for (const [id, parsed] of flos) {
        const floConfig = parsed.config;
        
        // Use opcode-ordered encoding from source file order
        const encoded = parsed.opcodes.length > 0 
            ? encodeFloWithOpcodes(floConfig, parsed.opcodes)
            : encodeFlo(floConfig);
        
        encodedFiles.set(id, encoded);
        
        if (encoded.length === 1 && encoded[0] === 0) {
            emptyCount++;
        } else {
            nonEmptyCount++;
        }
    }
    
    console.log(`Encoded: ${emptyCount} empty, ${nonEmptyCount} non-empty`);

    const files = encodedFiles;

    // Build ordered file IDs list - only include files that were actually parsed
    const orderedFileIds = fileIds.filter(id => files.has(id));

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
            throw new Error(
                'Exact mode mismatch: generated uncompressed payload differs from reference cache.'
            );
        }

        fs.writeFileSync(groupPath, originalContainer);
    } else {
        // Determine compression type from original
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

main().catch(err => {
    console.error(err);
    process.exit(1);
});
