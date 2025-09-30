import { ServerGameProtPriority } from '#/network/game/server/ServerGameProtPriority.js';
import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class UpdateStat extends ServerGameMessage {
    priority = ServerGameProtPriority.BUFFERED;

    constructor(
        readonly stat: number,
        readonly exp: number,
        readonly level: number
    ) {
        super();
    }
}
