import Packet from '#/io/Packet.js';
import MessageEncoder from '#/network/game/server/codec/MessageEncoder.js';
import ServerProt244 from '#/network/game/server/codec/rs244/ServerProt244.js';
import UpdatePid from '#/network/game/server/model/UpdatePid.js';

export default class UpdatePidEncoder extends MessageEncoder<UpdatePid> {
    prot = ServerProt244.UPDATE_PID;

    encode(buf: Packet, message: UpdatePid): void {
        buf.pbool(message.members);
        buf.p2_alt1(message.uid);
    }
}
