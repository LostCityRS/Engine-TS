import Packet from '#/io/Packet.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import OpPlayerT from '#/network/game/client/model/OpPlayerT.js';

export default class OpPlayerTDecoder extends ClientGameMessageDecoder<OpPlayerT> {
    prot = ClientGameProt.OPPLAYERT;

    decode(buf: Packet) {
        const pid = buf.g2();
        const spellComponent = buf.g2();
        return new OpPlayerT(pid, spellComponent);
    }
}
