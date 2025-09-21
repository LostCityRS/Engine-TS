import { ServerGameProtPriority } from '#/network/game/server/ServerGameProtPriority.js';
import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class IfOpenFull extends ServerGameMessage {
    // todo: Send as immediate?
    priority = ServerGameProtPriority.BUFFERED;

    constructor(
        readonly overlayComponent: number,
        readonly mainComponent: number
    ) {
        super();
    }
}
