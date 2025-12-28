import child_process from 'child_process';
import { parentPort } from 'worker_threads';

import { revalidatePack } from '#tools/pack/PackFile.js';
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
import { clearFsCache } from '#tools/pack/FsCache.js';

import Environment from '#/util/Environment.js';

export async function packAll() {
    if (parentPort) {
        parentPort.postMessage({
            type: 'dev_progress',
            broadcast: 'Packing changes'
        });
    }

    clearFsCache();
    revalidatePack();

    await packConfigs();
    packClientInterface();

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

    await packClientTitle();
    await packClientMedia();
    await packClientTexture();
    packClientWordenc();
    packClientSound();

    packClientGraphics();

    packClientMidi();

    packMaps();

    if (parentPort) {
        parentPort.postMessage({
            type: 'dev_progress',
            text: 'Reloading with changes'
        });
    }
}
