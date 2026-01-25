import { NetworkPlayer } from '#/engine/entity/NetworkPlayer.js';
import ClientGameMessageHandler from '#/network/game/client/ClientGameMessageHandler.js';
import OpLocE from '#/network/game/client/model/OpLocE.js';

export default class OpLocEHandler extends ClientGameMessageHandler<OpLocE> {
    handle(message: OpLocE, player: NetworkPlayer): boolean {
        // TODO
        return true;
    }
}
