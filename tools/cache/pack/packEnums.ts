import fs from 'fs';
import path from 'path';

import EnumType from '#/cache/config/EnumType.js';
import ScriptVarType from '#/cache/config/ScriptVarType.js';
import { CompressionType } from '#/io/CompressionType.js';
import Packet from '#/io/Packet.js';
import { unpackJs5Group } from '#/io/Js5Group.js';
import Environment from '#/util/Environment.js';
import { parseBracketedConfigSource } from '#tools/cache/lib/configSource.js';
import { encodeEnum } from '#tools/cache/lib/enumCodec.js';
import { getMidiId, hasMidiId } from '#tools/pack/packs/MidiPack.js';
import {
    arraysEqual,
    ensureDir,
    parsePackFile,
    combineGroupFiles,
    compressJs5Group,
    parseGroupIdsFromIndexPacked,
    writeInt32BE,
    type Js5ArchiveIndex as _Js5ArchiveIndex,
    loadReferenceArchiveIndex
} from '#tools/cache/lib/js5Tools.js';

type Args = {
    src: string;
    out: string;
    archive: number;
    mode: 'server' | 'client';
    exact: boolean;
    help: boolean;
};

type EnumPairInt = {
    key: number;
    value: number;
};

type EnumPairString = {
    key: number;
    value: string;
};

type EnumEncodeOp =
    | { code: 1; value: number }
    | { code: 2; value: number }
    | { code: 3; value: string }
    | { code: 4; value: number }
    | { code: 5; values: EnumPairString[] }
    | { code: 6; values: EnumPairInt[] }
    | { code: 250; value: string };

type ParsedEnumSource = {
    config: EnumType;
    ops: EnumEncodeOp[];
    transmit: boolean;
};

