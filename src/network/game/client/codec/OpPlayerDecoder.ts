import Packet from '#/io/Packet.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import OpPlayer from '#/network/game/client/model/OpPlayer.js';

export default class OpPlayerDecoder extends ClientGameMessageDecoder<OpPlayer> {
    constructor(
        readonly prot: ClientGameProt,
        readonly op: number
    ) {
        super();
    }

    decode(buf: Packet) {
        let playerSlot = -1;

        if (this.op === 1) {
            playerSlot = buf.g2_alt3();
        } else if (this.op === 2) {
            playerSlot = buf.g2_alt2();
        } else if (this.op === 3) {
            playerSlot = buf.g2_alt1();
        } else if (this.op === 4) {
            playerSlot = buf.g2_alt1();
        } else if (this.op === 5) {
            playerSlot = buf.g2_alt2();
        }

        return new OpPlayer(this.op, playerSlot);
    }
}
