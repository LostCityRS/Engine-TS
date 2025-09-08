import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import UnsetMapFlag from '#/network/game/server/model/UnsetMapFlag.js';

export default class UnsetMapFlagEncoder extends ServerGameMessageEncoder<UnsetMapFlag> {
    prot = ServerGameProt.UNSET_MAP_FLAG;

    encode(_: Packet, __: UnsetMapFlag): void {}
}
