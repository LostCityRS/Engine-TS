import FileStream from '#/io/FileStream.js';
import Jagfile from '#/io/Jagfile.js';
import Packet from '#/io/Packet.js';
import { printInfo, printWarning } from '#/util/Logger.js';

function readConfigIdx(idx: Packet): { pos: number[], len: number[] } {
    const count = idx.g2();

    const pos: number[] = [];
    const len: number[] = [];

    let cur = 2;
    for (let i = 0; i < count; i++) {
        pos[i] = cur;
        len[i] = idx.g2();
        cur += len[i];
    }
    return { pos, len };
}

function compareDat(idx1: { pos: number[], len: number[] }, idx2: { pos: number[], len: number[] }, dat1: Packet, dat2: Packet) {
    if (idx1.pos.length !== idx2.pos.length) {
        printWarning(`different config sizes, ${idx1.pos.length} != ${idx2.pos.length}`);
    }

    for (let i = 0; i < idx1.pos.length; i++) {
        if (i >= idx2.pos.length) {
            printWarning(`${i}: does not exist`);
            continue;
        }

        if (idx1.len[i] !== idx2.len[i]) {
            printWarning(`${i}: length does not match, ${idx1.len[i]} != ${idx2.len[i]}`);
            continue;
        }

        dat1.pos = idx1.pos[i];
        const temp1 = new Uint8Array(idx1.len[i]);
        dat1.gdata(temp1, 0, idx1.len[i]);

        dat2.pos = idx2.pos[i];
        const temp2 = new Uint8Array(idx2.len[i]);
        dat2.gdata(temp2, 0, idx2.len[i]);

        if (Packet.getcrc(temp1, 0, temp1.length) !== Packet.getcrc(temp2, 0, temp2.length)) {
            printWarning(`${i}: crc does not match`);
            // console.log(temp1, temp2);
        }
    }
}

const configType = 'npc'; // npc

const cache1 = new FileStream('data/unpack');
const config1 = new Jagfile(new Packet(cache1.read(0, 2)!));
const idx1 = readConfigIdx(config1.read(configType + '.idx')!);
const dat1 = config1.read(configType + '.dat')!;

// const cache2 = new FileStream('data/pack');
const config2 = new Jagfile(Packet.load('data/pack/client/config')); // new Jagfile(new Packet(cache2.read(0, 2)!));
const idx2 = readConfigIdx(config2.read(configType + '.idx')!);
const dat2 = config2.read(configType + '.dat')!;

printInfo(configType);
if (Packet.getcrc(dat1.data, 0, dat1.length) !== Packet.getcrc(dat2.data, 0, dat2.length)) {
    compareDat(idx1, idx2, dat1, dat2);
} else {
    printInfo('exact match');
}
