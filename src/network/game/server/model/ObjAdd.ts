import ServerGameZoneMessage from '#/network/game/server/ServerGameZoneMessage.js';

export default class ObjAdd extends ServerGameZoneMessage {
    constructor(
        readonly coord: number,
        readonly obj: number,
        readonly count: number
    ) {
        super(coord);
    }
}
