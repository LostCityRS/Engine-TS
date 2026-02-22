import Packet from '#/io/Packet.js';
import FloType from '#/cache/config/FloType.js';

type OpcodeValue = {
    code: number;
    value?: any;
};

export function encodeFloWithOpcodes(config: FloType, opcodes: OpcodeValue[]): Uint8Array {
    const buf = Packet.alloc(2);

    for (const opc of opcodes) {
        const code = opc.code;
        if (code === 1) {
            // colour (RGB24)
            buf.p1(1);
            buf.p3(opc.value ?? config.colour);
        } else if (code === 2) {
            // material (byte)
            buf.p1(2);
            buf.p1(opc.value ?? config.material);
        } else if (code === 3) {
            // material (word)
            buf.p1(3);
            const matValue = opc.value ?? config.material;
            buf.p2(matValue === -1 ? 65535 : matValue);
        } else if (code === 5) {
            // occlude=no
            buf.p1(5);
        } else if (code === 6) {
            // debugname
            buf.p1(6);
            buf.pjstr(opc.value ?? config.debugname ?? '');
        } else if (code === 7) {
            // averagecolour (RGB24)
            buf.p1(7);
            buf.p3(opc.value ?? config.averagecolour);
        } else if (code === 8) {
            // client-only, no data
            buf.p1(8);
        } else if (code === 9) {
            // materialscale
            buf.p1(9);
            buf.p2(opc.value ?? config.materialscale);
        } else if (code === 10) {
            // hardshadow
            buf.p1(10);
        } else if (code === 11) {
            // priority
            buf.p1(11);
            buf.p1(opc.value ?? config.priority);
        } else if (code === 12) {
            // blend
            buf.p1(12);
        } else if (code === 13) {
            // waterfogcolour
            buf.p1(13);
            buf.p3(opc.value ?? config.waterfogcolour);
        } else if (code === 14) {
            // waterfogscale
            buf.p1(14);
            buf.p1(opc.value ?? config.waterfogscale);
        }
    }

    // Terminator
    buf.p1(0);

    return new Uint8Array(buf.data.subarray(0, buf.pos));
}

export function encodeFlo(config: FloType): Uint8Array {
    const buf = Packet.alloc(2);

    // Code 1: colour (RGB24)
    if (config.colour !== 0) {
        buf.p1(1);
        buf.p3(config.colour);
    }

    // Code 2/3: materials (texture ID)
    if (config.material !== -1) {
        if (config.material < 256) {
            buf.p1(2);
            buf.p1(config.material);
        } else {
            buf.p1(3);
            buf.p2(config.material === -1 ? 65535 : config.material);
        }
    }

    // Code 5: occlude=no
    if (!config.occlude) {
        buf.p1(5);
    }

    // Code 6: debugname
    if (config.debugname) {
        buf.p1(6);
        buf.pjstr(config.debugname);
    }

    // Code 7: averagecolour (RGB24)
    if (config.averagecolour !== -1) {
        buf.p1(7);
        buf.p3(config.averagecolour);
    }

    // Code 9: materialscale
    if (config.materialscale !== 512) {
        buf.p1(9);
        buf.p2(config.materialscale);
    }

    // Code 10: hardshadow=no
    if (!config.hardshadow) {
        buf.p1(10);
    }

    // Code 11: priority
    if (config.priority !== 8) {
        buf.p1(11);
        buf.p1(config.priority);
    }

    // Code 12: blend=yes
    if (config.blend) {
        buf.p1(12);
    }

    // Code 13: waterfogcolour
    if (config.waterfogcolour !== 1190717) {
        buf.p1(13);
        buf.p3(config.waterfogcolour);
    }

    // Code 14: waterfogscale
    if (config.waterfogscale !== 512) {
        buf.p1(14);
        buf.p1(config.waterfogscale);
    }

    // Terminator
    buf.p1(0);

    return new Uint8Array(buf.data.subarray(0, buf.pos));
}
