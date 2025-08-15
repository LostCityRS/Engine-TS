import Packet from '#/io/Packet.js';
import MessageDecoder from '#/network/game/client/codec/MessageDecoder.js';
import ClientProt244 from '#/network/game/client/codec/rs244/ClientProt244.js';
import OpLoc from '#/network/game/client/model/OpLoc.js';


export default class OpLocDecoder extends MessageDecoder<OpLoc> {
    constructor(
        readonly prot: ClientProt244,
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
            x = buf.g2();
            z = buf.g2();
            loc = buf.g2_alt2();
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
        }

        return new OpLoc(this.op, x, z, loc);
    }
}
