import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import UpdateStat from '#/network/game/server/model/UpdateStat.js';

export default class UpdateStatEncoder extends ServerGameMessageEncoder<UpdateStat> {
    prot = ServerGameProt.UPDATE_STAT;
    usable = true;

    encode(buf: Packet, message: UpdateStat): void {
        buf.p1_alt1(message.level); // not base level
        buf.p4_alt2((message.exp / 10) | 0);
        buf.p1(message.stat);
    }
}
