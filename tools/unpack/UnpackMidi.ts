import fs from 'fs';

import Environment from '#/util/Environment.js';
import { printWarning, printInfo } from '#/util/Logger.js';
import { getGroup } from '#/util/OpenRS2.js';
import { createPackManager } from '#tools/pack/core/PackManager.js';

// Create directories if they don't exist
if (!fs.existsSync(`${Environment.BUILD_SRC_DIR}/songs`)) {
    fs.mkdirSync(`${Environment.BUILD_SRC_DIR}/songs`, { recursive: true });
}

if (!fs.existsSync(`${Environment.BUILD_SRC_DIR}/jingles`)) {
    fs.mkdirSync(`${Environment.BUILD_SRC_DIR}/jingles`, { recursive: true });
}

console.time('midis');

// Load or create midi pack file
const midiPack = createPackManager('midi');
printInfo(`Loaded pack with ${midiPack.getSize()} existing MIDIs`);

// Fetch MIDI data from OpenRS2 archive 6
const archive = 6;
const maxMidiId = 700;
const foundMidis: { id: number; data: Uint8Array; isJingle: boolean }[] = [];

for (let i = 0; i < maxMidiId; i++) {
    try {
        const data = await getGroup(archive, i);
        if (data && data.length > 0) {
            foundMidis.push({
                id: i,
                data: data,
                isJingle: false,
            });
            
            if (foundMidis.length % 10 === 0) {
                printInfo(`Found ${foundMidis.length} MIDIs so far...`);
            }
        }
    } catch (_e) {
        if (foundMidis.length === 0 && i > 50) {
            printWarning(`No MIDIs found after trying ${i} IDs. Stopping.`);
            break;
        }
        if (i % 100 === 0) {
            printInfo(`Tried ${i} IDs, found ${foundMidis.length} so far...`);
        }
    }
}

printInfo(`Found ${foundMidis.length} MIDIs`);

for (const midi of foundMidis) {
    // Get or register name for this MIDI ID
    const name = midiPack.getName(midi.id);

    const dir = midi.isJingle ? 'jingles' : 'songs';
    fs.writeFileSync(`${Environment.BUILD_SRC_DIR}/${dir}/${name}.mid`, midi.data);
    printInfo(`  ${midi.id}: ${name}.mid (${midi.data.length} bytes)`);
}

// Save pack file with any new IDs that were discovered
midiPack.save();

console.timeEnd('midis');
