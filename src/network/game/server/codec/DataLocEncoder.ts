import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import DataLoc from '#/network/game/server/model/DataLoc.js';

export default class DataLocEncoder extends ServerGameMessageEncoder<DataLoc> {
    prot = ServerGameProt.DATA_LOC;

    encode(buf: Packet, message: DataLoc): void {
        buf.p1(message.x);
        buf.p1(message.z);
        buf.p2(message.off);
        buf.p2(message.len);
        buf.pdata(message.data, 0, message.data.length);
    }

    test(message: DataLoc): number {
        return 1 + 1 + 2 + 2 + message.data.length;
    }
}
