import fs from 'fs';
import path from 'path';

import { compressGz } from '#/io/GZip.js';
import Environment from '#/util/Environment.js';
import FileStream from '#/io/FileStream.js';
import { didFileSetChange } from '#tools/pack/FsCache.js';
import { MidiPack, shouldBuild, shouldBuildFile } from '#tools/pack/PackFile.js';
import { listFilesExt } from '#tools/pack/Parse.js';

function hasUnexpectedPackedFiles(dir: string, expected: Set<string>) {
    if (!fs.existsSync(dir)) {
        return false;
    }

    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
        if (!file.isFile() || !expected.has(file.name)) {
            return true;
        }
    }

    return false;
}

export function packClientMidi(cache: FileStream) {
    fs.mkdirSync('data/pack/client/midi', { recursive: true });

    const midis = [...listFilesExt(`${Environment.BUILD_SRC_DIR}/jingles`, '.mid'), ...listFilesExt(`${Environment.BUILD_SRC_DIR}/songs`, '.mid')];
    const expectedMidis = new Set(midis.map(file => path.basename(file, '.mid')));
    const toolChanged = didFileSetChange('data/pack/.stamps/midi-tools.txt', [Environment.IS_BUN ? __filename : import.meta.filename]);
    const rebuildMidiArchive = shouldBuildFile(`${Environment.BUILD_SRC_DIR}/pack/midi.pack`, 'data/pack/main_file_cache.idx3') || hasUnexpectedPackedFiles('data/pack/client/midi', expectedMidis);
    const needsMidiHydration = rebuildMidiArchive || cache.count(3) === 0;
    const needsMidiPackWork =
        rebuildMidiArchive || shouldBuild(`${Environment.BUILD_SRC_DIR}/jingles`, '.mid', 'data/pack/main_file_cache.idx3') || shouldBuild(`${Environment.BUILD_SRC_DIR}/songs`, '.mid', 'data/pack/main_file_cache.idx3') || toolChanged;

    if (rebuildMidiArchive) {
        cache.clearArchive(3);
    }

    if (!needsMidiPackWork && !needsMidiHydration) {
        return;
    }

    for (const file of midis) {
        const name = path.basename(file, '.mid');
        const id = MidiPack.getByName(name);
        const packedFile = `data/pack/client/midi/${name}`;
        const needsRebuild = needsMidiPackWork && (toolChanged || shouldBuildFile(file, packedFile));

        if (needsRebuild) {
            const data = fs.readFileSync(file);
            if (data.length) {
                fs.writeFileSync(packedFile, compressGz(data)!);
            }
        }

        if (needsRebuild || needsMidiHydration) {
            cache.write(3, id, fs.readFileSync(packedFile), 1);
        }
    }
}
