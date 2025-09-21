import Packet from '#/io/Packet.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import IgnoreListAdd from '#/network/game/client/model/IgnoreListAdd.js';

export default class IgnoreListAddDecoder extends ClientGameMessageDecoder<IgnoreListAdd> {
    prot = ClientGameProt.IGNORELIST_ADD;

    decode(buf: Packet) {
        const username = buf.g8();
        return new IgnoreListAdd(username);
    }
}
