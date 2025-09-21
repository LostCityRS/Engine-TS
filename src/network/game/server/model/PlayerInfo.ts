import { ServerGameProtPriority } from '#/network/game/server/ServerGameProtPriority.js';
import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class PlayerInfo extends ServerGameMessage {
    priority = ServerGameProtPriority.IMMEDIATE;

    constructor(readonly bytes: Uint8Array) {
        super();
    }
}
