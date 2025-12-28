import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class UpdateInvStopTransmit extends ServerGameMessage {
    constructor(
        readonly component: number
    ) {
        super();
    }
}
