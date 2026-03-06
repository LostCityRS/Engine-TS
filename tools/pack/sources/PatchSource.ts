import fs from 'fs';
import path from 'path';

import Environment from '#/util/Environment.js';

export type PatchSourceFile = {
    name: string;
    filePath: string;
};

export type PatchPackEntry = PatchSourceFile & {
    id: number;
};

export function extractPatchId(name: string): number {
    if (!name.startsWith('patch_')) {
        return -1;
    }

    const parsed = parseInt(name.slice(6));
    return Number.isNaN(parsed) ? -1 : parsed;
}

export function listAllPatchSourceFiles(): PatchSourceFile[] {
    const dir = path.join(Environment.BUILD_SRC_DIR, 'patches');
    if (!fs.existsSync(dir)) {
        return [];
    }

    return fs.readdirSync(dir)
        .filter(filename => filename.endsWith('.patch'))
        .map(filename => {
            const ext = path.extname(filename);
            const name = filename.slice(0, -ext.length);
            return {
                name,
                filePath: path.join(dir, filename)
            };
        });
}

export function listPatchPackEntries(): PatchPackEntry[] {
    const entries: PatchPackEntry[] = [];

    for (const patch of listAllPatchSourceFiles()) {
        const id = extractPatchId(patch.name);
        if (id >= 0) {
            entries.push({
                id,
                name: patch.name,
                filePath: patch.filePath
            });
        }
    }

    entries.sort((a, b) => a.id - b.id);
    return entries;
}

export function resolvePatchPathByName(name: string): string | null {
    const patchPath = path.join(Environment.BUILD_SRC_DIR, 'patches', `${name}.patch`);
    if (fs.existsSync(patchPath)) {
        return patchPath;
    }

    return null;
}
