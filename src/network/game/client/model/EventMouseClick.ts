import ClientGameProtCategory from '#/network/game/client/ClientGameProtCategory.js';
import ClientGameMessage from '#/network/game/client/ClientGameMessage.js';

export default class EventMouseClick extends ClientGameMessage {
    category = ClientGameProtCategory.CLIENT_EVENT;

    constructor(
        readonly info: number
    ) {
        super();
    }
}
