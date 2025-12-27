import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class IfSetScrollPos extends ServerGameMessage {
    constructor(
        readonly component: number,
        readonly y: number
    ) {
        super();
    }
}
