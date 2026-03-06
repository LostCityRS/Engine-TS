import fs from 'fs';
import path from 'path';

import { CompressionType } from '#/io/CompressionType.js';
import { splitGroupFiles } from '#/io/Js5ArchiveIndex.js';
import { unpackJs5Group } from '#/io/Js5Group.js';
import Environment from '#/util/Environment.js';
import {
    resolveSectionId
} from '#tools/cache/lib/configSource.js';
import { encodeNpcOps, type NpcOpcode } from '#tools/cache/lib/npcCodec.js';
import {
    arraysEqual,
    ensureDir,
    parsePackFile,
    compressJs5Group,
    parseGroupIdsFromIndexPacked,
    writeInt32BE,
    loadReferenceArchiveIndex,
    combineGroupFiles,
    readGroupBytes
} from '#tools/cache/lib/js5Tools.js';

type Args = {
    src: string;
    out: string;
    archive: number;
    exact: boolean;
    help: boolean;
};

type NpcSourceField = {
    key: string;
    value: string;
    line: number;
};

type NpcSourceSection = {
    name: string;
    line: number;
    fields: NpcSourceField[];
};

function parseArgs(argv: string[]): Args {
    const args: Args = {
        src: path.join(Environment.BUILD_SRC_DIR, 'scripts', '_unpack', '530', 'all.npc'),
        out: 'data/pack',
        archive: 18,
        exact: false,
        help: false
    };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];

        if (arg === '--src') {
            args.src = argv[++i];
        } else if (arg === '--out') {
            args.out = argv[++i];
        } else if (arg === '--archive') {
            args.archive = Number(argv[++i]);
        } else if (arg === '--exact') {
            args.exact = true;
        } else if (arg === '--no-exact') {
            args.exact = false;
        } else if (arg === '--help' || arg === '-h') {
            args.help = true;
        }
    }

    return args;
}

function parseNpcSourceSections(content: string): NpcSourceSection[] {
    const lines = content.split('\n');
    const sections: NpcSourceSection[] = [];
    let current: NpcSourceSection | null = null;

    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw;
        const trimmed = line.trim();

        if (trimmed.length === 0 || trimmed.startsWith('//')) {
            continue;
        }

        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            current = {
                name: trimmed.substring(1, trimmed.length - 1),
                line: i + 1,
                fields: []
            };
            sections.push(current);
            continue;
        }

        if (!current) {
            continue;
        }

        const eq = line.indexOf('=');
        if (eq === -1) {
            continue;
        }

        const key = line.substring(0, eq).trim();
        const value = line.substring(eq + 1);
        if (key.length === 0) {
            continue;
        }

        current.fields.push({ key, value, line: i + 1 });
    }

    return sections;
}

function parseIntStrict(value: string, context: string): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        throw new Error(`Invalid number for ${context}: ${value}`);
    }
    return parsed;
}

function parseKeyValueNumber(value: string, key: string): number {
    return parseIntStrict(value.trim(), key);
}

function parsePair(value: string, key: string): [string, string] {
    const comma = value.indexOf(',');
    if (comma === -1) {
        throw new Error(`Expected comma-separated value for ${key}: ${value}`);
    }

    const left = value.slice(0, comma).trim();
    const right = value.slice(comma + 1).trim();
    return [left, right];
}

function resolveParamId(name: string, paramNameToId: Map<string, number>): number {
    const id = paramNameToId.get(name);
    if (id !== undefined) {
        return id;
    }

    const numeric = Number(name);
    if (Number.isInteger(numeric) && numeric >= 0) {
        return numeric;
    }

    throw new Error(`Unknown param name: ${name}`);
}

