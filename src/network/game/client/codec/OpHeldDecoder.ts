import Packet from '#/io/Packet.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import OpHeld from '#/network/game/client/model/OpHeld.js';

export default class OpHeldDecoder extends ClientGameMessageDecoder<OpHeld> {
    constructor(
        readonly prot: ClientGameProt,
        readonly op: number
    ) {
        super();
    }

    decode(buf: Packet) {
        let obj = -1;
        let slot = -1;
        let com = -1;

        if (this.op === 1) {
            com = buf.g2_alt2();
            slot = buf.g2_alt1();
            obj = buf.g2_alt1();
        } else if (this.op === 2) {
            com = buf.g2_alt1();
            obj = buf.g2_alt1();
            slot = buf.g2_alt2();
        } else if (this.op === 3) {
            slot = buf.g2_alt3();
            obj = buf.g2_alt3();
            com = buf.g2_alt1();
        } else if (this.op === 4) {
            slot = buf.g2_alt1();
            obj = buf.g2_alt2();
            com = buf.g2();
        } else if (this.op === 5) {
            slot = buf.g2_alt1();
            obj = buf.g2_alt3();
            com = buf.g2_alt3();
        }

        return new OpHeld(this.op, obj, slot, com);
    }
}
