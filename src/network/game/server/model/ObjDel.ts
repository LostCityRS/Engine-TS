import ServerGameZoneMessage from '#/network/game/server/ServerGameZoneMessage.js';

export default class ObjDel extends ServerGameZoneMessage {
    constructor(
        readonly coord: number,
        readonly obj: number
    ) {
        super(coord);
    }
}
