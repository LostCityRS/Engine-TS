import fs from 'fs';
import path from 'path';

import Environment from '#/util/Environment.js';

async function main() {
    const packPath = path.join(Environment.BUILD_SRC_DIR, 'pack', 'chatcat.pack');

    const dir = path.dirname(packPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    // Generate all 164 entries in 530 with format: id=chatcat_<id>
    const lines: string[] = [];
    for (let id = 0; id < 164; id++) {
        lines.push(`${id}=chatcat_${id}`);
    }

    fs.writeFileSync(packPath, lines.join('\n') + '\n');
    console.log(`Wrote 164 entries to ${packPath}`);
}

main().catch(console.error);

