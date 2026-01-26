import Packet from '#/io/Packet.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import OpObjE from '#/network/game/client/model/OpObjE.js';

export default class OpObjEDecoder extends ClientGameMessageDecoder<OpObjE> {
    prot = ClientGameProt.OPOBJE;

    decode(buf: Packet) {
        const obj = buf.g2_alt3();

        return new OpObjE(obj);
    }
}
