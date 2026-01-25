import Packet from '#/io/Packet.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import OpObj from '#/network/game/client/model/OpObj.js';

export default class OpObjDecoder extends ClientGameMessageDecoder<OpObj> {
    constructor(
        readonly prot: ClientGameProt,
        readonly op: number
    ) {
        super();
    }

    decode(buf: Packet) {
        let x = -1;
        let z = -1;
        let obj = -1;

        if (this.op === 1) {
            x = buf.g2_alt3();
            obj = buf.g2_alt2();
            z = buf.g4_alt1();
        } else if (this.op === 2) {
            obj = buf.g2();
            x = buf.g2_alt1();
            z = buf.g2_alt3();
        } else if (this.op === 3) {
            z = buf.g4_alt2();
            obj = buf.g2();
            x = buf.g2_alt2();
        } else if (this.op === 4) {
            z = buf.g4_alt1();
            obj = buf.g2_alt3();
            x = buf.g2_alt3();
        } else if (this.op === 5) {
            obj = buf.g2_alt1();
            x = buf.g2_alt2();
            z = buf.g4_alt3();
        }

        return new OpObj(this.op, x, z, obj);
    }
}
