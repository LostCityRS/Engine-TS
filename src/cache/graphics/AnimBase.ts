import Packet from '#/io/Packet.js';

export default class AnimBase {
    static instances: AnimBase[] = [];
    static order: string[] = [];

    static OP_BASE = 0;
    static OP_TRANSLATE = 1;
    static OP_ROTATE = 2;
    static OP_SCALE = 3;
    static OP_ALPHA = 5;

    length: number = 0;
    types: Int32Array = new Int32Array();
    labels: Int32Array[] = [];

    static unpack(dat: Packet): number {
        const length = dat.g1();

        const types = new Int32Array(length);
        const labels = new Array(length);

        for (let i = 0; i < length; i++) {
            types[i] = dat.g1();
        }

        for (let i = 0; i < length; i++) {
            const labelCount = dat.g1();
            labels[i] = new Int32Array(labelCount);

            for (let j = 0; j < labelCount; j++) {
                labels[i][j] = dat.g1();
            }
        }

        const base = new AnimBase();
        base.length = length;
        base.types = types;
        base.labels = labels;
        return AnimBase.instances.push(base) - 1;
    }
}
