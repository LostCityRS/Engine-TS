import ClientGameProtCategory from '#/network/game/client/ClientGameProtCategory.js';
import ClientGameMessage from '#/network/game/client/ClientGameMessage.js';

export default class OpHeldU extends ClientGameMessage {
    category = ClientGameProtCategory.USER_EVENT;

    constructor(
        readonly obj: number,
        readonly slot: number,
        readonly component: number,
        readonly useObj: number,
        readonly useSlot: number,
        readonly useComponent: number
    ) {
        super();
    }
}
