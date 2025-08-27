import Packet from '#/io/Packet.js';
import MessageEncoder from '#/network/game/server/codec/MessageEncoder.js';
import ServerProt244 from '#/network/game/server/codec/rs244/ServerProt244.js';
import IfSetAngle from '#/network/game/server/model/IfSetAngle.js';

export default class IfSetAngleEncoder extends MessageEncoder<IfSetAngle> {
    prot = ServerProt244.IF_SETANGLE;

    encode(buf: Packet, message: IfSetAngle): void {
        buf.p2_alt2(message.xan);
        buf.p2_alt3(message.component);
        buf.p2_alt2(message.zoom);
        buf.p2_alt1(message.yan);
    }
}
