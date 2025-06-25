import fs from 'fs';

import FileStream from '#/io/FileStream.js';
import Jagfile from '#/io/Jagfile.js';
import Packet from '#/io/Packet.js';

const cache = new FileStream('data/unpack');
const versionlist = new Jagfile(new Packet(cache.read(0, 5)!));
const modelIndex = versionlist.read('model_index')!;
const modelFlags: number[] = [];

modelIndex.save('data/unpack/model_index', modelIndex.length);
fs.writeFileSync('data/unpack/model_index.txt', '');
for (let i = 0; i < modelIndex.length; i++) {
    modelFlags[i] = modelIndex.g1();

    let explicit = 'none';
    if (modelFlags[i] !== 0) {
        explicit = '';

        if ((modelFlags[i] & 0x1) !== 0) {
            explicit += 'tut ';
        }

        if ((modelFlags[i] & 0x2) !== 0) {
            explicit += 'dynamic ';
        }

        if ((modelFlags[i] & 0x4) !== 0) {
            explicit += 'npc+static ';
        }

        if ((modelFlags[i] & 0x8) !== 0) {
            explicit += 'wornf2p ';
        }

        if ((modelFlags[i] & 0x10) !== 0) {
            explicit += 'worn ';
        }

        if ((modelFlags[i] & 0x20) !== 0) {
            explicit += 'invf2p ';
        }

        if ((modelFlags[i] & 0x40) !== 0) {
            explicit += 'inv ';
        }

        if ((modelFlags[i] & 0x80) !== 0) {
            explicit += 'player ';
        }

        explicit = explicit.trimEnd();
    }

    fs.appendFileSync('data/unpack/model_index.txt', `${i}=${explicit} (${modelFlags[i].toString(16)})\n`);
}
