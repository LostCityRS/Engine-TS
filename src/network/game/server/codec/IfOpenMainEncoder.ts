import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import IfOpenMain from '#/network/game/server/model/IfOpenMain.js';

export default class IfOpenMainEncoder extends ServerGameMessageEncoder<IfOpenMain> {
    prot = ServerGameProt.IF_OPENMAIN;

    encode(buf: Packet, message: IfOpenMain): void {
        buf.p2(message.component);
    }
}
