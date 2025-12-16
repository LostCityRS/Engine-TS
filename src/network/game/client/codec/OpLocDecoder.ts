import Packet from '#/io/Packet.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import OpLoc from '#/network/game/client/model/OpLoc.js';

export default class OpLocDecoder extends ClientGameMessageDecoder<OpLoc> {
    constructor(
        readonly prot: ClientGameProt,
        readonly op: number
    ) {
        super();
    }

    decode(buf: Packet) {
        let x = -1;
        let z = -1;
        let loc = -1;

        if (this.op === 1) {
            x = buf.g2_alt2();
            z = buf.g2_alt1();
            loc = buf.g2_alt1();
        } else if (this.op === 2) {
            loc = buf.g2();
            x = buf.g2();
            z = buf.g2_alt2();
        } else if (this.op === 3) {
            z = buf.g2_alt2();
            loc = buf.g2_alt1();
            x = buf.g2_alt3();
        } else if (this.op === 4) {
            x = buf.g2();
            z = buf.g2_alt1();
            loc = buf.g2();
        } else if (this.op === 5) {
            loc = buf.g2_alt1();
            z = buf.g2_alt1();
            x = buf.g2();
        } else if (this.op === 6) {
            loc = buf.g2_alt3();
        }

        return new OpLoc(this.op, x, z, loc);
    }
}
