import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import IfSetAnim from '#/network/game/server/model/IfSetAnim.js';

export default class IfSetAnimEncoder extends ServerGameMessageEncoder<IfSetAnim> {
    prot = ServerGameProt.IF_SETANIM;

    encode(buf: Packet, _message: IfSetAnim): void {
        buf.p4_alt3(0);
        buf.p2_alt1(0);
        buf.p2_alt2(0);

        // buf.p2_alt3(message.component);
        // buf.p2_alt2(message.seq);
    }
}
