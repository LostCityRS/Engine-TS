import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class RebuildNormal extends ServerGameMessage {
    constructor(
        readonly zoneX: number,
        readonly zoneZ: number,
        readonly mapsquares: Set<number>,
    ) {
        super();
    }
}
