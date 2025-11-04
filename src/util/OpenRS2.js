import fs from 'fs';

import axios from 'axios';

const OPENRS2_SCOPE = 'runescape';
const OPENRS2_ID = '254';
const OPENRS2_API = `https://archive.openrs2.org/caches/${OPENRS2_SCOPE}/${OPENRS2_ID}`;

if (!fs.existsSync('data')) {
    fs.mkdirSync('data', { recursive: true });
}

if (!fs.existsSync('data/xteas.json')) {
    console.log('Downloading XTEAs...');
    await axios.get(`${OPENRS2_API}/keys.json`).then((response) => {
        fs.writeFileSync('data/xteas.json', JSON.stringify(response.data));
    });
}

if (!fs.existsSync('data/cache') || !fs.existsSync('data/cache/openrs2id.txt')) {
    fs.mkdirSync('data/cache', { recursive: true });
    fs.writeFileSync('data/cache/openrs2id.txt', OPENRS2_ID);
}

if (fs.readFileSync('data/cache/openrs2id.txt', 'utf8') != OPENRS2_ID) {
    console.log('OpenRS2 ID changed, clearing cache...');
    fs.rmSync('data/cache', { recursive: true, force: true });
    fs.mkdirSync('data/cache', { recursive: true });
    fs.writeFileSync('data/cache/openrs2id.txt', OPENRS2_ID);
}

const XTEAS = JSON.parse(fs.readFileSync('data/xteas.json'));

export function getXtea(x, z) {
    return XTEAS.find((xtea) => xtea.mapsquare == (x << 8 | z));
}

export async function getGroup(archive, group) {
    if (!fs.existsSync(`data/cache/${archive}`)) {
        fs.mkdirSync(`data/cache/${archive}`, { recursive: true });
    }

    let file;
    if (!fs.existsSync(`data/cache/${archive}/${group}.dat`)) {
        file = await axios.get(`${OPENRS2_API}/archives/${archive}/groups/${group}.dat`, { responseType: 'arraybuffer' });
        file = new Uint8Array(file.data);
        fs.writeFileSync(`data/cache/${archive}/${group}.dat`, file);
    } else {
        file = fs.readFileSync(`data/cache/${archive}/${group}.dat`);
    }

    return file;
}
