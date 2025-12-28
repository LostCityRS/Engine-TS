import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class IfSetRecol extends ServerGameMessage {
    constructor(
        readonly component: number,
        readonly src: number,
        readonly dst: number
    ) {
        super();
    }
}
