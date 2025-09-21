import ServerGameZoneMessage from '#/network/game/server/ServerGameZoneMessage.js';

export default class LocDel extends ServerGameZoneMessage {
    constructor(
        readonly coord: number,
        readonly shape: number,
        readonly angle: number
    ) {
        super(coord);
    }
}
