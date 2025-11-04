import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import VarpLarge from '#/network/game/server/model/VarpLarge.js';

export default class VarpLargeEncoder extends ServerGameMessageEncoder<VarpLarge> {
    prot = ServerGameProt.VARP_LARGE;
    usable = true;

    encode(buf: Packet, message: VarpLarge): void {
        buf.p4(message.value);
        buf.p2_alt2(message.varp);
    }
}
