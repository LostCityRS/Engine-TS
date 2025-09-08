import Packet from '#/io/Packet.js';
import ZoneProt from '#/network/game/server/codec/ZoneProt.js';
import ServerGameZoneMessageEncoder from '#/network/game/server/ServerGameZoneMessageEncoder.js';
import ObjDel from '#/network/game/server/model/ObjDel.js';

export default class ObjDelEncoder extends ServerGameZoneMessageEncoder<ObjDel> {
    prot = ZoneProt.OBJ_DEL;

    encode(buf: Packet, message: ObjDel): void {
        buf.p2_alt2(message.obj);
        buf.p1_alt1(message.coord);
    }
}
