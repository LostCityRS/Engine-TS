import Packet from '#/io/Packet.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import MessagePublic from '#/network/game/client/model/MessagePublic.js';

export default class MessagePublicDecoder extends ClientGameMessageDecoder<MessagePublic> {
    prot = ClientGameProt.MESSAGE_PUBLIC;

    decode(buf: Packet, length: number) {
        const color = buf.g1();
        const effect = buf.g1();
        const input = buf.data.slice(buf.pos, buf.pos + length - 2);
        buf.pos += length;
        return new MessagePublic(input, color, effect);
    }
}
