import * as fs from 'fs';
import * as zlib from 'zlib';

const data = fs.readFileSync('data/cache/17/0.dat');
const uncompressed = zlib.gunzipSync(data.subarray(9));

const stripeCount = uncompressed[uncompressed.length - 1];
const chunkTableSize = 256 * 4 * stripeCount;
const chunkTableStart = uncompressed.length - 1 - chunkTableSize;

// Parse chunk table to get file sizes
const fileSizes: number[] = [];
for (let fileId = 0; fileId < 256; fileId++) {
    let totalSize = 0;
    for (let stripe = 0; stripe < stripeCount; stripe++) {
        const offset = chunkTableStart + (stripe * 256 * 4) + (fileId * 4);
        const deltaSize = (uncompressed[offset] << 24) | (uncompressed[offset + 1] << 16) | (uncompressed[offset + 2] << 8) | uncompressed[offset + 3];
        totalSize += deltaSize;
    }
    fileSizes.push(totalSize);
}

// Extract actual file data
const fileOffsets: number[] = [0];
for (let i = 0; i < 255; i++) {
    fileOffsets.push(fileOffsets[i] + fileSizes[i]);
}

// Show the bytes for file 0 (has data) and file 1 (empty)
console.log('File 0 (size:', fileSizes[0], 'bytes):');
const file0Data = uncompressed.subarray(fileOffsets[0], fileOffsets[0] + fileSizes[0]);
console.log('  Hex:', Array.from(file0Data).map(b => b.toString(16).padStart(2, '0')).join(' '));

console.log('\nFile 1 (size:', fileSizes[1], 'bytes):');
if (fileSizes[1] > 0) {
    const file1Data = uncompressed.subarray(fileOffsets[1], fileOffsets[1] + fileSizes[1]);
    console.log('  Hex:', Array.from(file1Data).map(b => b.toString(16).padStart(2, '0')).join(' '));
} else {
    console.log('  (no data)');
}

console.log('\nFile 73 (first non-zero after file 0, size:', fileSizes[73], 'bytes):');
const file73Data = uncompressed.subarray(fileOffsets[73], fileOffsets[73] + Math.min(fileSizes[73], 20));
console.log('  First 20 bytes:', Array.from(file73Data).map(b => b.toString(16).padStart(2, '0')).join(' '));
