import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class IfOpenChat extends ServerGameMessage {
    constructor(
        readonly component: number
    ) {
        super();
    }
}
