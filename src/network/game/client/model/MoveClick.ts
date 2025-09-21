import ClientGameProtCategory from '#/network/game/client/ClientGameProtCategory.js';
import ClientGameMessage from '#/network/game/client/ClientGameMessage.js';

export default class MoveClick extends ClientGameMessage {
    category = ClientGameProtCategory.USER_EVENT;

    constructor(
        readonly path: { x: number; z: number }[],
        readonly ctrlHeld: number,
        readonly opClick: boolean
    ) {
        super();
    }
}
