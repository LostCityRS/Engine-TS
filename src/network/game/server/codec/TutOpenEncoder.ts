import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import TutOpen from '#/network/game/server/model/TutOpen.js';

export default class TutOpenEncoder extends ServerGameMessageEncoder<TutOpen> {
    prot = ServerGameProt.TUT_OPEN;

    encode(buf: Packet, message: TutOpen): void {
        buf.p2(message.component);
    }
}
