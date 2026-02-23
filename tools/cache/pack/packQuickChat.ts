import fs from 'fs';
import path from 'path';

import QuickChatCatType from '#/cache/config/QuickChatCatType.js';
import QuickChatPhraseType from '#/cache/config/QuickChatPhraseType.js';
import { CompressionType } from '#/io/CompressionType.js';
import { parseJs5ArchiveIndex } from '#/io/Js5ArchiveIndex.js';
import { unpackJs5Group } from '#/io/Js5Group.js';
import Environment from '#/util/Environment.js';
import { getGroup } from '#/util/OpenRS2.js';
import { encodeQuickChatCat } from '#tools/cache/lib/quickchatCatCodec.js';
import { encodeQuickChatPhrase } from '#tools/cache/lib/quickchatPhraseCodec.js';
import {
    ensureDir,
    combineGroupFiles,
    compressJs5Group,
    parseGroupIdsFromIndexPacked,
    writeInt32BE
} from '#tools/cache/lib/js5Tools.js';

const DEFAULT_ARCHIVE = 24;
const CAT_GROUP = 0;
const PHRASE_GROUP = 1;

type Args = {
    archive: number;
    catInput: string;
    phraseInput: string;
    catPackInput: string;
    phrasePackInput: string;
    enumPackInput: string;
    out: string;
    mode: 'server' | 'client';
    exact: boolean;
    help: boolean;
};

type ParsedQuickChatCat = {
    id: number;
    config: QuickChatCatType;
    data: Uint8Array;
};

type ParsedQuickChatPhrase = {
    id: number;
    config: QuickChatPhraseType;
    data: Uint8Array;
};

function loadPackFile(packPath: string): Map<string, number> {
    const nameToId = new Map<string, number>();
    if (!fs.existsSync(packPath)) {
        return nameToId;
    }

    const content = fs.readFileSync(packPath, 'utf-8');
    const lines = content.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length === 0 || trimmed.startsWith('#')) {
            continue;
        }

        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) {
            continue;
        }

        const id = parseInt(trimmed.substring(0, eqIdx));
        const name = trimmed.substring(eqIdx + 1);
        if (!isNaN(id)) {
            nameToId.set(name, id);
        }
    }

    return nameToId;
}

function parseArgs(argv: string[]): Args {
    const args: Args = {
        archive: DEFAULT_ARCHIVE,
        catInput: '',
        phraseInput: '',
        catPackInput: path.join(Environment.BUILD_SRC_DIR, 'pack', 'chatcat.pack'),
        phrasePackInput: path.join(Environment.BUILD_SRC_DIR, 'pack', 'chatphrase.pack'),
        enumPackInput: path.join(Environment.BUILD_SRC_DIR, 'pack', 'enum.pack'),
        out: 'data/pack',
        mode: 'server',
        exact: false,
        help: false
    };

    let catInputOverride = false;
    let phraseInputOverride = false;

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];

        if (arg === '--archive') {
            args.archive = Number(argv[++i]);
        } else if (arg === '--cat-input') {
            args.catInput = argv[++i];
            catInputOverride = true;
        } else if (arg === '--phrase-input') {
            args.phraseInput = argv[++i];
            phraseInputOverride = true;
        } else if (arg === '--cat-pack-input') {
            args.catPackInput = argv[++i];
        } else if (arg === '--phrase-pack-input') {
            args.phrasePackInput = argv[++i];
        } else if (arg === '--enum-pack-input') {
            args.enumPackInput = argv[++i];
        } else if (arg === '--mode') {
            const mode = argv[++i];
            if (mode === 'server' || mode === 'client') {
                args.mode = mode;
            }
        } else if (arg === '--exact') {
            args.exact = true;
        } else if (arg === '--out') {
            args.out = argv[++i];
        } else if (arg === '--help' || arg === '-h') {
            args.help = true;
        }
    }

    // Set archive-specific default input paths if not explicitly provided
    if (!catInputOverride) {
        if (args.archive === 24) {
            args.catInput = path.join(Environment.BUILD_SRC_DIR, 'scripts', '_unpack', '530', 'all.chatcat');
        } else if (args.archive === 25) {
            args.catInput = path.join(Environment.BUILD_SRC_DIR, 'scripts', '_unpack', '530', 'all.global.chatcat');
        }
    }

    if (!phraseInputOverride) {
        if (args.archive === 24) {
            args.phraseInput = path.join(Environment.BUILD_SRC_DIR, 'scripts', '_unpack', '530', 'all.chatphrase');
        } else if (args.archive === 25) {
            args.phraseInput = path.join(Environment.BUILD_SRC_DIR, 'scripts', '_unpack', '530', 'all.global.chatphrase');
        }
    }

    return args;
}

