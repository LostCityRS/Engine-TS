import { ServerGameProtPriority } from '#/network/game/server/ServerGameProtPriority.js';
import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class CamMoveTo extends ServerGameMessage {
    priority = ServerGameProtPriority.BUFFERED;

    constructor(
        readonly x: number,
        readonly z: number,
        readonly height: number,
        readonly speed: number,
        readonly multiplier: number
    ) {
        super();
    }
}
