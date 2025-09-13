import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import IfSetTabActive from '#/network/game/server/model/IfSetTab.js';

export default class IfSetTabEncoder extends ServerGameMessageEncoder<IfSetTabActive> {
    prot = ServerGameProt.IF_SETTAB_ACTIVE;

    encode(buf: Packet, message: IfSetTabActive): void {
        buf.p1(message.tab);
    }
}
