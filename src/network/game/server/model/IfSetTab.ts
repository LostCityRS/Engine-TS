import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class IfSetTab extends ServerGameMessage {
    constructor(
        readonly component: number,
        readonly tab: number
    ) {
        super();
    }
}
