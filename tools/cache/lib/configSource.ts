export type SourceField = {
    key: string;
    value: string;
    line: number;
};

export type SourceSection = {
    name: string;
    line: number;
    fields: SourceField[];
};

export function parseBracketedConfigSource(content: string): SourceSection[] {
    const lines = content.split('\n');
    const sections: SourceSection[] = [];
    let current: SourceSection | null = null;

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
        const value = line.substring(eq + 1).trim();
        if (key.length === 0) {
            continue;
        }

        current.fields.push({ key, value, line: i + 1 });
    }

    return sections;
}

export function resolveSectionId(name: string, nameToId: Map<string, number>, fallbackPrefix: string): number | null {
    const mapped = nameToId.get(name);
    if (mapped !== undefined) {
        return mapped;
    }

    if (name.startsWith(fallbackPrefix)) {
        const parsed = parseInt(name.substring(fallbackPrefix.length));
        if (!isNaN(parsed)) {
            return parsed;
        }
    }

    return null;
}

export function parseConfigBoolean(value: string): boolean {
    const normalized = value.trim().toLowerCase();
    return normalized === 'yes' || normalized === 'true' || normalized === '1';
}

export function parseConfigInteger(value: string): number {
    if (value.startsWith('0x') || value.startsWith('0X')) {
        const parsedHex = parseInt(value, 16);
        return isNaN(parsedHex) ? 0 : parsedHex;
    }

    const parsed = parseInt(value);
    return isNaN(parsed) ? 0 : parsed;
}
