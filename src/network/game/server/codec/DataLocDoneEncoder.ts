import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import DataLocDone from '#/network/game/server/model/DataLocDone.js';

export default class DataLocDoneEncoder extends ServerGameMessageEncoder<DataLocDone> {
    prot = ServerGameProt.DATA_LOC_DONE;

    encode(buf: Packet, message: DataLocDone): void {
        buf.p1(message.x);
        buf.p1(message.z);
    }
}
