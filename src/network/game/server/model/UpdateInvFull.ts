import { Inventory } from '#/engine/Inventory.js';

import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class UpdateInvFull extends ServerGameMessage {
    constructor(
        readonly component: number,
        readonly inv: Inventory
    ) {
        super();
    }
}
