import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

import forge from 'node-forge';

import DoublyLinkable from '#/util/DoublyLinkable.js';
import Environment from '#/util/Environment.js';
import LinkList from '#/util/LinkList.js';

import PrivateKey = forge.pki.rsa.PrivateKey;
import BigInteger = forge.jsbn.BigInteger;

export default class Packet extends DoublyLinkable {
    private static readonly crctable: Int32Array = new Int32Array(256);
    private static readonly bitmask: Uint32Array = new Uint32Array(33);

    /**
     * Reversed CRC-32 polynomial for Cyclic Redundancy Check (CRC).
     * This is sometimes referred to as CRC32B.
     */
    private static readonly crc32b = 0xedb88320;

    static {
        for (let i: number = 0; i < 32; i++) {
            this.bitmask[i] = (1 << i) - 1;
        }
        this.bitmask[32] = 0xffffffff;

        for (let b = 0; b < 256; b++) {
            let remainder = b;

            for (let bit = 0; bit < 8; bit++) {
                if ((remainder & 0x1) == 1) {
                    remainder = (remainder >>> 1) ^ this.crc32b;
                } else {
                    remainder >>>= 0x1;
                }
            }

            this.crctable[b] = remainder;
        }
    }

    static getcrc(src: Uint8Array, offset: number, length: number): number {
        let crc = 0xffffffff;
        for (let i = offset; i < length; i++) {
            crc = (crc >>> 8) ^ this.crctable[(crc ^ src[i]) & 0xff];
        }
        return ~crc;
    }

    static checkcrc(src: Uint8Array, offset: number, length: number, expected: number = 0): boolean {
        return Packet.getcrc(src, offset, length) == expected;
    }

    static alloc(type: number): Packet {
        let packet: Packet | null = null;

        if (type === 0 && this.cacheMinCount > 0) {
            packet = this.cacheMin.removeHead();
            this.cacheMinCount--;
        } else if (type === 1 && this.cacheMidCount > 0) {
            packet = this.cacheMid.removeHead();
            this.cacheMidCount--;
        } else if (type === 2 && this.cacheMaxCount > 0) {
            packet = this.cacheMax.removeHead();
            this.cacheMaxCount--;
        } else if (type === 3 && this.cacheBigCount > 0) {
            packet = this.cacheBig.removeHead();
            this.cacheBigCount--;
        } else if (type === 4 && this.cacheHugeCount > 0) {
            packet = this.cacheHuge.removeHead();
            this.cacheHugeCount--;
        } else if (type === 5 && this.cacheUnimaginableCount > 0) {
            packet = this.cacheUnimaginable.removeHead();
            this.cacheUnimaginableCount--;
        }

        if (packet !== null) {
            packet.pos = 0;
            packet.bitPos = 0;
            return packet;
        }

        if (type === 0) {
            return new Packet(new Uint8Array(100));
        } else if (type === 1) {
            return new Packet(new Uint8Array(5000));
        } else if (type === 2) {
            return new Packet(new Uint8Array(30000));
        } else if (type === 3) {
            return new Packet(new Uint8Array(100000));
        } else if (type === 4) {
            return new Packet(new Uint8Array(500000));
        } else if (type === 5) {
            return new Packet(new Uint8Array(2000000));
        } else {
            return new Packet(new Uint8Array(type));
        }
    }

    static load(path: string, seekToEnd: boolean = false): Packet {
        const packet = new Packet(new Uint8Array(fs.readFileSync(path)));
        if (seekToEnd) {
            packet.pos = packet.data.length;
        }
        return packet;
    }

    static async loadAsync(path: string, seekToEnd: boolean = false): Promise<Packet> {
        const packet = new Packet(new Uint8Array(await (await fetch(path)).arrayBuffer()));
        if (seekToEnd) {
            packet.pos = packet.data.length;
        }
        return packet;
    }

