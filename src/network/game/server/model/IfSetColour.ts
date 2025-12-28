import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class IfSetColour extends ServerGameMessage {
    constructor(
        readonly component: number,
        readonly colour: number
    ) {
        super();
    }
}
