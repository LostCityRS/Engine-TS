import { ServerGameProtPriority } from '#/network/game/server/ServerGameProtPriority.js';
import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class ResetAnims extends ServerGameMessage {
    priority = ServerGameProtPriority.IMMEDIATE; // todo: what should priority be?
}
