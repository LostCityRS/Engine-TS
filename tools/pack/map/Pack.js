import fs from 'fs';

import NpcType from '#/cache/config/NpcType.js';

import { compressGz } from '#/io/GZip.js';
import Packet from '#/io/Packet.js';

import Environment from '#/util/Environment.js';
import { printWarning } from '#/util/Logger.js';

import { MapPack, shouldBuildFile } from '#tools/pack/PackFile.js';

function packKey(level, x, z) {
    return (level << 12) | (x << 6) | z;
}

function readMap(lines) {
    const land = new Map();
    const loc = new Map();
    const npc = new Map();
    const obj = new Map();

    let section = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.charCodeAt(0) === 61) { // '='
            section = line.slice(4, -4).slice(1, 4);
            continue;
        }

        const colon = line.indexOf(':');
        const sp1 = line.indexOf(' ');
        const sp2 = line.indexOf(' ', sp1 + 1);

        const level = line.charCodeAt(0) - 48;
        const x = parseInt(line.slice(sp1 + 1, sp2));
        const z = parseInt(line.slice(sp2 + 1, colon));
        const key = packKey(level, x, z);
        const data = line.slice(colon + 2);

        if (section === 'MAP') {
            let h = 0, overlayId = -1, overlayShape = -1, overlayRot = -1, flags = -1, underlay = -1;
            let start = 0;
            while (start < data.length) {
                const end = data.indexOf(' ', start);
                const token = end === -1 ? data.slice(start) : data.slice(start, end);
                const type = token.charCodeAt(0);
                const info = token.slice(1);

                if (type === 104) { // 'h'
                    h = parseInt(info);
                } else if (type === 111) { // 'o'
                    const sc1 = info.indexOf(';');
                    const sc2 = sc1 === -1 ? -1 : info.indexOf(';', sc1 + 1);
                    overlayId = sc1 === -1 ? parseInt(info) : parseInt(info.slice(0, sc1));
                    overlayShape = sc1 === -1 ? -1 : parseInt(info.slice(sc1 + 1, sc2 === -1 ? undefined : sc2));
                    overlayRot = sc2 === -1 ? -1 : parseInt(info.slice(sc2 + 1));
                } else if (type === 102) { // 'f'
                    flags = parseInt(info);
                } else if (type === 117) { // 'u'
                    underlay = parseInt(info);
                }

                if (end === -1) {
                    break;
                }

                start = end + 1;
            }
            land.set(key, { h, overlayId, overlayShape, overlayRot, flags, underlay });
        } else if (section === 'LOC') {
            const parts = data.split(' ');
            const id = parseInt(parts[0]);
            const shape = parts.length > 1 ? parseInt(parts[1]) : 10;
            const angle = parts.length > 2 ? parseInt(parts[2]) : 0;
            const entry = loc.get(key);
            if (entry) {
                entry.push({ id, shape, angle });
            } else {
                loc.set(key, [{ id, shape, angle }]);
            }
        } else if (section === 'NPC') {
            const id = parseInt(data);
            const entry = npc.get(key);
            if (entry) {
                entry.push(id);
            } else {
                npc.set(key, [id]);
            }
        } else if (section === 'OBJ') {
            const sp = data.indexOf(' ');
            const id = parseInt(data.slice(0, sp));
            const count = parseInt(data.slice(sp + 1));
            const entry = obj.get(key);
            if (entry) {
                entry.push({ id, count });
            } else {
                obj.set(key, [{ id, count }]);
            }
        }
    }

    return { land, loc, npc, obj };
}

