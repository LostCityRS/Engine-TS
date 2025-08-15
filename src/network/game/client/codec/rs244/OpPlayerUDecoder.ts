import Packet from '#/io/Packet.js';
import MessageDecoder from '#/network/game/client/codec/MessageDecoder.js';
import ClientProt244 from '#/network/game/client/codec/rs244/ClientProt244.js';
import OpPlayerU from '#/network/game/client/model/OpPlayerU.js';


export default class OpPlayerUDecoder extends MessageDecoder<OpPlayerU> {
    prot = ClientProt244.OPPLAYERU;

    decode(buf: Packet) {
        const useObj = buf.g2_alt1();
        const useSlot = buf.g2_alt3();
        const useComponent = buf.g2();
        const pid = buf.g2_alt2();

        return new OpPlayerU(pid, useObj, useSlot, useComponent);
    }
}
