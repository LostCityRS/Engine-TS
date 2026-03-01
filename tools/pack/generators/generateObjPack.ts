import fs from 'fs';
import path from 'path';

import { splitGroupFiles } from '#/io/Js5ArchiveIndex.js';
import { unpackJs5Group } from '#/io/Js5Group.js';
import Packet from '#/io/Packet.js';
import Environment from '#/util/Environment.js';
import { decodeObjOpcode } from '#tools/cache/lib/objCodec.js';
import { loadReferenceArchiveIndex, readGroupBytes } from '#tools/cache/lib/js5Tools.js';
import { PackFile } from '#tools/pack/core/PackFile.js';

const OBJ_ARCHIVE = 19;
const CERT_TEMPLATE_ID = 799;
const LENT_TEMPLATE_ID = 13009;

type ObjSection = {
    name: string;
    id: number;
    fields: Array<{ key: string; value: string }>;
};

function parseObjSections(content: string, existingNameToId: Map<string, number>): ObjSection[] {
    const sections: ObjSection[] = [];
    const lines = content.split('\n');
    let current: ObjSection | null = null;

    for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            const name = trimmed.substring(1, trimmed.length - 1);
            const existingId = existingNameToId.get(name);
            const id = existingId !== undefined ? existingId : extractObjId(name);
            if (id !== null) {
                current = {
                    name,
                    id,
                    fields: []
                };
                sections.push(current);
            }
            continue;
        }

        if (!current || trimmed.length === 0 || trimmed.startsWith('//')) {
            continue;
        }

        const eq = line.indexOf('=');
        if (eq === -1) {
            continue;
        }

        const key = line.substring(0, eq).trim();
        const value = line.substring(eq + 1).trim();
        if (key.length === 0) {
            continue;
        }

        current.fields.push({ key, value });
    }

    return sections;
}

function extractObjId(name: string): number | null {
    if (!name.startsWith('obj_')) {
        return null;
    }

    const idPart = name.substring(4);
    const id = parseInt(idPart);
    if (isNaN(id)) {
        return null;
    }

    return id;
}

function parseObjReference(value: string): number | null {
    const numeric = parseInt(value, 10);
    if (!isNaN(numeric)) {
        return numeric;
    }

    if (value.startsWith('obj_')) {
        return extractObjId(value);
    }

    if (value.startsWith('cert_obj_')) {
        return extractObjId(value.substring('cert_'.length));
    }

    if (value.startsWith('lent_obj_')) {
        return extractObjId(value.substring('lent_'.length));
    }

    return null;
}

function parseLinkedTargetFromSectionName(name: string, kind: 'cert' | 'lent'): number | null {
    const prefix = `${kind}_obj_`;
    if (!name.startsWith(prefix)) {
        return null;
    }

    const rest = name.substring(prefix.length);
    const first = rest.split('_')[0];
    const id = parseInt(first, 10);
    return isNaN(id) ? null : id;
}

function collectCertObjectNames(sections: ObjSection[]): Map<number, string> {
    const certNames = new Map<number, string>();

    for (const section of sections) {
        let hasCertTemplate = false;
        let certLinkTarget: number | null = null;

        for (const field of section.fields) {
            if (field.key === 'certtemplate') {
                const templateId = parseObjReference(field.value);
                if (templateId !== null && templateId >= 0) {
                    hasCertTemplate = true;
                }
            }

            if (field.key === 'certlink') {
                const linkId = parseObjReference(field.value);
                if (linkId !== null && linkId >= 0) {
                    certLinkTarget = linkId;
                }
            }
        }

        if (certLinkTarget === null) {
            certLinkTarget = parseLinkedTargetFromSectionName(section.name, 'cert');
        }

        if (hasCertTemplate && certLinkTarget !== null) {
            certNames.set(section.id, `cert_obj_${certLinkTarget}`);
        } else if (hasCertTemplate) {
            certNames.set(section.id, section.name.startsWith('cert_') ? section.name : `cert_${section.name}`);
        }
    }

    return certNames;
}

function collectLentObjectNames(sections: ObjSection[]): Map<number, string> {
    const lentNames = new Map<number, string>();

    for (const section of sections) {
        let hasLentTemplate = false;
        let lentLinkTarget: number | null = null;

        for (const field of section.fields) {
            if (field.key === 'lenttemplate') {
                const templateId = parseObjReference(field.value);
                if (templateId !== null && templateId >= 0) {
                    hasLentTemplate = true;
                }
            }

            if (field.key === 'lentlink') {
                const linkId = parseObjReference(field.value);
                if (linkId !== null && linkId >= 0) {
                    lentLinkTarget = linkId;
                }
            }
        }

        if (lentLinkTarget === null) {
            lentLinkTarget = parseLinkedTargetFromSectionName(section.name, 'lent');
        }

        if (hasLentTemplate && lentLinkTarget !== null) {
            lentNames.set(section.id, `lent_obj_${lentLinkTarget}`);
        } else if (hasLentTemplate) {
            lentNames.set(section.id, section.name.startsWith('lent_') ? section.name : `lent_${section.name}`);
        }
    }

    return lentNames;
}

