import Packet from '#/io/Packet.js';
import MessageDecoder from '#/network/game/client/codec/MessageDecoder.js';
import ClientProt244 from '#/network/game/client/codec/rs244/ClientProt244.js';
import InvButton from '#/network/game/client/model/InvButton.js';


export default class InvButtonDecoder extends MessageDecoder<InvButton> {
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
            obj = buf.g2_alt2();
            component = buf.g2();
            slot = buf.g2();
        } else if (this.op === 2) {
            slot = buf.g2_alt2();
            obj = buf.g2_alt1();
            component = buf.g2_alt1();
        } else if (this.op === 3) {
            obj = buf.g2_alt1();
            slot = buf.g2_alt3();
            component = buf.g2();
        } else if (this.op === 4) {
            component = buf.g2_alt3();
            slot = buf.g2_alt1();
            obj = buf.g2();
        } else if (this.op === 5) {
            slot = buf.g2_alt3();
            obj = buf.g2_alt3();
            component = buf.g2_alt1();
        }

        return new InvButton(this.op, obj, slot, component);
    }
}
