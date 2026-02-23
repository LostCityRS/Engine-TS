import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class DataLoc extends ServerGameMessage {
    constructor(
        readonly x: number,
        readonly z: number,
        readonly off: number,
        readonly len: number,
        readonly data: Uint8Array
    ) {
        super();
    }
}
