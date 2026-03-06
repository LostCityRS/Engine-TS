import Packet from '#/io/Packet.js';
import InvType from '#/cache/config/InvType.js';

type OpcodeValue = {
    code: number;
    value?: any;
};

export function encodeInvWithOpcodes(config: InvType, opcodes: OpcodeValue[]): Uint8Array {
    const buf = Packet.alloc(2);

    for (const opc of opcodes) {
        const code = opc.code;
        if (code === 1) {
            // scope
            buf.p1(1);
            buf.p1(opc.value ?? config.scope);
        } else if (code === 2) {
            // size
            buf.p1(2);
            buf.p2(opc.value ?? config.size);
        } else if (code === 3) {
            // stackall
            buf.p1(3);
        } else if (code === 4) {
            // stock items
            buf.p1(4);
            const count = opc.value?.length ?? config.stockobj?.length ?? 0;
            buf.p1(count);
            for (let i = 0; i < count; i++) {
                const stockobj = opc.value?.[i]?.obj ?? config.stockobj![i];
                const stockcount = opc.value?.[i]?.count ?? config.stockcount![i];
                const stockrate = opc.value?.[i]?.rate ?? config.stockrate![i];
                buf.p2(stockobj);
                buf.p2(stockcount);
                buf.p4(stockrate);
            }
        } else if (code === 5) {
            // restock
            buf.p1(5);
        } else if (code === 6) {
            // allstock
            buf.p1(6);
        } else if (code === 7) {
            // protect=no
            buf.p1(7);
        } else if (code === 8) {
            // runweight
            buf.p1(8);
        } else if (code === 9) {
            // dummyinv
            buf.p1(9);
        } else if (code === 250) {
            // debugname
            buf.p1(250);
            buf.pjstr(opc.value ?? config.debugname ?? '');
        }
    }

    buf.p1(0);

    return new Uint8Array(buf.data.subarray(0, buf.pos));
}

export function encodeInv(config: InvType): Uint8Array {
    const buf = Packet.alloc(2);

    if (config.scope !== 0) {
        buf.p1(1);
        buf.p1(config.scope);
    }

    if (config.size !== 1) {
        buf.p1(2);
        buf.p2(config.size);
    }

    if (config.stackall) {
        buf.p1(3);
    }

    if (config.stockobj !== null && config.stockobj.length > 0) {
        buf.p1(4);
        buf.p1(config.stockobj.length);
        for (let i = 0; i < config.stockobj.length; i++) {
            buf.p2(config.stockobj[i]);
            buf.p2(config.stockcount![i]);
            buf.p4(config.stockrate![i]);
        }
    }

    if (config.restock) {
        buf.p1(5);
    }

    if (config.allstock) {
        buf.p1(6);
    }

    if (!config.protect) {
        buf.p1(7);
    }

    if (config.runweight) {
        buf.p1(8);
    }

    if (config.dummyinv) {
        buf.p1(9);
    }

    if (config.debugname) {
        buf.p1(250);
        buf.pjstr(config.debugname);
    }

    buf.p1(0);

    return new Uint8Array(buf.data.subarray(0, buf.pos));
}
