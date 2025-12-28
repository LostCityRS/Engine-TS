import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class UpdateZonePartialEnclosed extends ServerGameMessage {
    constructor(
        readonly zoneX: number,
        readonly zoneZ: number,
        readonly originX: number,
        readonly originZ: number,
        readonly data: Uint8Array
    ) {
        super();
    }
}
