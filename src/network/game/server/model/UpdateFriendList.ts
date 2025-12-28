import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class UpdateFriendList extends ServerGameMessage {
    constructor(
        readonly name: bigint,
        readonly nodeId: number
    ) {
        super();
    }
}
