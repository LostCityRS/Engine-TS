import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import SetMultiway from '#/network/game/server/model/SetMultiway.js';

export default class SetMultiwayEncoder extends ServerGameMessageEncoder<SetMultiway> {
    prot = ServerGameProt.SET_MULTIWAY;

    encode(buf: Packet, message: SetMultiway): void {
        buf.pbool(message.hidden);
    }
}
