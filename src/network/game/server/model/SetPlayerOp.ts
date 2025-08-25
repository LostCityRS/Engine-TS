import { ServerProtPriority } from '../codec/ServerProtPriority.js';
import OutgoingMessage from '../OutgoingMessage.js';

export default class SetPlayerOp extends OutgoingMessage {
    priority = ServerProtPriority.IMMEDIATE;

    constructor(
        readonly op: number,
        readonly value: string,
        readonly primary: number
    ) {
        super();
    }
}
