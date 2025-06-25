import { printWarning } from '#/util/Logger.js';
import { AnimPack, ObjPack, SeqPack } from '#/util/PackFile.js';

import { ConfigIdx } from './Common.js';

export function unpackSeqConfig(config: ConfigIdx, id: number): string[] {
    const { dat, pos, len } = config;

    const def: string[] = [];
    def.push(`[${SeqPack.getById(id)}]`);

    dat.pos = pos[id];
    while (true) {
        const code = dat.g1();
        if (code === 0) {
            break;
        }

        if (code === 1) {
            const count = dat.g1();

            const frame: number[] = [];
            const iframe: number[] = [];
            const delay: number[] = [];

            for (let i = 0; i < count; i++) {
                frame[i] = dat.g2();
                iframe[i] = dat.g2();
                if (iframe[i] === 65535) {
                    iframe[i] = -1;
                }
                delay[i] = dat.g2();
            }

            for (let i = 0; i < count; i++) {
                const index = i + 1;

                const frameName = AnimPack.getById(frame[i]) || 'anim_' + frame[i];
                def.push(`frame${index}=${frameName}`);

                if (delay[i] !== 0) {
                    def.push(`delay${index}=${delay[i]}`);
                }
            }

            for (let i = 0; i < count; i++) {
                const index = i + 1;

                if (iframe[i] !== -1) {
                    const iframeName = AnimPack.getById(iframe[i]) || 'anim_' + iframe[i];
                    def.push(`iframe${index}=${iframeName}`);
                }
            }
        } else if (code === 2) {
            const replayoff = dat.g2();
            def.push(`replayoff=${replayoff}`);
        } else if (code === 3) {
            const count = dat.g1();

            for (let i = 0; i < count; i++) {
                const index = i + 1;
                const walkmerge = dat.g1();
                def.push(`walkmerge${index}=label_${walkmerge}`);
            }
        } else if (code === 4) {
            def.push('stretches=yes');
        } else if (code === 5) {
            const priority = dat.g1();
            def.push(`priority=${priority}`);
        } else if (code === 6) {
            const righthand = dat.g2();
            if (righthand === 0) {
                def.push('righthand=hide');
            } else {
                def.push(`righthand=${ObjPack.getById(righthand - 512)}`);
            }
        } else if (code === 7) {
            const lefthand = dat.g2();
            if (lefthand === 0) {
                def.push('lefthand=hide');
            } else {
                def.push(`lefthand=${ObjPack.getById(lefthand - 512)}`);
            }
        } else if (code === 8) {
            const replaycount = dat.g1();
            def.push(`replaycount=${replaycount}`);
        } else if (code === 9) {
            const preanim_move = dat.g1();

            let op = preanim_move.toString();
            if (preanim_move === 0) {
                op = 'delaymove';
            } else if (preanim_move === 1) {
                op = 'delayanim';
            } else if (preanim_move === 2) {
                op = 'merge';
            }
            def.push(`preanim_move=${op}`);
        } else if (code === 10) {
            const postanim_move = dat.g1();

            let op = postanim_move.toString();
            if (postanim_move === 0) {
                op = 'delaymove';
            } else if (postanim_move === 1) {
                op = 'abortanim';
            } else if (postanim_move === 2) {
                op = 'merge';
            }
            def.push(`postanim_move=${op}`);
        } else if (code === 11) {
            const restart_mode = dat.g1();

            let op = restart_mode.toString();
            if (restart_mode === 1) {
                op = 'reset';
            } else if (restart_mode === 2) {
                op = 'reset_loop';
            }
            def.push(`restart_mode=${op}`);
        } else {
            printWarning(`unknown seq code ${code}`);
        }
    }

    if (dat.pos !== pos[id] + len[id]) {
        printWarning(`incomplete read: ${dat.pos} != ${pos[id] + len[id]}`);
    }

    return def;
}
