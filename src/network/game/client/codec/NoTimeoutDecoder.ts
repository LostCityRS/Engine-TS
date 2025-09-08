import ClientGameMessageDecoder from '#/network/game/client/ClientGameMessageDecoder.js';
import ClientGameProt from '#/network/game/client/ClientGameProt.js';
import NoTimeout from '#/network/game/client/model/NoTimeout.js';

export default class NoTimeoutDecoder extends ClientGameMessageDecoder<NoTimeout> {
    prot = ClientGameProt.NO_TIMEOUT;

    decode() {
        return new NoTimeout();
    }
}
