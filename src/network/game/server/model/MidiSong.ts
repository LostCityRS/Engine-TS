import { ServerGameProtPriority } from '#/network/game/server/ServerGameProtPriority.js';
import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class MidiSong extends ServerGameMessage {
    priority = ServerGameProtPriority.BUFFERED;

    constructor(readonly id: number) {
        super();
    }
}
