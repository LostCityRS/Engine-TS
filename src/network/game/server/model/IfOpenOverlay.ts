import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class IfOpenOverlay extends ServerGameMessage {
    constructor(
        readonly component: number
    ) {
        super();
    }
}
