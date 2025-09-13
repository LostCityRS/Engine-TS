import Packet from '#/io/Packet.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import OpObjT from '#/network/game/client/model/OpObjT.js';

export default class OpObjTDecoder extends ClientGameMessageDecoder<OpObjT> {
    prot = ClientGameProt.OPOBJT;

    decode(buf: Packet) {
        const x = buf.g2();
        const z = buf.g2();
        const obj = buf.g2();
        const spellComponent = buf.g2();
        return new OpObjT(x, z, obj, spellComponent);
    }
}
