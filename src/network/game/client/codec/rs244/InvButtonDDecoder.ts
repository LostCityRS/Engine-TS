import Packet from '#/io/Packet.js';
import MessageDecoder from '#/network/game/client/codec/MessageDecoder.js';
import ClientProt244 from '#/network/game/client/codec/rs244/ClientProt244.js';
import InvButtonD from '#/network/game/client/model/InvButtonD.js';


export default class InvButtonDDecoder extends MessageDecoder<InvButtonD> {
    prot = ClientProt244.INV_BUTTOND;

    decode(buf: Packet) {
        const targetSlot = buf.g2_alt3();
        const mode = buf.g1_alt1();
        const component = buf.g2_alt2();
        const slot = buf.g2_alt1();

        return new InvButtonD(component, slot, targetSlot, mode);
    }
}
