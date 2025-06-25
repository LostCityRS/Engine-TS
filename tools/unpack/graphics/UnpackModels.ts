import fs from 'fs';
import zlib from 'zlib';

import FileStream from '#/io/FileStream.js';
import Environment from '#/util/Environment.js';
import { printWarning } from '#/util/Logger.js';
import { PackFile } from '#/util/PackFileBase.js';
import { listFilesExt } from '#/util/Parse.js';

export const ModelPack = new PackFile('model');

const cache = new FileStream('data/unpack');

const existingFiles = listFilesExt(`${Environment.BUILD_SRC_DIR}/models`, '.ob2');

const modelCount = cache.count(1);
for (let i = 0; i < modelCount; i++) {
    if (!ModelPack.getById(i)) {
        ModelPack.register(i, `model_${i}`);
    }
    const name = ModelPack.getById(i);

    const existingFile = existingFiles.find(x => x.endsWith(`/${name}.ob2`));
    const destFile = existingFile ?? `${Environment.BUILD_SRC_DIR}/models/_unpack/${name}.ob2`;

    const model = cache.read(1, i);
    if (model) {
        fs.writeFileSync(destFile, zlib.gunzipSync(model));
    } else {
        printWarning(`Missing model ${name}`);
    }
}

ModelPack.save();
