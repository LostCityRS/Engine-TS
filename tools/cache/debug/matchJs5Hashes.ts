import fs from 'fs';
import path from 'path';

import { ensureDir } from '#tools/cache/lib/js5Tools.js';

type Args = {
    archive?: number;
    type?: string;
    hashFile?: string;
    keywords?: string;
    out?: string;
    id?: string;
    pairs: boolean;
    joiners: string[];
    mutate: boolean;
    numStart: number;
    numEnd: number;
    prefixes: string[];
    suffixes: string[];
    maxPerId: number;
    help: boolean;
};

type TargetHash = {
    id: string;
    hash: number;
};

type WordInfo = {
    word: string;
    hash: number;
    len: number;
};

const DEFAULT_KEYWORDS_URL = path.join('data', 'pack', 'keywords.txt');

const TYPE_TO_ARCHIVE: Record<string, number> = {
    flu: 1,
    flo: 4,
    inv: 5,
    midi: 6,
    enum: 17,
    quickchat: 24,
    quickchat_global: 25,
    chatcat: 24,
    chatphrase: 24,
    global_chatcat: 25,
    global_chatphrase: 25
};

function parseArgs(argv: string[]): Args {
    const args: Args = {
        pairs: false,
        joiners: ['_'],
        mutate: false,
        numStart: 0,
        numEnd: 999,
        prefixes: [],
        suffixes: [],
        maxPerId: 50,
        help: false
    };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];

        if (arg === '--archive') {
            args.archive = Number(argv[++i]);
        } else if (arg === '--type') {
            args.type = argv[++i]?.toLowerCase();
        } else if (arg === '--hash-file') {
            args.hashFile = argv[++i];
        } else if (arg === '--keywords') {
            args.keywords = argv[++i];
        } else if (arg === '--out') {
            args.out = argv[++i];
        } else if (arg === '--id') {
            args.id = argv[++i];
        } else if (arg === '--pairs') {
            args.pairs = true;
        } else if (arg === '--mutate') {
            args.mutate = true;
        } else if (arg === '--joiners') {
            const raw = argv[++i] ?? '';
            const parsed = raw.split(',').map(part => part === '<empty>' ? '' : part);
            args.joiners = parsed.length > 0 ? parsed : ['_'];
        } else if (arg === '--num-start') {
            args.numStart = Number(argv[++i]);
        } else if (arg === '--num-end') {
            args.numEnd = Number(argv[++i]);
        } else if (arg === '--prefixes') {
            const raw = argv[++i] ?? '';
            args.prefixes = raw.split(',').map(part => part === '<empty>' ? '' : part).filter(part => part.length > 0);
        } else if (arg === '--suffixes') {
            const raw = argv[++i] ?? '';
            args.suffixes = raw.split(',').map(part => part === '<empty>' ? '' : part).filter(part => part.length > 0);
        } else if (arg === '--max-per-id') {
            args.maxPerId = Number(argv[++i]);
        } else if (arg === '--help' || arg === '-h') {
            args.help = true;
        }
    }

    return args;
}

function resolveArchive(args: Args): number | undefined {
    if (typeof args.archive === 'number' && !Number.isNaN(args.archive)) {
        return args.archive;
    }

    if (args.type) {
        const numericType = Number(args.type);
        if (!Number.isNaN(numericType)) {
            return numericType;
        }

        const alias = TYPE_TO_ARCHIVE[args.type];
        if (typeof alias === 'number') {
            return alias;
        }
    }

    return undefined;
}

function defaultLabel(args: Args): string {
    if (args.type && args.type.length > 0) {
        return args.type;
    }

    const archive = resolveArchive(args);
    return typeof archive === 'number' ? `archive_${archive}` : 'hashes';
}

function resolveHashFilePath(args: Args): string {
    if (args.hashFile) {
        return args.hashFile;
    }

    return path.join('data', 'pack', `${defaultLabel(args)}.hash`);
}

function resolveOutPath(args: Args): string {
    if (args.out) {
        return args.out;
    }

    return path.join('data', 'pack', `${defaultLabel(args)}.matches.txt`);
}

function hashJs5(text: string): number {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        hash = ((hash * 31) + text.charCodeAt(i)) | 0;
    }
    return hash;
}

function toUint32(value: number): bigint {
    return BigInt(value >>> 0);
}

function toInt32(value: bigint): number {
    const normalized = Number(value & 0xffffffffn);
    return normalized > 0x7fffffff ? normalized - 0x100000000 : normalized;
}

