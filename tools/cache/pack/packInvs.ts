import fs from 'fs';
import path from 'path';

import InvType from '#/cache/config/InvType.js';
import { CompressionType } from '#/io/CompressionType.js';
import { unpackJs5Group } from '#/io/Js5Group.js';
import Environment from '#/util/Environment.js';
import { encodeInvWithOpcodes } from '#tools/cache/lib/invCodec.js';
import {
    arraysEqual,
    ensureDir,
    combineGroupFiles,
    compressJs5Group,
} from '#tools/cache/lib/js5Tools.js';
import { parseJs5ArchiveIndex } from '#/io/Js5ArchiveIndex.js';

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
    const lines = content.split('\n');

    let currentId = -1;
    let currentConfig: InvType | null = null;
    let currentOpcodes: OpcodeValue[] = [];

    const finalize = () => {
        if (currentConfig && currentId >= 0) {
            invs.set(currentId, {
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
                if (name.startsWith('inv_')) {
                    const num = parseInt(name.substring(4));
                    if (!isNaN(num)) {
                        id = num;
                    }
                }
            }

            if (id === undefined) {
                throw new Error(`Unknown inventory name: ${name}`);
            }

            currentId = id;
            currentConfig = new InvType(id);
            currentConfig.debugname = null;
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

        if (key === 'scope') {
            const scopeValue = parseInt(value);
            currentConfig.scope = scopeValue;
            currentOpcodes.push({ code: 1, value: scopeValue });
        } else if (key === 'size') {
            const sizeValue = parseInt(value);
            currentConfig.size = sizeValue;
            currentOpcodes.push({ code: 2, value: sizeValue });
        } else if (key === 'stackall') {
            currentConfig.stackall = value === 'yes' || value === 'true';
            if (currentConfig.stackall) {
                currentOpcodes.push({ code: 3 });
            }
        } else if (key === 'stock_add') {
            const parts = value.split(',');
            if (!currentConfig) continue;
            
            const obj = parseInt(parts[0]);
            const count = parseInt(parts[1]); 
            const rate = parseInt(parts[2]);

            if (!currentConfig.stockobj) {
                currentConfig.stockobj = new Uint16Array([obj]);
                currentConfig.stockcount = new Uint16Array([count]);
                currentConfig.stockrate = new Int32Array([rate]);
            } else {
                const newStockobj = new Uint16Array(currentConfig.stockobj!.length + 1);
                newStockobj.set(currentConfig.stockobj!);
                newStockobj[currentConfig.stockobj!.length] = obj;

                const newStockcount = new Uint16Array(currentConfig.stockcount!.length + 1);
                newStockcount.set(currentConfig.stockcount!);
                newStockcount[currentConfig.stockcount!.length] = count;

                const newStockrate = new Int32Array(currentConfig.stockrate!.length + 1);
                newStockrate.set(currentConfig.stockrate!);
                newStockrate[currentConfig.stockrate!.length] = rate;

                currentConfig.stockobj = newStockobj;
                currentConfig.stockcount = newStockcount;
                currentConfig.stockrate = newStockrate;
            }

            const stockItems = Array.from({ length: currentConfig.stockobj!.length }, (_, i) => ({
                obj: currentConfig!.stockobj![i],
                count: currentConfig!.stockcount![i],
                rate: currentConfig!.stockrate![i]
            }));
            const existingStockOpcode = currentOpcodes.find((op) => op.code === 4);
            if (existingStockOpcode) {
                existingStockOpcode.value = stockItems;
            } else {
                currentOpcodes.push({ code: 4, value: stockItems });
            }
        } else if (key === 'restock') {
            currentConfig.restock = value === 'yes' || value === 'true';
            if (currentConfig.restock) {
                currentOpcodes.push({ code: 5 });
            }
        } else if (key === 'allstock') {
            currentConfig.allstock = value === 'yes' || value === 'true';
            if (currentConfig.allstock) {
                currentOpcodes.push({ code: 6 });
            }
        } else if (key === 'protect') {
            currentConfig.protect = value === 'yes' || value === 'true';
            if (!currentConfig.protect) {
                currentOpcodes.push({ code: 7 });
            }
        } else if (key === 'runweight') {
            currentConfig.runweight = value === 'yes' || value === 'true';
            if (currentConfig.runweight) {
                currentOpcodes.push({ code: 8 });
            }
        } else if (key === 'dummyinv') {
            currentConfig.dummyinv = value === 'yes' || value === 'true';
            if (currentConfig.dummyinv) {
                currentOpcodes.push({ code: 9 });
            }
        } else if (key === 'debugname') {
            currentConfig.debugname = value;
            currentOpcodes.push({ code: 250, value });
        }
    }

    finalize();
    return invs;
}

async function main() {
    const args = parseArgs(process.argv.slice(2));

    if (!fs.existsSync(args.src)) {
        throw new Error(`Source file not found: ${args.src}`);
    }

    const { getGroup } = await import('#/util/OpenRS2.js');
    const indexData = await getGroup(255, args.index);
    const indexUnpacked = unpackJs5Group(new Uint8Array(indexData));
    const { fileIdsByGroup } = parseJs5ArchiveIndex(indexUnpacked);

    const currentGroupData = await getGroup(args.index, args.archive);
    const currentGroupUnpacked = unpackJs5Group(new Uint8Array(currentGroupData));

    const currentGroupFileIds = fileIdsByGroup.get(args.archive);
    if (!currentGroupFileIds) {
        throw new Error(`Group ${args.archive} not found in index ${args.index}`);
    }

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
        console.log('Generated group matches reference exactly');
    }

    const compressed = await compressJs5Group(combined, CompressionType.GZIP);
    const filename = `${args.archive}.dat`;
    const filepath = path.join(args.out, filename);

    ensureDir(args.out);
    if (fs.existsSync(filepath) && fs.statSync(filepath).isDirectory()) {
        fs.rmSync(filepath, { recursive: true, force: true });
    }
    fs.writeFileSync(filepath, compressed);

    console.log(`Packed ${sourceInvs.size} inventory configs to ${filepath}`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
