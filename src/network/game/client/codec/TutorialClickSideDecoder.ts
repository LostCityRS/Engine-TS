import Packet from '#/io/Packet.js';
import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import TutorialClickSide from '#/network/game/client/model/TutorialClickSide.js';

export default class TutorialClickSideDecoder extends ClientGameMessageDecoder<TutorialClickSide> {
    prot = ClientGameProt.TUTORIAL_CLICKSIDE;

    decode(buf: Packet) {
        const tab = buf.g1();
        return new TutorialClickSide(tab);
    }
}
