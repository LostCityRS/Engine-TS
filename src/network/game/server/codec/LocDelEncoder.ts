import Packet from '#/io/Packet.js';
import ServerGameZoneProt from '#/network/game/server/ServerGameZoneProt.js';
import ServerGameZoneMessageEncoder from '#/network/game/server/ServerGameZoneMessageEncoder.js';
import LocDel from '#/network/game/server/model/LocDel.js';

export default class LocDelEncoder extends ServerGameZoneMessageEncoder<LocDel> {
    prot = ServerGameZoneProt.LOC_DEL;
    usable = true;

    encode(buf: Packet, message: LocDel): void {
        buf.p1_alt2((message.shape << 2) | (message.angle & 0x3));
        buf.p1(message.coord);
    }
}
