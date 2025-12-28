import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import Logout from '#/network/game/server/model/Logout.js';

export default class LogoutEncoder extends ServerGameMessageEncoder<Logout> {
    prot = ServerGameProt.LOGOUT;

    encode(_: Packet, __: Logout): void {}
}
