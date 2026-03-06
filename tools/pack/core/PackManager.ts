import Environment from '#/util/Environment.js';
import { PackFile } from './PackFile.js';

export class PackManager {
    private pack: PackFile;
    private packPath: string;

    constructor(type: string) {
        this.pack = new PackFile(type);
        this.packPath = `${Environment.BUILD_SRC_DIR}/pack/${type}.pack`;
        this.pack.load(this.packPath);
    }

    public getName(id: number): string {
        let name = this.pack.getById(id);
        if (!name) {
            name = `${this.pack.type}_${id}`;
            this.pack.register(id, name);
            this.save();
        }
        return name;
    }

    public getNameIfExists(id: number): string | undefined {
        const name = this.pack.getById(id);
        return name || undefined;
    }

    public setName(id: number, name: string): void {
        this.pack.register(id, name);
        this.save();
    }

    public getId(name: string): number {
        return this.pack.getByName(name);
    }

    public hasName(name: string): boolean {
        return this.pack.names.has(name);
    }

    public hasId(id: number): boolean {
        return this.pack.pack.has(id);
    }

    public getAll(): Array<[number, string]> {
        return Array.from(this.pack.pack.entries());
    }

    public getSize(): number {
        return this.pack.size;
    }

    public save(): void {
        this.pack.save(this.packPath);
    }

    public forceSave(): void {
        this.save();
    }
}

export function createPackManager(type: string): PackManager {
    return new PackManager(type);
}
