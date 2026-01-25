import Player from '#/engine/entity/Player.js';
import ClientGameMessageHandler from '#/network/game/client/ClientGameMessageHandler.js';
import IdleTimer from '#/network/game/client/model/IdleTimer.js';

export default class IdleTimerHandler extends ClientGameMessageHandler<IdleTimer> {
    handle(_message: IdleTimer, _player: Player): boolean {
        return true;
    }
}
