import { ServerGameProtPriority } from '#/network/game/server/ServerGameProtPriority.js';
import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class UpdateRunEnergy extends ServerGameMessage {
    priority = ServerGameProtPriority.BUFFERED;

    constructor(readonly energy: number) {
        super();
    }
}
