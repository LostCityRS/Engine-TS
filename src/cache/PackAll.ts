import child_process from 'child_process';
import fs from 'fs';
import { parentPort } from 'worker_threads';

// import * as fflate from 'fflate';

import Environment from '#/util/Environment.js';
import { ModelPack, revalidatePack } from '#/util/PackFile.js';
// import { packClientWordenc } from '#tools/pack/chat/pack.js';
import { packConfigs } from '#tools/pack/config/PackShared.js';
import { packClientModel } from '#tools/pack/graphics/pack.js';
import { packClientInterface } from '#tools/pack/interface/PackClient.js';
import { packServerInterface } from '#tools/pack/interface/PackServer.js';
import { packClientMap } from '#tools/pack/map/PackClient.js';
import { packServerMap } from '#tools/pack/map/PackServer.js';
import { packClientMusic } from '#tools/pack/midi/pack.js';
// import { packClientSound } from '#tools/pack/sound/pack.js';
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

    console.time('revalidate');
    revalidatePack();
    console.timeEnd('revalidate');

    for (let i = 0; i < ModelPack.max; i++) {
        modelFlags[i] = 0;
    }

    console.time('config');
    await packConfigs(modelFlags);
    console.timeEnd('config');

    console.time('interface');
    packServerInterface(modelFlags);
    console.timeEnd('interface');

    console.time('map');
    packServerMap();
    console.time('map');

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
    const unpack = new FileStream('data/unpack');

    console.time('title');
    await packClientTitle(cache);
    console.timeEnd('title');

    console.time('config');
    cache.write(0, 2, fs.readFileSync('data/pack/client/config'));
    console.timeEnd('config');

    console.time('interface');
    packClientInterface(cache, modelFlags);
    console.timeEnd('interface');

    console.time('media');
    await packClientMedia(cache);
    console.timeEnd('media');

    console.time('texture');
    await packClientTexture(cache);
    console.timeEnd('texture');

    console.time('wordenc');
    // packClientWordenc(cache);
    const wordenc = unpack.read(0, 7);
    if (wordenc) {
        cache.write(0, 7, wordenc);
    }
    console.timeEnd('wordenc');

    console.time('sound');
    // packClientSound(cache);
    const sounds = unpack.read(0, 8);
    if (sounds) {
        cache.write(0, 8, sounds);
    }
    console.timeEnd('sound');

    console.time('model');
    packClientModel(cache);
    console.timeEnd('model');

    console.time('map');
    packClientMap(cache);
    console.timeEnd('map');

    console.time('music');
    packClientMusic(cache);
    console.timeEnd('music');

    console.time('versionlist');
    packClientVersionList(cache, modelFlags);
    console.timeEnd('versionlist');

    // const zipPack: Record<string, Uint8Array> = {};
    // for (let archive = 1; archive <= 4; archive++) {
    //     const count = cache.count(archive);
    //     for (let file = 0; file < count; file++) {
    //         const data = cache.read(archive, file);
    //         if (!data) {
    //             continue;
    //         }

    //         zipPack[`${archive}.${file}`] = data;
    //     }
    // }
    // const zip = fflate.zipSync(zipPack, { level: 0 });
    // fs.writeFileSync('data/pack/ondemand.zip', zip);

    if (parentPort) {
        parentPort.postMessage({
            type: 'dev_progress',
            text: 'Packed client cache (2/2)'
        });
    }
}
