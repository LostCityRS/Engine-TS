import fs from 'fs';
import path from 'path';

import { CompressionType } from '#/io/CompressionType.js';
import { splitGroupFiles } from '#/io/Js5ArchiveIndex.js';
import { unpackJs5Group } from '#/io/Js5Group.js';
import Environment from '#/util/Environment.js';
import { resolveSectionId } from '#tools/cache/lib/configSource.js';
import { encodeObjOps, type ObjOpcode } from '#tools/cache/lib/objCodec.js';
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
    exactTarget: 'server' | 'client';
    help: boolean;
};

type ObjSourceField = {
    key: string;
    value: string;
    line: number;
};

type ObjSourceSection = {
    name: string;
    line: number;
    fields: ObjSourceField[];
};

const CERT_TEMPLATE_ID = 799;
const LENT_TEMPLATE_ID = 13009;
const SERVER_ONLY_OBJ_OPCODES = new Set<number>([3, 13, 14, 15, 27, 75, 94, 123, 201]);

function parseArgs(argv: string[]): Args {
    const args: Args = {
        src: path.join(Environment.BUILD_SRC_DIR, 'scripts', '_unpack', '530', 'all.obj'),
        out: 'data/pack',
        archive: 19,
        exact: false,
        exactTarget: 'server',
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
            args.exactTarget = 'server';
        } else if (arg === '--exact-client') {
            args.exact = true;
            args.exactTarget = 'client';
        } else if (arg === '--no-exact') {
            args.exact = false;
            args.exactTarget = 'server';
        } else if (arg === '--help' || arg === '-h') {
            args.help = true;
        }
    }

    return args;
}