function parseHashFile(filePath: string, idFilter?: string): TargetHash[] {
    if (!fs.existsSync(filePath)) {
        throw new Error(`Hash file not found: ${filePath}`);
    }

    const targets: TargetHash[] = [];
    for (const line of fs.readFileSync(filePath, 'utf-8').split('\n')) {
        const trimmed = line.trim();
        if (trimmed.length === 0 || trimmed.startsWith('#')) {
            continue;
        }

        const eq = trimmed.indexOf('=');
        if (eq === -1) {
            continue;
        }

        const id = trimmed.substring(0, eq);
        const hashValue = Number(trimmed.substring(eq + 1));
        if (Number.isNaN(hashValue)) {
            continue;
        }

        if (idFilter && id !== idFilter) {
            continue;
        }

        targets.push({ id, hash: hashValue | 0 });
    }

    return targets;
}

async function loadKeywords(source?: string): Promise<string[]> {
    const keywordSource = source ?? DEFAULT_KEYWORDS_URL;
    let content: string;

    if (keywordSource.startsWith('http://') || keywordSource.startsWith('https://')) {
        const response = await fetch(keywordSource);
        if (!response.ok) {
            throw new Error(`Failed to fetch keywords from ${keywordSource}: ${response.status} ${response.statusText}`);
        }
        content = await response.text();
    } else {
        if (!fs.existsSync(keywordSource)) {
            throw new Error(`Keywords file not found: ${keywordSource}`);
        }
        content = fs.readFileSync(keywordSource, 'utf-8');
    }

    const unique = new Set<string>();
    for (const line of content.split('\n')) {
        const normalized = line.trim().toLowerCase();
        if (normalized.length === 0 || normalized.startsWith('#')) {
            continue;
        }
        unique.add(normalized);
    }

    return Array.from(unique);
}

function buildWordInfo(words: string[]): WordInfo[] {
    return words.map((word) => ({
        word,
        hash: hashJs5(word),
        len: word.length
    }));
}

function addMatch(matchesById: Map<string, Set<string>>, id: string, candidate: string, maxPerId: number): void {
    let set = matchesById.get(id);
    if (!set) {
        set = new Set<string>();
        matchesById.set(id, set);
    }

    if (set.size < maxPerId) {
        set.add(candidate);
    }
}

function addCandidateMatches(
    candidate: string,
    byHash: Map<number, string[]>,
    matchesById: Map<string, Set<string>>,
    maxPerId: number
): void {
    const hitIds = byHash.get(hashJs5(candidate));
    if (!hitIds) {
        return;
    }

    for (const id of hitIds) {
        addMatch(matchesById, id, candidate, maxPerId);
    }
}

function matchSingles(targets: TargetHash[], words: WordInfo[], maxPerId: number): Map<string, Set<string>> {
    const byHash = new Map<number, string[]>();
    for (const target of targets) {
        const list = byHash.get(target.hash) ?? [];
        list.push(target.id);
        byHash.set(target.hash, list);
    }

    const matches = new Map<string, Set<string>>();
    for (const word of words) {
        const hitIds = byHash.get(word.hash);
        if (!hitIds) {
            continue;
        }

        for (const id of hitIds) {
            addMatch(matches, id, word.word, maxPerId);
        }
    }

    return matches;
}

function precomputePow31(maxLen: number): bigint[] {
    const pow: bigint[] = new Array(maxLen + 1);
    pow[0] = 1n;
    for (let i = 1; i <= maxLen; i++) {
        pow[i] = (pow[i - 1] * 31n) & 0xffffffffn;
    }
    return pow;
}

function modInverseOdd32(value: bigint): bigint {
    const modulus = 0x100000000n;
    let a = value & 0xffffffffn;
    let b = modulus;
    let x0 = 1n;
    let x1 = 0n;

    while (b !== 0n) {
        const q = a / b;
        const tA = a - q * b;
        a = b;
        b = tA;

        const tX = x0 - q * x1;
        x0 = x1;
        x1 = tX;
    }

    if (a !== 1n) {
        throw new Error('Value is not invertible modulo 2^32');
    }

    return (x0 % modulus + modulus) % modulus;
}

