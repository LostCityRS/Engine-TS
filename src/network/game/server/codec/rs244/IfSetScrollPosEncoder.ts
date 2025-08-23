import Packet from '#/io/Packet.js';
import MessageEncoder from '#/network/game/server/codec/MessageEncoder.js';
import ServerProt244 from '#/network/game/server/codec/rs244/ServerProt244.js';
import IfSetScrollPos from '#/network/game/server/model/IfSetScrollPos.js';

export default class IfSetScrollPosEncoder extends MessageEncoder<IfSetScrollPos> {
    prot = ServerProt244.IF_SETSCROLLPOS;

    encode(buf: Packet, message: IfSetScrollPos): void {
        buf.p2(message.component);
        buf.p2_alt3(message.y);
    }
}
