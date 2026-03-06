import Packet from '#/io/Packet.js';

export type NpcOpcode = {
    code: number;
    payload: any;
};

function readParams(dat: Packet): Array<{ string: boolean; key: number; value: number | string }> {
    const count = dat.g1();
    const entries: Array<{ string: boolean; key: number; value: number | string }> = [];

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

export function decodeNpcOpcode(code: number, dat: Packet): any {
    if (code === 1) {
        const count = dat.g1();
        const models: number[] = [];
        for (let i = 0; i < count; i++) {
            models.push(dat.g2());
        }
        return { models };
    }

    if (code === 2 || code === 3 || (code >= 30 && code < 35) || code === 250) {
        return dat.gjstr();
    }

    if (code === 12 || code === 128 || code === 202 || code === 206 || code === 208 || code === 209 || code === 210) {
        return dat.g1();
    }

    if (code === 13 || code === 14 || code === 18 || (code >= 74 && code <= 79) || code === 90 || code === 91 || code === 92 || code === 95 || code === 97 || code === 98 || code === 102 || code === 103 || code === 122 || code === 123 || code === 127 || code === 137 || code === 200 || code === 201 || code === 203 || code === 204 || code === 207) {
        return dat.g2();
    }

    if (code === 16 || code === 93 || code === 99 || code === 107 || code === 109 || code === 111 || code === 211 || code === 213) {
        return true;
    }

    if (code === 17) {
        return {
            walkanim: dat.g2(),
            walkanim_b: dat.g2(),
            walkanim_r: dat.g2(),
            walkanim_l: dat.g2()
        };
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

    if (code === 60) {
        const count = dat.g1();
        const heads: number[] = [];
        for (let i = 0; i < count; i++) {
            heads.push(dat.g2());
        }
        return heads;
    }

    if (code === 100 || code === 101 || code === 113 || code === 114 || code === 119 || code === 125) {
        if (code === 113) {
            return { trans1: dat.g2(), trans2: dat.g2() };
        }

        if (code === 114) {
            return { trans1: dat.g1b(), trans2: dat.g1b() };
        }
        return dat.g1b();
    }

    if (code === 106 || code === 118) {
        const multivarbit = dat.g2();
        const multivarp = dat.g2();

        let defaultId: number | undefined;
        if (code === 118) {
            defaultId = dat.g2();
        }

        const count = dat.g1();
        const multinpc: number[] = [];
        for (let i = 0; i <= count; i++) {
            multinpc.push(dat.g2());
        }

        return {
            multivarbit,
            multivarp,
            defaultId,
            multinpc
        };
    }

    if (code === 112) {
        return { colour1: dat.g2(), colour2: dat.g2() };
    }

    if (code === 115) {
        return { value1: dat.g1(), value2: dat.g1() };
    }

    if (code === 121) {
        const count = dat.g1();
        const offsets: Array<{ index: number; x: number; y: number; z: number }> = [];

        for (let i = 0; i < count; i++) {
            offsets.push({
                index: dat.g1(),
                x: dat.g1b(),
                y: dat.g1b(),
                z: dat.g1b()
            });
        }

        return offsets;
    }

    if (code === 134) {
        return {
            bgsound: dat.g2(),
            bgsound_crawl: dat.g2(),
            bgsound_walk: dat.g2(),
            bgsound_run: dat.g2(),
            bgsound_range: dat.g1()
        };
    }

    if (code === 135 || code === 136) {
        return {
            op: dat.g1(),
            cursor: dat.g2()
        };
    }

    if (code === 212) {
        const count = dat.g1();
        const patrol: Array<{ coord: number; delay: number }> = [];
        for (let i = 0; i < count; i++) {
            patrol.push({ coord: dat.g4s(), delay: dat.g1() });
        }
        return patrol;
    }

    if (code === 249) {
        return readParams(dat);
    }

    throw new Error(`Unrecognized npc config code: ${code}`);
}

export function encodeNpcOpcode(buf: Packet, op: NpcOpcode): void {
    const { code, payload } = op;
    buf.p1(code);

    if (code === 1) {
        const models = (payload?.models ?? []) as number[];
        buf.p1(models.length);
        for (const model of models) {
            buf.p2(model);
        }
        return;
    }

    if (code === 2 || code === 3 || (code >= 30 && code < 35) || code === 250) {
        buf.pjstr(String(payload ?? ''));
        return;
    }

    if (code === 12 || code === 128 || code === 202 || code === 206 || code === 208 || code === 209 || code === 210) {
        buf.p1(Number(payload));
        return;
    }

    if (code === 13 || code === 14 || code === 18 || (code >= 74 && code <= 79) || code === 90 || code === 91 || code === 92 || code === 95 || code === 97 || code === 98 || code === 102 || code === 103 || code === 122 || code === 123 || code === 127 || code === 137 || code === 200 || code === 201 || code === 203 || code === 204 || code === 207) {
        buf.p2(Number(payload));
        return;
    }

    if (code === 16 || code === 93 || code === 99 || code === 107 || code === 109 || code === 111 || code === 211 || code === 213) {
        return;
    }

    if (code === 17) {
        buf.p2(Number(payload.walkanim));
        buf.p2(Number(payload.walkanim_b));
        buf.p2(Number(payload.walkanim_r));
        buf.p2(Number(payload.walkanim_l));
        return;
    }

    if (code === 40 || code === 41) {
        const pairs = (payload ?? []) as Array<{ from: number; to: number }>;
        buf.p1(pairs.length);
        for (const pair of pairs) {
            buf.p2(pair.from);
            buf.p2(pair.to);
        }
        return;
    }

    if (code === 42) {
        const values = (payload ?? []) as number[];
        buf.p1(values.length);
        for (const value of values) {
            buf.p1(value & 0xff);
        }
        return;
    }

    if (code === 60) {
        const heads = (payload ?? []) as number[];
        buf.p1(heads.length);
        for (const head of heads) {
            buf.p2(head);
        }
        return;
    }

    if (code === 100 || code === 101 || code === 119 || code === 125) {
        buf.p1(Number(payload) & 0xff);
        return;
    }

    if (code === 113) {
        buf.p2(Number(payload.trans1));
        buf.p2(Number(payload.trans2));
        return;
    }

    if (code === 114) {
        buf.p1(Number(payload.trans1) & 0xff);
        buf.p1(Number(payload.trans2) & 0xff);
        return;
    }

    if (code === 106 || code === 118) {
        buf.p2(Number(payload.multivarbit));
        buf.p2(Number(payload.multivarp));

        if (code === 118) {
            buf.p2(Number(payload.defaultId ?? 65535));
        }

        const multinpc = (payload.multinpc ?? []) as number[];
        if (multinpc.length === 0) {
            buf.p1(0);
            buf.p2(65535);
            return;
        }

        buf.p1(Math.max(0, multinpc.length - 1));
        for (const npcId of multinpc) {
            buf.p2(npcId);
        }
        return;
    }

    if (code === 112) {
        buf.p2(Number(payload.colour1));
        buf.p2(Number(payload.colour2));
        return;
    }

    if (code === 115) {
        buf.p1(Number(payload.value1));
        buf.p1(Number(payload.value2));
        return;
    }

    if (code === 121) {
        const offsets = (payload ?? []) as Array<{ index: number; x: number; y: number; z: number }>;
        buf.p1(offsets.length);
        for (const offset of offsets) {
            buf.p1(offset.index);
            buf.p1(offset.x & 0xff);
            buf.p1(offset.y & 0xff);
            buf.p1(offset.z & 0xff);
        }
        return;
    }

    if (code === 134) {
        buf.p2(Number(payload.bgsound));
        buf.p2(Number(payload.bgsound_crawl));
        buf.p2(Number(payload.bgsound_walk));
        buf.p2(Number(payload.bgsound_run));
        buf.p1(Number(payload.bgsound_range));
        return;
    }

    if (code === 135 || code === 136) {
        buf.p1(Number(payload.op));
        buf.p2(Number(payload.cursor));
        return;
    }

    if (code === 212) {
        const patrol = (payload ?? []) as Array<{ coord: number; delay: number }>;
        buf.p1(patrol.length);
        for (const point of patrol) {
            buf.p4(point.coord);
            buf.p1(point.delay);
        }
        return;
    }

    if (code === 249) {
        writeParams(buf, (payload ?? []) as Array<{ string: boolean; key: number; value: number | string }>);
        return;
    }

    throw new Error(`Unrecognized npc config code: ${code}`);
}

export function encodeNpcOps(ops: NpcOpcode[]): Uint8Array {
    const buf = Packet.alloc(2);

    for (const op of ops) {
        encodeNpcOpcode(buf, op);
    }

    buf.p1(0);
    return new Uint8Array(buf.data.subarray(0, buf.pos));
}
