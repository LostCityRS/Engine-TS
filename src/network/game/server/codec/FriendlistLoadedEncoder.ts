import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import FriendlistLoaded from '#/network/game/server/model/FriendlistLoaded.js';

export default class FriendlistLoadedEncoder extends ServerGameMessageEncoder<FriendlistLoaded> {
    prot = ServerGameProt.FRIENDLIST_LOADED;

    encode(buf: Packet, _message: FriendlistLoaded): void {
        buf.p1(0);

        // buf.p1(message.status);
    }
}
