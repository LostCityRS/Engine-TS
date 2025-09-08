import { ServerGameProtPriority } from '#/network/game/server/ServerGameProtPriority.js';
import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default abstract class ServerGameZoneMessage extends ServerGameMessage {
    priority = ServerGameProtPriority.IMMEDIATE;

    protected constructor(readonly coord: number) {
        super();
    }
}
