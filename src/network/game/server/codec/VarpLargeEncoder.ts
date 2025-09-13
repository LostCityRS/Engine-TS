import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import VarpLarge from '#/network/game/server/model/VarpLarge.js';

export default class VarpLargeEncoder extends ServerGameMessageEncoder<VarpLarge> {
    prot = ServerGameProt.VARP_LARGE;

    encode(buf: Packet, message: VarpLarge): void {
        buf.p2(message.varp);
        buf.p4(message.value);
    }
}
