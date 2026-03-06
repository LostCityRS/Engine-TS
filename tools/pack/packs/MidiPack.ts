import fs from 'fs';
import path from 'path';

import Environment from '#/util/Environment.js';
import { PackFile } from '#tools/pack/core/PackFile.js';

const midiPack = new PackFile('midi');

const midiPackCandidates = [
    path.join(Environment.BUILD_SRC_DIR, 'pack', 'midi.pack'),
    path.join('data', 'src', 'pack', 'midi.pack')
];

for (const candidate of midiPackCandidates) {
    if (fs.existsSync(candidate)) {
        midiPack.load(candidate);
        break;
    }
}

export function getMidiId(name: string): number {
    return midiPack.getByName(name);
}

export function getMidiName(id: number): string {
    return midiPack.getById(id);
}

export function hasMidiId(id: number): boolean {
    return midiPack.pack.has(id);
}

export function hasMidiName(name: string): boolean {
    return midiPack.names.has(name);
}

export function getAllMidiNames(): string[] {
    return Array.from(midiPack.names);
}