function parseQuickChatCat(text: string, catNameToId: Map<string, number>, phraseNameToId: Map<string, number>, validCatIds: number[]): Map<number, ParsedQuickChatCat> {
    const results = new Map<number, ParsedQuickChatCat>();
    const validCatIdSet = new Set(validCatIds);
    
    // First, create all category objects and encode empty ones
    for (const i of validCatIds) {
        const cat = new QuickChatCatType(i);
        cat.subcategories = [];
        cat.subcategoryShortcuts = [];
        cat.phrases = [];
        cat.phraseShortcuts = [];
        cat.hasOpcode4 = false;
        const encoded = encodeQuickChatCat(cat);
        if (encoded) {
            results.set(i, {
                id: i,
                config: cat,
                data: encoded
            });
        }
    }

    // Now parse and update from text config
    const lines = text.split('\n');
    let currentId = -1;

    for (const rawLine of lines) {
        const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
        const trimmed = line.trim();

        if (trimmed.length === 0 || trimmed.startsWith('//')) {
            continue;
        }

        // [chatcat_<id>] or [name]
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            const name = trimmed.substring(1, trimmed.length - 1);
            if (name.startsWith('chatcat_')) {
                currentId = parseInt(name.substring(8));
            } else {
                // Try to look up in pack file
                currentId = catNameToId.get(name) ?? -1;
            }
            continue;
        }

        if (currentId < 0 || !validCatIdSet.has(currentId)) {
            continue;
        }

        const eqIndex = line.indexOf('=');
        if (eqIndex === -1) {
            continue;
        }

        const key = line.substring(0, eqIndex).trim();
        const value = line.substring(eqIndex + 1).trim();
        
        const parsed = results.get(currentId);
        if (!parsed || !parsed.config.subcategories || !parsed.config.phrases) {
            continue;
        }

        if (key === 'description') {
            parsed.config.description = value;
        } else if (key === 'opcode4') {
            const normalized = value.trim().toLowerCase();
            parsed.config.hasOpcode4 = normalized === 'yes' || normalized === 'true' || normalized === '1';
        } else if (key === 'sub') {
            // sub=<name>,<shortcut> or sub=<id>,<shortcut>
            const commaIdx = value.indexOf(',');
            let subId = -1;
            if (commaIdx !== -1) {
                const subPart = value.substring(0, commaIdx);
                // Try to parse as a number first
                subId = parseInt(subPart);
                if (isNaN(subId)) {
                    // Try to look up in pack file
                    subId = catNameToId.get(subPart) ?? -1;
                }
                const shortcut = parseShortcutToken(value.substring(commaIdx + 1));
                if (subId >= 0 && !parsed.config.subcategories.includes(subId)) {
                    parsed.config.subcategories.push(subId);
                    parsed.config.subcategoryShortcuts?.push(shortcut);
                }
            }
        } else if (key === 'phrase') {
            // phrase=<name>,<shortcut> or phrase=<id>,<shortcut>
            const commaIdx = value.indexOf(',');
            let phraseId = -1;
            if (commaIdx !== -1) {
                const phrasePart = value.substring(0, commaIdx);
                // Try to parse as a number first
                phraseId = parseInt(phrasePart);
                if (isNaN(phraseId)) {
                    // Try to look up in pack file
                    phraseId = phraseNameToId.get(phrasePart) ?? -1;
                }
                const shortcut = parseShortcutToken(value.substring(commaIdx + 1));
                if (phraseId >= 0 && !parsed.config.phrases.includes(phraseId)) {
                    parsed.config.phrases.push(phraseId);
                    parsed.config.phraseShortcuts?.push(shortcut);
                }
            } else {
                // No comma, just the name/id
                phraseId = parseInt(value);
                if (isNaN(phraseId)) {
                    phraseId = phraseNameToId.get(value) ?? -1;
                }
                if (phraseId >= 0 && !parsed.config.phrases.includes(phraseId)) {
                    parsed.config.phrases.push(phraseId);
                    parsed.config.phraseShortcuts?.push(0);
                }
            }
        }
    }

    // Re-encode all categories with parsed data
    for (const [_id, parsed] of results) {
        const encoded = encodeQuickChatCat(parsed.config);
        if (encoded) {
            parsed.data = encoded;
        }
    }

    return results;
}

function parseShortcutToken(token: string): number {
    const trimmed = token.trim();
    if (trimmed.length === 0) {
        return 0;
    }

    const numeric = parseInt(trimmed, 10);
    if (!Number.isNaN(numeric)) {
        return numeric & 0xff;
    }

    return trimmed.charCodeAt(0) & 0xff;
}

