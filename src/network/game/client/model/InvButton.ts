import ClientGameProtCategory from '#/network/game/client/ClientGameProtCategory.js';
import ClientGameMessage from '#/network/game/client/ClientGameMessage.js';

export default class InvButton extends ClientGameMessage {
    category = ClientGameProtCategory.USER_EVENT;

    constructor(
        readonly op: number,
        readonly obj: number,
        readonly slot: number,
        readonly component: number
    ) {
        super();
    }
}
