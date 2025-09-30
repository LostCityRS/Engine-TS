import fs from 'fs';

import { SynthPack } from '#tools/pack/PackFile.js';
import Environment from '#/util/Environment.js';

const args = process.argv.slice(2);
if (args.length < 2) {
    process.exit(1);
}

const id = parseInt(args[0]);
const dst = args[1];

const src = SynthPack.getById(id);
if (src.length === 0) {
    process.exit(1);
}

if (fs.existsSync(`${Environment.BUILD_SRC_DIR}/synth/${dst}.synth`)) {
    process.exit(1);
}

fs.renameSync(`${Environment.BUILD_SRC_DIR}/synth/${src}.synth`, `${Environment.BUILD_SRC_DIR}/synth/${dst}.synth`);

SynthPack.register(id, dst);
SynthPack.save();
