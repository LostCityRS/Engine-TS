import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import ResumePauseButton from '#/network/game/client/model/ResumePauseButton.js';

export default class ResumePauseButtonDecoder extends ClientGameMessageDecoder<ResumePauseButton> {
    prot = ClientGameProt.RESUME_PAUSEBUTTON;

    decode() {
        return new ResumePauseButton();
    }
}
