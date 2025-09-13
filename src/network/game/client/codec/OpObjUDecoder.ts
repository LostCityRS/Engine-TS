import Packet from '#/io/Packet.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import OpObjU from '#/network/game/client/model/OpObjU.js';

export default class OpObjUDecoder extends ClientGameMessageDecoder<OpObjU> {
    prot = ClientGameProt.OPOBJU;

    decode(buf: Packet) {
        const x = buf.g2();
        const z = buf.g2();
        const obj = buf.g2();
        const useObj = buf.g2();
        const useSlot = buf.g2();
        const useComponent = buf.g2();
        return new OpObjU(x, z, obj, useObj, useSlot, useComponent);
    }
}
