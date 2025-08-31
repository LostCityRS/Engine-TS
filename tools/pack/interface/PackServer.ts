import Environment from '#/util/Environment.js';
import { shouldBuild } from '#/util/PackFile.js';
import { packInterface } from '#tools/pack/interface/PackShared.js';

export function packServerInterface(modelFlags: number[]) {
    if (shouldBuild(`${Environment.BUILD_SRC_DIR}/scripts`, '.if', 'data/pack/server/interface.dat') || shouldBuild('tools/pack/interface', '.ts', 'data/pack/server/interface.dat')) {
        const data = packInterface(true, modelFlags);
        data.save('data/pack/server/interface.dat');
        data.release();
    }
}
