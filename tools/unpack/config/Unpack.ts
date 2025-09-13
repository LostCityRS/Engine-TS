import fs from 'fs';

import FileStream from '#/io/FileStream.js';
import Jagfile from '#/io/Jagfile.js';
import Packet from '#/io/Packet.js';
import { printFatalError, printInfo } from '#/util/Logger.js';
import { FloPack, IdkPack, LocPack, ModelPack, NpcPack, ObjPack, SeqPack, SpotAnimPack, VarpPack } from '#tools/pack/PackFile.js';

import { ConfigIdx } from './Common.js';
import { unpackSeqConfig } from './SeqConfig.js';
import Environment from '#/util/Environment.js';
import { unpackNpcConfig } from './NpcConfig.js';
import { LocModels, LocShapeSuffix, unpackLocConfig, unpackLocModels } from './LocConfig.js';
import { unpackObjConfig } from './ObjConfig.js';
import { unpackIdkConfig } from './IdkConfig.js';
import { unpackFloConfig } from './FloConfig.js';
import { unpackVarpConfig } from './VarpConfig.js';
import { unpackSpotAnimConfig } from './SpotAnimConfig.js';
import Model from '#/cache/graphics/Model.js';

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

function unpackConfigNames(type: string, config: Jagfile) {
    let pack = null;
    if (type === 'loc') {
        pack = LocPack;
    } else if (type === 'npc') {
        pack = NpcPack;
    } else if (type === 'obj') {
        pack = ObjPack;
    } else if (type === 'seq') {
        pack = SeqPack;
    } else if (type === 'idk') {
        pack = IdkPack;
    } else if (type === 'flo') {
        pack = FloPack;
    } else if (type === 'varp') {
        pack = VarpPack;
    } else if (type === 'spotanim') {
        pack = SpotAnimPack;
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

function reorderUnpacked(config: string[], settings: { moveName: boolean, moveDesc: boolean, moveRecol: boolean, moveModel: boolean }) {
    const debugname: string[] = [];
    const others: string[] = [];

    // these properties get encoded last, and for readability we want them first
    // every other property is the source order
    const name: string[] = [];
    const desc: string[] = [];
    const model: string[] = [];
    const recol: string[] = [];

    for (const line of config) {
        if (line.startsWith('[')) {
            debugname.push(line);
        } else if (settings.moveName && line.startsWith('name=')) {
            name.push(line);
        } else if (settings.moveDesc && line.startsWith('desc=')) {
            desc.push(line);
        } else if (settings.moveModel && (line.startsWith('model') || line.startsWith('ldmodel'))) {
            model.push(line);
        } else if (settings.moveRecol && (line.startsWith('recol') || line.startsWith('retex'))) {
            recol.push(line);
        } else {
            others.push(line);
        }
    }
    return [...debugname, ...name, ...desc, ...model, ...recol, ...others];
}

type UnpackConfigImpl = (source: ConfigIdx, id: number) => string[];

function unpackConfig(revision: string, type: string, unpack: UnpackConfigImpl, config: Jagfile, config2?: Jagfile) {
    const sourceIdx = readConfigIdx(config.read(type + '.idx'), config.read(type + '.dat'));
    printInfo(`Unpacking ${sourceIdx.size} ${type} configs`);

    let compareIdx;
    if (config2) {
        compareIdx = readConfigIdx(config2.read(type + '.idx'), config2.read(type + '.dat'));
    }

    // const dat1 = config.read(type + '.dat')!;
    // const dat2 = config2!.read(type + '.dat')!;
    // const check1 = Packet.getcrc(dat1.data, 0, dat1.length);
    // const check2 = Packet.getcrc(dat2.data, 0, dat2.length);

    // if (check1 !== check2) {
    //     console.log(type, 'mismatch');
    //     dat1.save(`dump/${type}1.dat`, dat1.length);
    //     dat2.save(`dump/${type}2.dat`, dat2.length);
    // } else {
    //     console.log(type, 'match');
    // }

    // return;

    if (!fs.existsSync(`${Environment.BUILD_SRC_DIR}/scripts/_unpack/${revision}`)) {
        fs.mkdirSync(`${Environment.BUILD_SRC_DIR}/scripts/_unpack/${revision}`, { recursive: true });
    }

    const out = `${Environment.BUILD_SRC_DIR}/scripts/_unpack/${revision}/all.${type}`;
    fs.writeFileSync(out, '');

    const settings = { moveName: false, moveDesc: false, moveRecol: false, moveModel: false };

    if (type === 'loc' || type === 'npc' || type === 'obj') {
        settings.moveName = true;
        settings.moveDesc = true;
        settings.moveRecol = true;
    }

    if (type === 'idk') {
        settings.moveRecol = true;
    }

    if (type === 'loc' || type === 'npc') {
        settings.moveModel = true;
    }

    for (let id = 0; id < sourceIdx.size; id++) {
        const unpacked = reorderUnpacked(unpack(sourceIdx, id), settings);
        unpacked.push('');

        if (compareIdx) {
            if (id < compareIdx.size) {
                const unpacked2 = reorderUnpacked(unpack(compareIdx, id), settings);
                unpacked2.push('');

                for (let i = 0; i < unpacked2.length; i++) {
                    if (unpacked[i] !== unpacked2[i]) {
                        fs.appendFileSync(`${out}.merge`, '// --------\n' + unpacked.join('\n') + '\n');
                        fs.appendFileSync(`${out}.merge`, unpacked2.join('\n') + '\n');
                        break;
                    }
                }

                // if (sourceIdx.len[id] !== compareIdx.len[id]) {
                //     fs.appendFileSync(`${out}.merge`, unpacked.join('\n') + '\n');
                //     fs.appendFileSync(`${out}.merge`, unpacked2.join('\n') + '\n\n');
                // } else {
                //     for (let i = 0; i < unpacked2.length; i++) {
                //         if (unpacked[i] !== unpacked2[i]) {
                //             fs.appendFileSync(`${out}.merge`, unpacked.join('\n') + '\n');
                //             fs.appendFileSync(`${out}.merge`, unpacked2.join('\n') + '\n\n');
                //             break;
                //         }
                //     }
                // }
            } else {
                fs.appendFileSync(out, unpacked.join('\n') + '\n');
            }
        } else {
            fs.appendFileSync(out, unpacked.join('\n') + '\n');
        }
    }
}

type UnpackModelImpl = (source: ConfigIdx, id: number) => number[] | LocModels;

function unpackModelNames(type: string, unpack: UnpackModelImpl, config: Jagfile) {
    const sourceIdx = readConfigIdx(config.read(type + '.idx'), config.read(type + '.dat'));

    const locs: LocModels[] = [];
    for (let id = 0; id < sourceIdx.size; id++) {
        locs[id] = unpack(sourceIdx, id) as LocModels;
    }

    const seenAsNonCentrepiece: boolean[] = [];
    for (const config of locs) {
        for (const info of config.models) {
            if (info.shape !== 10) {
                seenAsNonCentrepiece[info.model] = true;
            }
        }

        for (const info of config.ldModels) {
            if (info.shape !== 10) {
                seenAsNonCentrepiece[info.model] = true;
            }
        }
    }

    for (let id = 0; id < locs.length; id++) {
        const config = locs[id];
        let debugname = LocPack.getById(id);

        for (let shape = 0; shape <= 22; shape++) {
            if (debugname.endsWith(LocShapeSuffix[shape])) {
                debugname = debugname.substring(0, debugname.lastIndexOf('_')) + debugname.substring(debugname.length - 1);
                break;
            }
        }

        for (const info of config.models) {
            const { model, shape } = info;
            if (shape === LocShapeSuffix._8 && seenAsNonCentrepiece[model]) {
                continue;
            }

            const modelName = ModelPack.getById(model);
            if (!modelName.startsWith('model_')) {
                continue;
            }

            let name = `${debugname}${LocShapeSuffix[shape]}`;
            let i = 2;
            while (ModelPack.getByName(name) !== -1) {
                name = `${debugname}i${i}${LocShapeSuffix[shape]}`;
                i++;
            }

            fs.renameSync(`${Environment.BUILD_SRC_DIR}/models/_unpack/${modelName}.ob2`, `${Environment.BUILD_SRC_DIR}/models/loc/${name}.ob2`);
            ModelPack.register(model, name);
        }

        for (const info of config.ldModels) {
            const { model, shape } = info;
            if (shape === LocShapeSuffix._8 && seenAsNonCentrepiece[model]) {
                continue;
            }

            const modelName = ModelPack.getById(model);
            if (!modelName.startsWith('model_')) {
                continue;
            }

            let name = `${debugname}_ld${LocShapeSuffix[shape]}`;
            let i = 2;
            while (ModelPack.getByName(name) !== -1) {
                name = `${debugname}i${i}_ld${LocShapeSuffix[shape]}`;
                i++;
            }

            fs.renameSync(`${Environment.BUILD_SRC_DIR}/models/_unpack/${modelName}.ob2`, `${Environment.BUILD_SRC_DIR}/models/loc/${name}.ob2`);
            ModelPack.register(model, name);
        }
    }

    ModelPack.save();
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
    // if (fs.existsSync('data/pack/main_file_cache.dat')) {
    //     const cache2 = new FileStream('data/pack');
    //     const temp = cache2.read(0, 2);
    //     if (temp) {
    //         config2 = new Jagfile(new Packet(temp));
    //     }
    // }

    printInfo(`Unpacking rev ${revision} into ${Environment.BUILD_SRC_DIR}/scripts`);

    for (let id = 0; id < ModelPack.max; id++) {
        const data = cache.read(1, id, true);
        Model.unpack(id, data);
    }

    unpackConfigNames('loc', config);
    unpackConfigNames('npc', config);
    unpackConfigNames('obj', config);
    unpackConfigNames('seq', config);
    unpackConfigNames('idk', config);
    unpackConfigNames('flo', config);
    unpackConfigNames('spotanim', config);
    unpackConfigNames('varp', config);

    if (!fs.existsSync(`${Environment.BUILD_SRC_DIR}/models/obj`)) {
        fs.mkdirSync(`${Environment.BUILD_SRC_DIR}/models/obj`, { recursive: true });
    }

    if (!fs.existsSync(`${Environment.BUILD_SRC_DIR}/models/spot`)) {
        fs.mkdirSync(`${Environment.BUILD_SRC_DIR}/models/spot`, { recursive: true });
    }

    if (!fs.existsSync(`${Environment.BUILD_SRC_DIR}/models/idk`)) {
        fs.mkdirSync(`${Environment.BUILD_SRC_DIR}/models/idk`, { recursive: true });
    }

    if (!fs.existsSync(`${Environment.BUILD_SRC_DIR}/models/loc`)) {
        fs.mkdirSync(`${Environment.BUILD_SRC_DIR}/models/loc`, { recursive: true });
    }

    if (!fs.existsSync(`${Environment.BUILD_SRC_DIR}/models/npc`)) {
        fs.mkdirSync(`${Environment.BUILD_SRC_DIR}/models/npc`, { recursive: true });
    }

    unpackModelNames('loc', unpackLocModels, config);

    unpackConfig(revision, 'loc', unpackLocConfig, config, config2);
    unpackConfig(revision, 'obj', unpackObjConfig, config, config2);
    unpackConfig(revision, 'spotanim', unpackSpotAnimConfig, config, config2);
    unpackConfig(revision, 'idk', unpackIdkConfig, config, config2);
    unpackConfig(revision, 'npc', unpackNpcConfig, config, config2);
    unpackConfig(revision, 'seq', unpackSeqConfig, config, config2);
    unpackConfig(revision, 'flo', unpackFloConfig, config, config2);
    unpackConfig(revision, 'varp', unpackVarpConfig, config, config2);

    ModelPack.save();

    printInfo('Done! Manual post processing may be required.');
}

unpackConfigs('244');
