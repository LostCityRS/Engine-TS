import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import UpdateRunEnergy from '#/network/game/server/model/UpdateRunEnergy.js';

export default class UpdateRunEnergyEncoder extends ServerGameMessageEncoder<UpdateRunEnergy> {
    prot = ServerGameProt.UPDATE_RUNENERGY;

    encode(buf: Packet, message: UpdateRunEnergy): void {
        buf.p1((message.energy / 100) | 0);
    }
}
