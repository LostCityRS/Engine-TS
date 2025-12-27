import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class UpdateIgnoreList extends ServerGameMessage {
    constructor(
        readonly names: bigint[]
    ) {
        super();
    }
}
