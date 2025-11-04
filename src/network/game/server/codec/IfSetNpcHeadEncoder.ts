import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import IfSetNpcHead from '#/network/game/server/model/IfSetNpcHead.js';

export default class IfSetNpcHeadEncoder extends ServerGameMessageEncoder<IfSetNpcHead> {
    prot = ServerGameProt.IF_SETNPCHEAD;

    encode(buf: Packet, _message: IfSetNpcHead): void {
        buf.p2_alt2(0);
        buf.p4_alt1(0);
        buf.p2_alt1(0);

        // buf.p2_alt2(message.npc);
        // buf.p2_alt1(message.component);
    }
}
