import fs from 'fs';
import path from 'path';

import FloType from '#/cache/config/FloType.js';
import { CompressionType } from '#/io/CompressionType.js';
import Packet from '#/io/Packet.js';
import { unpackJs5Group } from '#/io/Js5Group.js';
import { encodeFlo, encodeFloWithOpcodes } from '#tools/cache/lib/floCodec.js';
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
    const lines = content.split('\n');

    let currentId = -1;
    let currentConfig: FloType | null = null;
    let currentOpcodes: OpcodeValue[] = [];

    const finalize = () => {
        if (currentConfig && currentId >= 0) {
            flos.set(currentId, {
                config: currentConfig,
                opcodes: currentOpcodes
            });
        }
    };

    for (const rawLine of lines) {
        const line = rawLine.trim();

        // Skip empty lines and comments
        if (line.length === 0 || line.startsWith('//')) {
            continue;
        }

        // Section header: [flo_name] or [flo_123]
        if (line.startsWith('[') && line.endsWith(']')) {
            finalize();

            const name = line.substring(1, line.length - 1);
            let id = nameToId.get(name);

            if (id === undefined) {
                // Try to parse as flo_<id>
                if (name.startsWith('flo_')) {
                    const num = parseInt(name.substring(4));
                    if (!isNaN(num)) {
                        id = num;
                    }
                }
            }

            if (id === undefined) {
                throw new Error(`Unknown floor overlay name: ${name}`);
            }

            currentId = id;
            currentConfig = new FloType(id);
            currentConfig.debugname = nameToId.get(name) !== undefined ? name : null;
            currentOpcodes = [];
            continue;
        }

        if (!currentConfig) {
            continue;
        }

        // Property line: key=value
        const eq = line.indexOf('=');
        if (eq === -1) {
            continue;
        }

        const key = line.substring(0, eq).trim();
        const value = line.substring(eq + 1).trim();

        if (key === 'overlay') {
            // overlay is now deprecated/removed, skip
        } else if (key === 'code8') {
            currentConfig.code8 = value === 'yes' || value === 'true';
            currentOpcodes.push({ code: 8 });
        } else if (key === 'colour') {
            const colourValue = value.startsWith('0x') ? parseInt(value, 16) : parseInt(value);
            currentConfig.colour = colourValue;
            currentOpcodes.push({ code: 1, value: colourValue });
        } else if (key === 'texture') {
            const matValue = parseInt(value);
            currentConfig.material = matValue;
            currentOpcodes.push({ code: 2, value: matValue });
        } else if (key === 'material') {
            const matValue = parseInt(value);
            currentConfig.material = matValue;
            currentOpcodes.push({ code: 3, value: matValue });
        } else if (key === 'occlude') {
            currentConfig.occlude = value === 'yes' || value === 'true';
            currentOpcodes.push({ code: 5 });
        } else if (key === 'averagecolour') {
            const avgColourValue = value.startsWith('0x') ? parseInt(value, 16) : parseInt(value);
            currentConfig.averagecolour = avgColourValue;
            currentOpcodes.push({ code: 7, value: avgColourValue });
        } else if (key === 'materialscale') {
            const scaleValue = parseInt(value);
            currentConfig.materialscale = scaleValue;
            currentOpcodes.push({ code: 9, value: scaleValue });
        } else if (key === 'hardshadow') {
            currentConfig.hardshadow = value === 'yes' || value === 'true';
            if (!currentConfig.hardshadow) {
                currentOpcodes.push({ code: 10 });
            }
        } else if (key === 'priority') {
            const priorityValue = parseInt(value);
            currentConfig.priority = priorityValue;
            currentOpcodes.push({ code: 11, value: priorityValue });
        } else if (key === 'blend') {
            currentConfig.blend = value === 'yes' || value === 'true';
            currentOpcodes.push({ code: 12 });
        } else if (key === 'waterfogcolour') {
            const fogColourValue = value.startsWith('0x') ? parseInt(value, 16) : parseInt(value);
            currentConfig.waterfogcolour = fogColourValue;
            currentOpcodes.push({ code: 13, value: fogColourValue });
        } else if (key === 'waterfogscale') {
            const fogScaleValue = parseInt(value);
            currentConfig.waterfogscale = fogScaleValue;
            currentOpcodes.push({ code: 14, value: fogScaleValue });
        }
    }

    finalize();
    return flos;
}

async function main() {
    const args = parseArgs(process.argv.slice(2));

    if (!fs.existsSync(args.src)) {
        throw new Error(`Source file not found: ${args.src}`);
    }

    // Get file IDs from the index
    const { getGroup } = await import('#/util/OpenRS2.js');
    const indexData = await getGroup(255, args.index);
    const indexUnpacked = unpackJs5Group(new Uint8Array(indexData));
    const indexPacket = new Packet(indexUnpacked);

    const format = indexPacket.g1();
    if (format >= 6) {
        indexPacket.g4s(); // version
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

    // Skip to file counts
    if ((flags & 0x1) !== 0) {
        for (let i = 0; i < groupCount; i++) {
            indexPacket.g4s(); // skip names
        }
    }
    for (let i = 0; i < groupCount; i++) {
        indexPacket.g4s(); // skip CRCs
    }
    for (let i = 0; i < groupCount; i++) {
        indexPacket.g4s(); // skip versions
    }

    const fileCounts: number[] = new Array(groupCount);
    for (let i = 0; i < groupCount; i++) {
        fileCounts[i] = readJs5Id(indexPacket, format);
    }

    // Get file IDs for this archive
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
