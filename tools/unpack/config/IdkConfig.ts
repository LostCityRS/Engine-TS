import { printWarning } from '#/util/Logger.js';
import { IdkPack, ModelPack } from '#/util/PackFile.js';

import { ConfigIdx } from './Common.js';

enum IdkPartType {
    man_hair = 0,
    man_jaw = 1,
    man_torso = 2,
    man_arms = 3,
    man_hands = 4,
    man_legs = 5,
    man_feet = 6,
    woman_hair = 7,
    woman_jaw = 8,
    woman_torso = 9,
    woman_arms = 10,
    woman_hands = 11,
    woman_legs = 12,
    woman_feet = 13
}

export function unpackIdkConfig(config: ConfigIdx, id: number): string[] {
    const { dat, pos, len } = config;

    const def: string[] = [];
    def.push(`[${IdkPack.getById(id)}]`);

    dat.pos = pos[id];
    while (true) {
        const code = dat.g1();
        if (code === 0) {
            break;
        }

        if (code === 1) {
            const type = dat.g1();

            def.push(`type=${IdkPartType[type]}`);
        } else if (code === 2) {
            const count = dat.g1();
            for (let i = 0; i < count; i++) {
                const modelId = dat.g2();
                const model = ModelPack.getById(modelId) || 'model_' + modelId;

                def.push(`model${i + 1}=${model}`);
            }
        } else if (code === 3) {
            def.push('disable=yes');
        } else if (code >= 40 && code < 50) {
            const index = code - 40 + 1;
            const recol = dat.g2();

            def.push(`recol${index}s=${recol}`);
        } else if (code >= 50 && code < 60) {
            const index = code - 50 + 1;
            const recol = dat.g2();

            def.push(`recol${index}d=${recol}`);
        } else if (code >= 60 && code < 70) {
            const index = code - 60 + 1;
            const modelId = dat.g2();

            const model = ModelPack.getById(modelId) || 'model_' + modelId;
            def.push(`head${index}=${model}`);
        } else {
            printWarning(`unknown idk code ${code}`);
        }
    }

    if (dat.pos !== pos[id] + len[id]) {
        printWarning(`incomplete read: ${dat.pos} != ${pos[id] + len[id]}`);
    }

    return def;
}
