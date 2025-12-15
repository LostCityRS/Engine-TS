import Player from '#/engine/entity/Player.js';
import ClientGameMessageHandler from '#/network/game/client/ClientGameMessageHandler.js';
import FriendSetRank from '#/network/game/client/model/FriendSetRank.js';
import { fromBase37 } from '#/util/JString.js';

export default class FriendSetRankHandler extends ClientGameMessageHandler<FriendSetRank> {
    handle(message: FriendSetRank, player: Player): boolean {
        if (player.socialProtect ||fromBase37(message.username) === 'invalid_name')
        {
            return false;
        }

        return true;
    }
}
