import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class SetPlayerOp extends ServerGameMessage {
    constructor(
        readonly op: number,
        readonly value: string,
        readonly primary: number
    ) {
        super();
    }
}
