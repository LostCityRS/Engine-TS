import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class NpcInfo extends ServerGameMessage {
    constructor(
        readonly bytes: Uint8Array
    ) {
        super();
    }
}
