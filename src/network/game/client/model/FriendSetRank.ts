import ClientGameMessage from '#/network/game/client/ClientGameMessage.js';
import ClientGameProtCategory from '#/network/game/client/ClientGameProtCategory.js';

export default class FriendSetRank extends ClientGameMessage {
    category = ClientGameProtCategory.USER_EVENT;

    constructor(readonly username: bigint, readonly rank: number) {
        super();
    }
}
