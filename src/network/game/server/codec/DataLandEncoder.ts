import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import DataLand from '#/network/game/server/model/DataLand.js';

export default class DataLandEncoder extends ServerGameMessageEncoder<DataLand> {
    prot = ServerGameProt.DATA_LAND;

    encode(buf: Packet, message: DataLand): void {
        buf.p1(message.x);
        buf.p1(message.z);
        buf.p2(message.off);
        buf.p2(message.len);
        buf.pdata(message.data, 0, message.data.length);
    }

    test(message: DataLand): number {
        return 1 + 1 + 2 + 2 + message.data.length;
    }
}
