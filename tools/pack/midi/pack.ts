import fs from 'fs';

import BZip2 from '#/io/BZip2.js';
import Environment from '#/util/Environment.js';
import { shouldBuild } from '#tools/pack/PackFile.js';

export function packClientMusic() {
    if (!shouldBuild(`${Environment.BUILD_SRC_DIR}/jingles`, '', 'data/pack/client/jingles')) {
        return;
    }

    fs.mkdirSync('data/pack/client/jingles', { recursive: true });
    fs.readdirSync(`${Environment.BUILD_SRC_DIR}/jingles`).forEach(f => {
        // TODO: mtime-based check
        if (fs.existsSync(`data/pack/client/jingles/${f}`)) {
            return;
        }

        const data = fs.readFileSync(`${Environment.BUILD_SRC_DIR}/jingles/${f}`);
        fs.writeFileSync(`data/pack/client/jingles/${f}`, BZip2.compress(data, true));
    });

    // ----

    fs.mkdirSync('data/pack/client/songs', { recursive: true });
    fs.readdirSync(`${Environment.BUILD_SRC_DIR}/songs`).forEach(f => {
        // TODO: mtime-based check
        if (fs.existsSync(`data/pack/client/songs/${f}`)) {
            return;
        }

        const data = fs.readFileSync(`${Environment.BUILD_SRC_DIR}/songs/${f}`);
        fs.writeFileSync(`data/pack/client/songs/${f}`, BZip2.compress(data, true));
    });
}
