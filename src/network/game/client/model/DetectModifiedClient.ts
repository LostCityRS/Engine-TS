import ClientGameMessage from '#/network/game/client/ClientGameMessage.js';
import ClientGameProtCategory from '#/network/game/client/ClientGameProtCategory.js';

export default class DetectModifiedClient extends ClientGameMessage {
    category = ClientGameProtCategory.CLIENT_EVENT;

    constructor(readonly verification: number) {
        super();
    }
}
