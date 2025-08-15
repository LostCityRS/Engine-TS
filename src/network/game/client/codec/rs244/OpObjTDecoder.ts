import Packet from '#/io/Packet.js';
import MessageDecoder from '#/network/game/client/codec/MessageDecoder.js';
import ClientProt244 from '#/network/game/client/codec/rs244/ClientProt244.js';
import OpObjT from '#/network/game/client/model/OpObjT.js';


export default class OpObjTDecoder extends MessageDecoder<OpObjT> {
    prot = ClientProt244.OPOBJT;

    decode(buf: Packet) {
        const obj = buf.g2_alt1();
        const z = buf.g2();
        const spellComponent = buf.g2_alt1();
        const x = buf.g2_alt3();

        return new OpObjT(x, z, obj, spellComponent);
    }
}
