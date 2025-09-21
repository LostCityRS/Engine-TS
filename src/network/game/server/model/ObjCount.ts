import ServerGameZoneMessage from '#/network/game/server/ServerGameZoneMessage.js';

export default class ObjCount extends ServerGameZoneMessage {
    constructor(
        readonly coord: number,
        readonly obj: number,
        readonly oldCount: number,
        readonly newCount: number
    ) {
        super(coord);
    }
}
