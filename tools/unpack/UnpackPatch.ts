import fs from 'fs';

import { unpackJs5Group } from '#/io/Js5Group.js';
import Environment from '#/util/Environment.js';
import { printInfo, printWarning } from '#/util/Logger.js';
import { createPackManager } from '#tools/pack/core/PackManager.js';
import { parseGroupIdsFromIndexPacked } from '#tools/cache/lib/js5Tools.js';

const archive = 15;
const patchesDir = `${Environment.BUILD_SRC_DIR}/patches`;

if (!fs.existsSync(patchesDir)) {
    fs.mkdirSync(patchesDir, { recursive: true });
}

const indexPath = `data/cache/255/${archive}.dat`;
if (!fs.existsSync(indexPath)) {
    throw new Error(`Index file not found: ${indexPath}`);
}

console.time('patches');

const patchPack = createPackManager('patch');
printInfo(`Loaded pack with ${patchPack.getSize()} existing patches`);

const indexPacked = new Uint8Array(fs.readFileSync(indexPath));
const groupIds = parseGroupIdsFromIndexPacked(indexPacked);

let foundPatches = 0;
for (const groupId of groupIds) {
    const groupPath = `data/cache/${archive}/${groupId}.dat`;

    if (!fs.existsSync(groupPath)) {
        continue;
    }

    const container = new Uint8Array(fs.readFileSync(groupPath));
    const payload = unpackJs5Group(container);
    if (!payload || payload.length === 0) {
        continue;
    }

    const name = patchPack.getName(groupId);
    fs.writeFileSync(`${patchesDir}/${name}.patch`, payload);
    foundPatches++;

    if (foundPatches % 50 === 0) {
        printInfo(`Unpacked ${foundPatches} patches so far...`);
    }
}

if (foundPatches === 0) {
    printWarning('No non-empty patches were unpacked.');
} else {
    printInfo(`Unpacked ${foundPatches} patches`);
}

patchPack.save();
console.timeEnd('patches');
