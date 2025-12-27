import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class IfSetTabActive extends ServerGameMessage {
    constructor(
        readonly tab: number
    ) {
        super();
    }
}
