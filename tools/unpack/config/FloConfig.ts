import { printWarning } from '#/util/Logger.js';
import { FloPack, TexturePack } from '#tools/pack/PackFile.js';

import { ConfigIdx } from './Common.js';

export function unpackFloConfig(config: ConfigIdx, id: number): string[] {
    const { dat, pos, len } = config;

    const def: string[] = [];
    def.push(`[${FloPack.getById(id)}]`);

    dat.pos = pos[id];
    while (true) {
        const code = dat.g1();
        if (code === 0) {
            break;
        }

        if (code === 1) {
            const colour = dat.g3();

            def.push(`colour=0x${colour.toString(16).toUpperCase().padStart(6, '0')}`);
        } else if (code === 2) {
            const texture = dat.g1();

            const textureName = TexturePack.getById(texture) || `texture_${texture}`;
            def.push(`texture=${textureName}`);
        } else if (code == 3) {
            def.push('overlay=yes');
        } else if (code === 5) {
            def.push('occlude=no');
        } else if (code === 6) {
            const debugname = dat.gjstr();

            // console.log(id + '=' + debugname);
            def.push(`debugname=${debugname}`);
        } else {
            printWarning(`unknown flo code ${code}`);
        }
    }

    if (dat.pos !== pos[id] + len[id]) {
        printWarning(`incomplete read: ${dat.pos} != ${pos[id] + len[id]}`);
    }

    return def;
}
