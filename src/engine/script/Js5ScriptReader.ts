import Js5Reader from '#/io/Js5Reader.js';

/**
 * Reads scripts from a JS5 archive format (server.scripts.js5)
 * 
 * This is a thin wrapper around Js5Reader for script-specific loading.
 */
export default class Js5ScriptReader {
    private data: Uint8Array;

    constructor(data: Uint8Array) {
        this.data = data;
    }

    /**
     * Parse the JS5 archive and extract all script data
     * @returns Map of groupId -> decompressed script data
     */
    parseArchive(): Map<number, Uint8Array> {
        const reader = new Js5Reader(this.data);
        return reader.read();
    }
}
