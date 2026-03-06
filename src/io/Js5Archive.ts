import fs from 'fs';
import Js5Reader from '#/io/Js5Reader.js';

/**
 * Utility functions for loading JS5 archives from disk.
 */
export class Js5Archive {
    /**
     * Load a JS5 archive from a file path.
     * @param filePath Path to the .js5 file
     * @returns Map of groupId -> decompressed data
     */
    static load(filePath: string): Map<number, Uint8Array> {
        if (!fs.existsSync(filePath)) {
            throw new Error(`JS5 archive not found: ${filePath}`);
        }

        const data = fs.readFileSync(filePath);
        const reader = new Js5Reader(new Uint8Array(data));
        return reader.read();
    }

    /**
     * Load a JS5 archive asynchronously.
     * @param filePath Path to the .js5 file
     * @returns Map of groupId -> decompressed data
     */
    static async loadAsync(filePath: string): Promise<Map<number, Uint8Array>> {
        if (!fs.existsSync(filePath)) {
            throw new Error(`JS5 archive not found: ${filePath}`);
        }

        const data = await fs.promises.readFile(filePath);
        const reader = new Js5Reader(new Uint8Array(data));
        return reader.read();
    }

    /**
     * Check if a JS5 archive exists.
     * @param filePath Path to check
     */
    static exists(filePath: string): boolean {
        return fs.existsSync(filePath);
    }
}
