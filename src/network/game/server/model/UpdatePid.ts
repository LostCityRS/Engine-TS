import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class UpdatePid extends ServerGameMessage {
    constructor(
        readonly uid: number,
        readonly members: boolean
    ) {
        super();
    }
}
