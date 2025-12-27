import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class LastLoginInfo extends ServerGameMessage {
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
