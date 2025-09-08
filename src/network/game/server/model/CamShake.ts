import { ServerGameProtPriority } from '#/network/game/server/ServerGameProtPriority.js';
import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class CamShake extends ServerGameMessage {
    priority = ServerGameProtPriority.BUFFERED;

    constructor(
        readonly type: number,
        readonly jitter: number,
        readonly amplitude: number,
        readonly frequency: number
    ) {
        super();
    }
}
