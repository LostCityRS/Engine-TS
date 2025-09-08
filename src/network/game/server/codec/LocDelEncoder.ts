import Packet from '#/io/Packet.js';
import ZoneProt from '#/network/game/server/codec/ZoneProt.js';
import ServerGameZoneMessageEncoder from '#/network/game/server/ServerGameZoneMessageEncoder.js';
import LocDel from '#/network/game/server/model/LocDel.js';

export default class LocDelEncoder extends ServerGameZoneMessageEncoder<LocDel> {
    prot = ZoneProt.LOC_DEL;

    encode(buf: Packet, message: LocDel): void {
        buf.p1_alt3(message.coord);
        buf.p1_alt3((message.shape << 2) | (message.angle & 0x3));
    }
}
