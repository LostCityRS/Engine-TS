import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import CamShake from '#/network/game/server/model/CamShake.js';

export default class CamShakeEncoder extends ServerGameMessageEncoder<CamShake> {
    prot = ServerGameProt.CAM_SHAKE;

    encode(buf: Packet, _message: CamShake): void {
        buf.p2(0);
        buf.p1(0);
        buf.p1(0);
        buf.p1(0);
        buf.p1(0);
        buf.p2(0);

        // buf.p1(message.type); // direction?
        // buf.p1(message.jitter);
        // buf.p1(message.amplitude);
        // buf.p1(message.frequency);
    }
}
