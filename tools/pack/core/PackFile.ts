import fs from 'fs';
import path from 'path';

export class PackFile {
    type: string;
    pack: Map<number, string> = new Map();
    names: Set<string> = new Set();
    nameToId: Map<string, number> = new Map();
    max: number = 0;

    get size() {
        return this.pack.size;
    }

    constructor(type: string) {
        this.type = type;
    }

    load(path: string): void {
        this.pack = new Map();
        this.names = new Set();
        this.nameToId = new Map();
        this.max = 0;

        if (!fs.existsSync(path)) {
            return;
        }

        const content = fs.readFileSync(path, 'utf-8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Skip empty lines and comments
            if (line.length === 0 || line.startsWith('#') || !/^\d+=/g.test(line)) {
                continue;
            }

            const parts = line.split('=');
            if (parts[1].length === 0) {
                throw new Error(`Pack file has an empty name ${path}:${i + 1}`);
            }

            this.register(parseInt(parts[0]), parts[1]);
        }

        this.refreshNames();
    }

    save(filePath: string): void {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        const entries = Array.from(this.pack.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([id, name]) => `${id}=${name}`)
            .join('\n') + '\n';

        fs.writeFileSync(filePath, entries);
    }

    register(id: number, name: string): void {
        this.pack.set(id, name);
        this.names.add(name);
        this.nameToId.set(name, id);

        if (id >= this.max) {
            this.max = id + 1;
        }
    }

    refreshNames(): void {
        this.names = new Set();
        this.nameToId = new Map();

        for (const [id, name] of this.pack) {
            this.names.add(name);
            this.nameToId.set(name, id);
        }
    }

    getById(id: number): string {
        return this.pack.get(id) ?? '';
    }

    getByName(name: string): number {
        const id = this.nameToId.get(name);
        if (typeof id === 'undefined') {
            return -1;
        }
        return id;
    }
}
