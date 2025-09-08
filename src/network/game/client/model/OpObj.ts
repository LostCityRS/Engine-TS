import ClientGameProtCategory from '#/network/game/client/ClientGameProtCategory.js';
import ClientGameMessage from '#/network/game/client/ClientGameMessage.js';

export default class OpObj extends ClientGameMessage {
    category = ClientGameProtCategory.USER_EVENT;

    constructor(
        readonly op: number,
        readonly x: number,
        readonly z: number,
        readonly obj: number
    ) {
        super();
    }
}
