import Packet from '#/io/Packet.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import OpHeldU from '#/network/game/client/model/OpHeldU.js';

export default class OpHeldUDecoder extends ClientGameMessageDecoder<OpHeldU> {
    prot = ClientGameProt.OPHELDU;

    decode(buf: Packet) {
        const obj = buf.g2();
        const slot = buf.g2();
        const com = buf.g2();
        const useObj = buf.g2();
        const useSlot = buf.g2();
        const useCom = buf.g2();

        return new OpHeldU(obj, slot, com, useObj, useSlot, useCom);
    }
}
