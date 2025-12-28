import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class TutorialOpenChat extends ServerGameMessage {
    constructor(
        readonly component: number
    ) {
        super();
    }
}
