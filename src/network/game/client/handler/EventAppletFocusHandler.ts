import Player from '#/engine/entity/Player.js';
import ClientGameMessageHandler from '#/network/game/client/ClientGameMessageHandler.js';
import EventAppletFocus from '#/network/game/client/model/EventAppletFocus.js';

export default class EventAppletFocusHandler extends ClientGameMessageHandler<EventAppletFocus> {
    handle(message: EventAppletFocus, player: Player): boolean {
        player.input.appletFocus(message);
        return true;
    }
}
