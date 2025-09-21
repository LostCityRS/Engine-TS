import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import IfOpenFull from '#/network/game/server/model/IfOpenFull.js';

export default class IfOpenFullEncoder extends ServerGameMessageEncoder<IfOpenFull> {
    prot = ServerGameProt.IF_OPENFULL;

    encode(buf: Packet, message: IfOpenFull): void {
        buf.p2_alt1(message.overlayComponent);
        buf.p2_alt2(message.mainComponent);
    }
}
