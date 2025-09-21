import Packet from '#/io/Packet.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import InvButton from '#/network/game/client/model/InvButton.js';

export default class InvButtonDecoder extends ClientGameMessageDecoder<InvButton> {
    constructor(
        readonly prot: ClientGameProt,
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
