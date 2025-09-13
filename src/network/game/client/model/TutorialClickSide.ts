import ClientGameProtCategory from '#/network/game/client/ClientGameProtCategory.js';
import ClientGameMessage from '#/network/game/client/ClientGameMessage.js';

export default class TutorialClickSide extends ClientGameMessage {
    category = ClientGameProtCategory.USER_EVENT;

    constructor(readonly tab: number) {
        super();
    }
}
