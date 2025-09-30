import ClientGameProtCategory from '#/network/game/client/ClientGameProtCategory.js';
import ClientGameMessage from '#/network/game/client/ClientGameMessage.js';

export default class EventTracking extends ClientGameMessage {
    category = ClientGameProtCategory.RESTRICTED_EVENT;

    constructor(readonly bytes: Uint8Array) {
        super();
    }
}
