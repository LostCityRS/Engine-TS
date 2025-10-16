import child_process from 'child_process';
import fs from 'fs';
import { parentPort } from 'worker_threads';

import * as fflate from 'fflate';

import Environment from '#/util/Environment.js';
import { ModelPack, revalidatePack } from '#tools/pack/PackFile.js';
import { packClientWordenc } from '#tools/pack/chat/pack.js';
import { packConfigs } from '#tools/pack/config/PackShared.js';
import { packClientModel } from '#tools/pack/graphics/pack.js';
import { packClientInterface } from '#tools/pack/interface/PackClient.js';
import { packMaps } from '#tools/pack/map/Pack.js';
import { packClientMusic } from '#tools/pack/midi/pack.js';
import { packClientSound } from '#tools/pack/sound/pack.js';
import { packClientMedia } from '#tools/pack/sprite/media.js';
import { packClientTexture } from '#tools/pack/sprite/textures.js';
import { packClientTitle } from '#tools/pack/sprite/title.js';
import { generateServerSymbols } from '#tools/pack/CompilerSymbols.js';
import FileStream from '#/io/FileStream.js';
import { packClientVersionList } from '#tools/pack/versionlist/pack.js';
import { clearFsCache } from '#tools/pack/FsCache.js';

export async function packClient(modelFlags: number[]) {
    if (parentPort) {
        parentPort.postMessage({
            type: 'dev_progress',
            broadcast: 'Packing client cache (0%)'
        });
    }

    clearFsCache();
    revalidatePack();

    for (let i = 0; i < ModelPack.max; i++) {
        modelFlags[i] = 0;
    }

    const cache = new FileStream('data/pack', true);

    await packClientTitle(cache);
    await packConfigs(cache, modelFlags);
    packClientInterface(cache, modelFlags);
    await packClientMedia(cache);
    await packClientTexture(cache);

    packClientWordenc(cache);
    packClientSound(cache);
    packClientModel(cache, modelFlags);
    packMaps(cache);
    packClientMusic(cache);
    packClientVersionList(cache, modelFlags);

    const zipPack: Record<string, Uint8Array> = {};
    for (let archive = 1; archive <= 4; archive++) {
        const count = cache.count(archive);
        for (let file = 0; file < count; file++) {
            const data = cache.read(archive, file);
            if (!data) {
                continue;
            }

            zipPack[`${archive}.${file}`] = data;
        }
    }
    const zip = fflate.zipSync(zipPack, { level: 0 });
    fs.writeFileSync('data/pack/ondemand.zip', zip);

    if (parentPort) {
        parentPort.postMessage({
            type: 'dev_progress',
            text: 'Packed client cache'
        });
    }
}
export async function packServer() {
    if (!fs.existsSync('RuneScriptCompiler.jar')) {
        throw new Error('The RuneScript compiler is missing and the build process cannot continue.');
    }

    if (parentPort) {
        parentPort.postMessage({
            type: 'dev_progress',
            broadcast: 'Packing server cache (50%)'
        });
    }

    generateServerSymbols();

    if (parentPort) {
        parentPort.postMessage({
            type: 'dev_progress',
            text: 'Compiling server scripts'
        });
    }

    try {
        child_process.execSync(`"${Environment.BUILD_JAVA_PATH}" -jar RuneScriptCompiler.jar`, { stdio: 'inherit' });
    } catch (_err) {
        // console.error(err);
        if (parentPort) {
            throw new Error('Failed to compile scripts.');
        }
    }

    if (parentPort) {
        parentPort.postMessage({
            type: 'dev_progress',
            text: 'Packed server cache'
        });
    }
}
