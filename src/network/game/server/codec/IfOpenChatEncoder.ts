import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import IfOpenChat from '#/network/game/server/model/IfOpenChat.js';

export default class IfOpenChatEncoder extends ServerGameMessageEncoder<IfOpenChat> {
    prot = ServerGameProt.IF_OPENCHAT;

    encode(buf: Packet, message: IfOpenChat): void {
        buf.p2(message.component);
    }
}
