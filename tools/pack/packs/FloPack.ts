import { PackFile } from '#tools/pack/core/PackFile.js';

const floPack = new PackFile('flo');
floPack.load('data/src/pack/flo.pack');

export function getFloId(name: string): number {
    return floPack.getByName(name);
}

export function getFloName(id: number): string {
    return floPack.getById(id);
}

export function hasFloName(name: string): boolean {
    return floPack.names.has(name);
}

export function getAllFloNames(): string[] {
    return Array.from(floPack.names);
}
