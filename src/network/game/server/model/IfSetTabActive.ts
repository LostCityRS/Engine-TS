import { ServerGameProtPriority } from '#/network/game/server/ServerGameProtPriority.js';
import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class IfSetTabActive extends ServerGameMessage {
    priority = ServerGameProtPriority.BUFFERED;

    constructor(readonly tab: number) {
        super();
    }
}
