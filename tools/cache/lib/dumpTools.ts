import fs from 'fs';
import path from 'path';

import { ensureDir } from '#tools/cache/lib/js5Tools.js';

export function writeTextDump(outPath: string, lines: string[]): void {
    ensureDir(path.dirname(outPath));
    fs.writeFileSync(outPath, lines.join('\n'), 'utf-8');
}

export function writeBinaryDump(outPath: string, bytes: Uint8Array): void {
    ensureDir(path.dirname(outPath));
    fs.writeFileSync(outPath, bytes);
}

export function formatRgbHex(value: number): string {
    return `0x${value.toString(16).toUpperCase().padStart(6, '0')}`;
}
