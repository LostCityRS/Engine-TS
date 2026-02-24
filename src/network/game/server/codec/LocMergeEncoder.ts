import Packet from '#/io/Packet.js';
import ServerGameZoneProt from '#/network/game/server/ServerGameZoneProt.js';
import ServerGameZoneMessageEncoder from '#/network/game/server/ServerGameZoneMessageEncoder.js';
import LocMerge from '#/network/game/server/model/LocMerge.js';

export default class LocMergeEncoder extends ServerGameZoneMessageEncoder<LocMerge> {
    prot = ServerGameZoneProt.LOC_MERGE;

    encode(buf: Packet, message: LocMerge): void {
        buf.p2(message.locId);
        buf.p1((message.shape << 2) | (message.angle & 0x3));
        buf.p1_alt2(message.west - message.srcX);
        buf.p1_alt1(message.coord);
        buf.p1_alt1(message.east - message.srcX);
        buf.p2_alt2(message.endCycle);
        buf.p2_alt1(message.playerSlot);
        buf.p1(message.north - message.srcZ);
        buf.p1_alt1(message.south - message.srcZ);
        buf.p2(message.startCycle);
    }
}
