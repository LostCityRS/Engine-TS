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
        let pid = -1;

        if (this.op === 1) {
            pid = buf.g2_alt3();
        } else if (this.op === 2) {
            pid = buf.g2_alt2();
        } else if (this.op === 3) {
            pid = buf.g2_alt1();
        } else if (this.op === 4) {
            pid = buf.g2_alt1();
        } else if (this.op === 5) {
            pid = buf.g2_alt2();
        }

        return new OpPlayer(this.op, pid);
    }
}
