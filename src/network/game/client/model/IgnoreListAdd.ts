import ClientGameProtCategory from '#/network/game/client/ClientGameProtCategory.js';
import ClientGameMessage from '#/network/game/client/ClientGameMessage.js';

export default class IgnoreListAdd extends ClientGameMessage {
    category = ClientGameProtCategory.USER_EVENT;

    constructor(readonly username: bigint) {
        super();
    }
}
