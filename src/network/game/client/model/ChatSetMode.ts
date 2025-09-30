import ClientGameProtCategory from '#/network/game/client/ClientGameProtCategory.js';
import ClientGameMessage from '#/network/game/client/ClientGameMessage.js';
import { ChatModePrivate, ChatModePublic, ChatModeTradeDuel } from '#/engine/entity/ChatModes.js';

export default class ChatSetMode extends ClientGameMessage {
    category = ClientGameProtCategory.USER_EVENT;

    constructor(
        readonly publicChat: ChatModePublic,
        readonly privateChat: ChatModePrivate,
        readonly tradeDuel: ChatModeTradeDuel
    ) {
        super();
    }
}