    private static cacheMinCount: number = 0;
    private static cacheMidCount: number = 0;
    private static cacheMaxCount: number = 0;
    private static cacheBigCount: number = 0;
    private static cacheHugeCount: number = 0;
    private static cacheUnimaginableCount: number = 0;

    private static readonly cacheMin: LinkList<Packet> = new LinkList();
    private static readonly cacheMid: LinkList<Packet> = new LinkList();
    private static readonly cacheMax: LinkList<Packet> = new LinkList();
    private static readonly cacheBig: LinkList<Packet> = new LinkList();
    private static readonly cacheHuge: LinkList<Packet> = new LinkList();
    private static readonly cacheUnimaginable: LinkList<Packet> = new LinkList();

    data: Uint8Array;
    pos: number;
    bitPos: number;

    constructor(src: Uint8Array) {
        super();

        this.data = src;
        this.pos = 0;
        this.bitPos = 0;
    }

    get available(): number {
        return this.data.length - this.pos;
    }

    get length(): number {
        return this.data.length;
    }

    release(): void {
        this.pos = 0;
        this.bitPos = 0;

        if (this.data.length === 100 && Packet.cacheMinCount < 1000) {
            Packet.cacheMin.addTail(this);
            Packet.cacheMinCount++;
        } else if (this.data.length === 5000 && Packet.cacheMidCount < 250) {
            Packet.cacheMid.addTail(this);
            Packet.cacheMidCount++;
        } else if (this.data.length === 30000 && Packet.cacheMaxCount < 50) {
            Packet.cacheMax.addTail(this);
            Packet.cacheMaxCount++;
        } else if (this.data.length === 100000 && Packet.cacheBigCount < 10) {
            Packet.cacheBig.addTail(this);
            Packet.cacheBigCount++;
        } else if (this.data.length === 500000 && Packet.cacheHugeCount < 5) {
            Packet.cacheHuge.addTail(this);
            Packet.cacheHugeCount++;
        } else if (this.data.length === 2000000 && Packet.cacheUnimaginableCount < 2) {
            Packet.cacheUnimaginable.addTail(this);
            Packet.cacheUnimaginableCount++;
        }
    }

