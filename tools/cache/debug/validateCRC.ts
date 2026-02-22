import * as fs from 'fs';
import { createHash } from 'crypto';
import { unpackJs5Group } from '#/io/Js5Group.js';

console.log('Validating CRC of uncompressed enum data:\n');

for (let groupId = 0; groupId <= 8; groupId++) {
    const origPath = `data/cache/17/${groupId}.dat`;
    const packedPath = `data/pack/17/${groupId}.dat`;
    
    if (!fs.existsSync(origPath) || !fs.existsSync(packedPath)) {
        continue;
    }
    
    const orig = fs.readFileSync(origPath);
    const origUncomp = unpackJs5Group(new Uint8Array(orig));
    const origCrc = createHash('md5').update(origUncomp).digest('hex');
    
    const packed = fs.readFileSync(packedPath);
    const packedUncomp = unpackJs5Group(new Uint8Array(packed));
    const packedCrc = createHash('md5').update(packedUncomp).digest('hex');
    
    const match = origCrc === packedCrc;
    console.log(`Group ${groupId}: ${match ? '✓ MATCH' : '✗ DIFFER'} (orig=${origCrc.substring(0, 8)}... packed=${packedCrc.substring(0, 8)}...)`);
}
