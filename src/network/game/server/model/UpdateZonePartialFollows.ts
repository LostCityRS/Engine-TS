import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class UpdateZonePartialFollows extends ServerGameMessage {
    constructor(
        readonly zoneX: number,
        readonly zoneZ: number,
        readonly originX: number,
        readonly originZ: number
    ) {
        super();
    }
}
