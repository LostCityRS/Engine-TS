import Packet from '#/io/Packet.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import OpLocU from '#/network/game/client/model/OpLocU.js';

export default class OpLocUDecoder extends ClientGameMessageDecoder<OpLocU> {
    prot = ClientGameProt.OPLOCU;

    decode(buf: Packet) {
        const loc = buf.g2_alt1();
        const useComponent = buf.g2_alt1();
        const useObj = buf.g2_alt1();
        const z = buf.g2_alt1();
        const useSlot = buf.g2();
        const x = buf.g2_alt3();

        return new OpLocU(x, z, loc, useObj, useSlot, useComponent);
    }
}
