import Player from '#/engine/entity/Player.js';
import ClientGameMessage from '#/network/game/client/ClientGameMessage.js';

export default abstract class ClientGameMessageHandler<T extends ClientGameMessage> {
    abstract handle(message: T, player: Player): boolean;
}
