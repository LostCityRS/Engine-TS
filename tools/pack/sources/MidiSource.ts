import fs from 'fs';
import path from 'path';

import Environment from '#/util/Environment.js';

export type MidiSourceKind = 'songs' | 'jingles';

export type MidiSourceFile = {
    name: string;
    filePath: string;
    kind: MidiSourceKind;
};

export type MidiPackEntry = MidiSourceFile & {
    id: number;
};

export function extractMidiId(name: string): number {
    if (!name.startsWith('midi_')) {
        return -1;
    }

    const parsed = parseInt(name.slice(5));
    return Number.isNaN(parsed) ? -1 : parsed;
}

function listMidisInDir(kind: MidiSourceKind): MidiSourceFile[] {
    const dir = path.join(Environment.BUILD_SRC_DIR, kind);
    if (!fs.existsSync(dir)) {
        return [];
    }

    return fs.readdirSync(dir)
        .filter(filename => filename.endsWith('.mid'))
        .map(filename => {
            const name = filename.slice(0, -4);
            return {
                name,
                filePath: path.join(dir, filename),
                kind,
            };
        });
}

export function listAllMidiSourceFiles(): MidiSourceFile[] {
    return [
        ...listMidisInDir('songs'),
        ...listMidisInDir('jingles'),
    ];
}

export function listMidiPackEntries(): MidiPackEntry[] {
    const entries: MidiPackEntry[] = [];

    for (const midi of listAllMidiSourceFiles()) {
        const id = extractMidiId(midi.name);
        if (id >= 0) {
            entries.push({
                id,
                name: midi.name,
                filePath: midi.filePath,
                kind: midi.kind,
            });
        }
    }

    entries.sort((a, b) => a.id - b.id);
    return entries;
}

export function resolveMidiPathByName(name: string): string | null {
    const songsPath = path.join(Environment.BUILD_SRC_DIR, 'songs', `${name}.mid`);
    if (fs.existsSync(songsPath)) {
        return songsPath;
    }

    const jinglesPath = path.join(Environment.BUILD_SRC_DIR, 'jingles', `${name}.mid`);
    if (fs.existsSync(jinglesPath)) {
        return jinglesPath;
    }

    return null;
}
