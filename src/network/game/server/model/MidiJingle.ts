import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class MidiJingle extends ServerGameMessage {
    constructor(
        readonly id: number,
        readonly delay: number
    ) {
        super();
    }
}
