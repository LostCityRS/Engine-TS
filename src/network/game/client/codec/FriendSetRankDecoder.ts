import Packet from '#/io/Packet.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import FriendSetRank from '#/network/game/client/model/FriendSetRank.js';

export default class FriendSetRankDecoder extends ClientGameMessageDecoder<FriendSetRank> {
    prot = ClientGameProt.FRIEND_SETRANK;

    decode(buf: Packet) {
        const rank = buf.g1b_alt1();
        const username = buf.g8();
        return new FriendSetRank(username, rank);
    }
}
