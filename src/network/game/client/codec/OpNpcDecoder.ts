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
        const nid = buf.g2();
        return new OpNpc(this.op, nid);
    }
}