function parseObjSourceSections(content: string): ObjSourceSection[] {
    const lines = content.split('\n');
    const sections: ObjSourceSection[] = [];
    let current: ObjSourceSection | null = null;

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

function parseWeightValue(value: string): number {
    const normalized = value.trim().toLowerCase();
    const match = /^([+-]?\d+(?:\.\d+)?)\s*(kg|oz|lb|g)$/.exec(normalized);
    if (!match) {
        throw new Error(`Invalid weight value: ${value}`);
    }

    const amount = Number(match[1]);
    const unit = match[2];
    let grams = 0;

    if (unit === 'kg') {
        grams = amount * 1000;
    } else if (unit === 'oz') {
        grams = amount * 28.3495;
    } else if (unit === 'lb') {
        grams = amount * 453.592;
    } else {
        grams = amount;
    }

    const rounded = Math.round(grams);
    if (rounded < -32768 || rounded > 32767) {
        throw new Error(`Weight out of int16 range: ${value}`);
    }

    return rounded;
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

function extractLinkedSourceIdFromSectionName(sectionName: string, kind: 'cert' | 'lent'): number | undefined {
    const prefix = `${kind}_obj_`;
    if (!sectionName.startsWith(prefix)) {
        return undefined;
    }

    const rest = sectionName.substring(prefix.length);
    const first = rest.split('_')[0];
    const parsed = Number(first);
    if (!Number.isInteger(parsed) || parsed < 0) {
        return undefined;
    }

    return parsed;
}

function parseSourceObjs(content: string, nameToId: Map<string, number>, paramNameToId: Map<string, number>): Map<number, ObjOpcode[]> {
    const sections = parseObjSourceSections(content);
    const byId = new Map<number, ObjOpcode[]>();
    const sectionNameById = new Map<number, string>();

    for (const section of sections) {
        const id = resolveSectionId(section.name, nameToId, 'obj_');

        if (id === null) {
            throw new Error(`Unknown obj name: ${section.name}`);
        }

        sectionNameById.set(id, section.name);

        const ops: ObjOpcode[] = [];

        for (let i = 0; i < section.fields.length; i++) {
            const field = section.fields[i];
            const key = field.key;
            const value = field.value;

            if (/^op\d+$/.test(key)) {
                const opNum = Number(key.slice(2));
                if (opNum >= 1 && opNum <= 5) {
                    ops.push({ code: 29 + opNum, payload: value });
                    continue;
                }

                const code = opNum;
                let payload: any;
                try {
                    payload = JSON.parse(value);
                } catch (err) {
                    throw new Error(`Invalid JSON payload for ${field.key} at ${section.name}:${field.line}: ${err}`);
                }
                ops.push({ code, payload });
                continue;
            }

            if (/^iop[1-5]$/.test(key)) {
                const idx = Number(key.slice(3));
                ops.push({ code: 34 + idx, payload: value });
                continue;
            }

            if (key === 'model') {
                ops.push({ code: 1, payload: parseKeyValueNumber(value, key) });
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
            if (key === 'zoom2d') {
                ops.push({ code: 4, payload: parseKeyValueNumber(value, key) });
                continue;
            }
            if (key === 'xan2d') {
                ops.push({ code: 5, payload: parseKeyValueNumber(value, key) });
                continue;
            }
            if (key === 'yan2d') {
                ops.push({ code: 6, payload: parseKeyValueNumber(value, key) });
                continue;
            }
            if (key === 'xof2d') {
                ops.push({ code: 7, payload: parseKeyValueNumber(value, key) });
                continue;
            }
            if (key === 'yof2d') {
                ops.push({ code: 8, payload: parseKeyValueNumber(value, key) });
                continue;
            }
            if (key === 'stackable' && value.trim() === 'yes') {
                ops.push({ code: 11, payload: true });
                continue;
            }
            if (key === 'cost') {
                ops.push({ code: 12, payload: parseKeyValueNumber(value, key) });
                continue;
            }
            if (key === 'wearpos') {
                ops.push({ code: 13, payload: parseKeyValueNumber(value, key) });
                continue;
            }
            if (key === 'wearpos2') {
                ops.push({ code: 14, payload: parseKeyValueNumber(value, key) });
                continue;
            }
            if (key === 'tradeable' && value.trim() === 'no') {
                ops.push({ code: 15, payload: true });
                continue;
            }
            if (key === 'members' && value.trim() === 'yes') {
                ops.push({ code: 16, payload: true });
                continue;
            }
            if (key === 'manwear') {
                ops.push({ code: 23, payload: parseKeyValueNumber(value, key) });
                continue;
            }
            if (key === 'manwear2') {
                ops.push({ code: 24, payload: parseKeyValueNumber(value, key) });
                continue;
            }
            if (key === 'womanwear') {
                ops.push({ code: 25, payload: parseKeyValueNumber(value, key) });
                continue;
            }
            if (key === 'womanwear2') {
                ops.push({ code: 26, payload: parseKeyValueNumber(value, key) });
                continue;
            }
            if (key === 'wearpos3') {
                ops.push({ code: 27, payload: parseKeyValueNumber(value, key) });
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

            if (key === 'stockmarket' && value.trim() === 'yes') {
                ops.push({ code: 65, payload: true });
                continue;
            }
            if (key === 'weight') {
                ops.push({ code: 75, payload: parseWeightValue(value) });
                continue;
            }
            if (key === 'manwear3') {
                ops.push({ code: 78, payload: parseKeyValueNumber(value, key) });
                continue;
            }
            if (key === 'womanwear3') {
                ops.push({ code: 79, payload: parseKeyValueNumber(value, key) });
                continue;
            }
            if (key === 'manhead') {
                ops.push({ code: 90, payload: parseKeyValueNumber(value, key) });
                continue;
            }
            if (key === 'womanhead') {
                ops.push({ code: 91, payload: parseKeyValueNumber(value, key) });
                continue;
            }
            if (key === 'manhead2') {
                ops.push({ code: 92, payload: parseKeyValueNumber(value, key) });
                continue;
            }
            if (key === 'womanhead2') {
                ops.push({ code: 93, payload: parseKeyValueNumber(value, key) });
                continue;
            }
            if (key === 'category') {
                ops.push({ code: 94, payload: parseKeyValueNumber(value, key) });
                continue;
            }
            if (key === 'zan2d') {
                ops.push({ code: 95, payload: parseKeyValueNumber(value, key) });
                continue;
            }
            if (key === 'dummyitem') {
                const normalized = value.trim().toLowerCase();
                if (normalized === 'graphic_only') {
                    ops.push({ code: 96, payload: 1 });
                } else if (normalized === 'inv_only') {
                    ops.push({ code: 96, payload: 2 });
                } else {
                    ops.push({ code: 96, payload: parseKeyValueNumber(value, key) });
                }
                continue;
            }
            if (key === 'certlink') {
                ops.push({ code: 97, payload: parseKeyValueNumber(value, key) });
                continue;
            }
            if (key === 'certtemplate') {
                ops.push({ code: 98, payload: parseKeyValueNumber(value, key) });
                continue;
            }

            const countObjMatch = /^countobj(\d+)$/.exec(key);
            if (countObjMatch) {
                const idx = Number(countObjMatch[1]);
                const countField = section.fields[i + 1];
                if (!countField || countField.key !== `countco${idx}`) {
                    throw new Error(`Expected countco${idx} after countobj${idx} at ${section.name}:${field.line}`);
                }
                ops.push({
                    code: 99 + idx,
                    payload: {
                        obj: parseKeyValueNumber(value, key),
                        count: parseKeyValueNumber(countField.value, countField.key)
                    }
                });
                i += 1;
                continue;
            }

            if (key === 'resizex') {
                ops.push({ code: 110, payload: parseKeyValueNumber(value, key) });
                continue;
            }
            if (key === 'resizey') {
                ops.push({ code: 111, payload: parseKeyValueNumber(value, key) });
                continue;
            }
            if (key === 'resizez') {
                ops.push({ code: 112, payload: parseKeyValueNumber(value, key) });
                continue;
            }
            if (key === 'ambient') {
                ops.push({ code: 113, payload: parseKeyValueNumber(value, key) });
                continue;
            }
            if (key === 'contrast') {
                ops.push({ code: 114, payload: parseKeyValueNumber(value, key) });
                continue;
            }
            if (key === 'team') {
                ops.push({ code: 115, payload: parseKeyValueNumber(value, key) });
                continue;
            }
            if (key === 'lentlink') {
                ops.push({ code: 121, payload: parseKeyValueNumber(value, key) });
                continue;
            }
            if (key === 'lenttemplate') {
                ops.push({ code: 122, payload: parseKeyValueNumber(value, key) });
                continue;
            }
            if (key === 'lendable' && value.trim() === 'yes') {
                ops.push({ code: 123, payload: true });
                continue;
            }
            if (key === 'manwearoffset') {
                const [x, yz] = parsePair(value, key);
                const [y, z] = parsePair(yz, key);
                ops.push({
                    code: 125,
                    payload: {
                        x: parseIntStrict(x, `${key}.x`),
                        y: parseIntStrict(y, `${key}.y`),
                        z: parseIntStrict(z, `${key}.z`)
                    }
                });
                continue;
            }
            if (key === 'womanwearoffset') {
                const [x, yz] = parsePair(value, key);
                const [y, z] = parsePair(yz, key);
                ops.push({
                    code: 126,
                    payload: {
                        x: parseIntStrict(x, `${key}.x`),
                        y: parseIntStrict(y, `${key}.y`),
                        z: parseIntStrict(z, `${key}.z`)
                    }
                });
                continue;
            }
            if (key === 'cursor1op') {
                const next = section.fields[i + 1];
                if (!next || next.key !== 'cursor1') {
                    throw new Error(`Expected cursor1 after cursor1op at ${section.name}:${field.line}`);
                }
                ops.push({ code: 127, payload: { op: parseKeyValueNumber(value, key), cursor: parseKeyValueNumber(next.value, next.key) } });
                i += 1;
                continue;
            }
            if (key === 'cursor2op') {
                const next = section.fields[i + 1];
                if (!next || next.key !== 'cursor2') {
                    throw new Error(`Expected cursor2 after cursor2op at ${section.name}:${field.line}`);
                }
                ops.push({ code: 128, payload: { op: parseKeyValueNumber(value, key), cursor: parseKeyValueNumber(next.value, next.key) } });
                i += 1;
                continue;
            }
            if (key === 'cursor1iop') {
                const next = section.fields[i + 1];
                if (!next || next.key !== 'cursor1i') {
                    throw new Error(`Expected cursor1i after cursor1iop at ${section.name}:${field.line}`);
                }
                ops.push({ code: 129, payload: { op: parseKeyValueNumber(value, key), cursor: parseKeyValueNumber(next.value, next.key) } });
                i += 1;
                continue;
            }
            if (key === 'cursor2iop') {
                const next = section.fields[i + 1];
                if (!next || next.key !== 'cursor2i') {
                    throw new Error(`Expected cursor2i after cursor2iop at ${section.name}:${field.line}`);
                }
                ops.push({ code: 130, payload: { op: parseKeyValueNumber(value, key), cursor: parseKeyValueNumber(next.value, next.key) } });
                i += 1;
                continue;
            }
            if (key === 'respawnrate') {
                ops.push({ code: 201, payload: parseKeyValueNumber(value, key) });
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

    for (const [name, id] of nameToId) {
        if (byId.has(id)) {
            continue;
        }

        const certTarget = extractLinkedSourceIdFromSectionName(name, 'cert');
        if (certTarget !== undefined) {
            byId.set(id, [
                { code: 97, payload: certTarget },
                { code: 98, payload: CERT_TEMPLATE_ID }
            ]);
            continue;
        }

        const lentTarget = extractLinkedSourceIdFromSectionName(name, 'lent');
        if (lentTarget !== undefined) {
            byId.set(id, [
                { code: 121, payload: lentTarget },
                { code: 122, payload: LENT_TEMPLATE_ID }
            ]);
        }
    }

    const certBySource = new Map<number, number>();
    const lentBySource = new Map<number, number>();
    for (const [id, ops] of byId) {
        const hasCertTemplate = ops.some(op => op.code === 98);
        if (hasCertTemplate) {
            const certLink = ops.find(op => op.code === 97);
            const sourceIdFromName = extractLinkedSourceIdFromSectionName(sectionNameById.get(id) ?? '', 'cert');
            const sourceId = certLink ? Number(certLink.payload) : sourceIdFromName;
            if (sourceId !== undefined) {
                const existing = certBySource.get(sourceId);
                if (existing === undefined || id < existing) {
                    certBySource.set(sourceId, id);
                }
            }
        }

        const hasLentTemplate = ops.some(op => op.code === 122);
        if (hasLentTemplate) {
            const lentLink = ops.find(op => op.code === 121);
            const sourceIdFromName = extractLinkedSourceIdFromSectionName(sectionNameById.get(id) ?? '', 'lent');
            const sourceId = lentLink ? Number(lentLink.payload) : sourceIdFromName;
            if (sourceId !== undefined) {
                const existing = lentBySource.get(sourceId);
                if (existing === undefined || id < existing) {
                    lentBySource.set(sourceId, id);
                }
            }
        }
    }

    for (const [id, ops] of byId) {
        const hasCertLink = ops.some(op => op.code === 97);
        const hasCertTemplate = ops.some(op => op.code === 98);
        const hasLentLink = ops.some(op => op.code === 121);
        const hasLentTemplate = ops.some(op => op.code === 122);

        if (hasCertTemplate && !hasCertLink) {
            const sourceFromName = extractLinkedSourceIdFromSectionName(sectionNameById.get(id) ?? '', 'cert');
            if (sourceFromName !== undefined) {
                const templateIndex = ops.findIndex(op => op.code === 98);
                const certLinkOp: ObjOpcode = { code: 97, payload: sourceFromName };
                ops.splice(templateIndex, 0, certLinkOp);
            }
        }

        if (hasLentTemplate && !hasLentLink) {
            const sourceFromName = extractLinkedSourceIdFromSectionName(sectionNameById.get(id) ?? '', 'lent');
            if (sourceFromName !== undefined) {
                const templateIndex = ops.findIndex(op => op.code === 122);
                const lentLinkOp: ObjOpcode = { code: 121, payload: sourceFromName };
                ops.splice(templateIndex, 0, lentLinkOp);
            }
        }

        const derivedCertId = !hasCertLink && !hasCertTemplate ? certBySource.get(id) : undefined;
        const derivedLentId = !hasLentLink && !hasLentTemplate ? lentBySource.get(id) : undefined;

        const findLastOffset = (): number => {
            for (let i = ops.length - 1; i >= 0; i--) {
                if (ops[i].code === 125 || ops[i].code === 126) {
                    return i;
                }
            }
            return -1;
        };

        const findParamStart = (): number => {
            const index = ops.findIndex(op => op.code === 249 || op.code === 250);
            return index === -1 ? ops.length : index;
        };

        if (derivedCertId !== undefined) {
            const certLinkOp: ObjOpcode = { code: 97, payload: derivedCertId };
            const lastOffset = findLastOffset();
            let insertAt = findParamStart();
            if (lastOffset !== -1) {
                insertAt = lastOffset + 1;
            }
            ops.splice(insertAt, 0, certLinkOp);
        }

        if (derivedLentId !== undefined) {
            const lentLinkOp: ObjOpcode = { code: 121, payload: derivedLentId };
            const certIndex = ops.findIndex(op => op.code === 97);
            const lastOffset = findLastOffset();
            const paramStart = findParamStart();
            let insertAt = paramStart;
            if (lastOffset !== -1) {
                insertAt = Math.min(paramStart, lastOffset + 1);
            }
            if (certIndex !== -1) {
                insertAt = Math.max(insertAt, certIndex + 1);
            }
            ops.splice(insertAt, 0, lentLinkOp);
        }

        const nameIndex = ops.findIndex(op => op.code === 2);
        if (nameIndex !== -1) {
            const [nameOp] = ops.splice(nameIndex, 1);
            let anchor = ops.findIndex(op => op.code === 97 || op.code === 121 || op.code === 123 || op.code === 125 || op.code === 126 || op.code === 249 || op.code === 250);
            if (anchor === -1) {
                anchor = ops.length;
            }
            ops.splice(anchor, 0, nameOp);
        }
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
    const objLocalPackPath = path.join(localPackDir, 'obj.pack');
    const objFallbackPackPath = path.join(fallbackPackDir, 'obj.pack');
    const nameToId = new Map<string, number>();
    if (fs.existsSync(objFallbackPackPath)) {
        for (const [name, id] of parsePackFile(objFallbackPackPath)) {
            nameToId.set(name, id);
        }
    }
    if (fs.existsSync(objLocalPackPath)) {
        for (const [name, id] of parsePackFile(objLocalPackPath)) {
            nameToId.set(name, id);
        }
    }
    const paramLocalPackPath = path.join(localPackDir, 'param.pack');
    const paramFallbackPackPath = path.join(fallbackPackDir, 'param.pack');
    const paramNameToId = new Map<string, number>();
    if (fs.existsSync(paramFallbackPackPath)) {
        for (const [name, id] of parsePackFile(paramFallbackPackPath)) {
            paramNameToId.set(name, id);
        }
    }
    if (fs.existsSync(paramLocalPackPath)) {
        for (const [name, id] of parsePackFile(paramLocalPackPath)) {
            paramNameToId.set(name, id);
        }
    }

    const sourceContent = fs.readFileSync(args.src, 'utf-8');
    const objOpsById = parseSourceObjs(sourceContent, nameToId, paramNameToId);

    const referenceIndex = loadReferenceArchiveIndex(args.archive);
    if (!referenceIndex) {
        throw new Error(`Reference index not found for archive ${args.archive}`);
    }

    const encodedByGroup = new Map<number, Map<number, Uint8Array>>();
    const encodedByGroupClient = new Map<number, Map<number, Uint8Array>>();
    let hasServerOnlyObjOps = false;
    for (const [id, ops] of objOpsById) {
        const groupId = id >> 8;
        const fileId = id & 0xff;

        const encoded = encodeObjOps(ops);
        const clientOps = ops.filter(op => !SERVER_ONLY_OBJ_OPCODES.has(op.code));
        const encodedClient = encodeObjOps(clientOps);
        if (clientOps.length !== ops.length) {
            hasServerOnlyObjOps = true;
        }

        if (!encodedByGroup.has(groupId)) {
            encodedByGroup.set(groupId, new Map());
        }
        if (!encodedByGroupClient.has(groupId)) {
            encodedByGroupClient.set(groupId, new Map());
        }

        encodedByGroup.get(groupId)!.set(fileId, encoded);
        encodedByGroupClient.get(groupId)!.set(fileId, encodedClient);
    }

    const indexPath = `data/cache/255/${args.archive}.dat`;
    if (!fs.existsSync(indexPath)) {
        throw new Error(`Index file not found: ${indexPath}`);
    }

    const indexPacked = new Uint8Array(fs.readFileSync(indexPath));
    const groupIds = parseGroupIdsFromIndexPacked(indexPacked);

    const buildArchiveOutput = async (groups: Map<number, Map<number, Uint8Array>>, exactMode: boolean): Promise<Uint8Array> => {
        const finalGroupContainers = new Map<number, Uint8Array>();

        for (const groupId of groupIds) {
            const originals = await readOriginalGroupContainer(args.archive, groupId);
            const encodedFiles = groups.get(groupId);

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

            if (exactMode) {
                const originalUncompressed = unpackJs5Group(originals);
                if (!arraysEqual(originalUncompressed, combined)) {
                    const originalFiles = splitGroupFiles(originalUncompressed, orderedFileIds);
                    let mismatchFileId: number | null = null;
                    let mismatchOffset = -1;
                    let leftBytes: Uint8Array | null = null;
                    let rightBytes: Uint8Array | null = null;
                    for (const fileId of orderedFileIds) {
                        const left = originalFiles.get(fileId) ?? new Uint8Array(0);
                        const right = encodedFiles.get(fileId) ?? new Uint8Array(0);
                        if (!arraysEqual(left, right)) {
                            mismatchFileId = fileId;
                            leftBytes = left;
                            rightBytes = right;
                            const minLen = Math.min(left.length, right.length);
                            for (let i = 0; i < minLen; i++) {
                                if (left[i] !== right[i]) {
                                    mismatchOffset = i;
                                    break;
                                }
                            }
                            if (mismatchOffset === -1 && left.length !== right.length) {
                                mismatchOffset = minLen;
                            }
                            break;
                        }
                    }

                    const mismatchId = mismatchFileId !== null ? ((groupId << 8) | mismatchFileId) : null;
                    let detail = '';
                    if (leftBytes && rightBytes && mismatchOffset >= 0) {
                        const start = Math.max(0, mismatchOffset - 8);
                        const endL = Math.min(leftBytes.length, mismatchOffset + 8);
                        const endR = Math.min(rightBytes.length, mismatchOffset + 8);
                        const leftWindow = Array.from(leftBytes.subarray(start, endL)).map(b => b.toString(16).padStart(2, '0')).join(' ');
                        const rightWindow = Array.from(rightBytes.subarray(start, endR)).map(b => b.toString(16).padStart(2, '0')).join(' ');
                        const leftAt = mismatchOffset < leftBytes.length ? leftBytes[mismatchOffset] : -1;
                        const rightAt = mismatchOffset < rightBytes.length ? rightBytes[mismatchOffset] : -1;
                        detail = ` diffOffset=${mismatchOffset} leftByte=${leftAt} rightByte=${rightAt} ` +
                            `leftLen=${leftBytes.length} rightLen=${rightBytes.length} ` +
                            `leftWindow[${start}..${endL})=${leftWindow} rightWindow[${start}..${endR})=${rightWindow}`;
                    }
                    throw new Error(
                        `Exact mode mismatch for group ${groupId}` +
                        (mismatchFileId !== null ? ` file=${mismatchFileId} id=${mismatchId}` : '') +
                        `: generated payload differs from reference cache.${detail}`
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
        return output;
    };

    const exactServer = args.exact && args.exactTarget === 'server';
    const exactClient = args.exact && args.exactTarget === 'client';

    const output = await buildArchiveOutput(encodedByGroup, exactServer);
    const clientOutput = await buildArchiveOutput(encodedByGroupClient, exactClient);

    const serverDir = path.join(args.out, 'server');
    const clientDir = path.join(args.out, 'client');
    ensureDir(serverDir);
    ensureDir(clientDir);

    const serverOut = path.join(serverDir, 'server.obj.config.js5');
    const clientOut = path.join(clientDir, 'client.obj.config.js5');

    fs.writeFileSync(serverOut, output);
    fs.writeFileSync(clientOut, clientOutput);

    console.log(`Packed obj archive with ${groupIds.length} groups and ${objOpsById.size} obj configs`);
    if (args.exact) {
        console.log(`Exact validation target: ${args.exactTarget}`);
        if (hasServerOnlyObjOps && args.exactTarget === 'server') {
            console.log('Server exact mode will fail when server-only object opcodes deviate from reference cache.');
        }
    }
    console.log(`Wrote ${serverOut}`);
    console.log(`Wrote ${clientOut}`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
