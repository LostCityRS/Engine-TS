import Packet from '#/io/Packet.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import OpNpcT from '#/network/game/client/model/OpNpcT.js';

export default class OpNpcTDecoder extends ClientGameMessageDecoder<OpNpcT> {
    prot = ClientGameProt.OPNPCT;

    decode(buf: Packet) {
        const spellCom = buf.g2_alt2();
        const npcSlot = buf.g2_alt1();

        return new OpNpcT(npcSlot, spellCom);
    }
}
