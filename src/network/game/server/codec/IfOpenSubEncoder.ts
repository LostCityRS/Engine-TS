import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import IfOpenSub from '#/network/game/server/model/IfOpenSub.js';

export default class IfOpenSubEncoder extends ServerGameMessageEncoder<IfOpenSub> {
    prot = ServerGameProt.IF_OPENSUB;
    usable = true;

    encode(buf: Packet, message: IfOpenSub): void {
        buf.p1(message.type);
        buf.p4_alt3(message.component);
        buf.p2_alt2(message.transmitId);
        buf.p2(message.interfaceId);
    }
}