function parseSourceNpcs(content: string, nameToId: Map<string, number>, paramNameToId: Map<string, number>): Map<number, NpcOpcode[]> {
    const sections = parseNpcSourceSections(content);
    const byId = new Map<number, NpcOpcode[]>();

    for (const section of sections) {
        const id = resolveSectionId(section.name, nameToId, 'npc_');
        if (id === null) {
            throw new Error(`Unknown npc name: ${section.name}`);
        }

        const ops: NpcOpcode[] = [];

        for (let i = 0; i < section.fields.length; i++) {
            const field = section.fields[i];
            const key = field.key;
            const value = field.value;

            if (/^op\d+$/.test(key)) {
                const actionCode = Number(key.slice(2));
                if (actionCode >= 1 && actionCode <= 5) {
                    ops.push({ code: 29 + actionCode, payload: value });
                    continue;
                }

                const code = actionCode;
                let payload: any;
                try {
                    payload = JSON.parse(value);
                } catch (err) {
                    throw new Error(`Invalid JSON payload for ${field.key} at ${section.name}:${field.line}: ${err}`);
                }
                ops.push({ code, payload });
                continue;
            }

            if (/^model\d+$/.test(key)) {
                const models: number[] = [parseKeyValueNumber(value, key)];
                while (i + 1 < section.fields.length && /^model\d+$/.test(section.fields[i + 1].key)) {
                    i++;
                    models.push(parseKeyValueNumber(section.fields[i].value, section.fields[i].key));
                }
                ops.push({ code: 1, payload: { models } });
                continue;
            }

            if (key === 'name') {
                ops.push({ code: 2, payload: value });
                continue;
            }

            if (key === 'desc') {
                ops.push({ code: 3, payload: value });
                continue;
            }

            if (key === 'size') {
                ops.push({ code: 12, payload: parseKeyValueNumber(value, key) });
                continue;
            }

            if (key === 'readyanim') {
                ops.push({ code: 13, payload: parseKeyValueNumber(value, key) });
                continue;
            }

            if (key === 'walkanim') {
                const b = section.fields[i + 1];
                const r = section.fields[i + 2];
                const l = section.fields[i + 3];
                if (b?.key === 'walkanim_b' && r?.key === 'walkanim_r' && l?.key === 'walkanim_l') {
                    ops.push({
                        code: 17,
                        payload: {
                            walkanim: parseKeyValueNumber(value, key),
                            walkanim_b: parseKeyValueNumber(b.value, b.key),
                            walkanim_r: parseKeyValueNumber(r.value, r.key),
                            walkanim_l: parseKeyValueNumber(l.value, l.key)
                        }
                    });
                    i += 3;
                } else {
                    ops.push({ code: 14, payload: parseKeyValueNumber(value, key) });
                }
                continue;
            }

            if (key === 'hasanim' && value === 'yes') {
                ops.push({ code: 16, payload: true });
                continue;
            }

            if (key === 'category') {
                ops.push({ code: 18, payload: parseKeyValueNumber(value, key) });
                continue;
            }

            const opMatch = /^op([1-5])$/.exec(key);
            if (opMatch) {
                ops.push({ code: 29 + Number(opMatch[1]), payload: value });
                continue;
            }

            if (/^recol\d+s$/.test(key)) {
                const pairs: Array<{ from: number; to: number }> = [];
                let j = i;
                while (j < section.fields.length) {
                    const sField = section.fields[j];
                    const dField = section.fields[j + 1];
                    if (!sField || !dField || !/^recol\d+s$/.test(sField.key) || !/^recol\d+d$/.test(dField.key)) {
                        break;
                    }
                    pairs.push({
                        from: parseKeyValueNumber(sField.value, sField.key),
                        to: parseKeyValueNumber(dField.value, dField.key)
                    });
                    j += 2;
                }
                if (pairs.length > 0) {
                    ops.push({ code: 40, payload: pairs });
                    i = j - 1;
                    continue;
                }
            }

            if (/^retex\d+s$/.test(key)) {
                const pairs: Array<{ from: number; to: number }> = [];
                let j = i;
                while (j < section.fields.length) {
                    const sField = section.fields[j];
                    const dField = section.fields[j + 1];
                    if (!sField || !dField || !/^retex\d+s$/.test(sField.key) || !/^retex\d+d$/.test(dField.key)) {
                        break;
                    }
                    pairs.push({
                        from: parseKeyValueNumber(sField.value, sField.key),
                        to: parseKeyValueNumber(dField.value, dField.key)
                    });
                    j += 2;
                }
                if (pairs.length > 0) {
                    ops.push({ code: 41, payload: pairs });
                    i = j - 1;
                    continue;
                }
            }

            if (/^recol\d+p$/.test(key)) {
                const values: number[] = [parseKeyValueNumber(value, key)];
                while (i + 1 < section.fields.length && /^recol\d+p$/.test(section.fields[i + 1].key)) {
                    i++;
                    values.push(parseKeyValueNumber(section.fields[i].value, section.fields[i].key));
                }
                ops.push({ code: 42, payload: values });
                continue;
            }

            if (/^head\d+$/.test(key)) {
                const heads: number[] = [parseKeyValueNumber(value, key)];
                while (i + 1 < section.fields.length && /^head\d+$/.test(section.fields[i + 1].key)) {
                    i++;
                    heads.push(parseKeyValueNumber(section.fields[i].value, section.fields[i].key));
                }
                ops.push({ code: 60, payload: heads });
                continue;
            }

            if (key === 'attack') {
                ops.push({ code: 74, payload: parseKeyValueNumber(value, key) });
                continue;
            }
            if (key === 'defence') {
                ops.push({ code: 75, payload: parseKeyValueNumber(value, key) });
                continue;
            }
            if (key === 'strength') {
                ops.push({ code: 76, payload: parseKeyValueNumber(value, key) });
                continue;
            }
            if (key === 'hitpoints') {
                ops.push({ code: 77, payload: parseKeyValueNumber(value, key) });
                continue;
            }
            if (key === 'ranged') {
                ops.push({ code: 78, payload: parseKeyValueNumber(value, key) });
                continue;
            }
            if (key === 'magic') {
                ops.push({ code: 79, payload: parseKeyValueNumber(value, key) });
                continue;
            }

            if (key === 'resizex') {
                ops.push({ code: 90, payload: parseKeyValueNumber(value, key) });
                continue;
            }
            if (key === 'resizey') {
                ops.push({ code: 91, payload: parseKeyValueNumber(value, key) });
                continue;
            }
            if (key === 'resizez') {
                ops.push({ code: 92, payload: parseKeyValueNumber(value, key) });
                continue;
            }
            if (key === 'minimap' && value === 'no') {
                ops.push({ code: 93, payload: true });
                continue;
            }
            if (key === 'vislevel') {
                if (value === 'hide') {
                    ops.push({ code: 95, payload: 0 });
                } else {
                    ops.push({ code: 95, payload: parseKeyValueNumber(value, key) });
                }
                continue;
            }
            if (key === 'resizeh') {
                ops.push({ code: 97, payload: parseKeyValueNumber(value, key) });
                continue;
            }
            if (key === 'resizev') {
                ops.push({ code: 98, payload: parseKeyValueNumber(value, key) });
                continue;
            }
            if (key === 'alwaysontop' && value === 'yes') {
                ops.push({ code: 99, payload: true });
                continue;
            }
            if (key === 'ambient') {
                ops.push({ code: 100, payload: parseKeyValueNumber(value, key) });
                continue;
            }
            if (key === 'contrast') {
                ops.push({ code: 101, payload: parseKeyValueNumber(value, key) });
                continue;
            }
            if (key === 'headicon') {
                ops.push({ code: 102, payload: parseKeyValueNumber(value, key) });
                continue;
            }
            if (key === 'turnspeed') {
                ops.push({ code: 103, payload: parseKeyValueNumber(value, key) });
                continue;
            }

            if (key === 'multivarbit') {
                const multivarbit = parseKeyValueNumber(value, key);
                const varpField = section.fields[i + 1];
                if (!varpField || varpField.key !== 'multivarp') {
                    throw new Error(`Expected multivarp after multivarbit at ${section.name}:${field.line}`);
                }

                i += 1;
                const multivarp = parseKeyValueNumber(varpField.value, varpField.key);
                const multinpc: number[] = [];

                while (i + 1 < section.fields.length && /^multinpc\d+$/.test(section.fields[i + 1].key)) {
                    i += 1;
                    multinpc.push(parseKeyValueNumber(section.fields[i].value, section.fields[i].key));
                }

                let defaultId: number | undefined;
                if (i + 1 < section.fields.length && section.fields[i + 1].key === 'multidefault') {
                    i += 1;
                    defaultId = parseKeyValueNumber(section.fields[i].value, section.fields[i].key);
                }

                ops.push({
                    code: defaultId !== undefined ? 118 : 106,
                    payload: {
                        multivarbit,
                        multivarp,
                        defaultId,
                        multinpc
                    }
                });
                continue;
            }

            if (key === 'active' && value === 'no') {
                ops.push({ code: 107, payload: true });
                continue;
            }
            if (key === 'walksmoothing' && value === 'no') {
                ops.push({ code: 109, payload: true });
                continue;
            }
            if (key === 'spotshadow' && value === 'no') {
                ops.push({ code: 111, payload: true });
                continue;
            }
            if (key === 'spotshadowcolour1') {
                const second = section.fields[i + 1];
                if (!second || second.key !== 'spotshadowcolour2') {
                    throw new Error(`Expected spotshadowcolour2 after spotshadowcolour1 at ${section.name}:${field.line}`);
                }
                ops.push({
                    code: 112,
                    payload: {
                        colour1: parseKeyValueNumber(value, key),
                        colour2: parseKeyValueNumber(second.value, second.key)
                    }
                });
                i += 1;
                continue;
            }
            if (key === 'spotshadowtrans1') {
                const second = section.fields[i + 1];
                if (!second || second.key !== 'spotshadowtrans2') {
                    throw new Error(`Expected spotshadowtrans2 after spotshadowtrans1 at ${section.name}:${field.line}`);
                }
                const trans1 = parseKeyValueNumber(value, key);
                const trans2 = parseKeyValueNumber(second.value, second.key);
                ops.push({ code: 113, payload: { trans1, trans2 } });
                i += 1;
                continue;
            }
            if (key === 'spotshadowtrans1b') {
                const second = section.fields[i + 1];
                if (!second || second.key !== 'spotshadowtrans2b') {
                    throw new Error(`Expected spotshadowtrans2b after spotshadowtrans1b at ${section.name}:${field.line}`);
                }
                const trans1 = parseKeyValueNumber(value, key);
                const trans2 = parseKeyValueNumber(second.value, second.key);
                ops.push({ code: 114, payload: { trans1, trans2 } });
                i += 1;
                continue;
            }
            if (key === 'code115_1') {
                const second = section.fields[i + 1];
                if (!second || second.key !== 'code115_2') {
                    throw new Error(`Expected code115_2 after code115_1 at ${section.name}:${field.line}`);
                }
                ops.push({
                    code: 115,
                    payload: {
                        value1: parseKeyValueNumber(value, key),
                        value2: parseKeyValueNumber(second.value, second.key)
                    }
                });
                i += 1;
                continue;
            }
            if (key === 'walkflags') {
                ops.push({ code: 119, payload: parseKeyValueNumber(value, key) });
                continue;
            }

            if (/^modeloffset\d+$/.test(key)) {
                const offsets: Array<{ index: number; x: number; y: number; z: number }> = [];
                let j = i;
                while (j < section.fields.length && /^modeloffset\d+$/.test(section.fields[j].key)) {
                    const offsetField = section.fields[j];
                    const index = Number(offsetField.key.slice('modeloffset'.length));
                    const parts = offsetField.value.split(',').map(part => part.trim());
                    if (parts.length !== 3) {
                        throw new Error(`Invalid model offset format for ${offsetField.key} at ${section.name}:${offsetField.line}`);
                    }
                    offsets.push({
                        index,
                        x: parseIntStrict(parts[0], `${offsetField.key}.x`),
                        y: parseIntStrict(parts[1], `${offsetField.key}.y`),
                        z: parseIntStrict(parts[2], `${offsetField.key}.z`)
                    });
                    j += 1;
                }
                if (offsets.length > 0) {
                    ops.push({ code: 121, payload: offsets });
                    i = j - 1;
                    continue;
                }
            }

            if (key === 'hitbarid') {
                ops.push({ code: 122, payload: parseKeyValueNumber(value, key) });
                continue;
            }
            if (key === 'overlayheight') {
                ops.push({ code: 123, payload: parseKeyValueNumber(value, key) });
                continue;
            }
            if (key === 'respawndir') {
                ops.push({ code: 125, payload: parseKeyValueNumber(value, key) });
                continue;
            }
            if (key === 'bas') {
                ops.push({ code: 127, payload: parseKeyValueNumber(value, key) });
                continue;
            }
            if (key === 'movespeed') {
                ops.push({ code: 128, payload: parseKeyValueNumber(value, key) });
                continue;
            }
            if (key === 'bgsound') {
                const crawl = section.fields[i + 1];
                const walk = section.fields[i + 2];
                const run = section.fields[i + 3];
                const range = section.fields[i + 4];
                if (!crawl || !walk || !run || !range || crawl.key !== 'bgsound_crawl' || walk.key !== 'bgsound_walk' || run.key !== 'bgsound_run' || range.key !== 'bgsound_range') {
                    throw new Error(`Incomplete bgsound block at ${section.name}:${field.line}`);
                }
                ops.push({
                    code: 134,
                    payload: {
                        bgsound: parseKeyValueNumber(value, key),
                        bgsound_crawl: parseKeyValueNumber(crawl.value, crawl.key),
                        bgsound_walk: parseKeyValueNumber(walk.value, walk.key),
                        bgsound_run: parseKeyValueNumber(run.value, run.key),
                        bgsound_range: parseKeyValueNumber(range.value, range.key)
                    }
                });
                i += 4;
                continue;
            }
            if (key === 'cursor1op') {
                const next = section.fields[i + 1];
                if (!next || next.key !== 'cursor1') {
                    throw new Error(`Expected cursor1 after cursor1op at ${section.name}:${field.line}`);
                }
                ops.push({
                    code: 135,
                    payload: {
                        op: parseKeyValueNumber(value, key),
                        cursor: parseKeyValueNumber(next.value, next.key)
                    }
                });
                i += 1;
                continue;
            }
            if (key === 'cursor2op') {
                const next = section.fields[i + 1];
                if (!next || next.key !== 'cursor2') {
                    throw new Error(`Expected cursor2 after cursor2op at ${section.name}:${field.line}`);
                }
                ops.push({
                    code: 136,
                    payload: {
                        op: parseKeyValueNumber(value, key),
                        cursor: parseKeyValueNumber(next.value, next.key)
                    }
                });
                i += 1;
                continue;
            }
            if (key === 'cursorattack') {
                ops.push({ code: 137, payload: parseKeyValueNumber(value, key) });
                continue;
            }
            if (key === 'wanderrange') {
                ops.push({ code: 200, payload: parseKeyValueNumber(value, key) });
                continue;
            }
            if (key === 'maxrange') {
                ops.push({ code: 201, payload: parseKeyValueNumber(value, key) });
                continue;
            }
            if (key === 'huntrange') {
                ops.push({ code: 202, payload: parseKeyValueNumber(value, key) });
                continue;
            }
            if (key === 'timer') {
                ops.push({ code: 203, payload: parseKeyValueNumber(value, key) });
                continue;
            }
            if (key === 'respawnrate') {
                ops.push({ code: 204, payload: parseKeyValueNumber(value, key) });
                continue;
            }
            if (key === 'moverestrict') {
                ops.push({ code: 206, payload: parseKeyValueNumber(value, key) });
                continue;
            }
            if (key === 'attackrange') {
                ops.push({ code: 207, payload: parseKeyValueNumber(value, key) });
                continue;
            }
            if (key === 'blockwalk') {
                ops.push({ code: 208, payload: parseKeyValueNumber(value, key) });
                continue;
            }
            if (key === 'huntmode') {
                ops.push({ code: 209, payload: parseKeyValueNumber(value, key) });
                continue;
            }
            if (key === 'defaultmode') {
                ops.push({ code: 210, payload: parseKeyValueNumber(value, key) });
                continue;
            }
            if (key === 'members' && value === 'yes') {
                ops.push({ code: 211, payload: true });
                continue;
            }

            if (/^patrol\d+$/.test(key)) {
                const patrol: Array<{ coord: number; delay: number }> = [];
                let j = i;
                while (j < section.fields.length && /^patrol\d+$/.test(section.fields[j].key)) {
                    const patrolField = section.fields[j];
                    const [coord, delay] = parsePair(patrolField.value, patrolField.key);
                    patrol.push({
                        coord: parseIntStrict(coord, `${patrolField.key}.coord`),
                        delay: parseIntStrict(delay, `${patrolField.key}.delay`)
                    });
                    j += 1;
                }
                ops.push({ code: 212, payload: patrol });
                i = j - 1;
                continue;
            }

            if (key === 'givechase' && value === 'no') {
                ops.push({ code: 213, payload: true });
                continue;
            }

            if (key === 'param' || key === 'paramstr') {
                const params: Array<{ string: boolean; key: number; value: number | string }> = [];
                let j = i;

                while (j < section.fields.length && (section.fields[j].key === 'param' || section.fields[j].key === 'paramstr')) {
                    const paramField = section.fields[j];
                    const [paramName, paramValue] = parsePair(paramField.value, paramField.key);
                    params.push({
                        string: paramField.key === 'paramstr',
                        key: resolveParamId(paramName, paramNameToId),
                        value: paramField.key === 'paramstr' ? paramValue : parseIntStrict(paramValue, `${paramField.key}.value`)
                    });
                    j += 1;
                }

                ops.push({ code: 249, payload: params });
                i = j - 1;
                continue;
            }

            if (key === 'debugname') {
                ops.push({ code: 250, payload: value });
                continue;
            }
        }

        byId.set(id, ops);
    }

    return byId;
}

