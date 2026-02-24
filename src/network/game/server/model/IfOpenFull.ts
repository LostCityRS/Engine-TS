import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class IfOpenFull extends ServerGameMessage {
    constructor(
        readonly overlayComponent: number,
        readonly mainComponent: number
    ) {
        super();
    }
}
