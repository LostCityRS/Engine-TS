import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class IfSetObject extends ServerGameMessage {
    constructor(
        readonly component: number,
        readonly obj: number,
        readonly scale: number
    ) {
        super();
    }
}
