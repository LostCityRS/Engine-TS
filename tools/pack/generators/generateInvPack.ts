import fs from 'fs';
import { PackFile } from '#tools/pack/core/PackFile.js';
import Environment from '#/util/Environment.js';
import path from 'path';

function extractInvNames(content: string): string[] {
    const names: string[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();
        
        if (trimmed.startsWith('[inv_') && trimmed.endsWith(']')) {
            const name = trimmed.substring(1, trimmed.length - 1);
            if (!names.includes(name)) {
                names.push(name);
            }
        }
    }

    return names;
}

function extractInvId(name: string): number | null {
    if (!name.startsWith('inv_')) {
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
    const srcPath = path.join(Environment.BUILD_SRC_DIR, 'scripts', '_unpack', '530', 'all.inv');
    const packPath = path.join(Environment.BUILD_SRC_DIR, 'pack', 'inv.pack');

    if (!fs.existsSync(srcPath)) {
        throw new Error(`Source file not found: ${srcPath}`);
    }

    const content = fs.readFileSync(srcPath, 'utf-8');
    const names = extractInvNames(content);

    console.log(`Found ${names.length} inventory definitions`);

    const pack = new PackFile('inv');

    // Register all names with their IDs
    for (const name of names) {
        const id = extractInvId(name);
        if (id !== null) {
            pack.register(id, name);
        } else {
            console.warn(`Warning: Could not extract ID from name: ${name}`);
        }
    }

    pack.save(packPath);
    console.log(`Saved inv.pack to ${packPath}`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
