import Packet from '#/io/Packet.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import OpObjU from '#/network/game/client/model/OpObjU.js';

export default class OpObjUDecoder extends ClientGameMessageDecoder<OpObjU> {
    prot = ClientGameProt.OPOBJU;

    decode(buf: Packet) {
        const useSlot = buf.g2_alt3();
        const useObj = buf.g2_alt2();
        const z = buf.g2_alt3();
        const x = buf.g2_alt3();
        const useCom = buf.g2_alt1();
        const obj = buf.g2_alt1();

        return new OpObjU(x, z, obj, useObj, useSlot, useCom);
    }
}