function matchPairs(
    targets: TargetHash[],
    words: WordInfo[],
    joiners: string[],
    maxPerId: number,
    seed: Map<string, Set<string>>
): Map<string, Set<string>> {
    const matches = new Map(seed);
    const byHash = new Map<number, string[]>();

    for (const word of words) {
        const list = byHash.get(word.hash) ?? [];
        list.push(word.word);
        byHash.set(word.hash, list);
    }

    const maxWordLen = words.reduce((acc, word) => Math.max(acc, word.len), 0);
    const maxJoinerLen = joiners.reduce((acc, joiner) => Math.max(acc, joiner.length), 0);
    const pow31 = precomputePow31(maxWordLen + maxJoinerLen);
    const invPow31 = pow31.map((value) => modInverseOdd32(value));

    const targetU = targets.map((target) => ({
        id: target.id,
        hash: target.hash,
        hashU: toUint32(target.hash)
    }));

    for (const b of words) {
        const bHashU = toUint32(b.hash);

        for (const joiner of joiners) {
            if (joiner.length > 1) {
                continue;
            }

            const joinerHashU = joiner.length === 0 ? 0n : toUint32(joiner.charCodeAt(0));
            const tailLen = b.len + joiner.length;
            const tailPow = pow31[b.len];

            const tailConstU = joiner.length === 0
                ? bHashU
                : ((joinerHashU * tailPow) + bHashU) & 0xffffffffn;

            const inv = invPow31[tailLen];

            for (const target of targetU) {
                const neededU = (((target.hashU - tailConstU + 0x100000000n) & 0xffffffffn) * inv) & 0xffffffffn;
                const needed = toInt32(neededU);
                const candidatesA = byHash.get(needed);
                if (!candidatesA) {
                    continue;
                }

                for (const a of candidatesA) {
                    const candidate = `${a}${joiner}${b.word}`;
                    if (hashJs5(candidate) === target.hash) {
                        addMatch(matches, target.id, candidate, maxPerId);
                    }
                }
            }
        }
    }

    return matches;
}

function matchMutations(
    targets: TargetHash[],
    words: WordInfo[],
    args: Args,
    seed: Map<string, Set<string>>
): { matches: Map<string, Set<string>>; generated: number } {
    const matches = new Map(seed);
    const byHash = new Map<number, string[]>();

    for (const target of targets) {
        const list = byHash.get(target.hash) ?? [];
        list.push(target.id);
        byHash.set(target.hash, list);
    }

    const unique = new Set<string>();
    let generated = 0;
    const joiners = Array.from(new Set(['', ...args.joiners]));

    const emit = (candidate: string) => {
        if (candidate.length === 0 || unique.has(candidate)) {
            return;
        }
        unique.add(candidate);
        generated++;
        addCandidateMatches(candidate, byHash, matches, args.maxPerId);
    };

    const min = Number.isFinite(args.numStart) ? Math.max(0, Math.floor(args.numStart)) : 0;
    const max = Number.isFinite(args.numEnd) ? Math.max(min, Math.floor(args.numEnd)) : min;

    for (const word of words) {
        const base = word.word;

        for (const joiner of joiners) {
            for (let n = min; n <= max; n++) {
                emit(`${base}${joiner}${n}`);
                emit(`${n}${joiner}${base}`);
            }
        }

        for (const prefix of args.prefixes) {
            for (const joiner of joiners) {
                emit(`${prefix}${joiner}${base}`);
            }
        }

        for (const suffix of args.suffixes) {
            for (const joiner of joiners) {
                emit(`${base}${joiner}${suffix}`);
            }
        }

        for (const prefix of args.prefixes) {
            for (const suffix of args.suffixes) {
                for (const joiner of joiners) {
                    emit(`${prefix}${joiner}${base}${joiner}${suffix}`);
                }
            }
        }
    }

    return { matches, generated };
}

function writeMatches(outPath: string, targets: TargetHash[], matchesById: Map<string, Set<string>>): void {
    const lines: string[] = [];
    for (const target of targets) {
        const matches = Array.from(matchesById.get(target.id) ?? []);
        if (matches.length === 0) {
            continue;
        }

        for (const candidate of matches) {
            lines.push(`${target.id}\t${target.hash}\t${candidate}`);
        }
    }

    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, lines.join('\n') + (lines.length > 0 ? '\n' : ''), 'utf-8');
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        process.exit(0);
    }

    const hashFilePath = resolveHashFilePath(args);
    const targets = parseHashFile(hashFilePath, args.id);
    if (targets.length === 0) {
        throw new Error(`No target hashes found in ${hashFilePath}${args.id ? ` for id ${args.id}` : ''}`);
    }

    const keywords = await loadKeywords(args.keywords);
    const words = buildWordInfo(keywords);

    let matches = matchSingles(targets, words, args.maxPerId);
    if (args.pairs) {
        matches = matchPairs(targets, words, args.joiners, args.maxPerId, matches);
    }
    let generated = 0;
    if (args.mutate) {
        const mutationResult = matchMutations(targets, words, args, matches);
        matches = mutationResult.matches;
        generated = mutationResult.generated;
    }

    const outPath = resolveOutPath(args);
    ensureDir(path.dirname(outPath));
    writeMatches(outPath, targets, matches);

    const matchedIds = targets.filter((target) => (matches.get(target.id)?.size ?? 0) > 0).length;
    const totalMatches = Array.from(matches.values()).reduce((sum, set) => sum + set.size, 0);

    console.log(`targets=${targets.length} keywords=${words.length} matchedIds=${matchedIds} matches=${totalMatches} generated=${generated}`);
    console.log(`Wrote ${outPath}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
