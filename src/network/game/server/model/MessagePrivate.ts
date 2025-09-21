import { ServerGameProtPriority } from '#/network/game/server/ServerGameProtPriority.js';
import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class MessagePrivate extends ServerGameMessage {
    priority = ServerGameProtPriority.IMMEDIATE;

    constructor(
        readonly from: bigint,
        readonly messageId: number,
        readonly staffModLevel: number,
        readonly msg: string
    ) {
        super();
    }
}
