import ClientGameProtCategory from '#/network/game/client/ClientGameProtCategory.js';
import ClientGameMessage from '#/network/game/client/ClientGameMessage.js';

export default class OpHeldT extends ClientGameMessage {
    category = ClientGameProtCategory.USER_EVENT;

    constructor(
        readonly obj: number,
        readonly slot: number,
        readonly com: number,
        readonly spellCom: number
    ) {
        super();
    }
}
