import Player from '#/engine/entity/Player.js';
import World from '#/engine/World.js';
import ClientGameMessageHandler from '#/network/game/client/ClientGameMessageHandler.js';
import IgnoreListAdd from '#/network/game/client/model/IgnoreListAdd.js';
import { fromBase37 } from '#/util/JString.js';

export default class IgnoreListAddHandler extends ClientGameMessageHandler<IgnoreListAdd> {
    handle(message: IgnoreListAdd, player: Player): boolean {
        if (player.socialProtect || fromBase37(message.username) === 'invalid_name') {
            return false;
        }

        World.addIgnore(player, message.username);
        player.socialProtect = true;
        return true;
    }
}
