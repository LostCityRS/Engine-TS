import Packet from '#/io/Packet.js';
import MessageDecoder from '#/network/game/client/codec/MessageDecoder.js';
import ClientProt244 from '#/network/game/client/codec/rs244/ClientProt244.js';
import OpObjU from '#/network/game/client/model/OpObjU.js';


export default class OpObjUDecoder extends MessageDecoder<OpObjU> {
    prot = ClientProt244.OPOBJU;

    decode(buf: Packet) {
        const useSlot = buf.g2_alt3();
        const useObj = buf.g2_alt2();
        const z = buf.g2_alt3();
        const x = buf.g2_alt3();
        const useComponent = buf.g2_alt1();
        const obj = buf.g2_alt1();

        return new OpObjU(x, z, obj, useObj, useSlot, useComponent);
    }
}
