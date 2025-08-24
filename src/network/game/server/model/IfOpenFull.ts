import { ServerProtPriority } from '#/network/game/server/codec/ServerProtPriority.js';
import OutgoingMessage from '#/network/game/server/OutgoingMessage.js';

export default class IfOpenFull extends OutgoingMessage {
    // todo: Send as immediate?
    priority = ServerProtPriority.BUFFERED;

    constructor(
        readonly overlayComponent: number,
        readonly mainComponent: number
    ) {
        super();
    }
}
