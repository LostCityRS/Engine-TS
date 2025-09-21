import { Inventory } from '#/engine/Inventory.js';
import { ServerGameProtPriority } from '#/network/game/server/ServerGameProtPriority.js';
import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class UpdateInvPartial extends ServerGameMessage {
    priority = ServerGameProtPriority.IMMEDIATE;

    readonly slots: number[];

    constructor(
        readonly component: number,
        readonly inv: Inventory,
        ...slots: number[]
    ) {
        super();
        this.slots = slots;
    }
}
