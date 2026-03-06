import fs from 'fs';
import path from 'path';

import ParamType from '#/cache/config/ParamType.js';
import ScriptVarType from '#/cache/config/ScriptVarType.js';
import { CompressionType } from '#/io/CompressionType.js';
import Packet from '#/io/Packet.js';
import Environment from '#/util/Environment.js';
import {
    parseBracketedConfigSource,
    parseConfigBoolean,
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
        src: path.join(Environment.BUILD_SRC_DIR, 'scripts', '_unpack', '530', 'all.param'),
        out: 'data/pack',
        index: 2,
        archive: 11,
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

type ParsedParamSource = {
    config: ParamType;
    opcodes: OpcodeValue[];
};

function parseSourceTypeName(typeName: string): number {
    if (typeName.startsWith('unknown_')) {
        const code = parseInt(typeName.substring(8));
        if (!isNaN(code)) {
            return code;
        }
    }

    const typeCode = ScriptVarType.getTypeChar(typeName);
    return typeCode ?? ScriptVarType.INT;
}

function parseDefaultIntByType(value: string, type: number, structNameToId: Map<string, number>): number {
    if (type === ScriptVarType.STRUCT) {
        const structId = resolveSectionId(value, structNameToId, 'struct_');
        if (structId === null) {
            throw new Error(`Unknown struct default: ${value}`);
        }
        return structId;
    }

    return parseConfigInteger(value);
}

function parseSourceParams(content: string, nameToId: Map<string, number>, structNameToId: Map<string, number>): Map<number, ParsedParamSource> {
    const params = new Map<number, ParsedParamSource>();
    const sections = parseBracketedConfigSource(content);

    for (const section of sections) {
        const id = resolveSectionId(section.name, nameToId, 'param_');
        if (id === null) {
            throw new Error(`Unknown param name: ${section.name}`);
        }

        const config = new ParamType(id);
        config.debugname = null;
        const opcodes: OpcodeValue[] = [];
        const deferredDefaults: Array<{ index: number; value: string }> = [];

        for (const field of section.fields) {
            const { key, value } = field;

            if (key === 'type') {
                const typeValue = parseSourceTypeName(value);
                config.type = typeValue;
                opcodes.push({ code: 1, value: typeValue });
            } else if (key === 'default') {
                opcodes.push({ code: -1, value });
                deferredDefaults.push({ index: opcodes.length - 1, value });
            } else if (key === 'defaultint') {
                const defaultInt = parseConfigInteger(value);
                config.defaultInt = defaultInt;
                opcodes.push({ code: 2, value: defaultInt });
            } else if (key === 'autodisable') {
                config.autodisable = parseConfigBoolean(value);
                if (!config.autodisable) {
                    opcodes.push({ code: 4 });
                }
            } else if (key === 'defaultstr') {
                config.defaultString = value;
                opcodes.push({ code: 5, value });
            } else if (key === 'debugname') {
                config.debugname = value;
                opcodes.push({ code: 250, value });
            }
        }

        for (const deferred of deferredDefaults) {
            if (config.type === ScriptVarType.STRING) {
                config.defaultString = deferred.value;
                opcodes[deferred.index] = { code: 5, value: deferred.value };
            } else {
                const defaultInt = parseDefaultIntByType(deferred.value, config.type, structNameToId);
                config.defaultInt = defaultInt;
                opcodes[deferred.index] = { code: 2, value: defaultInt };
            }
        }

        params.set(id, { config, opcodes });
    }

    return params;
}

function encodeParamWithOpcodes(config: ParamType, opcodes: OpcodeValue[]): Uint8Array {
    const buf = Packet.alloc(2);

    for (const opc of opcodes) {
        if (opc.code === 1) {
            buf.p1(1);
            buf.p1(config.type);
        } else if (opc.code === 2) {
            buf.p1(2);
            buf.p4(config.defaultInt);
        } else if (opc.code === 4) {
            buf.p1(4);
        } else if (opc.code === 5) {
            buf.p1(5);
            buf.pjstr(String(opc.value ?? ''));
        } else if (opc.code === 250) {
            buf.p1(250);
            buf.pjstr(String(opc.value ?? ''));
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

    const localPackDir = path.join(path.dirname(args.src), 'pack');
    const fallbackPackDir = path.join(Environment.BUILD_SRC_DIR, 'pack');
    const localPackPath = path.join(localPackDir, 'param.pack');
    const fallbackPackPath = path.join(fallbackPackDir, 'param.pack');
    const localStructPackPath = path.join(localPackDir, 'struct.pack');
    const fallbackStructPackPath = path.join(fallbackPackDir, 'struct.pack');

    const nameToId = fs.existsSync(localPackPath) ? parsePackFile(localPackPath) : parsePackFile(fallbackPackPath);
    const structNameToId = fs.existsSync(localStructPackPath)
        ? parsePackFile(localStructPackPath)
        : parsePackFile(fallbackStructPackPath);

    const sourceContent = fs.readFileSync(args.src, 'utf-8');
    const sourceParams = parseSourceParams(sourceContent, nameToId, structNameToId);

    const fileData = new Map<number, Uint8Array>();
    for (const fileId of currentGroupFileIds) {
        const sourceParam = sourceParams.get(fileId);
        if (!sourceParam) {
            fileData.set(fileId, new Uint8Array(0));
            continue;
        }

        const encoded = encodeParamWithOpcodes(sourceParam.config, sourceParam.opcodes);
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

    console.log(`Packed ${sourceParams.size} param configs`);
    console.log(`Wrote ${filepath}`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
