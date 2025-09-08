import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import SetPlayerOp from '../model/SetPlayerOp.js';

export default class SetPlayerOpEncoder extends ServerGameMessageEncoder<SetPlayerOp> {
    prot = ServerGameProt.SET_PLAYER_OP;

    encode(buf: Packet, message: SetPlayerOp): void {
        buf.p1_alt2(message.op);
        buf.pjstr(message.value);
        buf.p1(message.primary);
    }
}