    save(filePath: string, length: number = this.pos, start: number = 0): void {
        if (Environment.STANDALONE_BUNDLE) {
            const blob = new Blob([this.data.subarray(start, start + length)], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            self.postMessage({ type: 'save', value: url, path: filePath });
        } else {
            const dir: string = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            fs.writeFileSync(filePath, this.data.subarray(start, start + length));
        }
    }

    saveGz(filePath: string, length: number = this.pos, start: number = 0): void {
        const dir: string = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        const compressed = zlib.gzipSync(this.data.subarray(start, start + length));
        compressed[9] = 0;
        fs.writeFileSync(filePath, compressed);
    }

    p1(value: number): void {
        this.data[this.pos++] = value;
    }

    p2(value: number): void {
        this.data[this.pos++] = value >> 8;
        this.data[this.pos++] = value;
    }

    p3(value: number): void {
        this.data[this.pos++] = value >> 16;
        this.data[this.pos++] = value >> 8;
        this.data[this.pos++] = value;
    }

    p4(value: number): void {
        this.data[this.pos++] = value >> 24;
        this.data[this.pos++] = value >> 16;
        this.data[this.pos++] = value >> 8;
        this.data[this.pos++] = value;
    }

    p8(value: bigint): void {
        const low = Number(value >> 32n);
        const high = Number(value & 0xFFFFFFFFn);
        this.p4(low);
        this.p4(high);
    }

    pbool(value: boolean): void {
        this.p1(value ? 1 : 0);
    }

    pjstr(str: string, terminator: number = 10): void {
        const length: number = str.length;
        for (let i: number = 0; i < length; i++) {
            this.p1(str.charCodeAt(i));
        }
        this.p1(terminator);
    }

    pdata(src: Uint8Array, offset: number, length: number): void {
        this.data.set(src.subarray(offset, offset + length), this.pos);
        this.pos += length - offset;
    }

    psize4(size: number): void {
        this.data[this.pos - size - 4] = size >> 24;
        this.data[this.pos - size - 3] = size >> 16;
        this.data[this.pos - size - 2] = size >> 8;
        this.data[this.pos - size - 1] = size;
    }

    psize2(size: number): void {
        this.data[this.pos - size - 2] = size >> 8;
        this.data[this.pos - size - 1] = size;
    }

    psize1(size: number): void {
        this.data[this.pos - size - 1] = size;
    }

    psmarts(value: number): void {
        if (value < 64 && value >= -64) {
            this.p1(value + 64);
        } else if (value < 16384 && value >= -16384) {
            this.p2(value + 0xc000);
        } else {
            throw new Error('Error psmarts out of range: ' + value);
        }
    }

    psmart(value: number): void {
        if (value >= 0 && value < 128) {
            this.p1(value);
        } else if (value >= 0 && value < 32768) {
            this.p2(value + 0x8000);
        } else {
            throw new Error('Error psmart out of range: ' + value);
        }
    }

    // ----

    g1(): number {
        const val = this.data[this.pos];
        if (typeof val === 'undefined') {
            throw new Error('Out of bounds');
        }

        this.pos += 1;
        return val;
    }

    g1b(): number {
        const val = this.data[this.pos];
        if (typeof val === 'undefined') {
            throw new Error('Out of bounds');
        }

        this.pos += 1;
        return val | (val & 2 ** 7) * 0x1fffffe;
    }

    g2(): number {
        const first = this.data[this.pos];
        const last = this.data[this.pos + 1];
        if (typeof first === 'undefined' || typeof last === 'undefined') {
            throw new Error('Out of bounds');
        }

        this.pos += 2;
        return first * 2 ** 8 + last;
    }

    g2s(): number {
        const first = this.data[this.pos];
        const last = this.data[this.pos + 1];
        if (typeof first === 'undefined' || typeof last === 'undefined') {
            throw new Error('Out of bounds');
        }

        this.pos += 2;

        const val = first * 2 ** 8 + last;
        return val | (val & 2 ** 15) * 0x1fffe;
    }

    ig2(): number {
        const first = this.data[this.pos];
        const last = this.data[this.pos + 1];
        if (typeof first === 'undefined' || typeof last === 'undefined') {
            throw new Error('Out of bounds');
        }

        this.pos += 2;

        const val = first * 2 ** 8 + last;
        return val | (val & 2 ** 15) * 0x1fffe;
    }

    g3(): number {
        const first = this.data[this.pos];
        const last = this.data[this.pos + 2];
        if (typeof first === 'undefined' || typeof last === 'undefined') {
            throw new Error('Out of bounds');
        }

        const val = first * 2 ** 16 + this.data[this.pos + 1] * 2 ** 8 + last;

        this.pos += 3;
        return val | (val & 2 ** 23) * 0x1fe;
    }

    g4(): number {
        const first = this.data[this.pos];
        const last = this.data[this.pos + 3];
        if (typeof first === 'undefined' || typeof last === 'undefined') {
            throw new Error('Out of bounds');
        }

        const val = (first << 24) + // Overflow
            this.data[this.pos + 1] * 2 ** 16 +
            this.data[this.pos + 2] * 2 ** 8 +
            last;

        this.pos += 4;
        return val;
    }

    g8(): bigint {
        const first = this.data[this.pos];
        const last = this.data[this.pos + 7];
        if (first === undefined || last === undefined) {
            throw new Error('Out of bounds');
        }

        const hi = first * 2 ** 24 +
            this.data[this.pos + 1] * 2 ** 16 +
            this.data[this.pos + 2] * 2 ** 8 +
            this.data[this.pos + 3];

        const lo = this.data[this.pos + 4] * 2 ** 24 +
            this.data[this.pos + 5] * 2 ** 16 +
            this.data[this.pos + 6] * 2 ** 8 +
            last;

        this.pos += 8;
        return (BigInt(hi) << 32n) + BigInt(lo);
    }

    gbool(): boolean {
        return this.g1() === 1;
    }

    gjstr(terminator = 10): string {
        const length: number = this.data.length;
        let str: string = '';
        let b: number;
        while ((b = this.data[this.pos++]) !== terminator && this.pos < length) {
            str += String.fromCharCode(b);
        }
        return str;
    }

    gdata(dest: Uint8Array, offset: number, length: number): void {
        dest.set(this.data.subarray(this.pos, this.pos + length), offset);
        this.pos += length;
    }

    gsmarts(): number {
        const n = this.data[this.pos] & 0xFF;
        return n < 128 ? this.g1() - 64 : this.g2() - 49152;
    }

    gsmart(): number {
        const n = this.data[this.pos] & 0xFF;
        return n < 128 ? this.g1() : this.g2() - 32768;
    }

    bits(): void {
        this.bitPos = this.pos << 3;
    }

    bytes(): void {
        this.pos = (this.bitPos + 7) >>> 3;
    }

    gBit(n: number): number {
        let bytePos: number = this.bitPos >>> 3;
        let remaining: number = 8 - (this.bitPos & 7);
        let value: number = 0;
        this.bitPos += n;

        for (; n > remaining; remaining = 8) {
            value += (this.data[bytePos++] & Packet.bitmask[remaining]) << (n - remaining);
            n -= remaining;
        }

        if (n == remaining) {
            value += this.data[bytePos] & Packet.bitmask[remaining];
        } else {
            value += (this.data[bytePos] >>> (remaining - n)) & Packet.bitmask[n];
        }

        return value;
    }

    pBit(n: number, value: number): void {
        const pos: number = this.bitPos;
        this.bitPos += n;
        let bytePos: number = pos >>> 3;
        let remaining: number = 8 - (pos & 7);

        for (; n > remaining; remaining = 8) {
            const shift: number = (1 << remaining) - 1;
            const byte: number = this.data[bytePos];
            this.data[bytePos++] = (byte & ~shift) | ((value >>> (n - remaining)) & shift);
            n -= remaining;
        }

        const r: number = remaining - n;
        const shift: number = (1 << n) - 1;
        const byte: number = this.data[bytePos];
        this.data[bytePos] = (byte & (~shift << r)) | ((value & shift) << r);
    }

    rsaenc(pem: PrivateKey): void {
        const length: number = this.pos;
        this.pos = 0;

        const dec: Uint8Array = new Uint8Array(length);
        this.gdata(dec, 0, dec.length);

        const bigRaw: BigInteger = new BigInteger(Array.from(dec));
        const rawEnc: Uint8Array = Uint8Array.from(bigRaw.modPow(pem.e, pem.n).toByteArray());

        this.pos = 0;
        this.p1(rawEnc.length);
        this.pdata(rawEnc, 0, rawEnc.length);
    }

    rsadec(pem: PrivateKey): void {
        const enc: Uint8Array = new Uint8Array(this.g1());
        this.gdata(enc, 0, enc.length);

        const cipher: BigInteger = new BigInteger(Array.from(enc));

        // decrypt using the Chinese Remainder Theorem
        const p: BigInteger = pem.p;
        const q: BigInteger = pem.q;
        const dP: BigInteger = pem.dP;
        const dQ: BigInteger = pem.dQ;
        const qInv: BigInteger = pem.qInv;

        const mP: BigInteger = cipher.modPow(dP, p);
        const mQ: BigInteger = cipher.modPow(dQ, q);

        const h: BigInteger = qInv.multiply(mP.subtract(mQ)).mod(p);

        const plain: Uint8Array = Uint8Array.from(mQ.add(h.multiply(q)).toByteArray());

        this.pos = 0;
        this.pdata(plain, 0, plain.length);
        this.pos = 0;
    }

    // later revs have tinyenc/tinydec methods
    // later revs have alt methods for packet obfuscation
}
