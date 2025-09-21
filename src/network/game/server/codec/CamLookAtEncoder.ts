import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import CamLookAt from '#/network/game/server/model/CamLookAt.js';

export default class CamLookAtEncoder extends ServerGameMessageEncoder<CamLookAt> {
    prot = ServerGameProt.CAM_LOOKAT;

    encode(buf: Packet, message: CamLookAt): void {
        buf.p1(message.x);
        buf.p1(message.z);
        buf.p2(message.height);
        buf.p1(message.speed);
        buf.p1(message.multiplier);
    }
}
