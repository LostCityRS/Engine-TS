import Packet from '#/io/Packet.js';
import MessageEncoder from '#/network/game/server/codec/MessageEncoder.js';
import ServerProt244 from '#/network/game/server/codec/rs244/ServerProt244.js';
import IfOpenOverlay from '#/network/game/server/model/IfOpenOverlay.js';

export default class IfOpenOverlayEncoder extends MessageEncoder<IfOpenOverlay> {
    prot = ServerProt244.IF_OPENOVERLAY;

    encode(buf: Packet, message: IfOpenOverlay): void {
        buf.p2(message.component);
    }
}
