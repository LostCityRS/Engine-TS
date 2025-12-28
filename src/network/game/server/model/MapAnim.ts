import ServerGameZoneMessage from '#/network/game/server/ServerGameZoneMessage.js';

export default class MapAnim extends ServerGameZoneMessage {
    constructor(
        readonly coord: number,
        readonly spotanim: number,
        readonly height: number,
        readonly delay: number
    ) {
        super(coord);
    }
}
