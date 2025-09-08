import Packet from '#/io/Packet.js';
import ZoneProt from '#/network/game/server/codec/ZoneProt.js';
import ServerGameZoneMessageEncoder from '#/network/game/server/ServerGameZoneMessageEncoder.js';
import LocAddChange from '#/network/game/server/model/LocAddChange.js';

export default class LocAddChangeEncoder extends ServerGameZoneMessageEncoder<LocAddChange> {
    prot = ZoneProt.LOC_ADD_CHANGE;

    encode(buf: Packet, message: LocAddChange): void {
        buf.p1_alt2((message.shape << 2) | (message.angle & 0x3));
        buf.p2_alt3(message.loc);
        buf.p1_alt1(message.coord);
    }
}
