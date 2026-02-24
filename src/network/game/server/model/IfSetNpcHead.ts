import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class IfSetNpcHead extends ServerGameMessage {
    constructor(
        readonly component: number,
        readonly npc: number
    ) {
        super();
    }
}
