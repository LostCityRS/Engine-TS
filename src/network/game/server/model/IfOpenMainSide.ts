import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class IfOpenMainSide extends ServerGameMessage {
    constructor(
        readonly main: number,
        readonly side: number
    ) {
        super();
    }
}
