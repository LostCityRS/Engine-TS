import Packet from '#/io/Packet.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import OpNpcU from '#/network/game/client/model/OpNpcU.js';

export default class OpNpcUDecoder extends ClientGameMessageDecoder<OpNpcU> {
    prot = ClientGameProt.OPNPCU;

    decode(buf: Packet) {
        const npcSlot = buf.g2();
        const useObj = buf.g2();
        const useSlot = buf.g2();
        const useCom = buf.g2();

        return new OpNpcU(npcSlot, useObj, useSlot, useCom);
    }
}
