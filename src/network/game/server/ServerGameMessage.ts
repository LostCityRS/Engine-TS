import { ServerGameProtPriority } from '#/network/game/server/ServerGameProtPriority.js';
import ServerMessage from '#/network/ServerMessage.js';

export default abstract class ServerGameMessage extends ServerMessage {
    abstract readonly priority: ServerGameProtPriority;
}
