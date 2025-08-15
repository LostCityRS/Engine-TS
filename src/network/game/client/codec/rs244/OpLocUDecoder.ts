import Packet from '#/io/Packet.js';
import MessageDecoder from '#/network/game/client/codec/MessageDecoder.js';
import ClientProt244 from '#/network/game/client/codec/rs244/ClientProt244.js';
import OpLocU from '#/network/game/client/model/OpLocU.js';


export default class OpLocUDecoder extends MessageDecoder<OpLocU> {
    prot = ClientProt244.OPLOCU;

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
