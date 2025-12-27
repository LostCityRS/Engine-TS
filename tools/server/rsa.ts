import fs from 'fs';

import forge from 'node-forge';

const key = forge.pki.rsa.generateKeyPair(1024);

const pubkey = forge.pki.publicKeyToPem(key.publicKey);
fs.writeFileSync('data/config/public.pem', pubkey);

const privkey = forge.pki.privateKeyToPem(key.privateKey);
fs.writeFileSync('data/config/private.pem', privkey);

console.log('static readonly exponent: bigint = ' + key.publicKey.e.toString(10) + 'n;');
console.log('static readonly modulus: bigint = ' + key.publicKey.n.toString(10) + 'n;');
