import ClientGameProtCategory from '#/network/game/client/ClientGameProtCategory.js';
import ClientGameMessage from '#/network/game/client/ClientGameMessage.js';

export default class OpLocT extends ClientGameMessage {
    category = ClientGameProtCategory.USER_EVENT;

    constructor(
        readonly x: number,
        readonly z: number,
        readonly loc: number,
        readonly spellComponent: number
    ) {
        super();
    }
}
