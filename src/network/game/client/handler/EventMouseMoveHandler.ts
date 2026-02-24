import Player from '#/engine/entity/Player.js';
import ClientGameMessageHandler from '#/network/game/client/ClientGameMessageHandler.js';
import EventMouseMove from '#/network/game/client/model/EventMouseMove.js';

export default class EventMouseMoveHandler extends ClientGameMessageHandler<EventMouseMove> {
    handle(message: EventMouseMove, player: Player): boolean {
        player.input.mouseMove(message);
        return true;
    }
}