function parseArgs(argv: string[]): Args {
    const args: Args = {
        src: path.join(Environment.BUILD_SRC_DIR, 'scripts', '_unpack', '530', 'all.enum'),
        out: 'data/pack',
        archive: 17,
        mode: 'server',
        exact: false,
        help: false
    };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];

        if (arg === '--src') {
            args.src = argv[++i];
        } else if (arg === '--out') {
            args.out = argv[++i];
        } else if (arg === '--archive') {
            args.archive = Number(argv[++i]);
        } else if (arg === '--mode') {
            const mode = argv[++i];
            if (mode === 'server' || mode === 'client') {
                args.mode = mode;
            }
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

function parseSourceTypeName(typeName: string): number {
    // Check for unknown_<code> format
    if (typeName.startsWith('unknown_')) {
        const code = parseInt(typeName.substring(8));
        if (!isNaN(code)) {
            return code;
        }
    }

    // Use ScriptVarType.getTypeChar for standard type names
    const typeCode = ScriptVarType.getTypeChar(typeName);
    return typeCode ?? ScriptVarType.INT;
}

function parseSourceScalar(value: string, type: number, sourceContext?: string): number | string {
    // Handle null
    if (value === 'null') {
        if (type === ScriptVarType.STRING) {
            return '';
        }
        return -1;
    }

    // Handle booleans
    if (type === ScriptVarType.BOOLEAN) {
        if (value === '^true') {
            return 1;
        }
        if (value === '^false') {
            return 0;
        }
    }

    // Handle strings
    if (type === ScriptVarType.STRING) {
        return value;
    }

    if (type === ScriptVarType.MIDI) {
        const trimmed = value.trim();

        const namedId = getMidiId(trimmed);
        if (namedId !== -1) {
            return namedId;
        }

        const numeric = parseInt(trimmed, 10);
        if (!isNaN(numeric) && String(numeric) === trimmed && hasMidiId(numeric)) {
            return numeric;
        }

        throw new Error(`Unknown midi value '${trimmed}'${sourceContext ? ` at ${sourceContext}` : ''}. It must exist in midi.pack.`);
    }

    // Handle numbers (including hex)
    if (value.startsWith('0x')) {
        const parsed = parseInt(value, 16);
        return isNaN(parsed) ? 0 : parsed;
    }

    const parsed = parseInt(value);
    return isNaN(parsed) ? 0 : parsed;
}

function parseSourceEnums(content: string, nameToId: Map<string, number>): Map<number, ParsedEnumSource> {
    const enums = new Map<number, ParsedEnumSource>();
    const sections = parseBracketedConfigSource(content);

    for (const section of sections) {
        // Resolve enum ID from section name
        let enumId = nameToId.get(section.name);
        if (enumId === undefined && section.name.startsWith('enum_')) {
            enumId = parseInt(section.name.substring(5));
        }

        if (enumId === undefined || isNaN(enumId)) {
            continue;
        }

        const currentEnum = new EnumType(enumId);
        const currentOps: EnumEncodeOp[] = [];
        let transmit = false;
        let pendingValuesBlock: { code: 5 | 6; remaining: number } | null = null;

        // Store debugname if it's not the default enum_<id> format
        if (!section.name.startsWith('enum_')) {
            currentEnum.debugname = section.name;
        }

        // Process fields
        for (const field of section.fields) {
            const { key, value } = field;

            if (key === 'inputtype') {
                const parsed = parseSourceTypeName(value);
                currentEnum.inputtype = parsed;
                currentOps.push({ code: 1, value: parsed });
            } else if (key === 'outputtype') {
                const parsed = parseSourceTypeName(value);
                currentEnum.outputtype = parsed;
                currentOps.push({ code: 2, value: parsed });
            } else if (key === 'debugname') {
                currentEnum.debugname = value;
                currentOps.push({ code: 250, value });
            } else if (key === 'transmit') {
                const parsed = value.trim().toLowerCase();
                transmit = parsed === 'yes' || parsed === 'true' || parsed === '1';
            } else if (key === 'default' || key === 'default@3' || key === 'default@4') {
                // Check for explicit flag (! suffix)
                const isExplicit = value.endsWith('!');
                const cleanValue = isExplicit ? value.slice(0, -1) : value;
                const opCode = key === 'default@3' ? 3 : key === 'default@4' ? 4 : (currentEnum.outputtype === ScriptVarType.STRING ? 3 : 4);

                if (opCode === 3) {
                    currentEnum.defaultString = cleanValue;
                    if (isExplicit) {
                        currentEnum.hasExplicitDefaultString = true;
                    }
                    currentOps.push({ code: 3, value: cleanValue });
                } else {
                    currentEnum.defaultInt = Number(parseSourceScalar(cleanValue, currentEnum.outputtype, `${section.name}:${field.line}`));
                    if (isExplicit) {
                        currentEnum.hasExplicitDefaultInt = true;
                    }
                    currentOps.push({ code: 4, value: currentEnum.defaultInt });
                }
                pendingValuesBlock = null;
            } else if (key === 'values@5' || key === 'values@6') {
                const count = Number(value);
                const code: 5 | 6 = key === 'values@5' ? 5 : 6;
                currentOps.push(code === 5 ? { code: 5, values: [] } : { code: 6, values: [] });
                pendingValuesBlock = { code, remaining: Number.isFinite(count) && count > 0 ? count : 0 };
            } else if (key === 'val' || key === 'val@5' || key === 'val@6') {
                const commaIndex = value.indexOf(',');
                if (commaIndex === -1) {
                    continue;
                }

                const keyPart = value.substring(0, commaIndex).trim();
                const valuePart = value.substring(commaIndex + 1);

                const parsedKey = Number(parseSourceScalar(keyPart, currentEnum.inputtype, `${section.name}:${field.line}`));
                const opCode: 5 | 6 = key === 'val@5' ? 5 : key === 'val@6' ? 6 : (currentEnum.outputtype === ScriptVarType.STRING ? 5 : 6);

                if (opCode === 5) {
                    const parsedValue = valuePart;
                    currentEnum.values.set(parsedKey, parsedValue);

                    const lastOp = currentOps[currentOps.length - 1];
                    if (lastOp?.code === 5 && (!pendingValuesBlock || pendingValuesBlock.code === 5)) {
                        lastOp.values.push({ key: parsedKey, value: parsedValue });
                    } else {
                        currentOps.push({ code: 5, values: [{ key: parsedKey, value: parsedValue }] });
                    }
                } else {
                    const parsedValue = Number(parseSourceScalar(valuePart, currentEnum.outputtype, `${section.name}:${field.line}`));
                    currentEnum.values.set(parsedKey, parsedValue);

                    const lastOp = currentOps[currentOps.length - 1];
                    if (lastOp?.code === 6 && (!pendingValuesBlock || pendingValuesBlock.code === 6)) {
                        lastOp.values.push({ key: parsedKey, value: parsedValue });
                    } else {
                        currentOps.push({ code: 6, values: [{ key: parsedKey, value: parsedValue }] });
                    }
                }

                if (pendingValuesBlock && pendingValuesBlock.code === opCode) {
                    pendingValuesBlock.remaining -= 1;
                    if (pendingValuesBlock.remaining <= 0) {
                        pendingValuesBlock = null;
                    }
                }
            } else {
                pendingValuesBlock = null;
            }
        }

        enums.set(enumId, { config: currentEnum, ops: currentOps, transmit });
    }

    return enums;
}

function encodeFromOps(ops: EnumEncodeOp[]): Uint8Array {
    const buf = Packet.alloc(2);

    for (const op of ops) {
        if (op.code === 1) {
            buf.p1(1);
            buf.p1(op.value);
        } else if (op.code === 2) {
            buf.p1(2);
            buf.p1(op.value);
        } else if (op.code === 3) {
            buf.p1(3);
            buf.pjstr(op.value);
        } else if (op.code === 4) {
            buf.p1(4);
            buf.p4(op.value);
        } else if (op.code === 5) {
            buf.p1(5);
            buf.p2(op.values.length);
            for (const pair of op.values) {
                buf.p4(pair.key);
                buf.pjstr(pair.value);
            }
        } else if (op.code === 6) {
            buf.p1(6);
            buf.p2(op.values.length);
            for (const pair of op.values) {
                buf.p4(pair.key);
                buf.p4(pair.value);
            }
        } else if (op.code === 250) {
            buf.p1(250);
            buf.pjstr(op.value);
        }
    }

    buf.p1(0);
    return new Uint8Array(buf.data.subarray(0, buf.pos));
}

async function main() {
    const args = parseArgs(process.argv.slice(2));

    if (args.mode === 'client' && args.exact) {
        throw new Error('Client mode intentionally empties non-transmit enums, so --exact is not valid. Use --no-exact.');
    }

    if (!fs.existsSync(args.src)) {
        throw new Error(`Source file not found: ${args.src}`);
    }

    // Read pack files to resolve names (prefer source-adjacent pack/, fallback to BUILD_SRC_DIR/pack)
    const localPackDir = path.join(path.dirname(args.src), 'pack');
    const fallbackPackDir = path.join(Environment.BUILD_SRC_DIR, 'pack');

    const enumLocalPackPath = path.join(localPackDir, 'enum.pack');
    const enumFallbackPackPath = path.join(fallbackPackDir, 'enum.pack');
    const nameToId = fs.existsSync(enumLocalPackPath) ? parsePackFile(enumLocalPackPath) : parsePackFile(enumFallbackPackPath);

    // Parse source enums
    const content = fs.readFileSync(args.src, 'utf-8');
    const enums = parseSourceEnums(content, nameToId);
    const transmitCount = Array.from(enums.values()).filter(parsed => parsed.transmit).length;

    if (args.mode === 'client' && transmitCount === 0) {
        console.log('Client mode: no transmit=yes directives found; all enums will be filtered to empty');
    }

    // Encode enums to binary
    const encodedFiles = new Map<number, Uint8Array>();
    let _emptyCount = 0;
    let _filteredCount = 0;
    let _nonEmptyCount = 0;
    
    for (const [id, parsed] of enums) {
        const enumConfig = parsed.config;
        // Check if this is an empty enum
        const isEmpty = enumConfig.values.size === 0 &&
                       enumConfig.inputtype === ScriptVarType.INT &&
                       enumConfig.outputtype === ScriptVarType.INT &&
                       enumConfig.defaultInt === 0 &&
                       enumConfig.defaultString === 'null' &&
                       !enumConfig.debugname &&
                       !enumConfig.hasExplicitDefaultInt &&
                       !enumConfig.hasExplicitDefaultString;
        
        const shouldPack = args.mode === 'server' || parsed.transmit;

        if (!shouldPack) {
            encodedFiles.set(id, new Uint8Array([0x00]));
            _filteredCount++;
            continue;
        }

        if (parsed.ops.length > 0) {
            encodedFiles.set(id, encodeFromOps(parsed.ops));
            _nonEmptyCount++;
        } else if (isEmpty) {
            // Empty enum - encode as single terminator byte
            encodedFiles.set(id, new Uint8Array([0x00]));
            _emptyCount++;
        } else {
            encodedFiles.set(id, encodeEnum(enumConfig));
            _nonEmptyCount++;
        }
    }

    // Group by (id >> 8)
    const groups = new Map<number, Map<number, Uint8Array>>();
    for (const [id, data] of encodedFiles) {
        const groupId = id >> 8;
        const fileId = id & 0xff;

        if (!groups.has(groupId)) {
            groups.set(groupId, new Map());
        }

        groups.get(groupId)!.set(fileId, data);
    }

    const referenceIndex = loadReferenceArchiveIndex(args.archive);
    const groupFileOrders = new Map<number, number[]>();

    for (const [groupId, files] of groups) {
        const referenceFileIds = referenceIndex?.fileIdsByGroup.get(groupId);
        if (referenceFileIds && referenceFileIds.length > 0) {
            groupFileOrders.set(groupId, referenceFileIds);
            for (const fileId of referenceFileIds) {
                if (!files.has(fileId)) {
                    files.set(fileId, new Uint8Array([0x00]));
                }
            }
        } else {
            const fallbackIds: number[] = new Array(256);
            for (let i = 0; i < 256; i++) {
                fallbackIds[i] = i;
            }
            groupFileOrders.set(groupId, fallbackIds);
            for (const fileId of fallbackIds) {
                if (!files.has(fileId)) {
                    files.set(fileId, new Uint8Array([0x00]));
                }
            }
        }
    }

    // Pack and compress each group into memory
    ensureDir(args.out);

    // Determine compression type by reading original groups from cache
    const compressionTypes = new Map<number, number>();
    for (const groupId of groups.keys()) {
        const origPath = `data/cache/${args.archive}/${groupId}.dat`;
        if (fs.existsSync(origPath)) {
            const origData = fs.readFileSync(origPath);
            compressionTypes.set(groupId, origData[0]);
        } else {
            // Default to GZIP if no original exists
            compressionTypes.set(groupId, CompressionType.GZIP);
        }
    }

    // Build group buffers in memory
    const compressedGroups = new Map<number, Uint8Array>();

    for (const [groupId, files] of groups) {
        const orderedFileIds = groupFileOrders.get(groupId);
        if (!orderedFileIds || orderedFileIds.length === 0) {
            throw new Error(`No file order available for group ${groupId}`);
        }

        const combined = combineGroupFiles(files, orderedFileIds);
        const origPath = `data/cache/${args.archive}/${groupId}.dat`;

        if (args.exact) {
            if (!fs.existsSync(origPath)) {
                throw new Error(`Exact mode requires reference cache group: ${origPath}`);
            }

            const originalContainer = new Uint8Array(fs.readFileSync(origPath));
            const originalUncompressed = unpackJs5Group(originalContainer);

            if (!arraysEqual(originalUncompressed, combined)) {
                throw new Error(
                    `Exact mode mismatch for group ${groupId}: generated uncompressed payload differs from reference cache.`
                );
            }

            compressedGroups.set(groupId, originalContainer);
            continue;
        }

        const compressionType = compressionTypes.get(groupId) ?? CompressionType.GZIP;
        const compressed = await compressJs5Group(combined, compressionType);
        compressedGroups.set(groupId, compressed);
    }

    // Load index to get group order
    const indexPath = `data/cache/255/${args.archive}.dat`;
    if (!fs.existsSync(indexPath)) {
        throw new Error(`Index file not found: ${indexPath}`);
    }

    const indexPacked = new Uint8Array(fs.readFileSync(indexPath));
    const groupIds = parseGroupIdsFromIndexPacked(indexPacked);

    // Build group buffers and length table in proper order
    const groupBuffers: Uint8Array[] = new Array(groupIds.length);
    const groupLengths: number[] = new Array(groupIds.length).fill(0);

    for (let i = 0; i < groupIds.length; i++) {
        const groupId = groupIds[i];
        const compressed = compressedGroups.get(groupId);

        if (!compressed || compressed.length === 0) {
            groupBuffers[i] = new Uint8Array(0);
            continue;
        }

        groupBuffers[i] = compressed;
        groupLengths[i] = compressed.length;
    }

    // Build length table
    const lengthTable = new Uint8Array(groupIds.length * 4);
    for (let i = 0; i < groupLengths.length; i++) {
        writeInt32BE(groupLengths[i], lengthTable, i * 4);
    }

    // Build final JS5 archive
    const totalGroupBytes = groupLengths.reduce((sum, length) => sum + length, 0);
    const totalSize = indexPacked.length + totalGroupBytes + lengthTable.length;
    const output = new Uint8Array(totalSize);

    let pos = 0;
    output.set(indexPacked, pos);
    pos += indexPacked.length;

    for (const group of groupBuffers) {
        if (group.length === 0) {
            continue;
        }
        output.set(group, pos);
        pos += group.length;
    }

    output.set(lengthTable, pos);

    // Write to appropriate .js5 file
    const modeDir = path.join(args.out, args.mode);
    ensureDir(modeDir);
    const outPath = path.join(modeDir, `${args.mode}.enum.config.js5`);

    fs.writeFileSync(outPath, output);

    console.log(`Wrote ${outPath}`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
