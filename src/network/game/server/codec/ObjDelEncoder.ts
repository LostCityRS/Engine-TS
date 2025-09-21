import Packet from '#/io/Packet.js';
import ServerGameZoneProt from '#/network/game/server/ServerGameZoneProt.js';
import ServerGameZoneMessageEncoder from '#/network/game/server/ServerGameZoneMessageEncoder.js';
import ObjDel from '#/network/game/server/model/ObjDel.js';

export default class ObjDelEncoder extends ServerGameZoneMessageEncoder<ObjDel> {
    prot = ServerGameZoneProt.OBJ_DEL;

    encode(buf: Packet, message: ObjDel): void {
        buf.p2_alt2(message.obj);
        buf.p1_alt1(message.coord);
    }
}
