import ClientGameProtCategory from '#/network/game/client/ClientGameProtCategory.js';
import ClientGameMessage from '#/network/game/client/ClientGameMessage.js';

export default class IfPlayerDesign extends ClientGameMessage {
    category = ClientGameProtCategory.USER_EVENT;

    constructor(
        readonly gender: number,
        readonly idkit: number[],
        readonly color: number[]
    ) {
        super();
    }
}
