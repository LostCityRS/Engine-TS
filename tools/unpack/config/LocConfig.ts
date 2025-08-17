import { modelsHaveTexture } from '#/cache/graphics/Model.js';
import ColorConversion from '#/util/ColorConversion.js';
import { printFatalError, printWarning } from '#/util/Logger.js';
import { LocPack, ModelPack, SeqPack, TexturePack, VarbitPack, VarpPack } from '#/util/PackFile.js';

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

    let decodedModels = false;
    let lastCode = 0;

    const modelIds: number[] = [];
    const recolSrc: number[] = [];
    const recolDst: number[] = [];

    while (true) {
        const code = dat.g1();
        if (code === 0) {
            break;
        }

        if (code === 1 || code === 5) {
            const count = dat.g1();

            for (let i = 0; i < count; i++) {
                const index = i + 1;
                const modelId = dat.g2();
                const shape = code === 1 ? dat.g1() : 10;

                modelIds.push(modelId);

                // this needs to be post-processed to become a single model line!
                const model = ModelPack.getById(modelId) || 'model_' + modelId;
                if (!decodedModels) {
                    def.push(`unpacked_${index}=${model},${LocShapeSuffix[shape]}`);
                } else {
                    def.push(`unpacked2_${index}=${model},${LocShapeSuffix[shape]}`);
                }
            }

            decodedModels = true;
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
                recolSrc[i] = dat.g2();
                recolDst[i] = dat.g2();
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
            const offsetx = dat.g2s();
            def.push(`offsetx=${offsetx}`);
        } else if (code === 71) {
            const offsety = dat.g2s();
            def.push(`offsety=${offsety}`);
        } else if (code === 72) {
            const offsetz = dat.g2s();
            def.push(`offsetz=${offsetz}`);
        } else if (code === 73) {
            def.push('forcedecor=yes');
        } else if (code === 74) {
            def.push('breakroutefinding=yes');
        } else if (code === 75) {
            const raiseobject = dat.gbool();
            def.push(`raiseobject=${raiseobject ? 'yes' : 'no'}`);
        } else if (code === 77) {
            const varbit = dat.g2();
            const varp = dat.g2();

            if (varbit === 65535) {
                const name = VarpPack.getById(varp) || 'varp_' + varp;
                def.push(`multivar=${name}`);
            } else {
                const name = VarbitPack.getById(varbit) || 'varbit_' + varbit;
                def.push(`multivar=${name}`);
            }

            const states = dat.g1();
            for (let i = 0; i <= states; i++) {
                const multiloc = dat.g2();

                if (multiloc !== 65535) {
                    const name = LocPack.getById(multiloc) || 'loc_' + multiloc;
                    def.push(`multiloc=${i},${name}`);
                }
            }
        } else {
            printFatalError(`unknown loc code ${code}, last code ${lastCode}`);
        }

        lastCode = code;
    }

    if (dat.pos !== pos[id] + len[id]) {
        printWarning(`incomplete read: ${dat.pos} != ${pos[id] + len[id]}`);
    }

    const recolCount = recolSrc.length;
    for (let i = 0; i < recolCount; i++) {
        const index = i + 1;

        const srcRaw = recolSrc[i];
        const dstRaw = recolDst[i];

        const srcRgb = ColorConversion.reverseHsl(srcRaw)[0];
        const dstRgb = ColorConversion.reverseHsl(dstRaw)[0];

        if (srcRaw >= 50 || dstRaw >= 50) {
            // texture ids cap at 50, so we can save time knowing it's not a texture id - output as rgb
            def.push(`recol${index}s=${srcRgb ?? srcRaw}`);
            def.push(`recol${index}d=${dstRgb ?? dstRaw}`);
        } else if (typeof srcRgb === 'undefined' || typeof dstRgb === 'undefined' || modelsHaveTexture(modelIds, srcRaw)) {
            // model has the source as a texture - output as texture
            def.push(`retex${index}s=${TexturePack.getById(srcRaw)}`);
            def.push(`retex${index}d=${TexturePack.getById(dstRaw)}`);
        } else {
            // output as rgb
            def.push(`recol${index}s=${srcRgb ?? srcRaw}`);
            def.push(`recol${index}d=${dstRgb ?? dstRaw}`);
        }
    }

    return def;
}
