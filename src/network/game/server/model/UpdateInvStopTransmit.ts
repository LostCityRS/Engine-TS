import { ServerGameProtPriority } from '#/network/game/server/ServerGameProtPriority.js';
import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class UpdateInvStopTransmit extends ServerGameMessage {
    priority = ServerGameProtPriority.IMMEDIATE;

    constructor(readonly component: number) {
        super();
    }
}
