import { ServerGameProtPriority } from '#/network/game/server/ServerGameProtPriority.js';
import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class IfSetAngle extends ServerGameMessage {
    priority = ServerGameProtPriority.BUFFERED;

    constructor(
        readonly xAngleSpeed: number,
        readonly component: number,
        readonly yAngleSpeed: number
    ) {
        super();
    }
}
