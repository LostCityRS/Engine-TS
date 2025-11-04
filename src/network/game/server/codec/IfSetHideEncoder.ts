import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import IfSetHide from '#/network/game/server/model/IfSetHide.js';

export default class IfSetHideEncoder extends ServerGameMessageEncoder<IfSetHide> {
    prot = ServerGameProt.IF_SETHIDE;

    encode(buf: Packet, _message: IfSetHide): void {
        buf.p1_alt2(0);
        buf.p2(0);
        buf.p4_alt1(0);

        // buf.pbool(message.hidden);
        // buf.p2(message.component);
    }
}
