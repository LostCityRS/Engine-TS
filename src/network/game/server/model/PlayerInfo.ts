import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class PlayerInfo extends ServerGameMessage {
    constructor(
        readonly bytes: Uint8Array
    ) {
        super();
    }
}
