import fs from 'fs';

import FileStream from '#/io/FileStream.js';
import Packet from '#/io/Packet.js';
import { convertImage } from '#tools/pack/PixPack.js';
import Environment from '#/util/Environment.js';
import Jagfile from '#/io/Jagfile.js';
import { TexturePack } from '#tools/pack/PackFile.js';

export async function packClientTexture(cache: FileStream) {
    const index = Packet.alloc(3);

    // Every id texture.pack lists, not a fixed 50. The client addresses textures
    // by name ("<id>.dat") out of this jagfile and tolerates a missing one, so
    // the pack can be sparse — which is what lets ids be appended past the 50
    // the 2004 cache shipped without renumbering anything below them.
    const all: { id: number; data: Packet }[] = [];
    for (let id = 0; id < TexturePack.max; id++) {
        const safeName = TexturePack.getById(id);
        if (!safeName.length) {
            continue;
        }

        all.push({ id, data: await convertImage(index, `${Environment.BUILD_SRC_DIR}/textures`, safeName) });
    }

    const textures = Jagfile.new();
    textures.write('index.dat', index);
    for (const texture of all) {
        textures.write(`${texture.id}.dat`, texture.data);
    }
    textures.save('data/pack/client/textures');

    cache.write(0, 6, fs.readFileSync('data/pack/client/textures'));
}
