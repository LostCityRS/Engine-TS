import fs from 'fs';

import FileStream from '#/io/FileStream.js';
import Jagfile from '#/io/Jagfile.js';
import Packet from '#/io/Packet.js';
import { AnimPack, MapPack } from '#/util/PackFile.js';

export function packClientVersionList(cache: FileStream, modelFlags: number[]) {
    const versionlist = new Jagfile();

    const modelVersion = Packet.alloc(3);
    const modelCrc = Packet.alloc(4);
    const modelIndex = Packet.alloc(3);
    const modelCount = cache.count(1);
    for (let id = 0; id < modelCount; id++) {
        const data = cache.read(1, id);
        if (data) {
            modelVersion.p2(1);
            modelCrc.p4(Packet.getcrc(data, 0, data.length - 2));
            modelIndex.p1(modelFlags[id] ?? 0);

            /*
            0x80 - player chatheads
            0x40 - item inventory models
            0x20 - item inventory models (f2p)
            0x10 - item worn models
            0x8 - item worn models (f2p)
            0x4 - npc models/chatheads + scenery of anything that is mapped down
            0x2 - anything that spawns dynamically (non mapped down npcs/scenery, spotanims, interfaces)
            0x1 - used on tutorial island
            */
        } else {
            modelVersion.p2(0);
            modelCrc.p4(0);
            modelIndex.p1(0);
        }
    }
    versionlist.write('model_version', modelVersion);
    versionlist.write('model_crc', modelCrc);
    versionlist.write('model_index', modelIndex);

    const animVersion = Packet.alloc(3);
    const animCrc = Packet.alloc(4);
    const animIndex = Packet.alloc(3);
    const animCount = cache.count(2);
    for (let id = 0; id < animCount; id++) {
        const data = cache.read(2, id);
        if (data) {
            animVersion.p2(1);
            animCrc.p4(Packet.getcrc(data, 0, data.length - 2));
        } else {
            animVersion.p2(0);
            animCrc.p4(0);
        }
    }
    for (let id = 0; id < AnimPack.max; id++) {
        animIndex.p2(0);
    }
    versionlist.write('anim_version', animVersion);
    versionlist.write('anim_crc', animCrc);
    versionlist.write('anim_index', animIndex);

    const midiVersion = Packet.alloc(3);
    const midiCrc = Packet.alloc(4);
    const midiIndex = Packet.alloc(3);
    const midiCount = cache.count(3);
    for (let id = 0; id < midiCount; id++) {
        const data = cache.read(3, id);
        if (data) {
            midiVersion.p2(1);
            midiCrc.p4(Packet.getcrc(data, 0, data.length - 2));
            midiIndex.p1(0); // prefetch
        } else {
            midiVersion.p2(0);
            midiCrc.p4(0);
            midiIndex.p1(0);
        }
    }
    versionlist.write('midi_version', midiVersion);
    versionlist.write('midi_crc', midiCrc);
    versionlist.write('midi_index', midiIndex);

    const mapVersion = Packet.alloc(3);
    const mapCrc = Packet.alloc(4);
    const mapIndex = Packet.alloc(4);
    const mapCount = cache.count(4);
    for (let id = 0; id < mapCount; id++) {
        const data = cache.read(4, id);
        if (data) {
            mapVersion.p2(1);
            mapCrc.p4(Packet.getcrc(data, 0, data.length - 2));
        } else {
            mapVersion.p2(0);
            mapCrc.p4(0);
        }
    }

    for (let id = 0; id < MapPack.max; id++) {
        const name = MapPack.getById(id);
        if (name.startsWith('l')) {
            continue;
        }

        const locMapId = MapPack.getByName(name.replace('m', 'l'));
        const [mapX, mapZ] = name.slice(1).split('_');

        mapIndex.p2((parseInt(mapX) << 8) | parseInt(mapZ));
        mapIndex.p2(id); // land map id
        mapIndex.p2(locMapId);
        mapIndex.p1(0); // members
    }
    versionlist.write('map_version', mapVersion);
    versionlist.write('map_crc', mapCrc);
    versionlist.write('map_index', mapIndex);

    versionlist.save('data/pack/client/versionlist');

    cache.write(0, 5, fs.readFileSync('data/pack/client/versionlist'));
}
