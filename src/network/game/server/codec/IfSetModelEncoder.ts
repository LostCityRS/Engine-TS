import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import IfSetModel from '#/network/game/server/model/IfSetModel.js';

export default class IfSetModelEncoder extends ServerGameMessageEncoder<IfSetModel> {
    prot = ServerGameProt.IF_SETMODEL;

    encode(buf: Packet, _message: IfSetModel): void {
        buf.p4_alt1(0);
        buf.p2_alt3(0);
        buf.p2_alt2(0);

        // buf.p2_alt3(message.model);
        // buf.p2_alt3(message.component);
    }
}
