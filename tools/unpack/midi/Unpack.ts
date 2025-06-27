import fs from 'fs';
import path from 'path';

import FileStream from '#/io/FileStream.js';
import Environment from '#/util/Environment.js';
import { printWarning } from '#/util/Logger.js';
import { MidiPack } from '#/util/PackFile.js';
import { listFilesExt } from '#/util/Parse.js';
import Packet from '#/io/Packet.js';

if (!fs.existsSync(`${Environment.BUILD_SRC_DIR}/songs`)) {
    fs.mkdirSync(`${Environment.BUILD_SRC_DIR}/songs`, { recursive: true });
}

const cache = new FileStream('data/unpack', false, true);

const existing = [...listFilesExt(`${Environment.BUILD_SRC_DIR}/songs`, '.mid'), ...listFilesExt(`${Environment.BUILD_SRC_DIR}/jingles`, '.mid')];
const crcs: Map<number, string> = new Map();

for (const file of existing) {
    const data = fs.readFileSync(file);
    const crc = Packet.getcrc(data, 0, data.length);

    if (crcs.get(crc)) {
        printWarning(`${file} has CRC collision with ${crcs.get(crc)}`);
    }

    crcs.set(crc, path.basename(file));
}

console.time('midis');
const midiCount = cache.count(3);
for (let i = 0; i < midiCount; i++) {
    const data = cache.read(3, i, true);

    if (data) {
        const crc = Packet.getcrc(data, 0, data.length);
        const existing = crcs.get(crc);

        let name = `midi_${i}`;
        if (existing) {
            name = existing.substring(0, existing.lastIndexOf('.'));
        }

        MidiPack.register(i, name);
        fs.writeFileSync(`${Environment.BUILD_SRC_DIR}/songs/${name}.mid`, data);
    } else {
        const name = `midi_${i}`;
        MidiPack.register(i, name);

        printWarning(`Missing midi id=${i}`);
    }
}
console.timeEnd('midis');

MidiPack.save();
