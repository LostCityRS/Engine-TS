import Packet from '#/io/Packet.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import OpLocE from '#/network/game/client/model/OpLocE.js';

export default class OpLocEDecoder extends ClientGameMessageDecoder<OpLocE> {
    prot = ClientGameProt.OPLOCE;

    decode(buf: Packet) {
        const loc = buf.g2_alt3();

        return new OpLocE(loc);
    }
}
