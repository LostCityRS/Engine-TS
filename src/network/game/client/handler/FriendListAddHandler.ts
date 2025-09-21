import Player from '#/engine/entity/Player.js';
import World from '#/engine/World.js';
import ClientGameMessageHandler from '#/network/game/client/ClientGameMessageHandler.js';
import FriendListAdd from '#/network/game/client/model/FriendListAdd.js';
import { fromBase37 } from '#/util/JString.js';

export default class FriendListAddHandler extends ClientGameMessageHandler<FriendListAdd> {
    handle(message: FriendListAdd, player: Player): boolean {
        if (player.socialProtect || fromBase37(message.username) === 'invalid_name') {
            return false;
        }

        World.addFriend(player, message.username);
        player.socialProtect = true;
        return true;
    }
}
