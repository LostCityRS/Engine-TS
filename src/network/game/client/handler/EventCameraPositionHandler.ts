import Player from '#/engine/entity/Player.js';
import ClientGameMessageHandler from '#/network/game/client/ClientGameMessageHandler.js';
import EventCameraPosition from '#/network/game/client/model/EventCameraPosition.js';

export default class EventCameraPositionHandler extends ClientGameMessageHandler<EventCameraPosition> {
    handle(message: EventCameraPosition, player: Player): boolean {
        player.input.cameraPosition(message);
        return true;
    }
}
