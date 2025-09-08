import ServerGameZoneMessage from '#/network/game/server/ServerGameZoneMessage.js';

export default class LocAddChange extends ServerGameZoneMessage {
    constructor(
        readonly coord: number,
        readonly loc: number,
        readonly shape: number,
        readonly angle: number
    ) {
        super(coord);
    }
}
