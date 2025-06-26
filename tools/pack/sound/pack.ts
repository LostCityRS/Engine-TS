import fs from 'fs';
import path from 'path';

import FileStream from '#/io/FileStream.js';
import { printError } from '#/util/Logger.js';
import Packet from '#/io/Packet.js';
import Jagfile from '#/io/Jagfile.js';
import { listFilesExt } from '#/util/Parse.js';
import Environment from '#/util/Environment.js';
import { loadOrder } from '#/util/NameMap.js';
import { SynthPack } from '#/util/PackFile.js';

export function packClientSound(cache: FileStream) {
    const order = loadOrder(`${Environment.BUILD_SRC_DIR}/pack/synth.order`);
    const files = listFilesExt(`${Environment.BUILD_SRC_DIR}/synth`, '.synth');

    const jag = new Jagfile();

    const out = Packet.alloc(4);
    for (let i = 0; i < order.length; i++) {
        const id = Number(order[i]);
        const name = SynthPack.getById(id);

        const file = files.find(file => path.basename(file, path.extname(file)) === name);
        if (!file) {
            printError('missing synth file ' + id + ' ' + name);
            continue;
        }

        out.p2(id);
        const data = fs.readFileSync(file);
        out.pdata(data, 0, data.length);
    }
    out.p2(-1);

    jag.write('sounds.dat', out);
    jag.save('data/pack/client/sounds', true);
    out.release();

    cache.write(0, 8, fs.readFileSync('data/pack/client/sounds'));
}
