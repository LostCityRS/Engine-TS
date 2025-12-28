import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class MidiJingle extends ServerGameMessage {
    constructor(
        readonly delay: number,
        readonly data: Uint8Array
    ) {
        super();
    }
}
