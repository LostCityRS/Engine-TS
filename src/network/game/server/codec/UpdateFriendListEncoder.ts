import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import UpdateFriendList from '#/network/game/server/model/UpdateFriendList.js';

export default class UpdateFriendListEncoder extends ServerGameMessageEncoder<UpdateFriendList> {
    prot = ServerGameProt.UPDATE_FRIENDLIST;
    usable = true;

    encode(buf: Packet, message: UpdateFriendList): void {
        buf.p8(message.name);
        buf.p2(0);
        buf.p1(message.nodeId);
    }
}
