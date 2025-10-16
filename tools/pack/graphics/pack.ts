import fs from 'fs';
import path from 'path';

import { compressGz } from '#/io/GZip.js';
import Environment from '#/util/Environment.js';
import FileStream from '#/io/FileStream.js';
import { listFilesExt } from '#tools/pack/Parse.js';
import { AnimSetPack, ModelPack } from '#tools/pack/PackFile.js';
import { printWarning } from '#/util/Logger.js';

export function packClientModel(cache: FileStream, modelFlags: number[]) {
    const models = listFilesExt(`${Environment.BUILD_SRC_DIR}/models`, '.ob2');
    for (const file of models) {
        const basename = path.basename(file);
        const id = ModelPack.getByName(basename.substring(0, basename.lastIndexOf('.')));
        const data = fs.readFileSync(file);
        if (data.length) {
            cache.write(1, id, compressGz(data)!, 1);
        }
    }

    for (let id = 0; id < ModelPack.max; id++) {
        if (!cache.has(1, id)) {
            if (modelFlags[id] > 0) {
                printWarning(`missing model ${ModelPack.getById(id)} (${id})`);
            } else {
                // printDebug(`missing model ${ModelPack.getById(id)} (${id})`);
            }
        }
    }

    const anims = listFilesExt(`${Environment.BUILD_SRC_DIR}/models`, '.anim');
    for (const file of anims) {
        const basename = path.basename(file);
        const id = AnimSetPack.getByName(basename.substring(0, basename.lastIndexOf('.')));
        const data = fs.readFileSync(file);
        if (data.length) {
            cache.write(2, id, compressGz(data)!, 1);
        }
    }
}
