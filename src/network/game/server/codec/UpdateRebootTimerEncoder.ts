import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import UpdateRebootTimer from '#/network/game/server/model/UpdateRebootTimer.js';

export default class UpdateRebootTimerEncoder extends ServerGameMessageEncoder<UpdateRebootTimer> {
    prot = ServerGameProt.UPDATE_REBOOT_TIMER;

    encode(buf: Packet, message: UpdateRebootTimer): void {
        buf.p2(message.ticks);
    }
}
