import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import UpdateRunWeight from '#/network/game/server/model/UpdateRunWeight.js';

export default class UpdateRunWeightEncoder extends ServerGameMessageEncoder<UpdateRunWeight> {
    prot = ServerGameProt.UPDATE_RUNWEIGHT;

    encode(buf: Packet, message: UpdateRunWeight): void {
        buf.p2(message.kg);
    }
}
