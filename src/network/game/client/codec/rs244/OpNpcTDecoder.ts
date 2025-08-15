import Packet from '#/io/Packet.js';
import MessageDecoder from '#/network/game/client/codec/MessageDecoder.js';
import ClientProt244 from '#/network/game/client/codec/rs244/ClientProt244.js';
import OpNpcT from '#/network/game/client/model/OpNpcT.js';


export default class OpNpcTDecoder extends MessageDecoder<OpNpcT> {
    prot = ClientProt244.OPNPCT;

    decode(buf: Packet) {
        const spellComponent = buf.g2_alt2();
        const nid = buf.g2_alt1();

        return new OpNpcT(nid, spellComponent);
    }
}
