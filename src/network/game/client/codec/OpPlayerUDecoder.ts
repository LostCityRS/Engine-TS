import Packet from '#/io/Packet.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import OpPlayerU from '#/network/game/client/model/OpPlayerU.js';

export default class OpPlayerUDecoder extends ClientGameMessageDecoder<OpPlayerU> {
    prot = ClientGameProt.OPPLAYERU;

    decode(buf: Packet) {
        const useObj = buf.g2_alt1();
        const useSlot = buf.g2_alt3();
        const useCom = buf.g2();
        const playerSlot = buf.g2_alt2();

        return new OpPlayerU(playerSlot, useObj, useSlot, useCom);
    }
}
