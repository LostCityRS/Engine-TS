import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class IfSetHide extends ServerGameMessage {
    constructor(
        readonly component: number,
        readonly hidden: boolean
    ) {
        super();
    }
}
