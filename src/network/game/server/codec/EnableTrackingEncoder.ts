import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import EnableTracking from '#/network/game/server/model/EnableTracking.js';

export default class EnableTrackingEncoder extends ServerGameMessageEncoder<EnableTracking> {
    prot = ServerGameProt.ENABLE_TRACKING;

    encode(_: Packet, __: EnableTracking): void {}
}
