import fs from 'fs';
import { PackFile } from '#tools/pack/core/PackFile.js';

function extractFloNames(content: string): string[] {
    const names: string[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();
        
        if (trimmed.startsWith('[flo_') && trimmed.endsWith(']')) {
            const name = trimmed.substring(1, trimmed.length - 1);
            if (!names.includes(name)) {
                names.push(name);
            }
        }
    }

    return names;
}

function extractFloId(name: string): number | null {
    if (!name.startsWith('flo_')) {
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
    const srcPath = 'data/src/all.flo';
    const packPath = 'data/src/pack/flo.pack';

    if (!fs.existsSync(srcPath)) {
        throw new Error(`Source file not found: ${srcPath}`);
    }

    const content = fs.readFileSync(srcPath, 'utf-8');
    const names = extractFloNames(content);

    console.log(`Found ${names.length} floor overlay definitions`);

    const pack = new PackFile('flo');

    // Register all names with their IDs
    for (const name of names) {
        const id = extractFloId(name);
        if (id !== null) {
            pack.register(id, name);
        } else {
            console.warn(`Warning: Could not extract ID from name: ${name}`);
        }
    }

    // Write with header comment
    const dir = packPath.substring(0, packPath.lastIndexOf('/'));
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
