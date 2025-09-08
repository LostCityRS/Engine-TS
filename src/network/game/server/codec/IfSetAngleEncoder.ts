import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import IfSetAngle from '#/network/game/server/model/IfSetAngle.js';

export default class IfSetAngleEncoder extends ServerGameMessageEncoder<IfSetAngle> {
    prot = ServerGameProt.IF_SETANGLE;

    encode(buf: Packet, message: IfSetAngle): void {
        buf.p2_alt2(message.xan);
        buf.p2_alt3(message.component);
        buf.p2_alt2(message.zoom);
        buf.p2_alt1(message.yan);
    }
}
