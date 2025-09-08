import Packet from '#/io/Packet.js';
import ZoneProt from '#/network/game/server/codec/ZoneProt.js';
import ServerGameZoneMessageEncoder from '#/network/game/server/ServerGameZoneMessageEncoder.js';
import ObjAdd from '#/network/game/server/model/ObjAdd.js';

export default class ObjAddEncoder extends ServerGameZoneMessageEncoder<ObjAdd> {
    prot = ZoneProt.OBJ_ADD;

    encode(buf: Packet, message: ObjAdd): void {
        buf.p2(message.obj);
        buf.p1_alt2(message.coord);
        buf.p2_alt2(Math.min(message.count, 65535));
    }
}
