import ColorConversion from '#/util/ColorConversion.js';
import { printWarning } from '#/util/Logger.js';
import { LocPack, ModelPack, SeqPack } from '#/util/PackFile.js';

import { ConfigIdx } from './Common.js';

enum LocShapeSuffix {
    _1 = 0, // wall_straight
    _2 = 1, // wall_diagonalcorner
    _3 = 2, // wall_l
    _4 = 3, // wall_squarecorner
    _q = 4, // walldecor_straight_nooffset
    _5 = 9, // wall_diagonal
    _w = 5, // walldecor_straight_offset
    _r = 6, // walldecor_diagonal_offset
    _e = 7, // walldecor_diagonal_nooffset
    _t = 8, // walldecor_diagonal_both
    _8 = 10, // centrepiece_straight
    _9 = 11, // centrepiece_diagonal
    _0 = 22, // grounddecor
    _a = 12, // roof_straight
    _s = 13, // roof_diagonal_with_roofedge
    _d = 14, // roof_diagonal
    _f = 15, // roof_l_concave
    _g = 16, // roof_l_convex
    _h = 17, // roof_flat
    _z = 18, // roofedge_straight
    _x = 19, // roofedge_diagonalcorner
    _c = 20, // roofedge_l
    _v = 21 // roofedge_squarecorner
}

export function unpackLocConfig(config: ConfigIdx, id: number): string[] {
    const { dat, pos, len } = config;
    dat.pos = pos[id];

    const def: string[] = [];
    def.push(`[${LocPack.getById(id)}]`);

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
                const shape = dat.g1();

                const model = ModelPack.getById(modelId) || 'model_' + modelId;
                def.push(`model${index}=${model},${LocShapeSuffix[shape]}`);
                // the comma is intentional as this needs to be post-processed to become a single model line!
            }
        } else if (code === 2) {
            const name = dat.gjstr();
            def.push(`name=${name}`);
        } else if (code === 3) {
            const desc = dat.gjstr();
            def.push(`desc=${desc}`);
        } else if (code === 14) {
            const width = dat.g1();
            def.push(`width=${width}`);
        } else if (code === 15) {
            const length = dat.g1();
            def.push(`length=${length}`);
        } else if (code === 17) {
            def.push('blockwalk=no');
        } else if (code === 18) {
            def.push('blockrange=no');
        } else if (code === 19) {
            const active = dat.gbool();
            def.push(`active=${active ? 'yes' : 'no'}`);
        } else if (code === 21) {
            def.push('hillskew=yes');
        } else if (code === 22) {
            def.push('sharelight=yes');
        } else if (code === 23) {
            def.push('occlude=yes');
        } else if (code === 24) {
            const seqId = dat.g2();

            const seq = SeqPack.getById(seqId) || 'seq_' + seqId;
            def.push(`anim=${seq}`);
        } else if (code === 25) {
            def.push('hasalpha=yes');
        } else if (code === 28) {
            const wallwidth = dat.g1();
            def.push(`wallwidth=${wallwidth}`);
        } else if (code === 29) {
            const ambient = dat.g1b();
            def.push(`ambient=${ambient}`);
        } else if (code === 39) {
            const contrast = dat.g1b();
            def.push(`contrast=${contrast}`);
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
            const mapfunction = dat.g2();
            def.push(`mapfunction=${mapfunction}`);
        } else if (code === 62) {
            def.push('mirror=yes');
        } else if (code === 64) {
            def.push('shadow=no');
        } else if (code === 65) {
            const resizex = dat.g2();
            def.push(`resizex=${resizex}`);
        } else if (code === 66) {
            const resizey = dat.g2();
            def.push(`resizey=${resizey}`);
        } else if (code === 67) {
            const resizez = dat.g2();
            def.push(`resizez=${resizez}`);
        } else if (code === 68) {
            const mapscene = dat.g2();
            def.push(`mapscene=${mapscene}`);
        } else if (code === 69) {
            const flags = dat.g1();

            let forceapproach = '';
            if ((flags & 0b0001) === 0) {
                forceapproach = 'north';
            } else if ((flags & 0b0010) === 0) {
                forceapproach = 'east';
            } else if ((flags & 0b0100) === 0) {
                forceapproach = 'south';
            } else if ((flags & 0b1000) === 0) {
                forceapproach = 'west';
            }

            def.push(`forceapproach=${forceapproach}`);
        } else if (code === 70) {
            const xoff = dat.g2s();
            def.push(`xoff=${xoff}`);
        } else if (code === 71) {
            const yoff = dat.g2s();
            def.push(`yoff=${yoff}`);
        } else if (code === 72) {
            const zoff = dat.g2s();
            def.push(`zoff=${zoff}`);
        } else if (code === 73) {
            def.push('forcedecor=yes');
        } else {
            printWarning(`unknown loc code ${code}`);
        }
    }

    if (dat.pos !== pos[id] + len[id]) {
        printWarning(`incomplete read: ${dat.pos} != ${pos[id] + len[id]}`);
    }

    return def;
}
