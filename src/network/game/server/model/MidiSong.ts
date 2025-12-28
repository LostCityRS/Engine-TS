import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class MidiSong extends ServerGameMessage {
    constructor(
        readonly name: string,
        readonly crc: number,
        readonly length: number
    ) {
        super();
    }
}
