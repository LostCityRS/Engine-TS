import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class IfSetPosition extends ServerGameMessage {
    constructor(
        readonly component: number,
        readonly x: number,
        readonly y: number
    ) {
        super();
    }
}
