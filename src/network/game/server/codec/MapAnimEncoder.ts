import Packet from '#/io/Packet.js';
import ServerGameZoneProt from '#/network/game/server/ServerGameZoneProt.js';
import ServerGameZoneMessageEncoder from '#/network/game/server/ServerGameZoneMessageEncoder.js';
import MapAnim from '#/network/game/server/model/MapAnim.js';

export default class MapAnimEncoder extends ServerGameZoneMessageEncoder<MapAnim> {
    prot = ServerGameZoneProt.MAP_ANIM;

    encode(buf: Packet, message: MapAnim): void {
        buf.p1(message.coord);
        buf.p2(message.spotanim);
        buf.p1(message.height);
        buf.p2(message.delay);
    }
}
