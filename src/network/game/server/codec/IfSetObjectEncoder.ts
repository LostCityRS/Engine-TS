import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import IfSetObject from '#/network/game/server/model/IfSetObject.js';

export default class IfSetObjectEncoder extends ServerGameMessageEncoder<IfSetObject> {
    prot = ServerGameProt.IF_SETOBJECT;

    encode(buf: Packet, _message: IfSetObject): void {
        buf.p4(0);
        buf.p4_alt3(0);
        buf.p2_alt3(0);
        buf.p2_alt1(0);

        // buf.p2(message.scale);
        // buf.p2_alt1(message.obj);
        // buf.p2_alt3(message.component);
    }
}
