import { CoordGrid } from '#/engine/CoordGrid.js';
import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import UpdateZoneFullFollows from '#/network/game/server/model/UpdateZoneFullFollows.js';

export default class UpdateZoneFullFollowsEncoder extends ServerGameMessageEncoder<UpdateZoneFullFollows> {
    prot = ServerGameProt.UPDATE_ZONE_FULL_FOLLOWS;

    encode(buf: Packet, message: UpdateZoneFullFollows): void {
        buf.p1((message.zoneX << 3) - CoordGrid.zoneOrigin(message.originX));
        buf.p1((message.zoneZ << 3) - CoordGrid.zoneOrigin(message.originZ));
    }
}
