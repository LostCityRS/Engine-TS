import Packet from '#/io/Packet.js';
import MessageEncoder from '#/network/game/server/codec/MessageEncoder.js';
import ServerProt244 from '#/network/game/server/codec/rs244/ServerProt244.js';
import SetPlayerOp from '../../model/SetPlayerOp.js';

export default class SetPlayerOpEncoder extends MessageEncoder<SetPlayerOp> {
    prot = ServerProt244.SET_PLAYER_OP;

    encode(buf: Packet, message: SetPlayerOp): void {
        buf.p1_alt2(message.op);
        buf.pjstr(message.value);
        buf.p1(message.primary);
    }
}
