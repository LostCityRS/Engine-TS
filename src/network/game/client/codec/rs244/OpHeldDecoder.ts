import Packet from '#/io/Packet.js';
import MessageDecoder from '#/network/game/client/codec/MessageDecoder.js';
import ClientProt244 from '#/network/game/client/codec/rs244/ClientProt244.js';
import OpHeld from '#/network/game/client/model/OpHeld.js';


export default class OpHeldDecoder extends MessageDecoder<OpHeld> {
    constructor(
        readonly prot: ClientProt244,
        readonly op: number
    ) {
        super();
    }

    decode(buf: Packet) {
        let obj = -1;
        let slot = -1;
        let component = -1;

        if (this.op === 1) {
            component = buf.g2_alt2();
            slot = buf.g2_alt1();
            obj = buf.g2_alt1();
        } else if (this.op === 2) {
            component = buf.g2_alt1();
            obj = buf.g2_alt1();
            slot = buf.g2_alt2();
        } else if (this.op === 3) {
            slot = buf.g2_alt3();
            obj = buf.g2_alt3();
            component = buf.g2_alt1();
        } else if (this.op === 4) {
            slot = buf.g2_alt1();
            obj = buf.g2_alt2();
            component = buf.g2();
        } else if (this.op === 5) {
            slot = buf.g2_alt1();
            obj = buf.g2_alt3();
            component = buf.g2_alt3();
        }

        return new OpHeld(this.op, obj, slot, component);
    }
}
