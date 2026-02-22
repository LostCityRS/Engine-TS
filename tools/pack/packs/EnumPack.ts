import { PackFile } from '#tools/pack/core/PackFile.js';

const enumPack = new PackFile('enum');
enumPack.load('data/src/pack/enum.pack');

export function getEnumId(name: string): number {
    return enumPack.getByName(name);
}

export function getEnumName(id: number): string {
    return enumPack.getById(id);
}

export function hasEnumName(name: string): boolean {
    return enumPack.names.has(name);
}

export function getAllEnumNames(): string[] {
    return Array.from(enumPack.names);
}
