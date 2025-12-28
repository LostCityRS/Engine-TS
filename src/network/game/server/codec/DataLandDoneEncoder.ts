import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import DataLandDone from '#/network/game/server/model/DataLandDone.js';

export default class DataLandDoneEncoder extends ServerGameMessageEncoder<DataLandDone> {
    prot = ServerGameProt.DATA_LAND_DONE;

    encode(buf: Packet, message: DataLandDone): void {
        buf.p1(message.x);
        buf.p1(message.z);
    }
}
