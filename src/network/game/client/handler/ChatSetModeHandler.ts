import Player from '#/engine/entity/Player.js';
import World from '#/engine/World.js';
import ClientGameMessageHandler from '#/network/game/client/ClientGameMessageHandler.js';
import ChatSetMode from '#/network/game/client/model/ChatSetMode.js';

export default class ChatSetModeHandler extends ClientGameMessageHandler<ChatSetMode> {
    handle(_message: ChatSetMode, player: Player): boolean {
        player.publicChat = _message.publicChat;
        player.privateChat = _message.privateChat;
        player.tradeDuel = _message.tradeDuel;

        World.sendPrivateChatModeToFriendsServer(player);

        return true;
    }
}
