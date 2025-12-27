import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class UpdateRunEnergy extends ServerGameMessage {
    constructor(
        readonly energy: number
    ) {
        super();
    }
}
