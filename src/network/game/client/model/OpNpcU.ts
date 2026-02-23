import ClientGameProtCategory from '#/network/game/client/ClientGameProtCategory.js';
import ClientGameMessage from '#/network/game/client/ClientGameMessage.js';

export default class OpNpcU extends ClientGameMessage {
    category = ClientGameProtCategory.USER_EVENT;

    constructor(
        readonly npcSlot: number,
        readonly useObj: number,
        readonly useSlot: number,
        readonly useCom: number
    ) {
        super();
    }
}
