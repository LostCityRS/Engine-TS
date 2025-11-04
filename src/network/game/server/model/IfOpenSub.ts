import { ServerGameProtPriority } from '#/network/game/server/ServerGameProtPriority.js';
import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class IfOpenSub extends ServerGameMessage {
    priority = ServerGameProtPriority.IMMEDIATE;

    constructor(
        readonly interfaceId: number,
        readonly component: number,
        readonly type: number,
        readonly transmitId: number
    ) {
        super();
    }
}
