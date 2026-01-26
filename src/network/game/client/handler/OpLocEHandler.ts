import { NetworkPlayer } from '#/engine/entity/NetworkPlayer.js';
import ClientGameMessageHandler from '#/network/game/client/ClientGameMessageHandler.js';
import OpLocE from '#/network/game/client/model/OpLocE.js';

export default class OpLocEHandler extends ClientGameMessageHandler<OpLocE> {
    handle(_message: OpLocE, _player: NetworkPlayer): boolean {
        // TODO
        return true;
    }
}
