import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class UpdateRunWeight extends ServerGameMessage {
    constructor(
        readonly kg: number
    ) {
        super();
    }
}
