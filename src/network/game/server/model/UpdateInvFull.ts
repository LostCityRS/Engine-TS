import { Inventory } from '#/engine/Inventory.js';
import { ServerGameProtPriority } from '#/network/game/server/ServerGameProtPriority.js';
import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class UpdateInvFull extends ServerGameMessage {
    priority = ServerGameProtPriority.IMMEDIATE;

    constructor(
        readonly component: number,
        readonly inv: Inventory
    ) {
        super();
    }
}
