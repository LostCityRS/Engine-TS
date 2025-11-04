import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import IfSetPosition from '#/network/game/server/model/IfSetPosition.js';

export default class IfSetPositionEncoder extends ServerGameMessageEncoder<IfSetPosition> {
    prot = ServerGameProt.IF_SETPOSITION;

    encode(buf: Packet, _message: IfSetPosition): void {
        buf.p2_alt2(0);
        buf.p4_alt1(0);
        buf.p2(0);
        buf.p2_alt2(0);

        // buf.p2_alt1(message.y);
        // buf.p2_alt1(message.x);
        // buf.p2(message.component);
    }
}
