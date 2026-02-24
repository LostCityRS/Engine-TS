import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class IfSetRotation extends ServerGameMessage {
    constructor(
        readonly xAngleSpeed: number,
        readonly component: number,
        readonly yAngleSpeed: number
    ) {
        super();
    }
}
