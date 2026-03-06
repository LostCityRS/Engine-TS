import Packet from '#/io/Packet.js';
import MesanimType from '#/cache/config/MesanimType.js';

type OpcodeValue = {
    code: number;
    value?: number;
};

export function encodeMesanimWithOpcodes(config: MesanimType, opcodes: OpcodeValue[]): Uint8Array {
    const buf = Packet.alloc(2);

    for (const opc of opcodes) {
        const code = opc.code;
        if (code >= 1 && code <= 4) {
            const fallback = config.len[code - 1];
            const value = opc.value ?? fallback;
            if (value < 0) {
                continue;
            }

            buf.p1(code);
            buf.p2(value);
        }
    }

    buf.p1(0);
    return new Uint8Array(buf.data.subarray(0, buf.pos));
}

export function encodeMesanim(config: MesanimType): Uint8Array {
    const buf = Packet.alloc(2);

    for (let i = 0; i < config.len.length; i++) {
        const value = config.len[i];
        if (value >= 0) {
            buf.p1(i + 1);
            buf.p2(value);
        }
    }

    buf.p1(0);
    return new Uint8Array(buf.data.subarray(0, buf.pos));
}
