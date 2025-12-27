import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class HintArrow extends ServerGameMessage {
    constructor(
        readonly type: number,
        readonly nid: number,
        readonly pid: number,
        readonly x: number,
        readonly z: number,
        readonly y: number
    ) {
        super();
    }
}
