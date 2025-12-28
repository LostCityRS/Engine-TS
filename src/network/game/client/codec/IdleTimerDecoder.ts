import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import IdleTimer from '#/network/game/client/model/IdleTimer.js';

export default class IdleTimerDecoder extends ClientGameMessageDecoder<IdleTimer> {
    prot = ClientGameProt.IDLE_TIMER;

    decode() {
        return new IdleTimer();
    }
}
