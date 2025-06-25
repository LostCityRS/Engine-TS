import ColorConversion from '#/util/ColorConversion.js';
import { printWarning } from '#/util/Logger.js';
import { ModelPack, NpcPack, SeqPack } from '#/util/PackFile.js';

import { ConfigIdx } from './Common.js';

export function unpackNpcConfig(config: ConfigIdx, id: number): string[] {
    const { dat, pos, len } = config;
    dat.pos = pos[id];

    const def: string[] = [];
    def.push(`[${NpcPack.getById(id)}]`);

    while (true) {
        const code = dat.g1();
        if (code === 0) {
            break;
        }

        if (code === 1) {
            const count = dat.g1();

            for (let i = 0; i < count; i++) {
                const index = i + 1;
                const modelId = dat.g2();

                const model = ModelPack.getById(modelId) || 'model_' + modelId;
                def.push(`model${index}=${model}`);
            }
        } else if (code === 2) {
            const name = dat.gjstr();
            def.push(`name=${name}`);
        } else if (code === 3) {
            const desc = dat.gjstr();
            def.push(`desc=${desc}`);
        } else if (code === 12) {
            const size = dat.g1b();
            def.push(`size=${size}`);
        } else if (code === 13) {
            const readyanimId = dat.g2();

            const readyanim = SeqPack.getById(readyanimId) || 'seq_ ' + readyanimId;
            def.push(`readyanim=${readyanim}`);
        } else if (code === 14) {
            const walkanimId = dat.g2();

            const walkanim = SeqPack.getById(walkanimId) || 'seq_ ' + walkanimId;
            def.push(`walkanim=${walkanim}`);
        } else if (code === 16) {
            def.push('hasalpha=yes');
        } else if (code === 17) {
            const walkanimId = dat.g2();
            const walkanim_bId = dat.g2();
            const walkanim_lId = dat.g2();
            const walkanim_rId = dat.g2();

            const walkanim = SeqPack.getById(walkanimId) || 'seq_' + walkanimId;
            const walkanim_b = SeqPack.getById(walkanim_bId) || 'seq_' + walkanim_bId;
            const walkanim_l = SeqPack.getById(walkanim_lId) || 'seq_' + walkanim_lId;
            const walkanim_r = SeqPack.getById(walkanim_rId) || 'seq_' + walkanim_rId;

            def.push(`walkanim=${walkanim},${walkanim_b},${walkanim_l},${walkanim_r}`);
        } else if (code >= 30 && code < 35) {
            const index = (code - 30) + 1;
            const op = dat.gjstr();
            def.push(`op${index}=${op}`);
        } else if (code === 40) {
            const count = dat.g1();

            for (let i = 0; i < count; i++) {
                const index = i + 1;
                const src = dat.g2();
                const dst = dat.g2();

                // todo: retex detection (no rgb value || model flags)
                const srcRgb = ColorConversion.reverseHsl(src)[0];
                const dstRgb = ColorConversion.reverseHsl(dst)[0];

                def.push(`recol${index}s=${srcRgb || src}`);
                def.push(`recol${index}d=${dstRgb || dst}`);
            }
        } else if (code === 60) {
            const count = dat.g1();

            for (let i = 0; i < count; i++) {
                const index = i + 1;
                const modelId = dat.g2();

                const model = ModelPack.getById(modelId) || 'model_' + modelId;
                def.push(`head${index}=${model}`);
            }
        } else if (code === 93) {
            def.push('minimap=no');
        } else if (code === 95) {
            const vislevel = dat.g2();
            if (vislevel === 0) {
                def.push('vislevel=hide');
            } else {
                def.push(`vislevel=${vislevel}`);
            }
        } else if (code === 97) {
            const resizeh = dat.g2();
            def.push(`resizeh=${resizeh}`);
        } else if (code === 98) {
            const resizev = dat.g2();
            def.push(`resizev=${resizev}`);
        } else if (code === 99) {
            def.push('alwaysontop=yes');
        } else if (code === 100) {
            const ambient = dat.g1b();
            def.push(`ambient=${ambient}`);
        } else if (code === 101) {
            const contrast = dat.g1b();
            def.push(`contrast=${contrast}`);
        } else if (code === 102) {
            const headicon = dat.g2();
            def.push(`headicon=${headicon}`);
        } else {
            printWarning(`unknown npc code ${code}`);
        }
    }

    if (dat.pos !== pos[id] + len[id]) {
        printWarning(`incomplete read: ${dat.pos} != ${pos[id] + len[id]}`);
    }

    return def;
}
