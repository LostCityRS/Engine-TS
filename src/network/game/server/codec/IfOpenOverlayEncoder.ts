import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import IfOpenOverlay from '#/network/game/server/model/IfOpenOverlay.js';

export default class IfOpenOverlayEncoder extends ServerGameMessageEncoder<IfOpenOverlay> {
    prot = ServerGameProt.IF_OPENOVERLAY;

    encode(buf: Packet, message: IfOpenOverlay): void {
        buf.p2(message.component);
    }
}
