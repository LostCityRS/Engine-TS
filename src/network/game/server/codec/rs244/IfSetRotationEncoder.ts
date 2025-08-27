import Packet from '#/io/Packet.js';
import MessageEncoder from '#/network/game/server/codec/MessageEncoder.js';
import ServerProt244 from '#/network/game/server/codec/rs244/ServerProt244.js';
import IfSetRotation from '#/network/game/server/model/IfSetRotation.js';

export default class IfSetRotationEncoder extends MessageEncoder<IfSetRotation> {
    prot = ServerProt244.IF_SETROTATION;

    encode(buf: Packet, message: IfSetRotation): void {
        buf.p2(message.xAngleSpeed);
        buf.p2_alt2(message.component);
        buf.p2_alt1(message.yAngleSpeed);
    }
}
