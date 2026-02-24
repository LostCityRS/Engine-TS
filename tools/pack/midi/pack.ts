import fs from 'fs';
import path from 'path';

import { compressGz } from '#/io/GZip.js';
import Environment from '#/util/Environment.js';
import FileStream from '#/io/FileStream.js';
import { MidiPack } from '#tools/pack/PackFile.js';
import { listFilesExt } from '#tools/pack/Parse.js';

export function packClientMidi(cache: FileStream) {
    const midis = [...listFilesExt(`${Environment.BUILD_SRC_DIR}/jingles`, '.mid'), ...listFilesExt(`${Environment.BUILD_SRC_DIR}/songs`, '.mid')];
    for (const file of midis) {
        const basename = path.basename(file);
        const id = MidiPack.getByName(basename.substring(0, basename.lastIndexOf('.')));
        const data = fs.readFileSync(file);
        if (data.length) {
            cache.write(3, id, compressGz(data)!, 1);
        }
    }
}
