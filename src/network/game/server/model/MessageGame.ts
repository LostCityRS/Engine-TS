import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class MessageGame extends ServerGameMessage {
    constructor(
        readonly msg: string
    ) {
        super();
    }
}
