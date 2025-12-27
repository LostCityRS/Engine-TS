import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class UpdateRebootTimer extends ServerGameMessage {
    constructor(
        readonly ticks: number
    ) {
        super();
    }
}
