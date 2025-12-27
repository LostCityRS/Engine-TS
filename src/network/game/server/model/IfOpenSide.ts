import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class IfOpenSide extends ServerGameMessage {
    constructor(
        readonly component: number
    ) {
        super();
    }
}
