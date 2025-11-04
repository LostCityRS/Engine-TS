import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import IfSetColour from '#/network/game/server/model/IfSetColour.js';

export default class IfSetColourEncoder extends ServerGameMessageEncoder<IfSetColour> {
    prot = ServerGameProt.IF_SETCOLOUR;

    encode(buf: Packet, _message: IfSetColour): void {
        buf.p4_alt2(0);
        buf.p2_alt2(0);
        buf.p2_alt3(0);

        // buf.p2(message.component);
        // buf.p2_alt2(message.colour);
    }
}
