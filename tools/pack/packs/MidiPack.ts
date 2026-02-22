import { PackFile } from '#tools/pack/core/PackFile.js';

const midiPack = new PackFile('midi');
midiPack.load('data/src/pack/midi.pack');

export function getMidiId(name: string): number {
    return midiPack.getByName(name);
}

export function getMidiName(id: number): string {
    return midiPack.getById(id);
}

export function hasMidiName(name: string): boolean {
    return midiPack.names.has(name);
}

export function getAllMidiNames(): string[] {
    return Array.from(midiPack.names);
}
