import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import IfOpenTop from '#/network/game/server/model/IfOpenTop.js';

export default class IfOpenTopEncoder extends ServerGameMessageEncoder<IfOpenTop> {
    prot = ServerGameProt.IF_OPENTOP;
    usable = true;

    encode(buf: Packet, message: IfOpenTop): void {
        buf.p2_alt3(message.interfaceId);
        buf.p1_alt1(0);
        buf.p2_alt3(message.transmitId);
    }
}
