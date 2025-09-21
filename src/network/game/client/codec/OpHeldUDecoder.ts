import Packet from '#/io/Packet.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import OpHeldU from '#/network/game/client/model/OpHeldU.js';

export default class OpHeldUDecoder extends ClientGameMessageDecoder<OpHeldU> {
    prot = ClientGameProt.OPHELDU;

    decode(buf: Packet) {
        const obj = buf.g2();
        const useSlot = buf.g2_alt1();
        const useObj = buf.g2_alt1();
        const useComponent = buf.g2_alt3();
        const slot = buf.g2_alt2();
        const component = buf.g2_alt2();

        return new OpHeldU(obj, slot, component, useObj, useSlot, useComponent);
    }
}
