import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import IfClose from '#/network/game/server/model/IfClose.js';

export default class IfCloseEncoder extends ServerGameMessageEncoder<IfClose> {
    prot = ServerGameProt.IF_CLOSE;

    encode(_: Packet, __: IfClose): void {}
}
