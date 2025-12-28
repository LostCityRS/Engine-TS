import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class SetMultiway extends ServerGameMessage {
    constructor(
        readonly hidden: boolean
    ) {
        super();
    }
}
