import fs from 'fs';

import FileStream from '#/io/FileStream.js';
import Jagfile from '#/io/Jagfile.js';
import Packet from '#/io/Packet.js';
import Environment from '#/util/Environment.js';
import Pix from '#/cache/graphics/Pix.js';

const cache = new FileStream('data/unpack');
const title = new Jagfile(new Packet(cache.read(0, 1)!));

if (!fs.existsSync(`${Environment.BUILD_SRC_DIR}/binary`)) {
    fs.mkdirSync(`${Environment.BUILD_SRC_DIR}/binary`, { recursive: true });
}

if (!fs.existsSync(`${Environment.BUILD_SRC_DIR}/title`)) {
    fs.mkdirSync(`${Environment.BUILD_SRC_DIR}/title`, { recursive: true });
}

if (!fs.existsSync(`${Environment.BUILD_SRC_DIR}/fonts`)) {
    fs.mkdirSync(`${Environment.BUILD_SRC_DIR}/fonts`, { recursive: true });
}

const background = title.read('title.dat');
if (background) {
    fs.writeFileSync(`${Environment.BUILD_SRC_DIR}/binary/title.jpg`, background.data);
}

const fonts = ['b12', 'p11', 'p12', 'q8'];

for (const name of fonts) {
    Pix.unpackFull(title, name, `${Environment.BUILD_SRC_DIR}/fonts`);
}

const titleImages = ['logo', 'runes', 'titlebox', 'titlebutton'];

for (const name of titleImages) {
    Pix.unpackFull(title, name, `${Environment.BUILD_SRC_DIR}/title`);
}
