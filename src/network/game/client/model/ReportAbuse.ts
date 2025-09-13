import ClientGameProtCategory from '#/network/game/client/ClientGameProtCategory.js';
import ClientGameMessage from '#/network/game/client/ClientGameMessage.js';

export const enum ReportAbuseReason {
    OFFENSIVE_LANGUAGE,  // 0
    ITEM_SCAMMING,  // 1
    PASSWORD_SCAMMING,  // 2
    BUG_ABUSE,  // 3
    STAFF_IMPERSONATION,  // 4
    ACCOUNT_SHARING,  // 5
    MACROING,  // 6
    MULTI_LOGGING,  // 7
    ENCOURAGING_BREAK_RULES,  // 8
    MISUSE_CUSTOMER_SUPPORT,  // 9
    ADVERTISING_WEBSITE,  // 10
    REAL_WORLD_TRADING  // 11
}

export default class ReportAbuse extends ClientGameMessage {
    category = ClientGameProtCategory.USER_EVENT;

    constructor(
        readonly offender: bigint,
        readonly reason: ReportAbuseReason,
        readonly moderatorMute: boolean
    ) {
        super();
    }
}
