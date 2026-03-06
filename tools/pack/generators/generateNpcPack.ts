import fs from 'fs';
import path from 'path';

import Environment from '#/util/Environment.js';
import { PackFile } from '#tools/pack/core/PackFile.js';

function extractNpcNames(content: string): string[] {
    const names: string[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('[npc_') && trimmed.endsWith(']')) {
            const name = trimmed.substring(1, trimmed.length - 1);
            if (!names.includes(name)) {
                names.push(name);
            }
        }
    }

    return names;
}

function extractNpcId(name: string): number | null {
    if (!name.startsWith('npc_')) {
        return null;
    }

    const idPart = name.substring(4);
    const id = parseInt(idPart);
    if (isNaN(id)) {
        return null;
    }

    return id;
}

async function main() {
    const srcPath = path.join(Environment.BUILD_SRC_DIR, 'scripts', '_unpack', '530', 'all.npc');
    const packPath = path.join(Environment.BUILD_SRC_DIR, 'pack', 'npc.pack');

    if (!fs.existsSync(srcPath)) {
        throw new Error(`Source file not found: ${srcPath}`);
    }

    const content = fs.readFileSync(srcPath, 'utf-8');
    const names = extractNpcNames(content);

    console.log(`Found ${names.length} npc definitions`);

    const pack = new PackFile('npc');
    for (const name of names) {
        const id = extractNpcId(name);
        if (id !== null) {
            pack.register(id, name);
        }
    }

    const dir = path.dirname(packPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    const entries = Array.from(pack.pack.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([id, name]) => `${id}=${name}`)
        .join('\n') + '\n';

    fs.writeFileSync(packPath, entries);
    console.log(`Wrote ${pack.size} entries to ${packPath}`);
}

main().catch(console.error);
