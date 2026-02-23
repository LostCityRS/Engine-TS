import Packet from '#/io/Packet.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import TutClickSide from '#/network/game/client/model/TutClickSide.js';

export default class TutClickSideDecoder extends ClientGameMessageDecoder<TutClickSide> {
    prot = ClientGameProt.TUT_CLICKSIDE;

    decode(buf: Packet) {
        const tab = buf.g1();

        return new TutClickSide(tab);
    }
}
