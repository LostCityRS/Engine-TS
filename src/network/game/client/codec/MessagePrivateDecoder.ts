import Packet from '#/io/Packet.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import MessagePrivate from '#/network/game/client/model/MessagePrivate.js';

export default class MessagePrivateDecoder extends ClientGameMessageDecoder<MessagePrivate> {
    prot = ClientGameProt.MESSAGE_PRIVATE;

    decode(buf: Packet, length: number) {
        const username = buf.g8();
        const input = buf.data.slice(buf.pos, buf.pos + length - 8);
        buf.pos += length;
        return new MessagePrivate(username, input);
    }
}
