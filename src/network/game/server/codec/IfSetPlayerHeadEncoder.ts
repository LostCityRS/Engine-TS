import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import IfSetPlayerHead from '#/network/game/server/model/IfSetPlayerHead.js';

export default class IfSetPlayerHeadEncoder extends ServerGameMessageEncoder<IfSetPlayerHead> {
    prot = ServerGameProt.IF_SETPLAYERHEAD;

    encode(buf: Packet, message: IfSetPlayerHead): void {
        buf.p2(message.component);
    }
}
