import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import UpdateInvStopTransmit from '#/network/game/server/model/UpdateInvStopTransmit.js';

export default class UpdateInvStopTransmitEncoder extends ServerGameMessageEncoder<UpdateInvStopTransmit> {
    prot = ServerGameProt.UPDATE_INV_STOP_TRANSMIT;

    encode(buf: Packet, message: UpdateInvStopTransmit): void {
        buf.p2(message.component);
    }
}
