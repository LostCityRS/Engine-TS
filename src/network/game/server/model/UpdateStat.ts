import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class UpdateStat extends ServerGameMessage {
    constructor(
        readonly stat: number,
        readonly exp: number,
        readonly level: number
    ) {
        super();
    }
}
