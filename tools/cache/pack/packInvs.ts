import fs from 'fs';
import path from 'path';

import InvType from '#/cache/config/InvType.js';
import { CompressionType } from '#/io/CompressionType.js';
import Environment from '#/util/Environment.js';
import {
    parseBracketedConfigSource,
    parseConfigBoolean,
    parseConfigInteger,
    resolveSectionId
} from '#tools/cache/lib/configSource.js';
import { encodeInvWithOpcodes } from '#tools/cache/lib/invCodec.js';
import {
    arraysEqual,
    ensureDir,
    loadArchiveGroupFiles,
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
        src: path.join(Environment.BUILD_SRC_DIR, 'scripts', '_unpack', '530', 'all.inv'),
        out: 'data/pack',
        index: 2,
        archive: 5,
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

type ParsedInvSource = {
    config: InvType;
    opcodes: OpcodeValue[];
};

function parseSourceInvs(content: string, nameToId: Map<string, number>): Map<number, ParsedInvSource> {
    const invs = new Map<number, ParsedInvSource>();
    const sections = parseBracketedConfigSource(content);

    for (const section of sections) {
        const id = resolveSectionId(section.name, nameToId, 'inv_');
        if (id === null) {
            throw new Error(`Unknown inventory name: ${section.name}`);
        }

        const config = new InvType(id);
        config.debugname = null;
        const opcodes: OpcodeValue[] = [];

        for (const field of section.fields) {
            const { key, value } = field;

            if (key === 'scope') {
                const scopeValue = parseConfigInteger(value);
                config.scope = scopeValue;
                opcodes.push({ code: 1, value: scopeValue });
            } else if (key === 'size') {
                const sizeValue = parseConfigInteger(value);
                config.size = sizeValue;
                opcodes.push({ code: 2, value: sizeValue });
            } else if (key === 'stackall') {
                config.stackall = parseConfigBoolean(value);
                if (config.stackall) {
                    opcodes.push({ code: 3 });
                }
            } else if (key === 'stock_add') {
                const parts = value.split(',');
                const obj = parseConfigInteger(parts[0]);
                const count = parseConfigInteger(parts[1]);
                const rate = parseConfigInteger(parts[2]);

                if (!config.stockobj) {
                    config.stockobj = new Uint16Array([obj]);
                    config.stockcount = new Uint16Array([count]);
                    config.stockrate = new Int32Array([rate]);
                } else {
                    const newStockobj = new Uint16Array(config.stockobj.length + 1);
                    newStockobj.set(config.stockobj);
                    newStockobj[config.stockobj.length] = obj;

                    const newStockcount = new Uint16Array(config.stockcount.length + 1);
                    newStockcount.set(config.stockcount);
                    newStockcount[config.stockcount.length] = count;

                    const newStockrate = new Int32Array(config.stockrate.length + 1);
                    newStockrate.set(config.stockrate);
                    newStockrate[config.stockrate.length] = rate;

                    config.stockobj = newStockobj;
                    config.stockcount = newStockcount;
                    config.stockrate = newStockrate;
                }

                const stockItems = Array.from({ length: config.stockobj!.length }, (_, i) => ({
                    obj: config.stockobj![i],
                    count: config.stockcount![i],
                    rate: config.stockrate![i]
                }));
                const existingStockOpcode = opcodes.find((op) => op.code === 4);
                if (existingStockOpcode) {
                    existingStockOpcode.value = stockItems;
                } else {
                    opcodes.push({ code: 4, value: stockItems });
                }
            } else if (key === 'restock') {
                config.restock = parseConfigBoolean(value);
                if (config.restock) {
                    opcodes.push({ code: 5 });
                }
            } else if (key === 'allstock') {
                config.allstock = parseConfigBoolean(value);
                if (config.allstock) {
                    opcodes.push({ code: 6 });
                }
            } else if (key === 'protect') {
                config.protect = parseConfigBoolean(value);
                if (!config.protect) {
                    opcodes.push({ code: 7 });
                }
            } else if (key === 'runweight') {
                config.runweight = parseConfigBoolean(value);
                if (config.runweight) {
                    opcodes.push({ code: 8 });
                }
            } else if (key === 'dummyinv') {
                config.dummyinv = parseConfigBoolean(value);
                if (config.dummyinv) {
                    opcodes.push({ code: 9 });
                }
            } else if (key === 'debugname') {
                config.debugname = value;
                opcodes.push({ code: 250, value });
            }
        }

        invs.set(id, { config, opcodes });
    }

    return invs;
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

    const sourceContent = fs.readFileSync(args.src, 'utf-8');

    const nameToId = new Map<string, number>();
    for (let i = 0; i < 10000; i++) {
        nameToId.set(`inv_${i}`, i);
    }

    const sourceInvs = parseSourceInvs(sourceContent, nameToId);

    const fileData = new Map<number, Uint8Array>();

    for (let id = 0; id < 10000; id++) {
        const sourceInv = sourceInvs.get(id);

        if (!sourceInv) {
            fileData.set(id, new Uint8Array(0));
            continue;
        }

        const encoded = encodeInvWithOpcodes(sourceInv.config, sourceInv.opcodes);
        fileData.set(id, encoded);
    }

    const combined = combineGroupFiles(fileData, currentGroupFileIds);

    if (args.exact) {
        const refGroupData = currentGroupUnpacked;

        if (!arraysEqual(combined, refGroupData)) {
            if (args.debug) {
                for (let i = 0; i < Math.min(combined.length, refGroupData.length); i++) {
                    if (combined[i] !== refGroupData[i]) {
                        console.error(`Mismatch at offset ${i}: generated=${combined[i]}, reference=${refGroupData[i]}`);
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

    console.log(`Packed ${sourceInvs.size} inventory configs`);
    console.log(`Wrote ${filepath}`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
