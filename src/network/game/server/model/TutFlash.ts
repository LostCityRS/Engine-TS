import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class TutorialFlashSide extends ServerGameMessage {
    constructor(
        readonly tab: number
    ) {
        super();
    }
}
