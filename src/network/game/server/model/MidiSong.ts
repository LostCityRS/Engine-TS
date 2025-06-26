import { ServerProtPriority } from '#/network/game/server/codec/ServerProtPriority.js';
import OutgoingMessage from '#/network/game/server/OutgoingMessage.js';

export default class MidiSong extends OutgoingMessage {
    priority = ServerProtPriority.BUFFERED;

    constructor(readonly id: number) {
        super();
    }
}
