import ServerGameZoneMessage from '#/network/game/server/ServerGameZoneMessage.js';

export default class ObjReveal extends ServerGameZoneMessage {
    constructor(
        readonly coord: number,
        readonly obj: number,
        readonly count: number,
        readonly receiverId: number
    ) {
        super(coord);
    }
}
