import Packet from '#/io/Packet.js';
import MessageEncoder from '#/network/game/server/codec/MessageEncoder.js';
import ServerProt244 from '#/network/game/server/codec/rs244/ServerProt244.js';
import IfOpenFull from '#/network/game/server/model/IfOpenFull.js';

export default class IfOpenFullEncoder extends MessageEncoder<IfOpenFull> {
    prot = ServerProt244.IF_OPENFULL;

    encode(buf: Packet, message: IfOpenFull): void {
        buf.p2_alt1(message.overlayComponent);
        buf.p2_alt2(message.mainComponent);
    }
}
