import fs from 'fs';
import path from 'path';

import { compressGz } from '#/io/GZip.js';
import Environment from '#/util/Environment.js';
import FileStream from '#/io/FileStream.js';
import { didFileSetChange } from '#tools/pack/FsCache.js';
import { listFilesExt } from '#tools/pack/Parse.js';
import { AnimSetPack, ModelPack, shouldBuild, shouldBuildFile } from '#tools/pack/PackFile.js';
import { printWarning } from '#/util/Logger.js';

function hasUnexpectedPackedFiles(dir: string, expected: Set<string>) {
    if (!fs.existsSync(dir)) {
        return false;
    }

    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
        if (!file.isFile() || !expected.has(file.name)) {
            return true;
        }
    }

    return false;
}

export function packClientGraphics(cache: FileStream, modelFlags: number[]) {
    fs.mkdirSync('data/pack/client/models', { recursive: true });
    fs.mkdirSync('data/pack/client/anims', { recursive: true });

    const models = listFilesExt(`${Environment.BUILD_SRC_DIR}/models`, '.ob2');
    const expectedModels = new Set(models.map(file => path.basename(file, '.ob2')));
    const toolChanged = didFileSetChange('data/pack/.stamps/graphics-tools.txt', [Environment.IS_BUN ? __filename : import.meta.filename]);
    const rebuildModelsArchive = shouldBuildFile(`${Environment.BUILD_SRC_DIR}/pack/model.pack`, 'data/pack/main_file_cache.idx1') || hasUnexpectedPackedFiles('data/pack/client/models', expectedModels);
    const needsModelHydration = rebuildModelsArchive || cache.count(1) === 0;
    const needsModelPackWork = rebuildModelsArchive || shouldBuild(`${Environment.BUILD_SRC_DIR}/models`, '.ob2', 'data/pack/main_file_cache.idx1') || toolChanged;

    if (rebuildModelsArchive) {
        cache.clearArchive(1);
    }

    const anims = listFilesExt(`${Environment.BUILD_SRC_DIR}/models`, '.anim');
    const expectedAnims = new Set(anims.map(file => path.basename(file, '.anim')));
    const rebuildAnimsArchive = shouldBuildFile(`${Environment.BUILD_SRC_DIR}/pack/animset.pack`, 'data/pack/main_file_cache.idx2') || hasUnexpectedPackedFiles('data/pack/client/anims', expectedAnims);
    const needsAnimHydration = rebuildAnimsArchive || cache.count(2) === 0;
    const needsAnimPackWork = rebuildAnimsArchive || shouldBuild(`${Environment.BUILD_SRC_DIR}/models`, '.anim', 'data/pack/main_file_cache.idx2') || toolChanged;

    if (rebuildAnimsArchive) {
        cache.clearArchive(2);
    }

    if (!needsModelPackWork && !needsModelHydration && !needsAnimPackWork && !needsAnimHydration) {
        return;
    }

    for (const file of models) {
        const name = path.basename(file, '.ob2');
        const id = ModelPack.getByName(name);
        const packedFile = `data/pack/client/models/${name}`;
        const needsRebuild = needsModelPackWork && (toolChanged || shouldBuildFile(file, packedFile));

        if (needsRebuild) {
            const data = fs.readFileSync(file);
            if (data.length) {
                fs.writeFileSync(packedFile, compressGz(data)!);
            }
        }

        if (needsRebuild || needsModelHydration) {
            cache.write(1, id, fs.readFileSync(packedFile), 1);
        }
    }

    let hasModelReferences = false;
    for (let id = 0; id < modelFlags.length; id++) {
        if (modelFlags[id] > 0) {
            hasModelReferences = true;
            break;
        }
    }

    if (hasModelReferences) {
        for (let id = 0; id < ModelPack.max; id++) {
            if (!cache.has(1, id)) {
                if (modelFlags[id] > 0) {
                    printWarning(`missing model ${ModelPack.getById(id)} (${id})`);
                } else {
                    // printDebug(`missing model ${ModelPack.getById(id)} (${id})`);
                }
            }
        }
    }

    for (const file of anims) {
        const name = path.basename(file, '.anim');
        const id = AnimSetPack.getByName(name);
        const packedFile = `data/pack/client/anims/${name}`;
        const needsRebuild = needsAnimPackWork && (toolChanged || shouldBuildFile(file, packedFile));

        if (needsRebuild) {
            const data = fs.readFileSync(file);
            if (data.length) {
                fs.writeFileSync(packedFile, compressGz(data)!);
            }
        }

        if (needsRebuild || needsAnimHydration) {
            cache.write(2, id, fs.readFileSync(packedFile), 1);
        }
    }
}
