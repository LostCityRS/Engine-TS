import fs from 'fs';
import path from 'path';

import { PackFile } from '#tools/pack/core/PackFile.js';
import { listMidiPackEntries } from '#tools/pack/sources/MidiSource.js';
import Environment from '#/util/Environment.js';

const midiPack = new PackFile('midi');

for (const midi of listMidiPackEntries()) {
    midiPack.register(midi.id, midi.name);
}

// Create directories if needed
const packDir = `${Environment.BUILD_SRC_DIR}/pack`;
if (!fs.existsSync(packDir)) {
    fs.mkdirSync(packDir, { recursive: true });
}

// Save pack file
const packPath = path.join(packDir, 'midi.pack');
midiPack.save(packPath);
console.log(`\nSaved to ${packPath}`);
