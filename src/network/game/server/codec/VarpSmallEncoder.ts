import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import VarpSmall from '#/network/game/server/model/VarpSmall.js';

export default class VarpSmallEncoder extends ServerGameMessageEncoder<VarpSmall> {
    prot = ServerGameProt.VARP_SMALL;

    encode(buf: Packet, message: VarpSmall): void {
        buf.p2(message.varp);
        buf.p1(message.value);
    }
}
