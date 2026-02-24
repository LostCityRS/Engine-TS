import ClientGameProtCategory from '#/network/game/client/ClientGameProtCategory.js';
import ClientGameMessage from '#/network/game/client/ClientGameMessage.js';

export default class EventMouseMove extends ClientGameMessage {
    category = ClientGameProtCategory.CLIENT_EVENT;

    constructor(
        readonly data: Uint8Array
    ) {
        super();
    }
}
