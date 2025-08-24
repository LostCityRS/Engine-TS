import { ServerProtPriority } from '#/network/game/server/codec/ServerProtPriority.js';
import OutgoingMessage from '#/network/game/server/OutgoingMessage.js';

export default class LastLoginInfo extends OutgoingMessage {
    priority = ServerProtPriority.BUFFERED;

    constructor(
        readonly lastLoginIp: number,
        readonly currentDay: number,
        readonly previousLoginDay: number,
        readonly daysSincePasswordChange: number,
        readonly daysSinceRecoveryChange: number,
        readonly unreadMessageCount: number,
        readonly membersCreditDays: number
    ) {
        super();
    }
}
