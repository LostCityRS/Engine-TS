import { ZoneEventType } from '#/engine/zone/ZoneEventType.js';
import ServerGameZoneMessage from '#/network/game/server/ServerGameZoneMessage.js';

export default class ZoneEvent {
    readonly type: ZoneEventType;
    readonly receiver64: bigint;
    readonly message: ServerGameZoneMessage;

    constructor(type: ZoneEventType, receiver64: bigint, message: ServerGameZoneMessage) {
        this.type = type;
        this.receiver64 = receiver64;
        this.message = message;
    }
}
