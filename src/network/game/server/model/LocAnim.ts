import ServerGameZoneMessage from '#/network/game/server/ServerGameZoneMessage.js';

export default class LocAnim extends ServerGameZoneMessage {
    constructor(
        readonly coord: number,
        readonly shape: number,
        readonly angle: number,
        readonly seq: number
    ) {
        super(coord);
    }
}
