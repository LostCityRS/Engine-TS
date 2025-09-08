import Packet from '#/io/Packet.js';
import ZoneProt from '#/network/game/server/codec/ZoneProt.js';
import ServerGameZoneMessageEncoder from '#/network/game/server/ServerGameZoneMessageEncoder.js';
import LocAnim from '#/network/game/server/model/LocAnim.js';

export default class LocAnimEncoder extends ServerGameZoneMessageEncoder<LocAnim> {
    prot = ZoneProt.LOC_ANIM;

    encode(buf: Packet, message: LocAnim): void {
        buf.p2(message.seq);
        buf.p1_alt1((message.shape << 2) | (message.angle & 0x3));
        buf.p1(message.coord);
    }
}
