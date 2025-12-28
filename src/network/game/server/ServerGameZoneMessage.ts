import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default abstract class ServerGameZoneMessage extends ServerGameMessage {
    protected constructor(
        readonly coord: number
    ) {
        super();
    }
}
