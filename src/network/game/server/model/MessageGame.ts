import { ServerGameProtPriority } from '#/network/game/server/ServerGameProtPriority.js';
import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class MessageGame extends ServerGameMessage {
    priority = ServerGameProtPriority.IMMEDIATE;

    constructor(readonly msg: string) {
        super();
    }
}
