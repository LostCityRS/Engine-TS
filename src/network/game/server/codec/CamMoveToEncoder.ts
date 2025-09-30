import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import CamMoveTo from '#/network/game/server/model/CamMoveTo.js';

export default class CamMoveToEncoder extends ServerGameMessageEncoder<CamMoveTo> {
    prot = ServerGameProt.CAM_MOVETO;

    encode(buf: Packet, message: CamMoveTo): void {
        buf.p1(message.x);
        buf.p1(message.z);
        buf.p2(message.height);
        buf.p1(message.speed);
        buf.p1(message.multiplier);
    }
}
