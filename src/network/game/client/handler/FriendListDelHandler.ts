import Player from '#/engine/entity/Player.js';
import World from '#/engine/World.js';
import ClientGameMessageHandler from '#/network/game/client/ClientGameMessageHandler.js';
import FriendListDel from '#/network/game/client/model/FriendListDel.js';
import { fromBase37 } from '#/util/JString.js';

export default class FriendListDelHandler extends ClientGameMessageHandler<FriendListDel> {
    handle(message: FriendListDel, player: Player): boolean {
        if (player.socialProtect || fromBase37(message.username) === 'invalid_name') {
            return false;
        }

        World.removeFriend(player, message.username);
        player.socialProtect = true;
        return true;
    }
}
