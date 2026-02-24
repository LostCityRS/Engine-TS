import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class LastLoginInfo extends ServerGameMessage {
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
