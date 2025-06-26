import fs from 'fs';

import FileStream from '#/io/FileStream.js';
import Packet from '#/io/Packet.js';
import { convertImage } from '#/util/PixPack.js';
import Environment from '#/util/Environment.js';
import Jagfile from '#/io/Jagfile.js';
import { TexturePack } from '#/util/PackFile.js';

export async function packClientTexture(cache: FileStream) {
    const index = Packet.alloc(3);

    const all = [];
    for (let id = 0; id < 50; id++) {
        all.push(await convertImage(index, `${Environment.BUILD_SRC_DIR}/textures`, TexturePack.getById(id)));
    }

    const textures = new Jagfile();
    textures.write('index.dat', index);
    for (let id = 0; id < all.length; id++) {
        textures.write(`${id}.dat`, all[id]);
    }
    textures.save('data/pack/client/textures');

    cache.write(0, 6, fs.readFileSync('data/pack/client/textures'));
}
