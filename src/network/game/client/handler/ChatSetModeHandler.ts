import Player from '#/engine/entity/Player.js';
import World from '#/engine/World.js';
import MessageHandler from '#/network/game/client/handler/MessageHandler.js';
import ChatSetMode from '#/network/game/client/model/ChatSetMode.js';
import { LoggerEventType } from '#/server/logger/LoggerEventType.js';

const CHAT_MODE_MAP: Record<number, string> = {
    0: 'On',
    1: 'Friends',
    2: 'Off',
    3: 'Hide'
};

const CHAT_MODE_NAME_MAP: Partial<Record<keyof ChatSetMode, string>> = {
    publicChat: 'Public chat',
    privateChat: 'Private chat',
    tradeDuel: 'Trade/duel'
};

export default class ChatSetModeHandler extends MessageHandler<ChatSetMode> {
    handle(_message: ChatSetMode, player: Player): boolean {
        const changes: Partial<Record<keyof ChatSetMode, string>> = {};

        if (_message.publicChat !== player.publicChat) {
            changes.publicChat = CHAT_MODE_MAP[_message.publicChat] || String(_message.publicChat);
            player.publicChat = _message.publicChat;
        }
        if (_message.privateChat !== player.privateChat) {
            changes.privateChat = CHAT_MODE_MAP[_message.privateChat] || String(_message.privateChat);
            player.privateChat = _message.privateChat;
        }
        if (_message.tradeDuel !== player.tradeDuel) {
            changes.tradeDuel = CHAT_MODE_MAP[_message.tradeDuel] || String(_message.tradeDuel);
            player.tradeDuel = _message.tradeDuel;
        }

        if (Object.keys(changes).length > 0) {
            player.addSessionLog(LoggerEventType.MODERATOR,
                Object.entries(changes).map(([key, value]) =>
                    `Set ${CHAT_MODE_NAME_MAP[key as keyof ChatSetMode]} to '${value}'`).join('; ')
            );
        }

        World.sendPrivateChatModeToFriendsServer(player);

        return true;
    }
}
