import { ServerGameProtPriority } from '#/network/game/server/ServerGameProtPriority.js';
import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class LastLoginInfo extends ServerGameMessage {
    priority = ServerGameProtPriority.BUFFERED;

    constructor(
        readonly lastLoginIp: number,
        readonly daysSinceLogin: number,
        readonly daysSinceRecoveryChange: number,
        readonly unreadMessageCount: number,
        readonly warnMembersInNonMembers: boolean
    ) {
        super();
    }
}
