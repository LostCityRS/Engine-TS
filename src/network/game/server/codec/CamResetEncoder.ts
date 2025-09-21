import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import CamReset from '#/network/game/server/model/CamReset.js';

export default class CamResetEncoder extends ServerGameMessageEncoder<CamReset> {
    prot = ServerGameProt.CAM_RESET;

    encode(_: Packet, __: CamReset): void {}
}
