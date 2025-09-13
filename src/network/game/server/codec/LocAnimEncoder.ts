import Packet from '#/io/Packet.js';
import ServerGameZoneProt from '#/network/game/server/ServerGameZoneProt.js';
import ServerGameZoneMessageEncoder from '#/network/game/server/ServerGameZoneMessageEncoder.js';
import LocAnim from '#/network/game/server/model/LocAnim.js';

export default class LocAnimEncoder extends ServerGameZoneMessageEncoder<LocAnim> {
    prot = ServerGameZoneProt.LOC_ANIM;

    encode(buf: Packet, message: LocAnim): void {
        buf.p1(message.coord);
        buf.p1((message.shape << 2) | (message.angle & 0x3));
        buf.p2(message.seq);
    }
}
