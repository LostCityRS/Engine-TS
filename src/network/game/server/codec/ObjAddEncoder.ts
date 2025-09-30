import Packet from '#/io/Packet.js';
import ServerGameZoneProt from '#/network/game/server/ServerGameZoneProt.js';
import ServerGameZoneMessageEncoder from '#/network/game/server/ServerGameZoneMessageEncoder.js';
import ObjAdd from '#/network/game/server/model/ObjAdd.js';

export default class ObjAddEncoder extends ServerGameZoneMessageEncoder<ObjAdd> {
    prot = ServerGameZoneProt.OBJ_ADD;

    encode(buf: Packet, message: ObjAdd): void {
        buf.p1(message.coord);
        buf.p2(message.obj);
        buf.p2(Math.min(message.count, 65535));
    }
}
