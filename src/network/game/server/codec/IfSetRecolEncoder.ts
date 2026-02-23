import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import IfSetRecol from '#/network/game/server/model/IfSetRecol.js';

export default class IfSetRecolEncoder extends ServerGameMessageEncoder<IfSetRecol> {
    prot = ServerGameProt.IF_SETRECOL;

    encode(buf: Packet, message: IfSetRecol): void {
        buf.p2(message.com);
        buf.p2(message.src);
        buf.p2(message.dst);
    }
}
