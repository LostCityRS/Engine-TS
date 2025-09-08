import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameZoneProt from '#/network/game/server/ServerGameZoneProt.js';
import ServerGameZoneMessage from '#/network/game/server/ServerGameZoneMessage.js';

export default abstract class ServerGameZoneMessageEncoder<T extends ServerGameZoneMessage> extends ServerGameMessageEncoder<T> {
    abstract prot: ServerGameZoneProt;

    enclose(buf: Packet, message: T): void {
        buf.p1(this.prot.id);
        this.encode(buf, message);
    }
}
