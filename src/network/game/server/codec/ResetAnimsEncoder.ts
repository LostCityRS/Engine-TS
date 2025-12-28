import Packet from '#/io/Packet.js';
import ServerGameMessageEncoder from '#/network/game/server/ServerGameMessageEncoder.js';
import ServerGameProt from '#/network/game/server/ServerGameProt.js';
import ResetAnims from '#/network/game/server/model/ResetAnims.js';

export default class ResetAnimsEncoder extends ServerGameMessageEncoder<ResetAnims> {
    prot = ServerGameProt.RESET_ANIMS;

    encode(_: Packet, __: ResetAnims): void {}
}
