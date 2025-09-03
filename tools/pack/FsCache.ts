import fs from 'fs';

const dirCache: Map<string, string[]> = new Map();
const existsCache: Map<string, boolean> = new Map();
const statsCache: Map<string, fs.Stats> = new Map();

export function clearFsCache() {
    dirCache.clear();
    existsCache.clear();
    statsCache.clear();
}

export function fileExists(path: string): boolean {
    if (existsCache.has(path)) {
        return existsCache.get(path)!;
    }

    const exists = fs.existsSync(path);
    existsCache.set(path, exists);
    return exists;
}

export function fileStats(path: string): fs.Stats {
    if (statsCache.has(path)) {
        return statsCache.get(path)!;
    }

    const exists = fs.statSync(path);
    statsCache.set(path, exists);
    return exists;
}

export function listDir(path: string): string[] {
    if (path.endsWith('/')) {
        path = path.substring(0, path.length - 1);
    }

    let files: string[] | undefined = dirCache.get(path);

    if (typeof files === 'undefined') {
        if (!fs.existsSync(path)) {
            return [];
        }

        const entries = fs.readdirSync(path, { withFileTypes: true });

        files = [];
        for (const entry of entries) {
            if (entry.isDirectory()) {
                files.push(`${entry.name}/`);
            } else {
                files.push(entry.name);
            }
        }

        dirCache.set(path, files);
    }

    const all: string[] = [];
    for (let i = 0; i < files.length; i++) {
        all.push(`${path}/${files[i]}`);

        if (files[i].endsWith('/')) {
            all.push(...listDir(`${path}/${files[i]}`));
        }
    }

    return all;
}

export function listFiles(path: string, out: string[] = []) {
    const files = listDir(path);

    for (const file of files) {
        out.push(file);
    }

    return out;
}
