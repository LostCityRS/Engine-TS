import Packet from '#/io/Packet.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import IfButton from '#/network/game/client/model/IfButton.js';

export default class IfButtonDecoder extends ClientGameMessageDecoder<IfButton> {
    prot = ClientGameProt.IF_BUTTON;

    decode(buf: Packet) {
        const component: number = buf.g2();
        return new IfButton(component);
    }
}
