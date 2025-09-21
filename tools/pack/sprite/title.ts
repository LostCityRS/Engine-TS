import fs from 'fs';

import FileStream from '#/io/FileStream.js';
import { convertImage } from '#tools/pack/PixPack.js';
import Packet from '#/io/Packet.js';
import Environment from '#/util/Environment.js';
import Jagfile from '#/io/Jagfile.js';

export async function packClientTitle(cache: FileStream) {
    const index = Packet.alloc(3);
    const logo = await convertImage(index, `${Environment.BUILD_SRC_DIR}/title`, 'logo');
    const runes = await convertImage(index, `${Environment.BUILD_SRC_DIR}/title`, 'runes');
    const titlebox = await convertImage(index, `${Environment.BUILD_SRC_DIR}/title`, 'titlebox');
    const titlebutton = await convertImage(index, `${Environment.BUILD_SRC_DIR}/title`, 'titlebutton');

    const b12 = await convertImage(index, `${Environment.BUILD_SRC_DIR}/fonts`, 'b12_full');
    const p11 = await convertImage(index, `${Environment.BUILD_SRC_DIR}/fonts`, 'p11_full');
    const p12 = await convertImage(index, `${Environment.BUILD_SRC_DIR}/fonts`, 'p12_full');
    const q8 = await convertImage(index, `${Environment.BUILD_SRC_DIR}/fonts`, 'q8_full');

    const title = Jagfile.new();
    title.write('title.dat', Packet.load(`${Environment.BUILD_SRC_DIR}/binary/title.jpg`, true));
    title.write('index.dat', index);
    title.write('logo.dat', logo);
    title.write('runes.dat', runes);
    title.write('titlebox.dat', titlebox);
    title.write('titlebutton.dat', titlebutton);
    title.write('b12_full.dat', b12);
    title.write('p11_full.dat', p11);
    title.write('p12_full.dat', p12);
    title.write('q8_full.dat', q8);
    title.save('data/pack/client/title');

    cache.write(0, 1, fs.readFileSync('data/pack/client/title'));
}
