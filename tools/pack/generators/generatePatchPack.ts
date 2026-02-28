import fs from 'fs';
import path from 'path';

import { PackFile } from '#tools/pack/core/PackFile.js';
import { listPatchPackEntries } from '#tools/pack/sources/PatchSource.js';
import Environment from '#/util/Environment.js';

const patchPack = new PackFile('patch');

for (const patchEntry of listPatchPackEntries()) {
    patchPack.register(patchEntry.id, patchEntry.name);
}

const packDir = `${Environment.BUILD_SRC_DIR}/pack`;
if (!fs.existsSync(packDir)) {
    fs.mkdirSync(packDir, { recursive: true });
}

const packPath = path.join(packDir, 'patch.pack');
patchPack.save(packPath);
console.log(`\nSaved to ${packPath}`);
