import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import FinishTracking from '#/network/game/server/model/FinishTracking.js';

export default class FinishTrackingEncoder extends ServerGameMessageEncoder<FinishTracking> {
    prot = ServerGameProt.FINISH_TRACKING;

    encode(_: Packet, __: FinishTracking): void {}
}
