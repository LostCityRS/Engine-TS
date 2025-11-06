import FloType from '#/cache/config/FloType.js';
import Jagfile from '#/io/Jagfile.js';
import { TexturePack } from '#tools/pack/PackFile.js';

FloType.load('data/pack');

const worldmap = Jagfile.load('data/unpack/worldmap.jag');

const floorcol = worldmap.read('floorcol.dat')!;
const floorcolCount = floorcol.g2();
for (let i = 0; i < floorcolCount && i < FloType.configs.length; i++) {
    const underlay = floorcol.g4().toString(16).padStart(8, '0');
    const overlay = floorcol.g4().toString(16).padStart(8, '0');

    const flo = FloType.get(i);
    if (flo.texture !== -1) {
        console.log(`[0x${underlay}, 0x${overlay}], // debugname=${flo.debugname} overlay=${flo.overlay} occlude=${flo.occlude} rgb=0x${flo.rgb.toString(16).padStart(6, '0')} texture=${TexturePack.getById(flo.texture)}`);
    } else {
        console.log(`[0x${underlay}, 0x${overlay}], // debugname=${flo.debugname} overlay=${flo.overlay} occlude=${flo.occlude} rgb=0x${flo.rgb.toString(16).padStart(6, '0')}`);
    }
}

console.log('----');

const labels = worldmap.read('labels.dat')!;
const labelCount = labels.g2();
for (let i = 0; i < labelCount; i++) {
    const text = labels.gjstr();
    const x = labels.g2();
    const y = labels.g2();
    const font = labels.g1();
    console.log(`=${text},${x},${y},${font}`);
}
