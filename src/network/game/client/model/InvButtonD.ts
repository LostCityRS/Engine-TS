import ClientGameProtCategory from '#/network/game/client/ClientGameProtCategory.js';
import ClientGameMessage from '#/network/game/client/ClientGameMessage.js';

export default class InvButtonD extends ClientGameMessage {
    category = ClientGameProtCategory.USER_EVENT;

    constructor(
        readonly component: number,
        readonly slot: number,
        readonly targetSlot: number,
        readonly mode: number
    ) {
        super();
    }
}
