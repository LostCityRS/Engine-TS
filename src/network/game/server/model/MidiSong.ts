import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class MidiSong extends ServerGameMessage {
    constructor(
        readonly id: number
    ) {
        super();
    }
}
