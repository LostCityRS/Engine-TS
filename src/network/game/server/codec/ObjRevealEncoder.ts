import Packet from '#/io/Packet.js';
import ServerGameZoneProt from '#/network/game/server/ServerGameZoneProt.js';
import ServerGameZoneMessageEncoder from '#/network/game/server/ServerGameZoneMessageEncoder.js';
import ObjReveal from '#/network/game/server/model/ObjReveal.js';

export default class ObjRevealEncoder extends ServerGameZoneMessageEncoder<ObjReveal> {
    prot = ServerGameZoneProt.OBJ_REVEAL;
    usable = true;

    encode(buf: Packet, message: ObjReveal): void {
        buf.p2_alt3(message.receiverId);
        buf.p1_alt2(message.coord);
        buf.p2_alt1(Math.min(message.count, 65535));
        buf.p2_alt1(message.obj);
    }
}
