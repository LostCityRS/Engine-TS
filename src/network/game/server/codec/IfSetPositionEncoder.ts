import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import IfSetPosition from '#/network/game/server/model/IfSetPosition.js';

export default class IfSetPositionEncoder extends ServerGameMessageEncoder<IfSetPosition> {
    prot = ServerGameProt.IF_SETPOSITION;

    encode(buf: Packet, message: IfSetPosition): void {
        buf.p2(message.component);
        buf.p2(message.x);
        buf.p2(message.y);
    }
}
