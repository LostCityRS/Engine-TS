import { ServerGameProtPriority } from '#/network/game/server/ServerGameProtPriority.js';
import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class HintArrow extends ServerGameMessage {
    priority = ServerGameProtPriority.BUFFERED; // todo: what should priority be?

    constructor(
        readonly type: number,
        readonly nid: number,
        readonly pid: number,
        readonly x: number,
        readonly z: number,
        readonly y: number
    ) {
        super();
    }
}
