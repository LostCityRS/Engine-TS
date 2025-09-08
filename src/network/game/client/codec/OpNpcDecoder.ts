import Packet from '#/io/Packet.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import OpNpc from '#/network/game/client/model/OpNpc.js';

export default class OpNpcDecoder extends ClientGameMessageDecoder<OpNpc> {
    constructor(
        readonly prot: ClientGameProt,
        readonly op: number
    ) {
        super();
    }

    decode(buf: Packet) {
        let nid = -1;

        if (this.op === 1) {
            nid = buf.g2_alt1();
        } else if (this.op === 2) {
            nid = buf.g2_alt2();
        } else if (this.op === 3) {
            nid = buf.g2_alt3();
        } else if (this.op === 4) {
            nid = buf.g2_alt1();
        } else if (this.op === 5) {
            nid = buf.g2_alt1();
        }

        return new OpNpc(this.op, nid);
    }
}
