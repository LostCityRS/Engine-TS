import fs from 'fs';

import FileStream from '#/io/FileStream.js';
import Jagfile from '#/io/Jagfile.js';
import Packet from '#/io/Packet.js';

import { ModelPack } from '#tools/pack/PackFile.js';

const cache = new FileStream('data/unpack');
const versionlist = new Jagfile(new Packet(cache.read(0, 5)!));
const modelIndex = versionlist.read('model_index')!;
const modelFlags: number[] = [];

modelIndex.save('data/unpack/model_index', modelIndex.length);
fs.writeFileSync('data/unpack/model_index.txt', '');
for (let i = 0; i < modelIndex.length; i++) {
    modelFlags[i] = modelIndex.g1();

    let readable = 'none';
    if (modelFlags[i] !== 0) {
        readable = '';

        if ((modelFlags[i] & 0x1) !== 0) {
            readable += 'tutorial ';
        }

        if ((modelFlags[i] & 0x2) !== 0) {
            // runescript (npc_add, npc_changetype)
            // interfaces
            readable += 'dynamic ';
        }

        if ((modelFlags[i] & 0x4) !== 0) {
            // 
            readable += 'static ';
        }

        if ((modelFlags[i] & 0x8) !== 0) {
            readable += 'wornf2p ';
        }
        if ((modelFlags[i] & 0x10) !== 0) {
            readable += 'worn ';
        }

        if ((modelFlags[i] & 0x20) !== 0) {
            readable += 'invf2p ';
        }
        if ((modelFlags[i] & 0x40) !== 0) {
            readable += 'inv ';
        }

        if ((modelFlags[i] & 0x80) !== 0) {
            readable += 'player ';
        }

        readable = readable.trimEnd();
    }

    const id = ModelPack.getById(i) || i;
    fs.appendFileSync('data/unpack/model_index.txt', `${id}=${readable}, 0x${modelFlags[i].toString(16).padStart(2, '0')} (0b${modelFlags[i].toString(2).padStart(8, '0')})\n`);
    // fs.appendFileSync('data/unpack/model_index.txt', `${id}=0x${modelFlags[i].toString(16).padStart(2, '0')} (0b${modelFlags[i].toString(2).padStart(8, '0')})\n`);
}
