import ColorConversion from '#/util/ColorConversion.js';
import { printWarning } from '#/util/Logger.js';
import { ModelPack, ObjPack, SeqPack } from '#/util/PackFile.js';

import { ConfigIdx } from './Common.js';

export function unpackObjConfig(config: ConfigIdx, id: number): string[] {
    const { dat, pos, len } = config;
    dat.pos = pos[id];

    const def: string[] = [];
    def.push(`[${ObjPack.getById(id)}]`);

    while (true) {
        const code = dat.g1();
        if (code === 0) {
            break;
        }

        if (code === 1) {
            const modelId = dat.g2();

            const model = ModelPack.getById(modelId) || 'model_' + modelId;
            def.push(`model=${model}`);
        } else if (code === 2) {
            const name = dat.gjstr();
            def.push(`name=${name}`);
        } else if (code === 3) {
            const desc = dat.gjstr();
            def.push(`desc=${desc}`);
        } else if (code === 4) {
            const zoom2d = dat.g2();
            def.push(`2dzoom=${zoom2d}`);
        } else if (code === 5) {
            const xan2d = dat.g2();
            def.push(`2dxan=${xan2d}`);
        } else if (code === 6) {
            const yan2d = dat.g2();
            def.push(`2dyan=${yan2d}`);
        } else if (code === 7) {
            const xof2d = dat.g2s();
            def.push(`2dxof=${xof2d}`);
        } else if (code === 8) {
            const yof2d = dat.g2s();
            def.push(`2dyof=${yof2d}`);
        } else if (code === 9) {
            def.push('code9=yes');
        } else if (code === 10) {
            const seqId = dat.g2();

            const seq = SeqPack.getById(seqId) || 'seq_' + seqId;
            def.push(`code10=${seq}`);
        } else if (code === 11) {
            def.push('stackable=yes');
        } else if (code === 12) {
            const cost = dat.g4();
            def.push(`cost=${cost}`);
        } else if (code === 16) {
            def.push('members=yes');
        } else if (code === 23) {
            const modelId = dat.g2();
            const offset = dat.g1b();

            const model = ModelPack.getById(modelId) || 'model_' + modelId;
            def.push(`manwear=${model},${offset}`);
        } else if (code === 24) {
            const modelId = dat.g2();

            const model = ModelPack.getById(modelId) || 'model_' + modelId;
            def.push(`manwear2=${model}`);
        } else if (code === 25) {
            const modelId = dat.g2();
            const offset = dat.g1b();

            const model = ModelPack.getById(modelId) || 'model_' + modelId;
            def.push(`womanwear=${model},${offset}`);
        } else if (code === 26) {
            const modelId = dat.g2();

            const model = ModelPack.getById(modelId) || 'model_' + modelId;
            def.push(`womanwear2=${model}`);
        } else if (code >= 30 && code < 35) {
            const index = (code - 30) + 1;
            const op = dat.gjstr();
            def.push(`op${index}=${op}`);
        } else if (code >= 35 && code < 40) {
            const index = (code - 35) + 1;
            const op = dat.gjstr();
            def.push(`iop${index}=${op}`);
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
        } else if (code === 78) {
            const modelId = dat.g2();

            const model = ModelPack.getById(modelId) || 'model_' + modelId;
            def.push(`manwear3=${model}`);
        } else if (code === 79) {
            const modelId = dat.g2();

            const model = ModelPack.getById(modelId) || 'model_' + modelId;
            def.push(`womanwear3=${model}`);
        } else if (code === 90) {
            const modelId = dat.g2();

            const model = ModelPack.getById(modelId) || 'model_' + modelId;
            def.push(`manhead=${model}`);
        } else if (code === 91) {
            const modelId = dat.g2();

            const model = ModelPack.getById(modelId) || 'model_' + modelId;
            def.push(`womanhead=${model}`);
        } else if (code === 92) {
            const modelId = dat.g2();

            const model = ModelPack.getById(modelId) || 'model_' + modelId;
            def.push(`manhead2=${model}`);
        } else if (code === 93) {
            const modelId = dat.g2();

            const model = ModelPack.getById(modelId) || 'model_' + modelId;
            def.push(`womanhead2=${model}`);
        } else if (code === 95) {
            const zan2d = dat.g2();
            def.push(`2dyof=${zan2d}`);
        } else if (code === 97) {
            const objId = dat.g2();

            const obj = ObjPack.getById(objId) || 'obj_' + objId;
            def.push(`certlink=${obj}`);
        } else if (code === 98) {
            const objId = dat.g2();

            const obj = ObjPack.getById(objId) || 'obj_' + objId;
            def.push(`certtemplate=${obj}`);
        } else if (code >= 100 && code < 110) {
            const index = (code - 100) + 1;
            const objId = dat.g2();
            const count = dat.g2();

            const obj = ObjPack.getById(objId) || 'obj_' + objId;
            def.push(`countobj${index}=${obj}`);
            def.push(`countco${index}=${count}`);
        } else if (code === 110) {
            const resizex = dat.g2();
            def.push(`resizex=${resizex}`);
        } else if (code === 111) {
            const resizey = dat.g2();
            def.push(`resizey=${resizey}`);
        } else if (code === 112) {
            const resizez = dat.g2();
            def.push(`resizez=${resizez}`);
        } else if (code === 113) {
            const ambient = dat.g1b();
            def.push(`ambient=${ambient}`);
        } else if (code === 114) {
            const contrast = dat.g1b();
            def.push(`contrast=${contrast}`);
        } else {
            printWarning(`unknown obj code ${code}`);
        }
    }

    if (dat.pos !== pos[id] + len[id]) {
        printWarning(`incomplete read: ${dat.pos} != ${pos[id] + len[id]}`);
    }

    return def;
}
