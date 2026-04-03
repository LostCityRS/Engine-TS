import fs from 'fs';
import path from 'path';

import { compressGz } from '#/io/GZip.js';
import Environment from '#/util/Environment.js';
import FileStream from '#/io/FileStream.js';
import { getArtifactManifestPath, getArtifactSourceStamp, loadArtifactManifest, openArtifactStore, saveArtifactManifest } from '#tools/pack/ArtifactCache.js';
import { didFileSetChange } from '#tools/pack/FsCache.js';
import { MidiPack, shouldBuild, shouldBuildFile } from '#tools/pack/PackFile.js';
import { listFilesExt } from '#tools/pack/Parse.js';

export function packClientMidi(cache: FileStream) {
    const midis = [...listFilesExt(`${Environment.BUILD_SRC_DIR}/jingles`, '.mid'), ...listFilesExt(`${Environment.BUILD_SRC_DIR}/songs`, '.mid')];
    const toolChanged = didFileSetChange('data/pack/.stamps/midi-tools.txt', [Environment.IS_BUN ? __filename : import.meta.filename]);
    const rebuildMidiArchive = shouldBuildFile(`${Environment.BUILD_SRC_DIR}/pack/midi.pack`, 'data/pack/main_file_cache.idx3');
    const needsMidiHydration = rebuildMidiArchive || cache.count(3) === 0;
    const artifactName = 'midi';
    const artifactStore = openArtifactStore(artifactName, rebuildMidiArchive);
    const artifactManifest = loadArtifactManifest(artifactName, rebuildMidiArchive);
    let artifactManifestDirty = false;
    const needsMidiPackWork =
        rebuildMidiArchive || shouldBuild(`${Environment.BUILD_SRC_DIR}/jingles`, '.mid', getArtifactManifestPath(artifactName)) || shouldBuild(`${Environment.BUILD_SRC_DIR}/songs`, '.mid', getArtifactManifestPath(artifactName)) || toolChanged;

    if (rebuildMidiArchive) {
        cache.clearArchive(3);
    }

    if (!needsMidiPackWork && !needsMidiHydration) {
        return;
    }

    for (const file of midis) {
        const name = path.basename(file, '.mid');
        const id = MidiPack.getByName(name);
        const sourceStamp = getArtifactSourceStamp(file);
        const needsRebuild = needsMidiPackWork && (toolChanged || artifactManifest[name] !== sourceStamp || !artifactStore.has(name));
        let packedData: Uint8Array | null = null;

        if (needsRebuild) {
            const data = fs.readFileSync(file);
            if (data.length) {
                packedData = compressGz(data)!;
                artifactStore.write(name, packedData);
            } else {
                packedData = new Uint8Array();
                artifactStore.write(name, packedData);
            }

            artifactManifest[name] = sourceStamp;
            artifactManifestDirty = true;
        }

        if (needsRebuild || needsMidiHydration) {
            packedData ??= artifactStore.read(name);
            if (packedData) {
                cache.write(3, id, packedData, 1);
            }
        }
    }

    if (artifactManifestDirty) {
        saveArtifactManifest(artifactName, artifactManifest);
    }

    artifactStore.save();
}