function readMapSection(lines, ...sections) {
    const sectionSet = new Set(sections);
    const npc = new Map();
    let section = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.charCodeAt(0) === 61) {
            section = line.slice(4, -4).slice(1, 4);
            continue;
        }
        if (!sectionSet.has(section)) {
            continue;
        }

        // only NPC parsing needed at this time for model flags
        const colon = line.indexOf(':');
        const sp1 = line.indexOf(' ');
        const sp2 = line.indexOf(' ', sp1 + 1);

        const level = line.charCodeAt(0) - 48;
        const x = parseInt(line.slice(sp1 + 1, sp2));
        const z = parseInt(line.slice(sp2 + 1, colon));
        const key = (level << 12) | (x << 6) | z;
        const data = line.slice(colon + 2);

        const id = parseInt(data);
        const entry = npc.get(key);
        if (entry) {
            entry.push(id);
        } else {
            npc.set(key, [id]);
        }
    }

    return { npc };
}

function updateModelFlags(npcMap, modelFlags) {
    for (const [_key, ids] of npcMap) {
        for (const id of ids) {
            const type = NpcType.get(id);
            if (type.models) {
                for (const model of type.models) {
                    modelFlags[model] |= 0x4;
                }
            }
            if (type.heads) {
                for (const model of type.heads) {
                    modelFlags[model] |= 0x4;
                }
            }
        }
    }
}

