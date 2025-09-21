import Packet from '#/io/Packet.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import FriendListAdd from '#/network/game/client/model/FriendListAdd.js';

export default class FriendListAddDecoder extends ClientGameMessageDecoder<FriendListAdd> {
    prot = ClientGameProt.FRIENDLIST_ADD;

    decode(buf: Packet) {
        const username = buf.g8();
        return new FriendListAdd(username);
    }
}
