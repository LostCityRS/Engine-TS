import { printWarning } from '#/util/Logger.js';
import { ModelPack, SeqPack, SpotAnimPack } from '#/util/PackFile.js';

import { ConfigIdx } from './Common.js';

export function unpackSpotAnimType(config: ConfigIdx, id: number): string[] {
    const { dat, pos, len } = config;

    const def: string[] = [];
    def.push(`[${SpotAnimPack.getById(id)}]`);

    console.log(id);

    dat.pos = pos[id];
    while (true) {
        const code = dat.g1();
        if (code === 0) {
            break;
        }

        if (code === 1) {
            const modelId = dat.g2();
            
            const modelName = ModelPack.getById(modelId) || `model_${modelId}`;
            def.push(`model=${modelName}`);
        } else if (code === 2) {
            const seqId = dat.g2();

            const seqName = SeqPack.getById(seqId) || `seq_${seqId}`;
            def.push(`anim=${seqName}`);
        } else if (code === 4) {
            const resizeh = dat.g2();

            def.push(`resizeh=${resizeh}`);
        } else if (code === 5) {
            const resizev = dat.g2();

            def.push(`resizev=${resizev}`);
        } else if (code === 6) {
            const angle = dat.g2();

            def.push(`angle=${angle}`);
        } else if (code === 7) {
            const ambient = dat.g1b();

            def.push(`ambient=${ambient}`);
        } else if (code === 8) {
            const contrast = dat.g1b();

            def.push(`contrast=${contrast}`);
        } else if (code >= 40 && code < 50) {
            const index = code - 40 + 1;
            const recol = dat.g2();

            def.push(`recol${index}s=${recol}`);
        } else if (code >= 50 && code < 60) {
            const index = code - 50 + 1;
            const recol = dat.g2();

            def.push(`recol${index}d=${recol}`);
        } else {
            printWarning(`unknown varbit code ${code}`);
        }
    }

    if (dat.pos !== pos[id] + len[id]) {
        printWarning(`incomplete read: ${dat.pos} != ${pos[id] + len[id]}`);
    }

    return def;
}
