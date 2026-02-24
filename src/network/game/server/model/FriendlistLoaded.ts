import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class FriendlistLoaded extends ServerGameMessage {
    constructor(
        readonly status: number
    ) {
        super();
    }
}
