import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import IfSetNpcHead from '#/network/game/server/model/IfSetNpcHead.js';

export default class IfSetNpcHeadEncoder extends ServerGameMessageEncoder<IfSetNpcHead> {
    prot = ServerGameProt.IF_SETNPCHEAD;

    encode(buf: Packet, message: IfSetNpcHead): void {
        buf.p2(message.component);
        buf.p2(message.npc);
    }
}