export function packMaps(cache, modelFlags) {
    if (!fs.existsSync(`${Environment.BUILD_SRC_DIR}/maps`)) {
        return;
    }

    if (!fs.existsSync('data/pack/client/maps')) {
        fs.mkdirSync('data/pack/client/maps', { recursive: true });
    }

    if (!fs.existsSync('data/pack/server/maps')) {
        fs.mkdirSync('data/pack/server/maps', { recursive: true });
    }

    NpcType.load('data/pack');

    const maps = [];
    for (let id = 0; id < MapPack.max; id++) {
        const name = MapPack.getById(id);
        if (!name.startsWith('m')) {
            continue;
        }

        maps.push(name);
    }

    for (const name of maps) {
        const mapXZ = name.slice(1);
        const file = `${Environment.BUILD_SRC_DIR}/maps/m${mapXZ}.jm2`;

        if (!fs.existsSync(file)) {
            printWarning(`missing map m${mapXZ}`);
            continue;
        }

        const mapFile = `data/pack/client/maps/m${mapXZ}`;
        const locFile = `data/pack/client/maps/l${mapXZ}`;
        const serverMapFile = `data/pack/server/maps/m${mapXZ}`;
        const serverLocFile = `data/pack/server/maps/l${mapXZ}`;
        const serverNpcFile = `data/pack/server/maps/n${mapXZ}`;
        const serverObjFile = `data/pack/server/maps/o${mapXZ}`;
        const packerUpdated = shouldBuildFile(Environment.IS_BUN ? __filename : import.meta.filename, mapFile);
        const needsRebuild = packerUpdated || shouldBuildFile(file, mapFile);

        const data = fs
            .readFileSync(file, 'utf8')
            .replace(/\r/g, '')
            .split('\n')
            .filter(x => x.length);
        if (!needsRebuild) {
            // only parse NPC section for model flags
            const map = readMapSection(data, 'NPC');
            updateModelFlags(map.npc, modelFlags);
            cache.write(4, MapPack.getByName(`m${mapXZ}`), fs.readFileSync(mapFile), 1);
            cache.write(4, MapPack.getByName(`l${mapXZ}`), fs.readFileSync(locFile), 1);
            continue;
        }

        const map = readMap(data);

        // encode land data
        {
            const TILES = 64 * 64;
            const STRIDE = 4 * TILES;

            const levelHeightmap = new Int16Array(STRIDE);
            const levelTileOverlayIds = new Int16Array(STRIDE).fill(-1);
            const levelTileOverlayShape = new Int16Array(STRIDE).fill(-1);
            const levelTileOverlayRotation = new Int16Array(STRIDE).fill(-1);
            const levelTileFlags = new Int16Array(STRIDE).fill(-1);
            const levelTileUnderlayIds = new Int16Array(STRIDE).fill(-1);

            for (const [key, tile] of map.land) {
                const idx = key;
                levelHeightmap[idx] = tile.h;
                levelTileOverlayIds[idx] = tile.overlayId;
                levelTileOverlayShape[idx] = tile.overlayShape;
                levelTileOverlayRotation[idx] = tile.overlayRot;
                levelTileFlags[idx] = tile.flags;
                levelTileUnderlayIds[idx] = tile.underlay;
            }

            let out = Packet.alloc(3);
            for (let i = 0; i < STRIDE; i++) {
                const height = levelHeightmap[i];
                const overlay = levelTileOverlayIds[i];
                const shape = levelTileOverlayShape[i];
                const rotation = levelTileOverlayRotation[i];
                const flags = levelTileFlags[i];
                const underlay = levelTileUnderlayIds[i];

                if (height === 0 && overlay === -1 && flags === -1 && underlay === -1) {
                    // default values
                    out.p1(0);
                    continue;
                }

                if (overlay !== -1) {
                    let opcode = 2;
                    if (shape !== -1) {
                        opcode += shape << 2;
                    }
                    if (rotation !== -1) {
                        opcode += rotation;
                    }
                    out.p1(opcode);
                    out.p1(overlay);
                }

                if (flags !== -1) {
                    out.p1(flags + 49);
                }

                if (underlay !== -1) {
                    out.p1(underlay + 81);
                }

                if (height !== 0) {
                    // specific height
                    out.p1(1);
                    out.p1(height);
                } else {
                    // perlin noise
                    out.p1(0);
                }
            }

            const data = out.data.subarray(0, out.pos);
            fs.writeFileSync(mapFile, compressGz(data));
            fs.writeFileSync(serverMapFile, data);
            out.release();
        }

        // encode loc data
        {
            const allLocs = [];
            for (const [key, entries] of map.loc) {
                for (const { id, shape, angle } of entries) {
                    allLocs.push(id << 14 | key, shape, angle);
                }
            }
            const locList = [];
            for (const [key, entries] of map.loc) {
                const level = (key >> 12) & 0x3;
                const x = (key >> 6) & 0x3f;
                const z = key & 0x3f;
                for (const { id, shape, angle } of entries) {
                    locList.push({ id, level, x, z, shape, angle });
                }
            }
            locList.sort((a, b) => a.id !== b.id ? a.id - b.id : ((a.level << 12 | a.x << 6 | a.z) - (b.level << 12 | b.x << 6 | b.z)));

            let out = Packet.alloc(3);
            let lastLocId = -1;
            let lastLocData = 0;
            let i = 0;
            while (i < locList.length) {
                const id = locList[i].id;
                out.psmart(id - lastLocId);
                lastLocId = id;
                lastLocData = 0;

                while (i < locList.length && locList[i].id === id) {
                    const { level, x, z, shape, angle } = locList[i++];
                    const currentLocData = (level << 12) | (x << 6) | z;
                    out.psmart(currentLocData - lastLocData + 1);
                    lastLocData = currentLocData;
                    out.p1((shape << 2) | angle);
                }
                out.psmart(0); // end of this loc
            }
            out.psmart(0); // end of map

            const data = out.data.subarray(0, out.pos);
            fs.writeFileSync(locFile, compressGz(data));
            fs.writeFileSync(serverLocFile, data);
            out.release();
        }

        // encode npc data
        {
            let out = Packet.alloc(1);

            for (const [key, ids] of map.npc) {
                out.p2(key);
                out.p1(ids.length);
                for (const id of ids) {
                    out.p2(id);
                }
            }

            out.save(serverNpcFile);
            out.release();
        }

        // encode obj data
        {
            let out = Packet.alloc(1);

            for (const [key, objs] of map.obj) {
                out.p2(key);
                out.p1(objs.length);
                for (const { id, count } of objs) {
                    out.p2(id);
                    out.p1(count);
                }
            }

            out.save(serverObjFile);
            out.release();
        }

        cache.write(4, MapPack.getByName(`m${mapXZ}`), fs.readFileSync(mapFile), 1);
        cache.write(4, MapPack.getByName(`l${mapXZ}`), fs.readFileSync(locFile), 1);

        updateModelFlags(map.npc, modelFlags);
    }
}
