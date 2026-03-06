import Packet from '#/io/Packet.js';

export type ObjOpcode = {
    code: number;
    payload: any;
};

function readParams(dat: Packet): Array<{ string: boolean; key: number; value: number | string }> {
    const entries: Array<{ string: boolean; key: number; value: number | string }> = [];

    const count = dat.g1();
    for (let i = 0; i < count; i++) {
        const isString = dat.g1() === 1;
        const key = dat.g3();
        const value = isString ? dat.gjstr() : dat.g4s();
        entries.push({ string: isString, key, value });
    }

    return entries;
}

function writeParams(buf: Packet, entries: Array<{ string: boolean; key: number; value: number | string }>): void {
    buf.p1(entries.length);

    for (const entry of entries) {
        buf.p1(entry.string ? 1 : 0);
        buf.p3(entry.key);

        if (entry.string) {
            buf.pjstr(String(entry.value));
        } else {
            buf.p4(Number(entry.value));
        }
    }
}

export function decodeObjOpcode(code: number, dat: Packet): any {
    if (code === 1 || code === 23 || code === 24 || code === 25 || code === 26 || code === 78 || code === 79 ||
        code === 90 || code === 91 || code === 92 || code === 93 || code === 94 || code === 95 || code === 97 ||
        code === 98 || code === 110 || code === 111 || code === 112 || code === 121 || code === 122 ||
        code === 201 || code === 4 || code === 5 || code === 6) {
        return dat.g2();
    }

    if (code === 2 || code === 3 || (code >= 30 && code < 40) || code === 250) {
        return dat.gjstr();
    }

    if (code === 7 || code === 8 || code === 75) {
        return dat.g2s();
    }

    if (code === 12) {
        return dat.g4s();
    }

    if (code === 11 || code === 15 || code === 16 || code === 65 || code === 123) {
        return true;
    }

    if (code === 13 || code === 14 || code === 27 || code === 96 || code === 115) {
        return dat.g1();
    }

    if (code === 113 || code === 114) {
        return dat.g1b();
    }

    if (code === 40 || code === 41) {
        const count = dat.g1();
        const pairs: Array<{ from: number; to: number }> = [];
        for (let i = 0; i < count; i++) {
            pairs.push({ from: dat.g2(), to: dat.g2() });
        }
        return pairs;
    }

    if (code === 42) {
        const count = dat.g1();
        const values: number[] = [];
        for (let i = 0; i < count; i++) {
            values.push(dat.g1b());
        }
        return values;
    }

    if (code >= 100 && code < 110) {
        return {
            obj: dat.g2(),
            count: dat.g2()
        };
    }

    if (code === 125 || code === 126) {
        return {
            x: dat.g1b(),
            y: dat.g1b(),
            z: dat.g1b()
        };
    }

    if (code === 127 || code === 128 || code === 129 || code === 130) {
        return {
            op: dat.g1(),
            cursor: dat.g2()
        };
    }

    if (code === 249) {
        return readParams(dat);
    }

    throw new Error(`Unrecognized obj config code: ${code}`);
}

export function encodeObjOpcode(buf: Packet, op: ObjOpcode): void {
    const { code, payload } = op;
    buf.p1(code);

    if (code === 1 || code === 23 || code === 24 || code === 25 || code === 26 || code === 78 || code === 79 ||
        code === 90 || code === 91 || code === 92 || code === 93 || code === 94 || code === 95 || code === 97 ||
        code === 98 || code === 110 || code === 111 || code === 112 || code === 121 || code === 122 ||
        code === 4 || code === 5 || code === 6 || code === 201) {
        buf.p2(Number(payload));
        return;
    }

    if (code === 2 || code === 3 || (code >= 30 && code < 40) || code === 250) {
        buf.pjstr(String(payload ?? ''));
        return;
    }

    if (code === 7 || code === 8 || code === 75) {
        buf.p2(Number(payload) & 0xffff);
        return;
    }

    if (code === 12) {
        buf.p4(Number(payload));
        return;
    }

    if (code === 11 || code === 15 || code === 16 || code === 65 || code === 123) {
        return;
    }

    if (code === 13 || code === 14 || code === 27 || code === 96 || code === 115) {
        buf.p1(Number(payload) & 0xff);
        return;
    }

    if (code === 113 || code === 114) {
        buf.p1(Number(payload) & 0xff);
        return;
    }

    if (code === 40 || code === 41) {
        const pairs = (payload ?? []) as Array<{ from: number; to: number }>;
        buf.p1(pairs.length);
        for (const pair of pairs) {
            buf.p2(Number(pair.from));
            buf.p2(Number(pair.to));
        }
        return;
    }

    if (code === 42) {
        const values = (payload ?? []) as number[];
        buf.p1(values.length);
        for (const value of values) {
            buf.p1(Number(value) & 0xff);
        }
        return;
    }

    if (code >= 100 && code < 110) {
        buf.p2(Number(payload.obj));
        buf.p2(Number(payload.count));
        return;
    }

    if (code === 125 || code === 126) {
        buf.p1(Number(payload.x) & 0xff);
        buf.p1(Number(payload.y) & 0xff);
        buf.p1(Number(payload.z) & 0xff);
        return;
    }

    if (code === 127 || code === 128 || code === 129 || code === 130) {
        buf.p1(Number(payload.op));
        buf.p2(Number(payload.cursor));
        return;
    }

    if (code === 249) {
        writeParams(buf, (payload ?? []) as Array<{ string: boolean; key: number; value: number | string }>);
        return;
    }

    throw new Error(`Unrecognized obj config code: ${code}`);
}

export function encodeObjOps(ops: ObjOpcode[]): Uint8Array {
    const buf = Packet.alloc(2);

    for (const op of ops) {
        encodeObjOpcode(buf, op);
    }

    buf.p1(0);
    return new Uint8Array(buf.data.subarray(0, buf.pos));
}
