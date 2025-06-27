import fs from 'fs';

import FileStream from '#/io/FileStream.js';
import Jagfile from '#/io/Jagfile.js';
import Packet from '#/io/Packet.js';
import { printFatalError, printInfo } from '#/util/Logger.js';
import { LocPack, NpcPack, ObjPack, SeqPack } from '#/util/PackFile.js';

import { ConfigIdx } from './Common.js';
import { unpackSeqConfig } from './SeqConfig.js';
import Environment from '#/util/Environment.js';
import { unpackNpcConfig } from './NpcConfig.js';
import { unpackLocConfig } from './LocConfig.js';
import { unpackObjConfig } from './ObjConfig.js';

function readConfigIdx(idx: Packet | null, dat: Packet | null): ConfigIdx {
    if (!idx || !dat) {
        printFatalError('Missing config data');
    }

    const count = idx!.g2();

    const pos: number[] = [];
    const len: number[] = [];

    let cur = 2;
    for (let i = 0; i < count; i++) {
        pos[i] = cur;
        len[i] = idx!.g2();
        cur += len[i];
    }

    return {
        size: count,
        pos,
        len,
        dat: dat!
    };
}

function unpackConfigNames(type: string, config: Jagfile) {    let pack = null;
    if (type === 'loc') {
        pack = LocPack;
    } else if (type === 'npc') {
        pack = NpcPack;
    } else if (type === 'obj') {
        pack = ObjPack;
    } else if (type === 'seq') {
        pack = SeqPack;
    }

    if (!pack) {
        printFatalError(`Unrecognized config type ${type}`);
        return;
    }

    const sourceIdx = readConfigIdx(config.read(type + '.idx'), config.read(type + '.dat'));
    for (let id = 0; id < sourceIdx.size; id++) {
        if (!pack.getById(id)) {
            pack.register(id, `${type}_${id}`);
        }
    }
    pack.save();
}

type UnpackConfigImpl = (source: ConfigIdx, id: number) => string[];

function unpackConfig(revision: string, type: string, unpack: UnpackConfigImpl, config: Jagfile, config2?: Jagfile) {
    const sourceIdx = readConfigIdx(config.read(type + '.idx'), config.read(type + '.dat'));
    printInfo(`Unpacking ${sourceIdx.size} ${type} configs`);

    let compareIdx;
    if (config2) {
        compareIdx = readConfigIdx(config2.read(type + '.idx'), config2.read(type + '.dat'));
    }

    if (!fs.existsSync(`${Environment.BUILD_SRC_DIR}/scripts/_unpack/${revision}`)) {
        fs.mkdirSync(`${Environment.BUILD_SRC_DIR}/scripts/_unpack/${revision}`, { recursive: true });
    }

    const out = `${Environment.BUILD_SRC_DIR}/scripts/_unpack/${revision}/all.${type}`;
    fs.writeFileSync(out, '');

    for (let id = 0; id < sourceIdx.size; id++) {
        const unpacked = unpack(sourceIdx, id);
        unpacked.push('');

        if (compareIdx) {
            if (id < compareIdx.size) {
                const unpacked2 = unpack(compareIdx, id);
                unpacked2.push('');

                if (sourceIdx.len[id] !== compareIdx.len[id]) {
                    fs.appendFileSync(`${out}.merge`, unpacked.join('\n') + '\n');
                    fs.appendFileSync(`${out}.merge`, unpacked2.join('\n') + '\n\n');
                } else {
                    for (let i = 0; i < unpacked2.length; i++) {
                        if (unpacked[i] !== unpacked2[i]) {
                            fs.appendFileSync(`${out}.merge`, unpacked.join('\n') + '\n');
                            fs.appendFileSync(`${out}.merge`, unpacked2.join('\n') + '\n\n');
                            break;
                        }
                    }
                }
            } else {
                fs.appendFileSync(out, unpacked.join('\n') + '\n');
            }
        } else {
            fs.appendFileSync(out, unpacked.join('\n') + '\n');
        }
    }
}

function unpackConfigs(revision: string) {
    if (!fs.existsSync('data/unpack/main_file_cache.dat')) {
        printFatalError('Place a functional cache inside data/unpack to continue.');
    }

    const cache = new FileStream('data/unpack');
    const temp = cache.read(0, 2);
    if (!temp) {
        return;
    }

    const config = new Jagfile(new Packet(temp));

    let config2;
    if (fs.existsSync('data/pack/main_file_cache.dat')) {
        const cache2 = new FileStream('data/pack');
        const temp = cache2.read(0, 2);
        if (temp) {
            config2 = new Jagfile(new Packet(temp));
        }
    }

    printInfo(`Unpacking rev ${revision} into ${Environment.BUILD_SRC_DIR}/scripts`);

    unpackConfigNames('loc', config);
    unpackConfigNames('npc', config);
    unpackConfigNames('obj', config);
    unpackConfigNames('seq', config);

    unpackConfig(revision, 'loc', unpackLocConfig, config, config2);
    unpackConfig(revision, 'npc', unpackNpcConfig, config, config2);
    unpackConfig(revision, 'obj', unpackObjConfig, config, config2);
    unpackConfig(revision, 'seq', unpackSeqConfig, config, config2);

    printInfo('Done! Manual post processing may be required.');
}

unpackConfigs('244');
