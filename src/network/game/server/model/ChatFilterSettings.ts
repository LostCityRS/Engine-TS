import { ChatModePrivate, ChatModePublic, ChatModeTradeDuel } from '#/engine/entity/ChatModes.js';

import ServerGameMessage from '#/network/game/server/ServerGameMessage.js';

export default class ChatFilterSettings extends ServerGameMessage {
    constructor(
        readonly publicChat: ChatModePublic,
        readonly privateChat: ChatModePrivate,
        readonly tradeDuel: ChatModeTradeDuel
    ) {
        super();
    }
}
