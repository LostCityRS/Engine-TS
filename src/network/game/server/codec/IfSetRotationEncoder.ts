import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import IfSetRotation from '#/network/game/server/model/IfSetRotation.js';

export default class IfSetRotationEncoder extends ServerGameMessageEncoder<IfSetRotation> {
    prot = ServerGameProt.IF_SETROTATION;

    encode(buf: Packet, _message: IfSetRotation): void {
        buf.p4_alt3(0);
        buf.p2_alt2(0);
        buf.p2(0);
        buf.p2_alt2(0);

        // buf.p2(message.xAngleSpeed);
        // buf.p2_alt2(message.component);
        // buf.p2_alt1(message.yAngleSpeed);
    }
}
