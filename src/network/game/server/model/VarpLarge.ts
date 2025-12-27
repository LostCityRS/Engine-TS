import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class VarpLarge extends ServerGameMessage {
    constructor(
        readonly varp: number,
        readonly value: number
    ) {
        super();
    }
}
