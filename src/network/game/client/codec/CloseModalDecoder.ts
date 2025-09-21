import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import CloseModal from '#/network/game/client/model/CloseModal.js';

export default class CloseModalDecoder extends ClientGameMessageDecoder<CloseModal> {
    prot = ClientGameProt.CLOSE_MODAL;

    decode() {
        return new CloseModal();
    }
}
