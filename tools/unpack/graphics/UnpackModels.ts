import fs from 'fs';
import zlib from 'zlib';

import FileStream from '#/io/FileStream.js';
import Environment from '#/util/Environment.js';
import { printWarning } from '#/util/Logger.js';
import { PackFile } from '#tools/pack/PackFileBase.js';
import { listFilesExt } from '#tools/pack/Parse.js';

export const ModelPack = new PackFile('model');

const cache = new FileStream('data/unpack');

const existingFiles = listFilesExt(`${Environment.BUILD_SRC_DIR}/models`, '.ob2');

if (!fs.existsSync(`${Environment.BUILD_SRC_DIR}/models/_unpack`)) {
    fs.mkdirSync(`${Environment.BUILD_SRC_DIR}/models/_unpack`, { recursive: true });
}

const modelCount = cache.count(1);
console.log(`Extracting ${modelCount} models`);

for (let id = 0; id < modelCount; id++) {
    if (!ModelPack.getById(id)) {
        ModelPack.register(id, `model_${id}`);
    }
    const name = ModelPack.getById(id);

    const existingFile = existingFiles.find(x => x.endsWith(`/${name}.ob2`));
    const destFile = existingFile ?? `${Environment.BUILD_SRC_DIR}/models/_unpack/${name}.ob2`;

    const model = cache.read(1, id);
    if (model) {
        fs.writeFileSync(destFile, zlib.gunzipSync(model));
    } else {
        printWarning(`Missing model ${name}`);
    }
}

ModelPack.save();
