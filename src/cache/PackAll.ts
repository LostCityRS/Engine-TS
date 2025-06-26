import child_process from 'child_process';
import fs from 'fs';
import { parentPort } from 'worker_threads';

import Environment from '#/util/Environment.js';
import { ModelPack, revalidatePack } from '#/util/PackFile.js';
import { packClientWordenc } from '#tools/pack/chat/pack.js';
import { packConfigs } from '#tools/pack/config/PackShared.js';
import { packClientModel } from '#tools/pack/graphics/pack.js';
import { packClientInterface } from '#tools/pack/interface/PackClient.js';
import { packServerInterface } from '#tools/pack/interface/PackServer.js';
import { packClientMap } from '#tools/pack/map/PackClient.js';
import { packServerMap } from '#tools/pack/map/PackServer.js';
import { packClientMusic } from '#tools/pack/midi/pack.js';
import { packClientSound } from '#tools/pack/sound/pack.js';
import { packClientMedia } from '#tools/pack/sprite/media.js';
import { packClientTexture } from '#tools/pack/sprite/textures.js';
import { packClientTitle } from '#tools/pack/sprite/title.js';
import { generateServerSymbols } from '#tools/pack/symbols.js';
import FileStream from '#/io/FileStream.js';
import { packClientVersionList } from '#tools/pack/versionlist/pack.js';

export async function packServer(modelFlags: number[]) {
    if (!fs.existsSync('RuneScriptCompiler.jar')) {
        throw new Error('The RuneScript compiler is missing and the build process cannot continue.');
    }

    if (parentPort) {
        parentPort.postMessage({
            type: 'dev_progress',
            broadcast: 'Packing server cache (1/2)'
        });
    }

    revalidatePack();

    for (let i = 0; i < ModelPack.max; i++) {
        modelFlags[i] = 0;
    }

    await packConfigs(modelFlags);
    packServerInterface(modelFlags);

    packServerMap();

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
            text: 'Packed server cache (1/2)'
        });
    }
}

export async function packClient(modelFlags: number[]) {
    if (parentPort) {
        parentPort.postMessage({
            type: 'dev_progress',
            broadcast: 'Packing client cache (2/2)'
        });
    }

    const cache = new FileStream('data/pack', true);

    await packClientTitle(cache);
    cache.write(0, 2, fs.readFileSync('data/pack/client/config'));
    packClientInterface(cache, modelFlags);
    await packClientMedia(cache);
    await packClientTexture(cache);
    packClientWordenc(cache);
    packClientSound(cache);

    packClientModel(cache);
    packClientMap(cache);
    packClientMusic(cache);
    packClientVersionList(cache, modelFlags);

    if (parentPort) {
        parentPort.postMessage({
            type: 'dev_progress',
            text: 'Packed client cache (2/2)'
        });
    }
}
