import child_process from 'child_process';
import fs from 'fs';
import { parentPort } from 'worker_threads';

import * as fflate from 'fflate';

import FileStream from '#/io/FileStream.js';
import Packet from '#/io/Packet.js';

import { ModelPack, revalidatePack } from '#tools/pack/PackFile.js';
import { packClientWordenc } from '#tools/pack/chat/pack.js';
import { packConfigs } from '#tools/pack/config/PackShared.js';
import { packClientGraphics } from '#tools/pack/graphics/pack.js';
import { packClientInterface } from '#tools/pack/interface/PackClient.js';
import { packMaps } from '#tools/pack/map/Pack.js';
import { packClientMidi } from '#tools/pack/midi/pack.js';
import { packClientSound } from '#tools/pack/sound/pack.js';
import { packClientMedia } from '#tools/pack/sprite/media.js';
import { packClientTexture } from '#tools/pack/sprite/textures.js';
import { packClientTitle } from '#tools/pack/sprite/title.js';
import { generateCompilerSymbols } from '#tools/pack/CompilerSymbols.js';
import { packClientVersionList } from '#tools/pack/versionlist/pack.js';
import { clearFsCache } from '#tools/pack/FsCache.js';

import Environment from '#/util/Environment.js';

export async function packAll(modelFlags: number[]) {
    if (parentPort) {
        parentPort.postMessage({
            type: 'dev_progress',
            broadcast: 'Packing changes'
        });
    }

    clearFsCache();
    revalidatePack();

    for (let i = 0; i < ModelPack.max; i++) {
        modelFlags[i] = 0;
    }

    // todo: better build conditions to do minimal rebuilds and only build a new client cache if necessary
    const cache = new FileStream('data/pack', true);

    await packConfigs(cache, modelFlags);
    packClientInterface(cache, modelFlags);

    // todo: better/native compiler integration to extract npc_add/npc_changetype calls for modelFlags
    generateCompilerSymbols(); // relies on reading configs/interfaces
    try {
        child_process.execSync(`"${Environment.BUILD_JAVA_PATH}" -jar RuneScriptCompiler.jar`, { stdio: 'inherit' });
    } catch (_err) {
        // console.error(err);
        if (parentPort) {
            throw new Error('Failed to compile scripts.');
        }
    }

    await packClientTitle(cache);
    await packClientMedia(cache);
    await packClientTexture(cache);
    packClientWordenc(cache);
    packClientSound(cache);

    packClientGraphics(cache, modelFlags);

    packClientMidi(cache);

    packMaps(cache, modelFlags);

    packClientVersionList(cache, modelFlags); // relies on additional flags set during packMaps

    const build = Packet.alloc(0);
    build.p4(Date.now() / 1000);
    build.save('data/pack/server/build');

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
            text: 'Reloading with changes'
        });
    }
}