async function readOriginalGroupContainer(archive: number, groupId: number): Promise<Uint8Array> {
    const localPath = `data/cache/${archive}/${groupId}.dat`;
    if (fs.existsSync(localPath)) {
        return new Uint8Array(fs.readFileSync(localPath));
    }

    const fetched = await readGroupBytes(archive, groupId, 'data/cache', true);
    if (!fetched) {
        throw new Error(`Reference cache group not found: data/cache/${archive}/${groupId}.dat`);
    }

    return fetched;
}

async function main() {
    const args = parseArgs(process.argv.slice(2));

    if (!fs.existsSync(args.src)) {
        throw new Error(`Source file not found: ${args.src}`);
    }

    const localPackDir = path.join(path.dirname(args.src), 'pack');
    const fallbackPackDir = path.join(Environment.BUILD_SRC_DIR, 'pack');
    const npcLocalPackPath = path.join(localPackDir, 'npc.pack');
    const npcFallbackPackPath = path.join(fallbackPackDir, 'npc.pack');
    const nameToId = fs.existsSync(npcLocalPackPath) ? parsePackFile(npcLocalPackPath) : parsePackFile(npcFallbackPackPath);
    const paramLocalPackPath = path.join(localPackDir, 'param.pack');
    const paramFallbackPackPath = path.join(fallbackPackDir, 'param.pack');
    const paramNameToId = fs.existsSync(paramLocalPackPath)
        ? parsePackFile(paramLocalPackPath)
        : parsePackFile(paramFallbackPackPath);

    const sourceContent = fs.readFileSync(args.src, 'utf-8');
    const npcOpsById = parseSourceNpcs(sourceContent, nameToId, paramNameToId);

    const referenceIndex = loadReferenceArchiveIndex(args.archive);
    if (!referenceIndex) {
        throw new Error(`Reference index not found for archive ${args.archive}`);
    }

    const encodedByGroup = new Map<number, Map<number, Uint8Array>>();
    for (const [id, ops] of npcOpsById) {
        const groupId = id >> 8;
        const fileId = id & 0xff;

        const encoded = encodeNpcOps(ops);

        if (!encodedByGroup.has(groupId)) {
            encodedByGroup.set(groupId, new Map());
        }

        encodedByGroup.get(groupId)!.set(fileId, encoded);
    }

    const indexPath = `data/cache/255/${args.archive}.dat`;
    if (!fs.existsSync(indexPath)) {
        throw new Error(`Index file not found: ${indexPath}`);
    }

    const indexPacked = new Uint8Array(fs.readFileSync(indexPath));
    const groupIds = parseGroupIdsFromIndexPacked(indexPacked);

    const finalGroupContainers = new Map<number, Uint8Array>();

    for (const groupId of groupIds) {
        const originals = await readOriginalGroupContainer(args.archive, groupId);
        const encodedFiles = encodedByGroup.get(groupId);

        if (!encodedFiles) {
            finalGroupContainers.set(groupId, originals);
            continue;
        }

        const orderedFileIds = referenceIndex.fileIdsByGroup.get(groupId) ?? [];
        if (orderedFileIds.length === 0) {
            finalGroupContainers.set(groupId, originals);
            continue;
        }

        for (const fileId of orderedFileIds) {
            if (!encodedFiles.has(fileId)) {
                encodedFiles.set(fileId, new Uint8Array([0x00]));
            }
        }

        const combined = combineGroupFiles(encodedFiles, orderedFileIds);

        if (args.exact) {
            const originalUncompressed = unpackJs5Group(originals);
            if (!arraysEqual(originalUncompressed, combined)) {
                const originalFiles = splitGroupFiles(originalUncompressed, orderedFileIds);
                let mismatchFileId: number | null = null;
                for (const fileId of orderedFileIds) {
                    const left = originalFiles.get(fileId) ?? new Uint8Array(0);
                    const right = encodedFiles.get(fileId) ?? new Uint8Array(0);
                    if (!arraysEqual(left, right)) {
                        mismatchFileId = fileId;
                        break;
                    }
                }

                const mismatchId = mismatchFileId !== null ? ((groupId << 8) | mismatchFileId) : null;
                throw new Error(
                    `Exact mode mismatch for group ${groupId}` +
                    (mismatchFileId !== null ? ` file=${mismatchFileId} id=${mismatchId}` : '') +
                    ': generated payload differs from reference cache.'
                );
            }

            finalGroupContainers.set(groupId, originals);
            continue;
        }

        const compressionType = originals[0] ?? CompressionType.GZIP;
        const compressed = await compressJs5Group(combined, compressionType);
        finalGroupContainers.set(groupId, compressed);
    }

    const groupBuffers: Uint8Array[] = new Array(groupIds.length);
    const groupLengths: number[] = new Array(groupIds.length).fill(0);

    for (let i = 0; i < groupIds.length; i++) {
        const groupId = groupIds[i];
        const container = finalGroupContainers.get(groupId);

        if (!container) {
            throw new Error(`Missing packed data for group ${groupId}`);
        }

        groupBuffers[i] = container;
        groupLengths[i] = container.length;
    }

    const lengthTable = new Uint8Array(groupIds.length * 4);
    for (let i = 0; i < groupLengths.length; i++) {
        writeInt32BE(groupLengths[i], lengthTable, i * 4);
    }

    const totalGroupBytes = groupLengths.reduce((sum, length) => sum + length, 0);
    const totalSize = indexPacked.length + totalGroupBytes + lengthTable.length;
    const output = new Uint8Array(totalSize);

    let pos = 0;
    output.set(indexPacked, pos);
    pos += indexPacked.length;

    for (const group of groupBuffers) {
        output.set(group, pos);
        pos += group.length;
    }

    output.set(lengthTable, pos);

    const serverDir = path.join(args.out, 'server');
    const clientDir = path.join(args.out, 'client');
    ensureDir(serverDir);
    ensureDir(clientDir);

    const serverOut = path.join(serverDir, 'server.npc.config.js5');
    const clientOut = path.join(clientDir, 'client.npc.config.js5');

    fs.writeFileSync(serverOut, output);
    fs.writeFileSync(clientOut, output);

    console.log(`Packed NPC archive with ${groupIds.length} groups and ${npcOpsById.size} npc configs`);
    console.log(`Wrote ${serverOut}`);
    console.log(`Wrote ${clientOut}`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
