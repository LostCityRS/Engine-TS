import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class IfSetModel extends ServerGameMessage {
    constructor(
        readonly component: number,
        readonly model: number
    ) {
        super();
    }
}
