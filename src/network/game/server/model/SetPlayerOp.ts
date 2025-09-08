import { ServerGameProtPriority } from '../ServerGameProtPriority.js';
import ServerGameMessage from '../ServerGameMessage.js';

export default class SetPlayerOp extends ServerGameMessage {
    priority = ServerGameProtPriority.IMMEDIATE;

    constructor(
        readonly op: number,
        readonly value: string,
        readonly primary: number
    ) {
        super();
    }
}
