import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class IfSetText extends ServerGameMessage {
    constructor(
        readonly component: number,
        readonly text: string
    ) {
        super();
    }
}
