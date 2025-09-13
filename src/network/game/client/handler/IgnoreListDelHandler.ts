import Player from '#/engine/entity/Player.js';
import World from '#/engine/World.js';
import ClientGameMessageHandler from '#/network/game/client/ClientGameMessageHandler.js';
import IgnoreListDel from '#/network/game/client/model/IgnoreListDel.js';
import { fromBase37 } from '#/util/JString.js';

export default class IgnoreListDelHandler extends ClientGameMessageHandler<IgnoreListDel> {
    handle(message: IgnoreListDel, player: Player): boolean {
        if (player.socialProtect || fromBase37(message.username) === 'invalid_name') {
            return false;
        }

        World.removeIgnore(player, message.username);
        player.socialProtect = true;
        return true;
    }
}
