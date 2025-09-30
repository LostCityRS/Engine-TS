import { CoordGrid } from '#/engine/CoordGrid.js';
import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import UpdateZonePartialFollows from '#/network/game/server/model/UpdateZonePartialFollows.js';

export default class UpdateZonePartialFollowsEncoder extends ServerGameMessageEncoder<UpdateZonePartialFollows> {
    prot = ServerGameProt.UPDATE_ZONE_PARTIAL_FOLLOWS;

    encode(buf: Packet, message: UpdateZonePartialFollows): void {
        buf.p1((message.zoneX << 3) - CoordGrid.zoneOrigin(message.originX));
        buf.p1((message.zoneZ << 3) - CoordGrid.zoneOrigin(message.originZ));
    }
}
