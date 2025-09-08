import { printWarning } from '#/util/Logger.js';
import { VarpPack } from '#tools/pack/PackFile.js';

import { ConfigIdx } from './Common.js';

export function unpackVarpConfig(config: ConfigIdx, id: number): string[] {
    const { dat, pos, len } = config;

    const def: string[] = [];
    def.push(`[${VarpPack.getById(id)}]`);

    dat.pos = pos[id];
    while (true) {
        const code = dat.g1();
        if (code === 0) {
            break;
        }

        if (code === 5) {
            const clientcode = dat.g2();

            def.push(`clientcode=${clientcode}`);
        } else {
            printWarning(`unknown varp code ${code}`);
        }
    }

    if (dat.pos !== pos[id] + len[id]) {
        printWarning(`incomplete read: ${dat.pos} != ${pos[id] + len[id]}`);
    }

    return def;
}
