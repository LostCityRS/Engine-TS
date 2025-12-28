import Packet from '#/io/Packet.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import OpPlayerU from '#/network/game/client/model/OpPlayerU.js';

export default class OpPlayerUDecoder extends ClientGameMessageDecoder<OpPlayerU> {
    prot = ClientGameProt.OPPLAYERU;

    decode(buf: Packet) {
        const pid = buf.g2();
        const useObj = buf.g2();
        const useSlot = buf.g2();
        const useComponent = buf.g2();
        return new OpPlayerU(pid, useObj, useSlot, useComponent);
    }
}
