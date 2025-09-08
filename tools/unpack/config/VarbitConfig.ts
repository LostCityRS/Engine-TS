import { printWarning } from '#/util/Logger.js';
import { VarbitPack, VarpPack } from '#tools/pack/PackFile.js';

import { ConfigIdx } from './Common.js';

export function unpackVarbitConfig(config: ConfigIdx, id: number): string[] {
    const { dat, pos, len } = config;

    const def: string[] = [];
    def.push(`[${VarbitPack.getById(id)}]`);

    dat.pos = pos[id];
    while (true) {
        const code = dat.g1();
        if (code === 0) {
            break;
        }

        if (code === 1) {
            const varpId = dat.g2();
            const startbit = dat.g1();
            const endbit = dat.g1();

            const varpName = VarpPack.getById(varpId) || `varp_${varpId}`;
            def.push(`basevar=${varpName}`);
            def.push(`startbit=${startbit}`);
            def.push(`endbit=${endbit}`);
        } else {
            printWarning(`unknown varbit code ${code}`);
        }
    }

    if (dat.pos !== pos[id] + len[id]) {
        printWarning(`incomplete read: ${dat.pos} != ${pos[id] + len[id]}`);
    }

    return def;
}
