import { ServerGameProtPriority } from '#/network/game/server/ServerGameProtPriority.js';
import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class UpdateRebootTimer extends ServerGameMessage {
    priority = ServerGameProtPriority.BUFFERED; // todo: what should priority be?

    constructor(readonly ticks: number) {
        super();
    }
}
