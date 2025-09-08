import Packet from '#/io/Packet.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import FriendListDel from '#/network/game/client/model/FriendListDel.js';

export default class FriendListDelDecoder extends ClientGameMessageDecoder<FriendListDel> {
    prot = ClientGameProt.FRIENDLIST_DEL;

    decode(buf: Packet) {
        const username = buf.g8();
        return new FriendListDel(username);
    }
}
