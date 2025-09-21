import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import FriendlistLoaded from '#/network/game/server/model/FriendlistLoaded.js';

export default class FriendlistLoadedEncoder extends ServerGameMessageEncoder<FriendlistLoaded> {
    prot = ServerGameProt.FRIENDLIST_LOADED;

    encode(buf: Packet, message: FriendlistLoaded): void {
        // 0 loading friend list
        // 1 connecting to friendserver
        // 2 online
        // else Please wait...
        buf.p1(message.status);
    }
}
