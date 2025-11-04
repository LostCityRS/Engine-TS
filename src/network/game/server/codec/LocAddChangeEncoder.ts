import Packet from '#/io/Packet.js';
import ServerGameZoneProt from '#/network/game/server/ServerGameZoneProt.js';
import ServerGameZoneMessageEncoder from '#/network/game/server/ServerGameZoneMessageEncoder.js';
import LocAddChange from '#/network/game/server/model/LocAddChange.js';

export default class LocAddChangeEncoder extends ServerGameZoneMessageEncoder<LocAddChange> {
    prot = ServerGameZoneProt.LOC_ADD_CHANGE;
    usable = true;

    encode(buf: Packet, message: LocAddChange): void {
        buf.p1_alt1((message.shape << 2) | (message.angle & 0x3));
        buf.p1(message.coord);
        buf.p2_alt2(message.loc);
    }
}
