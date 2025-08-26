import Packet from '#/io/Packet.js';
import MessageEncoder from '#/network/game/server/codec/MessageEncoder.js';
import ServerProt244 from '#/network/game/server/codec/rs244/ServerProt244.js';
import FriendlistLoaded from '#/network/game/server/model/FriendlistLoaded.js';

export default class FriendlistLoadedEncoder extends MessageEncoder<FriendlistLoaded> {
    prot = ServerProt244.FRIENDLIST_LOADED;

    encode(buf: Packet, message: FriendlistLoaded): void {
        // 0 loading friend list
        // 1 connecting to friendserver
        // 2 online
        // else Please wait...
        buf.p1(message.status);
    }
}
