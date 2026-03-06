import fs from 'fs';
import path from 'path';

import ParamType from '#/cache/config/ParamType.js';
import ScriptVarType from '#/cache/config/ScriptVarType.js';
import StructType from '#/cache/config/StructType.js';
import { CompressionType } from '#/io/CompressionType.js';
import Packet from '#/io/Packet.js';
import Environment from '#/util/Environment.js';
import {
    parseBracketedConfigSource,
    parseConfigInteger,
    resolveSectionId
} from '#tools/cache/lib/configSource.js';
import {
    arraysEqual,
    ensureDir,
    combineGroupFiles,
    compressJs5Group,
    loadArchiveGroupFiles,
    parsePackFile
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
        src: path.join(Environment.BUILD_SRC_DIR, 'scripts', '_unpack', '530', 'all.struct'),
        out: 'data/pack',
        index: 2,
        archive: 26,
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

type StructParamEntry = {
    id: number;
    value: number | string;
};

type OpcodeValue =
    | { code: 249; value: StructParamEntry[] }
    | { code: 250; value: string };

type ParsedStructSource = {
    config: StructType;
    opcodes: OpcodeValue[];
};

function parseParamId(token: string, nameToId: Map<string, number>): number {
    const mapped = nameToId.get(token);
    if (mapped !== undefined) {
        return mapped;
    }

    if (token.startsWith('param_')) {
        const parsed = parseInt(token.substring(6));
        if (!isNaN(parsed)) {
            return parsed;
        }
    }

    throw new Error(`Unknown param name: ${token}`);
}

function parseSourceStructs(
    content: string,
    structNameToId: Map<string, number>,
    paramNameToId: Map<string, number>,
    paramIdToType: Map<number, number>
): Map<number, ParsedStructSource> {
    const structs = new Map<number, ParsedStructSource>();
    const sections = parseBracketedConfigSource(content);

    for (const section of sections) {
        const id = resolveSectionId(section.name, structNameToId, 'struct_');
        if (id === null) {
            throw new Error(`Unknown struct name: ${section.name}`);
        }

        const config = new StructType(id);
        config.params = new Map();
        config.debugname = null;
        const opcodes: OpcodeValue[] = [];
        let paramsOpcode: OpcodeValue | null = null;

        for (const field of section.fields) {
            const { key, value } = field;

            if (key === 'param' || key === 'paramstr') {
                const commaIndex = value.indexOf(',');
                if (commaIndex === -1) {
                    continue;
                }

                const paramName = value.substring(0, commaIndex).trim();
                const rawValue = value.substring(commaIndex + 1);
                const paramId = parseParamId(paramName, paramNameToId);
                const paramType = paramIdToType.get(paramId);

                if (paramType === undefined) {
                    throw new Error(`No ParamType definition found for param id ${paramId} (${paramName})`);
                }

                const parsedValue: number | string = paramType === ScriptVarType.STRING
                    ? rawValue
                    : parseConfigInteger(rawValue.trim());

                config.params.set(paramId, parsedValue);

                if (!paramsOpcode) {
                    paramsOpcode = { code: 249, value: [] };
                    opcodes.push(paramsOpcode);
                }
                paramsOpcode.value.push({ id: paramId, value: parsedValue });
            } else if (key === 'debugname') {
                config.debugname = value;
                opcodes.push({ code: 250, value });
            }
        }

        structs.set(id, { config, opcodes });
    }

    return structs;
}

function parseParamTypesFromGroup(fileIds: number[], files: Map<number, Uint8Array>): Map<number, number> {
    const typeMap = new Map<number, number>();

    for (const fileId of fileIds) {
        const fileData = files.get(fileId) ?? new Uint8Array(0);
        const param = new ParamType(fileId);

        if (fileData.length > 0) {
            const dat = new Packet(fileData);

            while (dat.available > 0) {
                const code = dat.g1();
                if (code === 0) {
                    break;
                }
                param.decode(code, dat);
            }
        }

        typeMap.set(fileId, param.type);
    }

    return typeMap;
}

function encodeStructWithOpcodes(opcodes: OpcodeValue[]): Uint8Array {
    const buf = Packet.alloc(2);

    for (const opc of opcodes) {
        if (opc.code === 249) {
            buf.p1(249);
            buf.p1(opc.value.length);

            for (const entry of opc.value) {
                const isString = typeof entry.value === 'string';
                buf.p1(isString ? 1 : 0);
                buf.p3(entry.id);

                if (isString) {
                    buf.pjstr(entry.value as string);
                } else {
                    buf.p4(entry.value as number);
                }
            }
        } else if (opc.code === 250) {
            buf.p1(250);
            buf.pjstr(opc.value);
        }
    }

    buf.p1(0);
    return new Uint8Array(buf.data.subarray(0, buf.pos));
}

async function main() {
    const args = parseArgs(process.argv.slice(2));

    if (!fs.existsSync(args.src)) {
        throw new Error(`Source file not found: ${args.src}`);
    }

    const {
        fileIds: currentGroupFileIds,
        groupUnpacked: currentGroupUnpacked
    } = await loadArchiveGroupFiles(args.index, args.archive, 'data/cache', true);

    const {
        fileIds: paramFileIds,
        files: paramFiles
    } = await loadArchiveGroupFiles(2, 11, 'data/cache', true);

    const paramIdToType = parseParamTypesFromGroup(paramFileIds, paramFiles);

    const localPackDir = path.join(path.dirname(args.src), 'pack');
    const fallbackPackDir = path.join(Environment.BUILD_SRC_DIR, 'pack');

    const structLocalPackPath = path.join(localPackDir, 'struct.pack');
    const structFallbackPackPath = path.join(fallbackPackDir, 'struct.pack');
    const paramLocalPackPath = path.join(localPackDir, 'param.pack');
    const paramFallbackPackPath = path.join(fallbackPackDir, 'param.pack');

    const structNameToId = fs.existsSync(structLocalPackPath)
        ? parsePackFile(structLocalPackPath)
        : parsePackFile(structFallbackPackPath);

    const paramNameToId = fs.existsSync(paramLocalPackPath)
        ? parsePackFile(paramLocalPackPath)
        : parsePackFile(paramFallbackPackPath);

    const sourceContent = fs.readFileSync(args.src, 'utf-8');
    const sourceStructs = parseSourceStructs(sourceContent, structNameToId, paramNameToId, paramIdToType);

    const fileData = new Map<number, Uint8Array>();
    for (const fileId of currentGroupFileIds) {
        const sourceStruct = sourceStructs.get(fileId);
        if (!sourceStruct) {
            fileData.set(fileId, new Uint8Array(0));
            continue;
        }

        const encoded = encodeStructWithOpcodes(sourceStruct.opcodes);
        fileData.set(fileId, encoded);
    }

    const combined = combineGroupFiles(fileData, currentGroupFileIds);

    if (args.exact) {
        if (!arraysEqual(combined, currentGroupUnpacked)) {
            if (args.debug) {
                for (let i = 0; i < Math.min(combined.length, currentGroupUnpacked.length); i++) {
                    if (combined[i] !== currentGroupUnpacked[i]) {
                        console.error(`Mismatch at offset ${i}: generated=${combined[i]}, reference=${currentGroupUnpacked[i]}`);
                        break;
                    }
                }
            }

            throw new Error('Generated group does not match reference');
        }
    }

    const compressed = await compressJs5Group(combined, CompressionType.GZIP);
    const filename = `${args.archive}.dat`;
    const filepath = path.join(args.out, filename);

    ensureDir(args.out);
    if (fs.existsSync(filepath) && fs.statSync(filepath).isDirectory()) {
        fs.rmSync(filepath, { recursive: true, force: true });
    }

    fs.writeFileSync(filepath, compressed);

    console.log(`Packed ${sourceStructs.size} struct configs`);
    console.log(`Wrote ${filepath}`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
