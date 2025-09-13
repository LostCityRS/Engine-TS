import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import IfOpenSide from '#/network/game/server/model/IfOpenSide.js';

export default class IfOpenSideEncoder extends ServerGameMessageEncoder<IfOpenSide> {
    prot = ServerGameProt.IF_OPENSIDE;

    encode(buf: Packet, message: IfOpenSide): void {
        buf.p2(message.component);
    }
}
