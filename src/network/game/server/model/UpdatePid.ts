import { ServerGameProtPriority } from '#/network/game/server/ServerGameProtPriority.js';
import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class UpdatePid extends ServerGameMessage {
    priority = ServerGameProtPriority.IMMEDIATE; // todo: what should priority be?

    constructor(readonly uid: number, readonly members: boolean) {
        super();
    }
}
