import { ServerGameProtPriority } from '#/network/game/server/ServerGameProtPriority.js';
import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class UpdateFriendList extends ServerGameMessage {
    priority = ServerGameProtPriority.BUFFERED;

    constructor(
        readonly name: bigint,
        readonly nodeId: number
    ) {
        super();
    }
}
