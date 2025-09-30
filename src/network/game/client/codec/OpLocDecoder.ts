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
        const x = buf.g2();
        const z = buf.g2();
        const loc = buf.g2();
        return new OpLoc(this.op, x, z, loc);
    }
}