function allocateUniqueName(baseName: string, id: number, usedNames: Set<string>): string {
    if (!usedNames.has(baseName)) {
        return baseName;
    }

    const withId = `${baseName}_${id}`;
    if (!usedNames.has(withId)) {
        return withId;
    }

    let suffix = 2;
    while (usedNames.has(`${withId}_${suffix}`)) {
        suffix += 1;
    }

    return `${withId}_${suffix}`;
}

async function collectLinkedObjectNamesFromCache(): Promise<{ cert: Map<number, string>; lent: Map<number, string> }> {
    const certNames = new Map<number, string>();
    const lentNames = new Map<number, string>();

    const index = loadReferenceArchiveIndex(OBJ_ARCHIVE);
    if (!index) {
        return { cert: certNames, lent: lentNames };
    }

    for (const groupId of index.groupIds) {
        const fileIds = index.fileIdsByGroup.get(groupId);
        if (!fileIds || fileIds.length === 0) {
            continue;
        }

        const groupPacked = await readGroupBytes(OBJ_ARCHIVE, groupId, 'data/cache', true);
        if (!groupPacked) {
            continue;
        }

        const groupUnpacked = unpackJs5Group(groupPacked);
        const files = splitGroupFiles(groupUnpacked, fileIds);

        for (const fileId of fileIds) {
            const fileData = files.get(fileId) ?? new Uint8Array(0);
            const id = (groupId << 8) | fileId;
            const dat = new Packet(fileData);

            let certLink: number | null = null;
            let certTemplate: number | null = null;
            let lentLink: number | null = null;
            let lentTemplate: number | null = null;

            while (dat.available > 0) {
                const code = dat.g1();
                if (code === 0) {
                    break;
                }

                const payload = decodeObjOpcode(code, dat);
                if (code === 97) {
                    certLink = Number(payload);
                } else if (code === 98) {
                    certTemplate = Number(payload);
                } else if (code === 121) {
                    lentLink = Number(payload);
                } else if (code === 122) {
                    lentTemplate = Number(payload);
                }
            }

            if (certTemplate === CERT_TEMPLATE_ID && certLink !== null) {
                certNames.set(id, `cert_obj_${certLink}`);
            }

            if (lentTemplate === LENT_TEMPLATE_ID && lentLink !== null) {
                lentNames.set(id, `lent_obj_${lentLink}`);
            }
        }
    }

    return { cert: certNames, lent: lentNames };
}

async function main() {
    const srcPath = path.join(Environment.BUILD_SRC_DIR, 'scripts', '_unpack', '530', 'all.obj');
    const packPath = path.join(Environment.BUILD_SRC_DIR, 'pack', 'obj.pack');

    if (!fs.existsSync(srcPath)) {
        throw new Error(`Source file not found: ${srcPath}`);
    }

    const content = fs.readFileSync(srcPath, 'utf-8');
    const existingPack = new PackFile('obj');
    existingPack.load(packPath);
    const sections = parseObjSections(content, new Map(existingPack.nameToId));
    const cacheLinkedNames = await collectLinkedObjectNamesFromCache();
    const certObjectNames = collectCertObjectNames(sections);
    const lentObjectNames = collectLentObjectNames(sections);

    for (const [id, name] of cacheLinkedNames.cert) {
        certObjectNames.set(id, name);
    }
    for (const [id, name] of cacheLinkedNames.lent) {
        lentObjectNames.set(id, name);
    }

    console.log(`Found ${sections.length} obj definitions (${certObjectNames.size} cert objects, ${lentObjectNames.size} lent objects)`);

    const pack = new PackFile('obj');
    const usedNames = new Set<string>();

    for (const section of sections) {
        let desiredName = `obj_${section.id}`;
        if (lentObjectNames.has(section.id)) {
            desiredName = lentObjectNames.get(section.id)!;
        }
        if (certObjectNames.has(section.id)) {
            desiredName = certObjectNames.get(section.id)!;
        }
        const uniqueName = allocateUniqueName(desiredName, section.id, usedNames);
        usedNames.add(uniqueName);
        pack.register(section.id, uniqueName);
    }

    for (const [id, existingName] of existingPack.pack.entries()) {
        if (pack.pack.has(id)) {
            continue;
        }

        let desiredName = existingName;
        if (lentObjectNames.has(id)) {
            desiredName = lentObjectNames.get(id)!;
        }
        if (certObjectNames.has(id)) {
            desiredName = certObjectNames.get(id)!;
        }

        const uniqueName = allocateUniqueName(desiredName, id, usedNames);
        usedNames.add(uniqueName);
        pack.register(id, uniqueName);
    }

    for (const [id, name] of cacheLinkedNames.lent) {
        if (!pack.pack.has(id)) {
            const uniqueName = allocateUniqueName(name, id, usedNames);
            usedNames.add(uniqueName);
            pack.register(id, uniqueName);
        }
    }
    for (const [id, name] of cacheLinkedNames.cert) {
        if (!pack.pack.has(id)) {
            const uniqueName = allocateUniqueName(name, id, usedNames);
            usedNames.add(uniqueName);
            pack.register(id, uniqueName);
        }
    }

    const dir = path.dirname(packPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    const entries = Array.from(pack.pack.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([id, name]) => `${id}=${name}`)
        .join('\n') + '\n';

    fs.writeFileSync(packPath, entries);
    console.log(`Wrote ${pack.size} entries to ${packPath}`);
}

main().catch(console.error);
