import Packet from '#/io/Packet.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import IgnoreListDel from '#/network/game/client/model/IgnoreListDel.js';

export default class IgnoreListDelDecoder extends ClientGameMessageDecoder<IgnoreListDel> {
    prot = ClientGameProt.IGNORELIST_DEL;

    decode(buf: Packet) {
        const username = buf.g8();
        return new IgnoreListDel(username);
    }
}
