import Packet from '#/io/Packet.js';
import FluType from '#/cache/config/FluType.js';

type OpcodeValue = {
    code: number;
    value?: any;
};

export function encodeFluWithOpcodes(config: FluType, opcodes: OpcodeValue[]): Uint8Array {
    const buf = Packet.alloc(2);

    for (const opc of opcodes) {
        const code = opc.code;
        if (code === 1) {
            // colour (RGB24)
            buf.p1(1);
            buf.p3(opc.value ?? config.colour);
        } else if (code === 2) {
            // material (word)
            buf.p1(2);
            const matValue = opc.value ?? config.material;
            buf.p2(matValue === -1 ? 65535 : matValue);
        } else if (code === 3) {
            // materialscale
            buf.p1(3);
            const scaleValue = opc.value ?? config.materialscale;
            buf.p2(scaleValue & 0xffff);
        } else if (code === 4) {
            // hardshadow=no
            buf.p1(4);
        }
    }

    buf.p1(0);

    return new Uint8Array(buf.data.subarray(0, buf.pos));
}

export function encodeFlu(config: FluType): Uint8Array {
    const buf = Packet.alloc(2);

    if (config.colour !== 0) {
        buf.p1(1);
        buf.p3(config.colour);
    }

    if (config.material !== -1) {
        buf.p1(2);
        buf.p2(config.material === -1 ? 65535 : config.material);
    }

    if (config.materialscale !== 512) {
        buf.p1(3);
        buf.p2(config.materialscale & 0xffff);
    }

    if (!config.hardshadow) {
        buf.p1(4);
    }

    buf.p1(0);

    return new Uint8Array(buf.data.subarray(0, buf.pos));
}
