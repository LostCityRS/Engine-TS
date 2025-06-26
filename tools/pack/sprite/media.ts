import fs from 'fs';
import path from 'path';

import FileStream from '#/io/FileStream.js';
import { listFilesExt } from '#/util/Parse.js';
import Environment from '#/util/Environment.js';
import Jagfile from '#/io/Jagfile.js';
import Packet from '#/io/Packet.js';
import { convertImage } from '#/util/PixPack.js';

export async function packClientMedia(cache: FileStream) {
    const index = Packet.alloc(3);

    const sprites = listFilesExt(`${Environment.BUILD_SRC_DIR}/sprites`, '.png');
    const all = new Map();
    for (const name of sprites) {
        const safeName = path.basename(name, path.extname(name));
        all.set(safeName, await convertImage(index, `${Environment.BUILD_SRC_DIR}/sprites`, safeName));
    }
    
    const media = new Jagfile();
    media.write('index.dat', index);
    for (const [name, sprite] of all) {
        media.write(`${name}.dat`, sprite);
    }
    media.save('data/pack/client/media');

    cache.write(0, 4, fs.readFileSync('data/pack/client/media'));
}
