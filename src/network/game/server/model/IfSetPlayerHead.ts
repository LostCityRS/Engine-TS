import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class IfSetPlayerHead extends ServerGameMessage {
    constructor(
        readonly component: number
    ) {
        super();
    }
}
