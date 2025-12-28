import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class DataLocDone extends ServerGameMessage {
    constructor(
        readonly x: number,
        readonly z: number
    ) {
        super();
    }
}
