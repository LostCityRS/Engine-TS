import { ServerProtPriority } from '#/network/game/server/codec/ServerProtPriority.js';
import OutgoingMessage from '#/network/game/server/OutgoingMessage.js';

export default class IfSetAngle extends OutgoingMessage {
    priority = ServerProtPriority.BUFFERED;

    constructor(
        readonly xAngleSpeed: number,
        readonly component: number,
        readonly yAngleSpeed: number
    ) {
        super();
    }
}