function parseQuickChatPhrase(text: string, phraseNameToId: Map<string, number>, enumNameToId: Map<string, number>, validPhraseIds: number[]): Map<number, ParsedQuickChatPhrase> {
    const results = new Map<number, ParsedQuickChatPhrase>();
    const validPhraseIdSet = new Set(validPhraseIds);

    // First, create all phrase objects and encode empty ones
    for (const i of validPhraseIds) {
        const phrase = new QuickChatPhraseType(i);
        phrase.text = [];
        phrase.autoResponses = [];
        phrase.dynamicCommands = [];
        phrase.dynamicCommandParameters = [];
        const encoded = encodeQuickChatPhrase(phrase);
        if (encoded) {
            results.set(i, {
                id: i,
                config: phrase,
                data: encoded
            });
        }
    }

    // Now parse and update from text config
    const lines = text.split('\n');
    let currentId = -1;

    for (const rawLine of lines) {
        const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
        const trimmed = line.trim();

        if (trimmed.length === 0 || trimmed.startsWith('//')) {
            continue;
        }

        // [chatphrase_<id>] or [name]
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            const name = trimmed.substring(1, trimmed.length - 1);
            if (name.startsWith('chatphrase_')) {
                currentId = parseInt(name.substring(11));
            } else {
                // Try to look up in pack file
                currentId = phraseNameToId.get(name) ?? -1;
            }
            continue;
        }

        if (currentId < 0 || !validPhraseIdSet.has(currentId)) {
            continue;
        }

        const eqIndex = line.indexOf('=');
        if (eqIndex === -1) {
            continue;
        }

        const key = line.substring(0, eqIndex).trim();
        const value = line.substring(eqIndex + 1).trim();

        const parsed = results.get(currentId);
        if (!parsed || !parsed.config.text || !parsed.config.autoResponses || !parsed.config.dynamicCommands || !parsed.config.dynamicCommandParameters) {
            continue;
        }

        if (key === 'text') {
            parsed.config.text = [value];
        } else if (key === 'response') {
            // response=<id> or response=<name>
            let responseId = parseInt(value);
            if (isNaN(responseId)) {
                // Try to look up in pack file
                responseId = phraseNameToId.get(value) ?? -1;
            }
            if (responseId >= 0 && !parsed.config.autoResponses.includes(responseId)) {
                parsed.config.autoResponses.push(responseId);
            }
        } else if (key === 'command') {
            // command=<cmdid>,<param1>,<param2>...
            // Only cmd 0 uses enum names (e.g., "enum_1493"), others use numeric values
            const parts = value.split(',').map(p => p.trim());
            if (parts.length > 0) {
                const cmdId = parseInt(parts[0]);
                if (!isNaN(cmdId)) {
                    const params: number[] = [];
                    for (let j = 1; j < parts.length; j++) {
                        const part = parts[j];
                        let paramId = parseInt(part);
                        if (isNaN(paramId) && cmdId === 0) {
                            // Only look up enum names for command 0
                            paramId = enumNameToId.get(part) ?? -1;
                        }
                        if (paramId >= 0) {
                            params.push(paramId);
                        }
                    }
                    parsed.config.dynamicCommands.push(cmdId);
                    parsed.config.dynamicCommandParameters.push(params);
                }
            }
        }
    }

    // Re-encode all phrases with parsed data
    for (const [_id, parsed] of results) {
        const encoded = encodeQuickChatPhrase(parsed.config);
        if (encoded) {
            parsed.data = encoded;
        }
    }

    return results;
}
async function main() {
    const args = parseArgs(process.argv.slice(2));

    ensureDir(args.out);

    const catPack = loadPackFile(args.catPackInput);
    const phrasePack = loadPackFile(args.phrasePackInput);
    const enumPack = loadPackFile(args.enumPackInput);

    if (!fs.existsSync(args.catInput)) {
        throw new Error(`Category config not found: ${args.catInput}`);
    }

    if (!fs.existsSync(args.phraseInput)) {
        throw new Error(`Phrase config not found: ${args.phraseInput}`);
    }

    // Load index (getGroup handles caching automatically)
    const indexData = await getGroup(255, args.archive);
    const groupIds = parseGroupIdsFromIndexPacked(indexData);
    const indexUnpacked = unpackJs5Group(indexData);
    const { fileIdsByGroup } = parseJs5ArchiveIndex(indexUnpacked);

    const catFileIds = fileIdsByGroup.get(CAT_GROUP) ?? [];
    const phraseFileIds = fileIdsByGroup.get(PHRASE_GROUP) ?? [];

    if (catFileIds.length === 0 || phraseFileIds.length === 0) {
        throw new Error(`Archive ${args.archive} is missing QuickChat groups 0/1 file metadata.`);
    }

    // Parse configs
    const catText = fs.readFileSync(args.catInput, 'utf-8');
    const phraseText = fs.readFileSync(args.phraseInput, 'utf-8');
    
    const cats = parseQuickChatCat(catText, catPack, phrasePack, catFileIds);
    const phrases = parseQuickChatPhrase(phraseText, phrasePack, enumPack, phraseFileIds);

    // Build group 0 (categories)
    const catFiles = new Map<number, Uint8Array>();
    for (const [id, parsed] of cats) {
        catFiles.set(id, parsed.data);
    }

    const catCombined = combineGroupFiles(catFiles, catFileIds);

    // Build group 1 (phrases)
    const phraseFiles = new Map<number, Uint8Array>();
    for (const [id, parsed] of phrases) {
        phraseFiles.set(id, parsed.data);
    }

    const phraseCombined = combineGroupFiles(phraseFiles, phraseFileIds);

    // Validate exact match if requested
    let catCompressed: Uint8Array;
    let phraseCompressed: Uint8Array;

    if (args.exact) {
        // Fetch reference groups from cache
        const catPath = `data/cache/${args.archive}/${CAT_GROUP}.dat`;
        const phrasePath = `data/cache/${args.archive}/${PHRASE_GROUP}.dat`;

        if (!fs.existsSync(catPath) || !fs.existsSync(phrasePath)) {
            throw new Error(`Exact mode requires reference cache groups: ${catPath} and ${phrasePath}`);
        }

        const refCatContainer = new Uint8Array(fs.readFileSync(catPath));
        const refPhraseContainer = new Uint8Array(fs.readFileSync(phrasePath));

        const refCatData = unpackJs5Group(refCatContainer);
        const refPhraseData = unpackJs5Group(refPhraseContainer);

        // Compare categories
        if (catCombined.length !== refCatData.length) {
            throw new Error(`Category group size mismatch: generated ${catCombined.length} vs reference ${refCatData.length}`);
        }
        
        let catMismatch = false;
        for (let i = 0; i < catCombined.length; i++) {
            if (catCombined[i] !== refCatData[i]) {
                console.error(`Category group mismatch at byte ${i}: generated 0x${catCombined[i].toString(16).padStart(2, '0')} vs reference 0x${refCatData[i].toString(16).padStart(2, '0')}`);
                catMismatch = true;
                break;
            }
        }

        // Compare phrases
        if (phraseCombined.length !== refPhraseData.length) {
            throw new Error(`Phrase group size mismatch: generated ${phraseCombined.length} vs reference ${refPhraseData.length}`);
        }
        
        let phraseMismatch = false;
        for (let i = 0; i < phraseCombined.length; i++) {
            if (phraseCombined[i] !== refPhraseData[i]) {
                console.error(`Phrase group mismatch at byte ${i}: generated 0x${phraseCombined[i].toString(16).padStart(2, '0')} vs reference 0x${refPhraseData[i].toString(16).padStart(2, '0')}`);
                phraseMismatch = true;
                break;
            }
        }

        if (catMismatch || phraseMismatch) {
            throw new Error('Validation failed: generated data does not match reference cache');
        }
        
        catCompressed = refCatContainer;
        phraseCompressed = refPhraseContainer;
    } else {
        catCompressed = await compressJs5Group(catCombined, CompressionType.GZIP);
        phraseCompressed = await compressJs5Group(phraseCombined, CompressionType.GZIP);
    }

    // Build full archive
    const groupBuffers = new Map<number, Uint8Array>();
    groupBuffers.set(CAT_GROUP, catCompressed);
    groupBuffers.set(PHRASE_GROUP, phraseCompressed);

    // Build length table
    const totalGroups = Math.max(...groupIds) + 1;
    const lengthTable = new Uint8Array(totalGroups * 4);

    for (let i = 0; i < groupIds.length; i++) {
        const groupId = groupIds[i];
        const compressed = groupBuffers.get(groupId);
        const length = compressed ? compressed.length : 0;
        writeInt32BE(length, lengthTable, i * 4);
    }

    // Build output
    let totalSize = indexData.length;
    for (const [, data] of groupBuffers) {
        totalSize += data.length;
    }
    totalSize += lengthTable.length;

    const output = new Uint8Array(totalSize);
    let pos = 0;

    output.set(indexData, pos);
    pos += indexData.length;

    for (const groupId of groupIds) {
        const data = groupBuffers.get(groupId);
        if (data && data.length > 0) {
            output.set(data, pos);
            pos += data.length;
        }
    }

    output.set(lengthTable, pos);

    // Write output
    const modeDir = path.join(args.out, args.mode);
    ensureDir(modeDir);
    
    let filename: string;
    if (args.archive === 24) {
        filename = 'quickchat.js5';
    } else if (args.archive === 25) {
        filename = 'quickchat.global.js5';
    } else {
        throw new Error(`Unsupported archive ${args.archive}. Only archives 24 and 25 are supported.`);
    }
    
    const outPath = path.join(modeDir, filename);
    fs.writeFileSync(outPath, output);
    console.log(`Wrote ${outPath}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

