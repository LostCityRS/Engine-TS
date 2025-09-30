import { ServerGameProtPriority } from '#/network/game/server/ServerGameProtPriority.js';
import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class FinishTracking extends ServerGameMessage {
    priority = ServerGameProtPriority.BUFFERED;
}
