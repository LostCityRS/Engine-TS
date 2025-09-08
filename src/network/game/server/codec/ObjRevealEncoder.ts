import Packet from '#/io/Packet.js';
import ZoneProt from '#/network/game/server/codec/ZoneProt.js';
import ServerGameZoneMessageEncoder from '#/network/game/server/ServerGameZoneMessageEncoder.js';
import ObjReveal from '#/network/game/server/model/ObjReveal.js';

export default class ObjRevealEncoder extends ServerGameZoneMessageEncoder<ObjReveal> {
    prot = ZoneProt.OBJ_REVEAL;

    encode(buf: Packet, message: ObjReveal): void {
        buf.p1_alt1(message.coord);
        buf.p2_alt3(Math.min(message.count, 65535));
        buf.p2_alt2(message.obj);
        buf.p2_alt2(message.receiverId);
    }
}
