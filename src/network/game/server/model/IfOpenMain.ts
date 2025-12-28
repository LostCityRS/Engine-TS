import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class IfOpenMain extends ServerGameMessage {
    constructor(
        readonly component: number
    ) {
        super();
    }
}
