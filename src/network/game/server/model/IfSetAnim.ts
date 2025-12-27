import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class IfSetAnim extends ServerGameMessage {
    constructor(
        readonly component: number,
        readonly seq: number
    ) {
        super();
    }
}
